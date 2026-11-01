// ───────────────────────── خريطة الأحياء ─────────────────────────
// حدود الأحياء من OpenStreetMap (docs/assets/riyadh-districts.json)، ومواقع المساجد من روابط خرائط Google عند توفر الإحداثيات
const MAP_LIB = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
let leafletReady = null, districtGeo = null;
const loadLeaflet = () => leafletReady ||= new Promise((ok, fail) => {
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = MAP_LIB + "leaflet.min.css"; document.head.appendChild(css);
  const js = document.createElement("script"); js.src = MAP_LIB + "leaflet.min.js";
  js.onload = ok; js.onerror = () => { leafletReady = null; fail(new Error("تعذر تحميل مكتبة الخريطة — تحقق من الاتصال")); };
  document.head.appendChild(js);
});
const loadDistricts = async () => districtGeo ||= await fetch(ASSETS + "riyadh-districts.json").then((r) => { if (!r.ok) throw new Error("تعذر تحميل حدود الأحياء"); return r.json(); });

// توحيد أسماء الأحياء للمطابقة: «حي النرجس» = «النرجس» = «نرجس»
const normDist = (s) => String(s || "").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .replace(/^\s*حي\s+/, "").replace(/\s+/g, " ").trim().replace(/اء$/, "ا");
const distKeys = (s) => { const n = normDist(s); return [n, n.replace(/^ال/, "")]; };

