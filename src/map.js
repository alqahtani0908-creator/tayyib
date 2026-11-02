// ───────────────────────── خريطة الأحياء ─────────────────────────
// خريطة متجهة خاصة بالرياض بلا مكتبات خارجية: حدود الأحياء والطرق الرئيسية من OpenStreetMap (docs/assets/riyadh-districts.json)
// تُرسم مرة واحدة كـ SVG، والتحريك والتكبير بتحويل واحد مع حركة ناعمة وقصور ذاتي. مواقع المساجد من روابط خرائط Google عند توفر الإحداثيات.
let districtGeo = null;
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
  return lat > 24.3 && lat < 25.3 && lng > 46.2 && lng < 47.3 ? [lat, lng] : null; // الرياض فقط
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
  return best; // [lng, lat]
}

// إسقاط بسيط مناسب لمدينة واحدة: خطوط الطول مضروبة في جيب تمام خط عرض الرياض
const PROJ_K = 1000, COS_LAT = Math.cos((24.7 * Math.PI) / 180), LNG0 = 46.3, LAT0 = 25.2;
const proj = ([lng, lat]) => [(lng - LNG0) * COS_LAT * PROJ_K, (LAT0 - lat) * PROJ_K];
const pathOf = (rings) => rings.map((ring) => "M" + ring.map((p) => proj(p).map((n) => n.toFixed(1)).join(",")).join("L") + "Z").join("");

const MAP_METRICS = [["total", "كل المساجد"], ["active", "قيد التشغيل"], ["progress", "تحت الإجراء"]];
const PROGRESS = new Set(["assigned", "data_done", "feasible", "study_done", "approved"]);
const mapState = { metric: "total", assoc: "", region: "", points: true, labels: true };

