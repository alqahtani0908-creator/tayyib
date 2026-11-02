// ───────────────────────── خريطة الأحياء ─────────────────────────
// خريطة متجهة بهوية المنصة: حدود الأحياء والطرق الرئيسية من OpenStreetMap (docs/assets/riyadh-districts.json)،
// ومواقع المساجد من روابط خرائط Google عند توفر الإحداثيات
const MAP_LIB = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
let leafletReady = null, districtGeo = null;
const loadLeaflet = () => leafletReady ||= new Promise((ok, fail) => {
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = MAP_LIB + "leaflet.min.css"; document.head.appendChild(css);
  const js = document.createElement("script"); js.src = MAP_LIB + "leaflet.min.js";
  js.onload = ok; js.onerror = () => { leafletReady = null; fail(new Error("تعذر تحميل مكتبة الخريطة — تحقق من الاتصال")); };
  document.head.appendChild(js);
});
const loadDistricts = async () => districtGeo ||= await fetch(ASSETS + "riyadh-districts.json").then((r) => { if (!r.ok) throw new Error("تعذر تحميل حدود الأحياء"); return r.json(); });

// توحيد أسماء الأحياء للمطابقة: «حي النرجس» = «النرجس» = «نرجس»، «الشفاء» = «الشفا»
const normDist = (s) => String(s || "").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .replace(/^\s*حي\s+/, "").replace(/\s+/g, " ").trim().replace(/اء$/, "ا");
const distKeys = (s) => { const n = normDist(s); return [n, n.replace(/^ال/, "")]; };

// إحداثيات من رابط الموقع: @lat,lng أو q=lat,lng أو !3dlat!4dlng أو نص «lat, lng»
function coordsOf(url) {
  let s = String(url || "");
  try { s = decodeURIComponent(s); } catch {}
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
    s.match(/[?&](?:q|query|ll|destination|center)=(?:loc:)?(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return lat > 16 && lat < 33 && lng > 34 && lng < 56 ? [lat, lng] : null;
}

// مركز بصري تقريبي للمضلع: أبعد نقطة داخلية عن الحدود ضمن شبكة بسيطة (أفضل من مركز الإطار للأشكال الطويلة)
function polyCenter(ring) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  ring.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  const inside = (x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const segDist = (x, y) => { let d = Infinity; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, ay] = ring[j], [bx, by] = ring[i]; const dx = bx - ax, dy = by - ay; const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0; d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return d; };
  let best = [(x0 + x1) / 2, (y0 + y1) / 2], bd = -1;
  for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
    const x = x0 + ((x1 - x0) * i) / 12, y = y0 + ((y1 - y0) * j) / 12;
    if (inside(x, y)) { const d = segDist(x, y); if (d > bd) { bd = d; best = [x, y]; } }
  }
  return [best[1], best[0]];
}

const MAP_METRICS = [["total", "كل المساجد"], ["active", "قيد التشغيل"], ["progress", "تحت الإجراء"]];
const PROGRESS = new Set(["assigned", "data_done", "feasible", "study_done", "approved"]);
const mapState = { metric: "total", assoc: "", region: "", points: true, labels: true };