// إحداثيات من رابط الموقع: @lat,lng أو q=lat,lng أو !3dlat!4dlng أو نص «lat, lng»
function coordsOf(url) {
  const s = decodeURIComponent(String(url || ""));
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
    s.match(/[?&](?:q|query|ll|destination|center)=(?:loc:)?(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return lat > 16 && lat < 33 && lng > 34 && lng < 56 ? [lat, lng] : null;
}

const MAP_METRICS = [["total", "كل المساجد"], ["active", "قيد التشغيل"], ["progress", "تحت الإجراء"]];
const PROGRESS = new Set(["assigned", "data_done", "feasible", "study_done", "approved"]);
const mapState = { metric: "total", assoc: "", points: true };

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
    const pal = dark ? ["#6a4034", "#80503f", "#97624f", "#ae7863", "#c48f7a", "#d6a895", "#e6c3b4"] : ["#cda796", "#b78874", "#a06c57", "#895643", "#714434", "#5a3428", "#40231b"];
    const ptColor = (st) => st === "active" ? (dark ? "#b0902a" : "#a9831f") : PROGRESS.has(st) ? (dark ? "#4f86c6" : "#3b74a8") : st === "selected" ? (dark ? "#b04f45" : "#9a4a3a") : "#8e817e";
    if (mapState.assoc && !S.associations.some((a) => a.id === mapState.assoc)) mapState.assoc = "";

    // فهرس الأحياء: مضلع إن وُجد، وإلا نقطة مركز
    const index = new Map();
    districtGeo.polys.forEach((p, i) => distKeys(p.n).forEach((k) => index.has(k) || index.set(k, { kind: "poly", i, name: p.n })));
    districtGeo.pts.forEach((p, i) => distKeys(p.n).forEach((k) => index.has(k) || index.set(k, { kind: "pt", i, name: p.n })));

    v.innerHTML = `<div class="mapv">
      <div class="card map-ctl">
        <div class="seg" id="mp-metric">${MAP_METRICS.map(([k, l]) => `<button data-k="${k}" class="${mapState.metric === k ? "on" : ""}">${l}</button>`).join("")}</div>
        ${r !== "association" && S.associations.length ? `<select class="input" id="mp-assoc" aria-label="الجمعية"><option value="">كل الجمعيات</option>${S.associations.map((a) => `<option value="${a.id}" ${mapState.assoc === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : ""}
        <label class="row small" style="gap:6px;cursor:pointer"><input type="checkbox" id="mp-pts" ${mapState.points ? "checked" : ""}> مواقع المساجد</label>
        <div class="map-kpis" id="mp-kpis"></div>
      </div>
      <div class="map-wrap">
        <div class="card map-box"><div id="lmap"></div><div class="map-legend" id="mp-legend"></div></div>
        <div class="card map-side"><div class="hd"><h3>الأحياء</h3><span class="muted small right" id="mp-n"></span></div><div class="map-list" id="mp-list"></div></div>
      </div></div>`;

    const map = this.map = L.map($("#lmap", v), { zoomControl: true, attributionControl: true, minZoom: 9, maxZoom: 18 }).setView([24.72, 46.68], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: "mp-tiles", attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">مساهمو OpenStreetMap</a>',
    }).addTo(map);
    map.attributionControl.setPrefix(false);
    const base = L.layerGroup().addTo(map), shade = L.layerGroup().addTo(map), dots = L.layerGroup().addTo(map);
    districtGeo.polys.forEach((p) => L.polygon(p.r.map((ring) => ring.map(([x, y]) => [y, x])), { color: dark ? "#5a4743" : "#cbbfb3", weight: .8, fillOpacity: 0, interactive: false }).addTo(base));
    const centerOf = (hit) => hit.kind === "pt" ? [districtGeo.pts[hit.i].c[1], districtGeo.pts[hit.i].c[0]] : null;

    const paint = () => {
      shade.clearLayers(); dots.clearLayers();
      const list = mosques.filter((m) => !mapState.assoc || m.association_id === mapState.assoc);
      const val = (m) => mapState.metric === "active" ? m.stage === "active" : mapState.metric === "progress" ? PROGRESS.has(m.stage) : true;
      // تجميع حسب الحي
      const groups = new Map();
      list.forEach((m) => {
        const raw = (m.district || "").trim() || "غير محدد";
        const hit = distKeys(raw).map((k) => index.get(k)).find(Boolean) || null;
        const key = hit ? hit.kind + hit.i : "?" + normDist(raw);
        const g = groups.get(key) || { key, hit, label: hit ? hit.name.replace(/^حي\s+/, "") : raw, raws: new Set(), all: [], n: 0, active: 0, progress: 0, devices: 0, assocs: new Set() };
        g.raws.add(raw); g.all.push(m);
        if (val(m)) g.n++;
        if (m.stage === "active") { g.active++; g.devices += m.devices_count || 0; }
        if (PROGRESS.has(m.stage)) g.progress++;
        if (m.association_id) g.assocs.add(assocName(m.association_id));
        groups.set(key, g);
      });
      const all = [...groups.values()].sort((a, b) => b.n - a.n || b.all.length - a.all.length);
      const max = Math.max(1, ...all.map((g) => g.n));
      const step = Math.max(1, Math.ceil(max / 5));
      const cls = (n) => Math.min(4, Math.floor((n - 1) / step));
      const color = (n) => pal[[0, 2, 3, 5, 6][cls(n)]];

      const popup = (g) => `<div class="mp-pop"><b>${esc(g.label)}</b>
        <div class="mp-row"><span>إجمالي المساجد</span><b class="num">${fmtNum(g.all.length)}</b></div>
        <div class="mp-row"><span>قيد التشغيل</span><b class="num">${fmtNum(g.active)}</b></div>
        <div class="mp-row"><span>تحت الإجراء</span><b class="num">${fmtNum(g.progress)}</b></div>
        ${g.devices ? `<div class="mp-row"><span>أجهزة التعطير</span><b class="num">${fmtNum(g.devices)}</b></div>` : ""}
        ${g.assocs.size ? `<div class="mp-sub">${[...g.assocs].map(esc).join("، ")}</div>` : ""}
        ${canOpen ? `<a class="btn sm" href="#/mosques?district=${encodeURIComponent([...g.raws][0])}">${I.mosque} عرض المساجد</a>` : ""}</div>`;

      const layers = new Map();
      all.forEach((g) => {
        if (!g.hit || !g.n) return;
        let lay;
        if (g.hit.kind === "poly") {
          lay = L.polygon(districtGeo.polys[g.hit.i].r.map((ring) => ring.map(([x, y]) => [y, x])), { color: color(g.n), weight: 1.5, fillColor: color(g.n), fillOpacity: .62 });
          lay.on("mouseover", () => lay.setStyle({ weight: 3, fillOpacity: .8 })).on("mouseout", () => lay.setStyle({ weight: 1.5, fillOpacity: .62 }));
        } else {
          lay = L.circleMarker(centerOf(g.hit), { radius: 9 + cls(g.n) * 3, color: dark ? "#15100f" : "#fff", weight: 2, fillColor: color(g.n), fillOpacity: .9 });
        }
        lay.bindTooltip(`${esc(g.label)} • ${fmtNum(g.n)}`, { direction: "top", sticky: g.hit.kind === "poly", className: "mp-tip" }).bindPopup(popup(g), { maxWidth: 260 }).addTo(shade);
        layers.set(g.key, lay);
      });

      // مواقع المساجد (عند توفر إحداثيات في الرابط)
      let located = 0;
      list.forEach((m) => {
        const c = coordsOf(m.map_url); if (!c) return;
        located++;
        if (!mapState.points) return;
        L.circleMarker(c, { radius: 5, color: dark ? "#15100f" : "#fff", weight: 1.5, fillColor: ptColor(m.stage), fillOpacity: 1 })
          .bindTooltip(esc(m.name), { direction: "top", className: "mp-tip" })
          .bindPopup(`<div class="mp-pop"><b>${esc(m.name)}</b><div class="mp-sub">${esc(m.district || "")}</div>${stageChip(m.stage)}${canOpen ? `<a class="btn sm" href="#/mosque/${m.id}">${I.mosque} صفحة المسجد</a>` : ""}</div>`, { maxWidth: 240 })
          .addTo(dots);
      });

      const present = all.filter((g) => g.n);
      const unmapped = all.filter((g) => !g.hit);
      $("#mp-kpis", v).innerHTML = `<span><b class="num">${fmtNum(present.length)}</b> حيًّا</span><span><b class="num">${fmtNum(list.filter(val).length)}</b> مسجدًا</span><span><b class="num">${fmtNum(located)}</b> بموقع محدد</span>`;
      $("#mp-n", v).textContent = `${fmtNum(present.length)} حي`;
      $("#mp-legend", v).innerHTML = `<div class="small"><b>${esc(MAP_METRICS.find((x) => x[0] === mapState.metric)[1])}</b> في الحي</div>
        <div class="lg-scale">${[0, 1, 2, 3, 4].filter((c) => c * step + 1 <= max).map((c) => `<span><i style="background:${pal[[0, 2, 3, 5, 6][c]]}"></i><bdi dir="ltr">${step === 1 ? c + 1 : `${c * step + 1}${c === 4 || (c + 1) * step >= max ? "+" : `–${(c + 1) * step}`}`}</bdi></span>`).join("")}</div>
        ${mapState.points && located ? `<div class="lg-pts"><span><i style="background:${ptColor("active")}"></i>قيد التشغيل</span><span><i style="background:${ptColor("assigned")}"></i>تحت الإجراء</span><span><i style="background:${ptColor("selected")}"></i>بانتظار الإسناد</span></div>` : ""}`;
      $("#mp-list", v).innerHTML = present.length || unmapped.length ? present.filter((g) => g.hit).map((g) => `<button class="mp-item" data-k="${esc(g.key)}">
          <span class="sw" style="background:${color(g.n)}"></span><span class="grow"><b>${esc(g.label)}</b><span class="mp-bar"><i style="width:${(g.n / max) * 100}%"></i></span></span>
          <span class="num mp-v">${fmtNum(g.n)}<small>${mapState.metric === "total" ? `${fmtNum(g.active)} يعمل` : `من ${fmtNum(g.all.length)}`}</small></span></button>`).join("") +
        (unmapped.length ? `<div class="mp-unmapped"><div class="small"><b>${I.alert} أحياء لم تُحدَّد على الخريطة</b></div><div class="muted small">تأكد من كتابة اسم الحي كما هو (مثل: النرجس، الملقا)</div>
          ${unmapped.map((g) => `<div class="mp-u"><span>${esc(g.label)}</span><span class="num">${fmtNum(g.all.length)}</span></div>`).join("")}</div>` : "")
        : `<div class="empty">${I.map}لا توجد مساجد بعد</div>`;
      if (list.length && !located) $("#mp-list", v).insertAdjacentHTML("beforeend", `<div class="hint" style="margin:10px 6px 0">لإظهار نقطة لكل مسجد، اجعل «رابط الموقع» يحتوي الإحداثيات (من خرائط Google: اضغط مطولًا على الموقع وانسخ الإحداثيات أو رابط المكان).</div>`);
      $$(".mp-item", v).forEach((b) => {
        const lay = layers.get(b.dataset.k);
        b.onclick = () => {
          if (!lay) return;
          lay.getBounds ? map.flyToBounds(lay.getBounds(), { maxZoom: 14, padding: [30, 30], duration: .6 }) : map.flyTo(lay.getLatLng(), 14, { duration: .6 });
          setTimeout(() => lay.openPopup(), 650);
          if (isMobile()) $("#lmap", v).scrollIntoView({ behavior: "smooth", block: "center" });
        };
        b.onmouseenter = () => lay?.setStyle?.({ weight: 3, fillOpacity: .85 });
        b.onmouseleave = () => lay?.setStyle?.({ weight: lay.getBounds ? 1.5 : 2, fillOpacity: lay.getBounds ? .62 : .9 });
      });
      // تأطير الخريطة على الأحياء الموجودة
      const fb = L.featureGroup([...layers.values()]);
      if (layers.size && !this.fitted) { map.fitBounds(fb.getBounds(), { padding: [30, 30], maxZoom: 13 }); this.fitted = true; }
    };
    this.fitted = false;
    paint();
    setTimeout(() => map.invalidateSize(), 50);

    $("#mp-metric", v).onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; mapState.metric = b.dataset.k; $$("#mp-metric button", v).forEach((x) => x.classList.toggle("on", x === b)); paint(); };
    $("#mp-assoc", v)?.addEventListener("change", (e) => { mapState.assoc = e.target.value; this.fitted = false; paint(); });
    $("#mp-pts", v).onchange = (e) => { mapState.points = e.target.checked; paint(); };
  },
});