route("map", {
  title: "خريطة الأحياء",
  leave() { this.stop?.(); },
  async render(v) {
    v.innerHTML = `<div class="empty">${I.map}جارٍ تحميل الخريطة…</div>`;
    let mosques;
    try {
      const [, res] = await Promise.all([loadDistricts(), sb.rpc("map_data")]);
      if (res.error) throw res.error;
      mosques = res.data || [];
    } catch (e) { v.innerHTML = `<div class="empty">${I.alert}${esc(errMsg(e))}</div>`; return; }
    const r = role(), canOpen = r !== "viewer", dark = isDark();
    const C = dark
      ? { scale: ["#4d3b25", "#7a5f33", "#a8853f", "#cfae5a", "#ecd69c"] }
      : { scale: ["#efe1b8", "#dcbd77", "#b98d4e", "#86573a", "#563331"] };
    const ptColor = (st) => st === "active" ? (dark ? "#cfae5a" : "#a9831f") : PROGRESS.has(st) ? (dark ? "#4f86c6" : "#3b74a8") : st === "selected" ? (dark ? "#b04f45" : "#9a4a3a") : "#8e817e";
    if (mapState.assoc && !S.associations.some((a) => a.id === mapState.assoc)) mapState.assoc = "";

    // فهرس الأحياء: مضلع إن وُجد، وإلا نقطة مركز
    const geo = districtGeo, index = new Map();
    geo.polys.forEach((p, i) => distKeys(p.n).forEach((k) => index.has(k) || index.set(k, { kind: "poly", i, name: p.n })));
    geo.pts.forEach((p, i) => distKeys(p.n).forEach((k) => index.has(k) || index.set(k, { kind: "pt", i, name: p.n })));
    const centers = geo.polys.map((p) => proj(polyCenter(p.r.reduce((a, b) => (b.length > a.length ? b : a)))));
    const centerOf = (hit) => hit.kind === "pt" ? proj(geo.pts[hit.i].c) : centers[hit.i];
    const boxOf = (hit) => {
      if (hit.kind === "pt") { const [x, y] = centerOf(hit); return [x - 8, y - 8, x + 8, y + 8]; }
      let b = [Infinity, Infinity, -Infinity, -Infinity];
      geo.polys[hit.i].r.forEach((ring) => ring.forEach((p) => { const [x, y] = proj(p); b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]; }));
      return b;
    };
    // حدود الرياض (كل الأحياء) لتقييد التحريك
    let W = [Infinity, Infinity, -Infinity, -Infinity];
    geo.polys.forEach((p) => p.r.forEach((ring) => ring.forEach((pt) => { const [x, y] = proj(pt); W = [Math.min(W[0], x), Math.min(W[1], y), Math.max(W[2], x), Math.max(W[3], y)]; })));

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
        <div class="card map-box">
          <div class="rmap ${dark ? "dk" : ""}" id="rmap" tabindex="0" aria-label="خريطة أحياء الرياض">
            <svg class="rm-svg" id="rm-svg"><g id="rm-g">
              <g class="rm-cells">${geo.polys.map((p, i) => `<path d="${pathOf(p.r)}" data-c="${i}"/>`).join("")}</g>
              <g class="rm-roads">${(geo.roads || []).map((rd) => `<polyline class="${rd.k === 1 ? "m" : "t"}" points="${rd.p.map((p) => proj(p).map((n) => n.toFixed(1)).join(",")).join(" ")}"/>`).join("")}</g>
              <g class="rm-shade" id="rm-shade"></g>
              <g class="rm-dots" id="rm-dots"></g>
            </g></svg>
            <div class="rm-labels" id="rm-labels"></div>
            <div class="rm-tip" id="rm-tip" hidden></div>
            <div class="rm-zoom"><button data-z="in" aria-label="تكبير">+</button><button data-z="out" aria-label="تصغير">−</button><button data-z="home" aria-label="كل الرياض" title="كل الرياض">${svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>')}</button></div>
            <div class="map-legend" id="mp-legend"></div>
            <div class="rm-card" id="rm-card" hidden></div>
            <div class="rm-attr">© مساهمو OpenStreetMap</div>
          </div>
        </div>
        <div class="card map-side"><div class="hd"><h3>الأحياء</h3><span class="muted small right" id="mp-n"></span></div><div class="map-list" id="mp-list"></div></div>
      </div></div>`;

    const box = $("#rmap", v), svgEl = $("#rm-svg", v), G = $("#rm-g", v), labelsEl = $("#rm-labels", v), tip = $("#rm-tip", v), card = $("#rm-card", v);
    // ───── المشهد: تحويل واحد (k, x, y) مع حركة ناعمة نحو الهدف ─────
    const view = { k: 1, x: 0, y: 0 }, goal = { k: 1, x: 0, y: 0 };
    let raf = 0, size = { w: 1, h: 1 }, kMin = 1, labels = [];
    const fitBox = (b, pad = 40) => { const k = Math.min((size.w - pad * 2) / (b[2] - b[0] || 1), (size.h - pad * 2) / (b[3] - b[1] || 1)); return { k, x: size.w / 2 - ((b[0] + b[2]) / 2) * k, y: size.h / 2 - ((b[1] + b[3]) / 2) * k }; };
    const clampK = (k) => Math.max(kMin * 0.9, Math.min(kMin * 16, k));
    // لا يخرج المشهد عن الرياض: يبقى جزء من المدينة دائمًا داخل الإطار
    const clampXY = (t) => {
      const m = 80;
      t.x = Math.min(size.w - m - W[0] * t.k, Math.max(m - W[2] * t.k, t.x));
      t.y = Math.min(size.h - m - W[1] * t.k, Math.max(m - W[3] * t.k, t.y));
      return t;
    };
    const apply = () => {
      G.setAttribute("transform", `translate(${view.x.toFixed(2)},${view.y.toFixed(2)}) scale(${view.k.toFixed(5)})`);
      box.style.setProperty("--k", view.k);
      for (const l of labels) l.el.style.transform = `translate(${(l.x * view.k + view.x).toFixed(1)}px,${(l.y * view.k + view.y).toFixed(1)}px)`;
      if (card._at) placeCard();
    };
    const tick = () => {
      const e = 0.22;
      view.k += (goal.k - view.k) * e; view.x += (goal.x - view.x) * e; view.y += (goal.y - view.y) * e;
      const done = Math.abs(goal.k - view.k) < goal.k * 0.0005 && Math.abs(goal.x - view.x) < 0.3 && Math.abs(goal.y - view.y) < 0.3;
      if (done) Object.assign(view, goal);
      apply();
      raf = done ? 0 : requestAnimationFrame(tick);
      if (done) declutter();
    };
    const animate = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const setGoal = (t, instant = false) => { Object.assign(goal, clampXY({ ...t, k: clampK(t.k) })); if (instant) { Object.assign(view, goal); apply(); declutter(); } else animate(); };
    const zoomAt = (f, cx, cy) => { const k = clampK(goal.k * f), s = k / goal.k; setGoal({ k, x: cx - (cx - goal.x) * s, y: cy - (cy - goal.y) * s }); };
    const resize = () => {
      const rc = box.getBoundingClientRect(); const first = size.w === 1;
      size = { w: rc.width, h: rc.height };
      kMin = fitBox(W, 20).k;
      if (first) setGoal(this.home || fitBox(W, 20), true); else setGoal(goal, true);
    };
    const ro = new ResizeObserver(resize); ro.observe(box);
    this.stop = () => { ro.disconnect(); cancelAnimationFrame(raf); };

    // ───── التفاعل: سحب بإصبع/فأرة مع قصور ذاتي، عجلة، قرص بإصبعين، نقر مزدوج ─────
    const ptrs = new Map(); let drag = null, moved = 0, vel = { x: 0, y: 0 }, lastT = 0;
    const local = (e) => { const rc = box.getBoundingClientRect(); return [e.clientX - rc.left, e.clientY - rc.top]; };
    box.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".rm-zoom, .rm-card, .map-legend")) return;
      box.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, local(e));
      cancelAnimationFrame(raf); raf = 0; Object.assign(goal, view);
      moved = 0; vel = { x: 0, y: 0 }; lastT = performance.now();
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k, x: view.x, y: view.y, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; }
      else drag = { last: local(e) };
      box.classList.add("grabbing"); tip.hidden = true;
    });
    box.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return hover(e);
      ptrs.set(e.pointerId, local(e));
      if (drag?.pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const k = clampK(drag.k * d / drag.pinch), s = k / drag.k;
        Object.assign(view, clampXY({ k, x: c[0] - (drag.c[0] - drag.x) * s, y: c[1] - (drag.c[1] - drag.y) * s })); Object.assign(goal, view); apply(); moved += 10;
      } else if (drag?.last) {
        const p = local(e), dx = p[0] - drag.last[0], dy = p[1] - drag.last[1], now = performance.now(), dt = Math.max(1, now - lastT);
        drag.last = p; lastT = now; moved += Math.abs(dx) + Math.abs(dy);
        vel = { x: dx / dt * 16, y: dy / dt * 16 };
        Object.assign(view, clampXY({ k: view.k, x: view.x + dx, y: view.y + dy })); Object.assign(goal, view); apply();
      }
    });
    const end = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 1) { drag = { last: [...ptrs.values()][0] }; return; }
      if (ptrs.size) return;
      box.classList.remove("grabbing");
      if (moved < 6 && e.type === "pointerup") return pick(e);
      // قصور ذاتي بعد الإفلات
      const sp = Math.hypot(vel.x, vel.y), cap = Math.min(1, 28 / (sp || 1));
      if (sp > 1.5 && performance.now() - lastT < 80) setGoal({ k: view.k, x: view.x + vel.x * cap * 10, y: view.y + vel.y * cap * 10 });
      else declutter();
      drag = null;
    };
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
    box.addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(Math.exp(-Math.max(-50, Math.min(50, e.deltaY * (e.deltaMode ? 30 : 1))) * 0.005), x, y); }, { passive: false });
    box.addEventListener("dblclick", (e) => { if (e.target.closest(".rm-zoom, .rm-card")) return; const [x, y] = local(e); zoomAt(e.shiftKey ? 0.5 : 2, x, y); });
    box.addEventListener("pointerleave", () => { tip.hidden = true; hoverOff(); });
    box.addEventListener("keydown", (e) => {
      const s = 60, m = { ArrowLeft: [s, 0], ArrowRight: [-s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
      if (m) { e.preventDefault(); setGoal({ k: goal.k, x: goal.x + m[0], y: goal.y + m[1] }); }
      if (e.key === "+" || e.key === "=") zoomAt(1.6, size.w / 2, size.h / 2);
      if (e.key === "-") zoomAt(1 / 1.6, size.w / 2, size.h / 2);
    });
    $(".rm-zoom", v).onclick = (e) => {
      const z = e.target.closest("[data-z]")?.dataset.z; if (!z) return;
      if (z === "home") { closeCard(); setGoal(this.home || fitBox(W, 20)); } else zoomAt(z === "in" ? 1.8 : 1 / 1.8, size.w / 2, size.h / 2);
    };

    // ───── الطبقات حسب البيانات ─────
    let groups = new Map(), byCell = new Map(), selected = null, hovered = null;
    const hoverOff = () => { hovered?.classList.remove("hov"); hovered = null; };
    function hover(e) {
      if (e.pointerType === "touch") return;
      const t = e.target.closest("[data-g], [data-c], [data-m]");
      if (t !== hovered) { hoverOff(); if (t?.dataset.g) { hovered = t; t.classList.add("hov"); } }
      if (!t) { tip.hidden = true; return; }
      const [x, y] = local(e);
      const g = t.dataset.g ? groups.get(t.dataset.g) : null, m = t.dataset.m ? mosques.find((q) => q.id === t.dataset.m) : null;
      tip.innerHTML = g ? `<b>${esc(g.label)}</b><span>${fmtNum(g.n)} ${esc(MAP_METRICS.find((q) => q[0] === mapState.metric)[1])}</span>` : m ? `<b>${esc(m.name)}</b><span>${esc(STAGES[m.stage]?.s || "")}</span>` : `<span>${esc(geo.polys[+t.dataset.c].n.replace(/^حي\s+/, ""))}</span>`;
      tip.hidden = false; tip.style.transform = `translate(${x}px,${y - 14}px)`;
    }
    function pick(e) {
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-g], [data-m]");
      if (!t) return closeCard();
      if (t.dataset.m) return openMosque(mosques.find((q) => q.id === t.dataset.m));
      openGroup(groups.get(t.dataset.g), false);
    }
    const placeCard = () => {
      if (isMobile() || !card._at) return;
      const [wx, wy] = card._at, x = wx * view.k + view.x, y = wy * view.k + view.y;
      card.style.setProperty("--x", `${Math.max(150, Math.min(size.w - 150, x))}px`); card.style.setProperty("--y", `${Math.max(20, y)}px`);
      card.classList.toggle("below", y < 260);
    };
    const closeCard = () => { card.hidden = true; card._at = null; selected?.classList.remove("sel"); selected = null; $$(".mp-item.on", v).forEach((b) => b.classList.remove("on")); };
    const showCard = (html, at) => { card.innerHTML = `<button class="rm-x" aria-label="إغلاق">×</button>${html}`; card.hidden = false; card._at = at; placeCard(); $(".rm-x", card).onclick = closeCard; };
    function openGroup(g, fly) {
      if (!g) return;
      selected?.classList.remove("sel"); selected = $(`[data-g="${CSS.escape(g.key)}"]`, v); selected?.classList.add("sel");
      $$(".mp-item", v).forEach((b) => b.classList.toggle("on", b.dataset.k === g.key));
      showCard(`<div class="mp-pop"><div class="mp-pt"><b>${esc(g.label)}</b>${Object.keys(g.regions).length ? `<span class="chip plain">${Object.entries(g.regions).sort((a, b) => b[1] - a[1]).map(([k]) => regionName(k)).join("، ")}</span>` : ""}</div>
        <div class="mp-grid"><div><span>المساجد</span><b class="num">${fmtNum(g.all.length)}</b></div><div><span>قيد التشغيل</span><b class="num">${fmtNum(g.active)}</b></div><div><span>تحت الإجراء</span><b class="num">${fmtNum(g.progress)}</b></div></div>
        ${g.devices ? `<div class="mp-sub">${fmtNum(g.devices)} جهاز تعطير يعمل</div>` : ""}
        ${g.assocs.size ? `<div class="mp-sub">${I.org} ${[...g.assocs].map(esc).join("، ")}</div>` : ""}
        ${canOpen ? `<a class="btn sm primary" href="#/mosques?district=${encodeURIComponent([...g.raws][0])}">${I.mosque} عرض المساجد</a>` : ""}</div>`, centerOf(g.hit));
      if (!fly && isMobile()) { const [cx, cy] = centerOf(g.hit), sy = cy * view.k + view.y, lim = size.h - 300; if (sy > lim) setGoal({ k: goal.k, x: goal.x, y: goal.y - (sy - lim) - 30 }); }
      if (fly) { const b = boxOf(g.hit), t = fitBox(b, Math.min(size.w, size.h) * 0.28); t.k = Math.min(t.k, kMin * 7); const c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; setGoal({ k: t.k, x: size.w / 2 - c[0] * t.k, y: size.h / 2 - c[1] * t.k + (isMobile() ? -60 : 40) }); }
    }
    function openMosque(m) {
      if (!m) return;
      const c = coordsOf(m.map_url);
      showCard(`<div class="mp-pop"><b>${esc(m.name)}</b><div class="mp-sub">${esc(m.district || "")}${m.region ? ` • ${regionName(m.region)}` : ""}</div>${stageChip(m.stage)}${canOpen ? `<a class="btn sm primary" href="#/mosque/${m.id}">${I.mosque} صفحة المسجد</a>` : ""}</div>`, c ? proj([c[1], c[0]]) : null);
    }

    const declutter = () => {
      const kept = [];
      for (const l of labels) {
        l.el.classList.remove("off");
        const b = l.el.firstElementChild.getBoundingClientRect();
        if (!b.width) continue;
        const hit = kept.some((k) => b.left < k.right + 4 && b.right > k.left - 4 && b.top < k.bottom + 3 && b.bottom > k.top - 3);
        if (hit) l.el.classList.add("off"); else kept.push(b);
      }
    };

    const paint = () => {
      closeCard();
      const list = mosques.filter((m) => (!mapState.assoc || m.association_id === mapState.assoc) && (!mapState.region || m.region === mapState.region));
      const val = (m) => mapState.metric === "active" ? m.stage === "active" : mapState.metric === "progress" ? PROGRESS.has(m.stage) : true;
      groups = new Map();
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
      const mapped = all.filter((g) => g.hit && g.n), unmapped = all.filter((g) => !g.hit);
      const max = Math.max(1, ...all.map((g) => g.n)), step = Math.max(1, Math.ceil(max / 5));
      const cls = (n) => Math.min(4, Math.floor((n - 1) / step)), color = (n) => C.scale[cls(n)];

      // الأحياء الملوّنة: مضلعات بالتدرج أو دوائر للأحياء المعروفة بنقطة فقط
      $("#rm-shade", v).innerHTML = mapped.map((g) => g.hit.kind === "poly"
        ? `<path d="${pathOf(geo.polys[g.hit.i].r)}" data-g="${esc(g.key)}" style="--f:${color(g.n)}"/>`
        : (() => { const [x, y] = centerOf(g.hit); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" class="pt" data-g="${esc(g.key)}" style="--f:${color(g.n)};--r:${10 + cls(g.n) * 3}"/>`; })()).join("");
      // نقاط المساجد
      let located = 0;
      $("#rm-dots", v).innerHTML = list.map((m) => { const c = coordsOf(m.map_url); if (!c) return ""; located++; if (!mapState.points) return ""; const [x, y] = proj([c[1], c[0]]); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" data-m="${m.id}" style="--f:${ptColor(m.stage)}"/>`; }).join("");
      // أسماء الأحياء (طبقة HTML بحجم ثابت)
      labels = mapState.labels ? mapped.map((g) => { const [x, y] = centerOf(g.hit); const el = document.createElement("div"); el.className = "rm-l"; el.innerHTML = `<span>${esc(g.label)}<b>${fmtNum(g.n)}</b></span>`; return { x, y, el }; }) : [];
      labelsEl.replaceChildren(...labels.map((l) => l.el));

      const top = mapped[0];
      $("#mp-kpis", v).innerHTML = `
        <div class="card ms"><span>${I.map}</span><div><b class="num">${fmtNum(all.filter((g) => g.n).length)}</b><small>حيًّا نتواجد فيه</small></div></div>
        <div class="card ms"><span>${I.mosque}</span><div><b class="num">${fmtNum(list.filter(val).length)}</b><small>${esc(MAP_METRICS.find((x) => x[0] === mapState.metric)[1])}</small></div></div>
        <div class="card ms"><span>${I.sparkle}</span><div><b>${top ? esc(top.label) : "—"}</b><small>${top ? `الأعلى تواجدًا • ${fmtNum(top.n)} مسجد` : "الأعلى تواجدًا"}</small></div></div>
        <div class="card ms"><span>${I.check}</span><div><b class="num">${fmtNum(located)}</b><small>مسجدًا بموقع محدد</small></div></div>`;
      $("#mp-n", v).textContent = `${fmtNum(all.filter((g) => g.n).length)} حي`;
      const classes = [0, 1, 2, 3, 4].filter((c) => c * step + 1 <= max);
      $("#mp-legend", v).innerHTML = `<div class="lg-t">${esc(MAP_METRICS.find((x) => x[0] === mapState.metric)[1])} في الحي</div>
        <div class="lg-ramp">${classes.map((c) => `<span><i style="background:${C.scale[c]}"></i><bdi dir="ltr">${step === 1 ? c + 1 : `${c * step + 1}${c === classes.length - 1 ? "+" : `–${(c + 1) * step}`}`}</bdi></span>`).join("")}</div>
        ${mapState.points && located ? `<div class="lg-pts"><span><i style="background:${ptColor("active")}"></i>قيد التشغيل</span><span><i style="background:${ptColor("assigned")}"></i>تحت الإجراء</span><span><i style="background:${ptColor("selected")}"></i>بانتظار الإسناد</span></div>` : ""}`;
      $("#mp-list", v).innerHTML = mapped.length || unmapped.length ? mapped.map((g) => `<button class="mp-item" data-k="${esc(g.key)}">
          <span class="grow"><b>${esc(g.label)}</b><small>${fmtNum(g.active)} قيد التشغيل • ${fmtNum(g.progress)} تحت الإجراء</small></span>
          <span class="cnt num" style="--c:${color(g.n)}">${fmtNum(g.n)}</span></button>`).join("") +
        (unmapped.length ? `<div class="mp-unmapped"><div class="small"><b>${I.alert} أحياء لم تُحدَّد على الخريطة</b></div><div class="muted small">اسم الحي غير موجود في بيانات الخريطة، أو مكتوب بصيغة مختلفة</div>
          ${unmapped.map((g) => `<div class="mp-u"><span>${esc(g.label)}</span><span class="num">${fmtNum(g.all.length)}</span></div>`).join("")}</div>` : "")
        : `<div class="empty">${I.map}لا توجد مساجد بعد</div>`;
      if (list.length && !located) $("#mp-list", v).insertAdjacentHTML("beforeend", `<div class="hint" style="margin:10px 6px 0">لإظهار نقطة لكل مسجد، اجعل «رابط الموقع» يحتوي الإحداثيات (في خرائط Google: اضغط مطولًا على الموقع وانسخ الإحداثيات).</div>`);
      $$(".mp-item", v).forEach((b) => {
        b.onclick = () => { openGroup(groups.get(b.dataset.k), true); if (isMobile()) box.scrollIntoView({ behavior: "smooth", block: "center" }); };
        b.onmouseenter = () => $(`[data-g="${CSS.escape(b.dataset.k)}"]`, v)?.classList.add("hov");
        b.onmouseleave = () => $(`[data-g="${CSS.escape(b.dataset.k)}"]`, v)?.classList.remove("hov");
      });
      // الإطار الافتراضي: الأحياء التي نتواجد فيها، وإلا الرياض كلها
      let hb = null;
      mapped.forEach((g) => { const b = boxOf(g.hit); hb = hb ? [Math.min(hb[0], b[0]), Math.min(hb[1], b[1]), Math.max(hb[2], b[2]), Math.max(hb[3], b[3])] : b; });
      this.home = hb && size.w > 1 ? (() => { const t = fitBox(hb, 50); t.k = Math.min(t.k, kMin * 6); const c = [(hb[0] + hb[2]) / 2, (hb[1] + hb[3]) / 2]; return { k: t.k, x: size.w / 2 - c[0] * t.k, y: size.h / 2 - c[1] * t.k }; })() : null;
      if (size.w > 1) setGoal(this.home || fitBox(W, 20)); apply(); requestAnimationFrame(declutter);
    };
    resize(); paint();

    $("#mp-metric", v).onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; mapState.metric = b.dataset.k; $$("#mp-metric button", v).forEach((x) => x.classList.toggle("on", x === b)); paint(); };
    $("#mp-assoc", v)?.addEventListener("change", (e) => { mapState.assoc = e.target.value; paint(); });
    $("#mp-region", v).onchange = (e) => { mapState.region = e.target.value; paint(); };
    $("#mp-pts", v).onchange = (e) => { mapState.points = e.target.checked; paint(); };
    $("#mp-lbl", v).onchange = (e) => { mapState.labels = e.target.checked; paint(); };
  },
});