route("map", {
  title: "خريطة الأحياء",
  leave() { this.map?.remove(); this.map = null; },
  async render(v) {
    v.innerHTML = `<div class="empty">${I.map}جارٍ تحميل الخريطة…</div>`;
    let mosques;
    try {
      const [, , res] = await Promise.all([loadLeaflet(), loadDistricts(), sb.rpc("map_data")]);
      if (res.error) throw res.error;
      mosques = res.data || [];
    } catch (e) { v.innerHTML = `<div class="empty">${I.alert}${esc(errMsg(e))}</div>`; return; }
    const r = role(), canOpen = r !== "viewer", dark = isDark();
    // ألوان الخريطة: أرض وأحياء هادئة، والتواجد بتدرج من الذهبي الفاتح إلى البني (يعكس في الداكن)
    const C = dark
      ? { cell: "#211917", edge: "#3a2c29", road1: "#5b4636", road2: "#3f312a", ring: "#15100f", scale: ["#4d3b25", "#7a5f33", "#a8853f", "#cfae5a", "#ecd69c"] }
      : { cell: "#fffdf8", edge: "#e6dccb", road1: "#dccaa5", road2: "#e9dcc4", ring: "#ffffff", scale: ["#efe1b8", "#dcbd77", "#b98d4e", "#86573a", "#563331"] };
    const ptColor = (st) => st === "active" ? (dark ? "#cfae5a" : "#a9831f") : PROGRESS.has(st) ? (dark ? "#4f86c6" : "#3b74a8") : st === "selected" ? (dark ? "#b04f45" : "#9a4a3a") : "#8e817e";
    if (mapState.assoc && !S.associations.some((a) => a.id === mapState.assoc)) mapState.assoc = "";

    // فهرس الأحياء: مضلع إن وُجد، وإلا نقطة مركز
    const index = new Map();
    districtGeo.polys.forEach((p, i) => distKeys(p.n).forEach((k) => index.has(k) || index.set(k, { kind: "poly", i, name: p.n })));
    districtGeo.pts.forEach((p, i) => distKeys(p.n).forEach((k) => index.has(k) || index.set(k, { kind: "pt", i, name: p.n })));
    const ll = (ring) => ring.map(([x, y]) => [y, x]);

    v.innerHTML = `<div class="mapv">
      <div class="card map-ctl">
        <div class="seg" id="mp-metric">${MAP_METRICS.map(([k, l]) => `<button data-k="${k}" class="${mapState.metric === k ? "on" : ""}">${l}</button>`).join("")}</div>
        ${r !== "association" && S.associations.length ? `<select class="input" id="mp-assoc" aria-label="الجمعية"><option value="">كل الجمعيات</option>${S.associations.map((a) => `<option value="${a.id}" ${mapState.assoc === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : ""}
        <select class="input" id="mp-region" aria-label="الجهة"><option value="">كل الجهات</option>${Object.entries(REGIONS).map(([k, l]) => `<option value="${k}" ${mapState.region === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        <div class="map-toggles">
          <label><input type="checkbox" id="mp-lbl" ${mapState.labels ? "checked" : ""}> أسماء الأحياء</label>
          <label><input type="checkbox" id="mp-pts" ${mapState.points ? "checked" : ""}> مواقع المساجد</label>
        </div>
      </div>
      <div class="map-stats" id="mp-kpis"></div>
      <div class="map-wrap">
        <div class="card map-box"><div id="lmap" class="${dark ? "dk" : ""}"></div><div class="map-legend" id="mp-legend"></div></div>
        <div class="card map-side"><div class="hd"><h3>الأحياء</h3><span class="muted small right" id="mp-n"></span></div><div class="map-list" id="mp-list"></div></div>
      </div></div>`;

    const map = this.map = L.map($("#lmap", v), { zoomControl: false, attributionControl: true, minZoom: 9, maxZoom: 17, zoomSnap: .25, wheelPxPerZoomLevel: 90 }).setView([24.72, 46.68], 11);
    L.control.zoom({ position: "topleft", zoomInTitle: "تكبير", zoomOutTitle: "تصغير" }).addTo(map);
    map.attributionControl.setPrefix(false).addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">مساهمو OpenStreetMap</a>');
    map.createPane("labels").style.zIndex = 650;
    // الطبقة الأساسية: كل الأحياء خلايا هادئة + الطرق الرئيسية للاتجاه
    const base = L.layerGroup().addTo(map);
    districtGeo.polys.forEach((p) => L.polygon(p.r.map(ll), { color: C.edge, weight: 1, fillColor: C.cell, fillOpacity: 1, interactive: true, bubblingMouseEvents: false })
      .bindTooltip(esc(p.n.replace(/^حي\s+/, "")), { direction: "top", sticky: true, className: "mp-tip quiet" }).addTo(base));
    (districtGeo.roads || []).forEach((rd) => L.polyline(ll(rd.p), { color: rd.k === 1 ? C.road1 : C.road2, weight: rd.k === 1 ? 2.4 : 1.4, interactive: false, lineCap: "round" }).addTo(base));
    const shade = L.layerGroup().addTo(map), labels = L.layerGroup().addTo(map), dots = L.layerGroup().addTo(map);
    const centerOf = (hit) => hit.kind === "pt" ? [districtGeo.pts[hit.i].c[1], districtGeo.pts[hit.i].c[0]] : polyCenter(districtGeo.polys[hit.i].r.reduce((a, b) => (b.length > a.length ? b : a)));
    let selected = null;
    // إخفاء الأسماء المتداخلة: الأحياء الأعلى تواجدًا أولًا (أُضيفت بالترتيب)
    const declutter = () => {
      const kept = [];
      $$(".dlbl span", v).forEach((el) => {
        el.style.visibility = "";
        const b = el.getBoundingClientRect();
        const hit = kept.some((k) => b.left < k.right + 4 && b.right > k.left - 4 && b.top < k.bottom + 2 && b.bottom > k.top - 2);
        if (hit) el.style.visibility = "hidden"; else kept.push(b);
      });
    };
    map.on("zoomend", declutter);

    const paint = () => {
      shade.clearLayers(); labels.clearLayers(); dots.clearLayers();
      const list = mosques.filter((m) => (!mapState.assoc || m.association_id === mapState.assoc) && (!mapState.region || m.region === mapState.region));
      const val = (m) => mapState.metric === "active" ? m.stage === "active" : mapState.metric === "progress" ? PROGRESS.has(m.stage) : true;
      // تجميع حسب الحي
      const groups = new Map();
      list.forEach((m) => {
        const raw = (m.district || "").trim() || "غير محدد";
        const hit = distKeys(raw).map((k) => index.get(k)).find(Boolean) || null;
        const key = hit ? hit.kind + hit.i : "?" + normDist(raw);
        const g = groups.get(key) || { key, hit, label: hit ? hit.name.replace(/^حي\s+/, "") : raw, raws: new Set(), all: [], n: 0, active: 0, progress: 0, devices: 0, assocs: new Set(), regions: {} };
        g.raws.add(raw); g.all.push(m);
        if (val(m)) g.n++;
        if (m.stage === "active") { g.active++; g.devices += m.devices_count || 0; }
        if (PROGRESS.has(m.stage)) g.progress++;
        if (m.association_id) g.assocs.add(assocName(m.association_id));
        if (m.region) g.regions[m.region] = (g.regions[m.region] || 0) + 1;
        groups.set(key, g);
      });
      const all = [...groups.values()].sort((a, b) => b.n - a.n || b.all.length - a.all.length);
      const max = Math.max(1, ...all.map((g) => g.n));
      const step = Math.max(1, Math.ceil(max / 5));
      const cls = (n) => Math.min(4, Math.floor((n - 1) / step));
      const color = (n) => C.scale[cls(n)];

      const popup = (g) => `<div class="mp-pop"><div class="mp-pt"><b>${esc(g.label)}</b>${Object.keys(g.regions).length ? `<span class="chip plain">${Object.entries(g.regions).sort((a, b) => b[1] - a[1]).map(([k]) => regionName(k)).join("، ")}</span>` : ""}<span class="chip ok">${fmtNum(g.all.length)} مسجد</span></div>
        <div class="mp-grid">
          <div><span>قيد التشغيل</span><b class="num">${fmtNum(g.active)}</b></div>
          <div><span>تحت الإجراء</span><b class="num">${fmtNum(g.progress)}</b></div>
          <div><span>أجهزة التعطير</span><b class="num">${fmtNum(g.devices)}</b></div>
        </div>
        ${g.assocs.size ? `<div class="mp-sub">${I.org} ${[...g.assocs].map(esc).join("، ")}</div>` : ""}
        ${canOpen ? `<a class="btn sm primary" href="#/mosques?district=${encodeURIComponent([...g.raws][0])}">${I.mosque} عرض المساجد</a>` : ""}</div>`;

      const layers = new Map();
      all.forEach((g) => {
        if (!g.hit || !g.n) return;
        let lay;
        const style = { color: C.ring, weight: 1.6, fillColor: color(g.n), fillOpacity: .92 };
        if (g.hit.kind === "poly") {
          lay = L.polygon(districtGeo.polys[g.hit.i].r.map(ll), style);
          lay.on("mouseover", () => lay.setStyle({ weight: 3, color: dark ? "#ecd69c" : "#563331" })).on("mouseout", () => lay !== selected && lay.setStyle({ weight: 1.6, color: C.ring }));
        } else {
          lay = L.circleMarker(centerOf(g.hit), { ...style, radius: 10 + cls(g.n) * 3, weight: 2 });
        }
        lay.bindPopup(popup(g), { maxWidth: 280, minWidth: 230, autoPanPadding: [40, 40] }).addTo(shade);
        lay.on("popupopen", () => { selected = lay; $$(".mp-item", v).forEach((b) => b.classList.toggle("on", b.dataset.k === g.key)); });
        lay.on("popupclose", () => { selected = null; lay.setStyle?.({ weight: g.hit.kind === "poly" ? 1.6 : 2, color: C.ring }); $$(".mp-item.on", v).forEach((b) => b.classList.remove("on")); });
        if (mapState.labels) {
          L.marker(centerOf(g.hit), { pane: "labels", interactive: false, keyboard: false,
            icon: L.divIcon({ className: "dlbl", html: `<span>${esc(g.label)}<b>${fmtNum(g.n)}</b></span>`, iconSize: null }) }).addTo(labels);
        }
        layers.set(g.key, lay);
      });

      // مواقع المساجد (عند توفر إحداثيات في الرابط)
      let located = 0;
      list.forEach((m) => {
        const c = coordsOf(m.map_url); if (!c) return;
        located++;
        if (!mapState.points) return;
        L.circleMarker(c, { radius: 5.5, color: C.ring, weight: 2, fillColor: ptColor(m.stage), fillOpacity: 1, pane: "markerPane" })
          .bindTooltip(esc(m.name), { direction: "top", offset: [0, -4], className: "mp-tip" })
          .bindPopup(`<div class="mp-pop"><b>${esc(m.name)}</b><div class="mp-sub">${esc(m.district || "")}</div>${stageChip(m.stage)}${canOpen ? `<a class="btn sm primary" href="#/mosque/${m.id}">${I.mosque} صفحة المسجد</a>` : ""}</div>`, { maxWidth: 240 })
          .addTo(dots);
      });

      const present = all.filter((g) => g.n);
      const mapped = present.filter((g) => g.hit);
      const unmapped = all.filter((g) => !g.hit);
      const top = mapped[0];
      $("#mp-kpis", v).innerHTML = `
        <div class="card ms"><span>${I.map}</span><div><b class="num">${fmtNum(present.length)}</b><small>حيًّا نتواجد فيه</small></div></div>
        <div class="card ms"><span>${I.mosque}</span><div><b class="num">${fmtNum(list.filter(val).length)}</b><small>${esc(MAP_METRICS.find((x) => x[0] === mapState.metric)[1])}</small></div></div>
        <div class="card ms"><span>${I.sparkle}</span><div><b>${top ? esc(top.label) : "—"}</b><small>${top ? `الأعلى تواجدًا • ${fmtNum(top.n)} مسجد` : "الأعلى تواجدًا"}</small></div></div>
        <div class="card ms"><span>${I.check}</span><div><b class="num">${fmtNum(located)}</b><small>مسجدًا بموقع محدد</small></div></div>`;
      $("#mp-n", v).textContent = `${fmtNum(present.length)} حي`;
      const classes = [0, 1, 2, 3, 4].filter((c) => c * step + 1 <= max);
      $("#mp-legend", v).innerHTML = `<div class="lg-t">${esc(MAP_METRICS.find((x) => x[0] === mapState.metric)[1])} في الحي</div>
        <div class="lg-ramp">${classes.map((c) => `<span><i style="background:${C.scale[c]}"></i><bdi dir="ltr">${step === 1 ? c + 1 : `${c * step + 1}${c === classes.length - 1 ? "+" : `–${(c + 1) * step}`}`}</bdi></span>`).join("")}</div>
        ${mapState.points && located ? `<div class="lg-pts"><span><i style="background:${ptColor("active")}"></i>قيد التشغيل</span><span><i style="background:${ptColor("assigned")}"></i>تحت الإجراء</span><span><i style="background:${ptColor("selected")}"></i>بانتظار الإسناد</span></div>` : ""}`;
      $("#mp-list", v).innerHTML = mapped.length || unmapped.length ? mapped.map((g, i) => `<button class="mp-item" data-k="${esc(g.key)}">
          <span class="grow"><b>${esc(g.label)}</b><small>${fmtNum(g.active)} قيد التشغيل • ${fmtNum(g.progress)} تحت الإجراء</small></span>
          <span class="cnt num" style="--c:${color(g.n)}">${fmtNum(g.n)}</span></button>`).join("") +
        (unmapped.length ? `<div class="mp-unmapped"><div class="small"><b>${I.alert} أحياء لم تُحدَّد على الخريطة</b></div><div class="muted small">اسم الحي غير موجود في بيانات الخريطة، أو مكتوب بصيغة مختلفة</div>
          ${unmapped.map((g) => `<div class="mp-u"><span>${esc(g.label)}</span><span class="num">${fmtNum(g.all.length)}</span></div>`).join("")}</div>` : "")
        : `<div class="empty">${I.map}لا توجد مساجد بعد</div>`;
      if (list.length && !located) $("#mp-list", v).insertAdjacentHTML("beforeend", `<div class="hint" style="margin:10px 6px 0">لإظهار نقطة لكل مسجد، اجعل «رابط الموقع» يحتوي الإحداثيات (في خرائط Google: اضغط مطولًا على الموقع وانسخ الإحداثيات).</div>`);
      $$(".mp-item", v).forEach((b) => {
        const lay = layers.get(b.dataset.k);
        b.onclick = () => {
          if (!lay) return;
          lay.getBounds ? map.flyToBounds(lay.getBounds(), { maxZoom: 14, padding: [60, 60], duration: .7 }) : map.flyTo(lay.getLatLng(), 14, { duration: .7 });
          map.once("moveend", () => lay.openPopup());
          if (isMobile()) $("#lmap", v).scrollIntoView({ behavior: "smooth", block: "center" });
        };
        b.onmouseenter = () => lay?.setStyle?.({ weight: 3, color: dark ? "#ecd69c" : "#563331" });
        b.onmouseleave = () => lay !== selected && lay?.setStyle?.({ weight: lay.getBounds ? 1.6 : 2, color: C.ring });
      });
      requestAnimationFrame(declutter);
      // تأطير الخريطة على الأحياء الموجودة
      if (layers.size && !this.fitted) { map.fitBounds(L.featureGroup([...layers.values()]).getBounds(), { padding: [50, 50], maxZoom: 13 }); this.fitted = true; }
      this.home = layers.size ? L.featureGroup([...layers.values()]).getBounds() : null;
    };
    this.fitted = false;
    paint();
    // زر إعادة التأطير
    const Home = L.Control.extend({ options: { position: "topleft" }, onAdd: () => {
      const a = L.DomUtil.create("a", "leaflet-bar mp-home"); a.href = "#"; a.title = "عرض كل الأحياء"; a.innerHTML = svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>');
      L.DomEvent.on(a, "click", (e) => { L.DomEvent.preventDefault(e); this.home && map.flyToBounds(this.home, { padding: [50, 50], maxZoom: 13, duration: .7 }); });
      return a;
    } });
    new Home().addTo(map);
    setTimeout(() => map.invalidateSize(), 50);

    $("#mp-metric", v).onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; mapState.metric = b.dataset.k; $$("#mp-metric button", v).forEach((x) => x.classList.toggle("on", x === b)); paint(); };
    $("#mp-assoc", v)?.addEventListener("change", (e) => { mapState.assoc = e.target.value; this.fitted = false; paint(); });
    $("#mp-region", v).onchange = (e) => { mapState.region = e.target.value; this.fitted = false; paint(); };
    $("#mp-pts", v).onchange = (e) => { mapState.points = e.target.checked; paint(); };
    $("#mp-lbl", v).onchange = (e) => { mapState.labels = e.target.checked; paint(); };
  },
});
