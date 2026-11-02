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

// حالات المساجد على الخريطة: كل حالة لون، والنقطة تمثل مسجدًا
const MAP_STATUS = [
  { k: "selected", l: "بانتظار الإسناد", st: ["selected"], c: "#9b8f88" },
  { k: "data", l: "البيانات والتواصل", st: ["assigned", "data_done"], c: "#4f86c6" },
  { k: "study", l: "الدراسة والاعتماد", st: ["feasible", "study_done"], c: "#d4893b" },
  { k: "install", l: "بانتظار التركيب", st: ["approved"], c: "#8d6cc4" },
  { k: "active", l: "قيد التشغيل", st: ["active"], c: "#2f9e6a" },
  { k: "stop", l: "متوقف", st: ["not_feasible", "suspended"], c: "#c4544a" },
];
const statusOf = (stage) => MAP_STATUS.find((s) => s.st.includes(stage)) || MAP_STATUS[0];
const PROGRESS = new Set(["assigned", "data_done", "feasible", "study_done", "approved"]);
const mapState = { off: new Set(), assoc: "", region: "", labels: true, shade: true };

// أرقام عشوائية ثابتة لكل مسجد (نفس الموقع التقريبي في كل مرة)
const hash32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const inRing = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

route("map", {
  title: "خريطة المشروع",
  leave() { this.stop?.(); },
  async render(v) {
    v.innerHTML = `<div class="empty">${I.map}جارٍ تحميل الخريطة…</div>`;
    let mosques;
    try {
      const [, res] = await Promise.all([loadDistricts(), sb.rpc("map_data")]);
      if (res.error) throw res.error;
      mosques = res.data || [];
    } catch (e) { v.innerHTML = `<div class="empty">${I.alert}${esc(errMsg(e))}</div>`; return; }
    const r = role(), canOpen = r !== "viewer", dark = isDark(), mobile = isMobile();
    if (mapState.assoc && !S.associations.some((a) => a.id === mapState.assoc)) mapState.assoc = "";

    // ───── الجغرافيا: فهرس الأحياء وحدود الرياض ─────
    const geo = districtGeo, index = new Map();
    geo.polys.forEach((p, i) => distKeys(p.n).forEach((k) => index.has(k) || index.set(k, { kind: "poly", i, name: p.n })));
    geo.pts.forEach((p, i) => distKeys(p.n).forEach((k) => index.has(k) || index.set(k, { kind: "pt", i, name: p.n })));
    const rings = geo.polys.map((p) => p.r.reduce((a, b) => (b.length > a.length ? b : a)).map(proj));
    const centers = geo.polys.map((p) => proj(polyCenter(p.r.reduce((a, b) => (b.length > a.length ? b : a)))));
    const centerOf = (hit) => hit.kind === "pt" ? proj(geo.pts[hit.i].c) : centers[hit.i];
    const bbox = (pts) => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
    const boxOf = (hit) => { if (hit.kind === "pt") { const [x, y] = centerOf(hit); return [x - 10, y - 10, x + 10, y + 10]; } return bbox(rings[hit.i]); };
    const W = bbox(rings.flat());
    const hitOf = (m) => distKeys((m.district || "").trim()).map((k) => index.get(k)).find(Boolean) || null;

    // ───── موقع كل مسجد: دقيق من الرابط، وإلا تقريبي موزّع داخل حدود حيّه ─────
    const placed = new Map(), byHit = new Map();
    mosques.forEach((m) => { const h = hitOf(m); m._hit = h; if (h) { const key = h.kind + h.i; (byHit.get(key) || byHit.set(key, []).get(key)).push(m); } });
    mosques.forEach((m) => { const c = coordsOf(m.map_url); if (c) placed.set(m.id, { xy: proj([c[1], c[0]]), exact: true }); });
    for (const [, list] of byHit) {
      const pts = list.filter((m) => placed.has(m.id)).map((m) => placed.get(m.id).xy);
      list.filter((m) => !placed.has(m.id)).sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((m) => {
        const h = m._hit, rnd = rng(hash32(m.id));
        let best = centerOf(h), bd = -1;
        if (h.kind === "poly") {
          const ring = rings[h.i], b = bbox(ring);
          for (let t = 0, got = 0; t < 120 && got < 14; t++) {
            const x = b[0] + (b[2] - b[0]) * rnd(), y = b[1] + (b[3] - b[1]) * rnd();
            if (!inRing(ring, x, y)) continue; got++;
            const d = pts.length ? Math.min(...pts.map(([px, py]) => Math.hypot(px - x, py - y))) : 1 + rnd();
            if (d > bd) { bd = d; best = [x, y]; }
          }
        } else {
          const [cx, cy] = best;
          for (let t = 0; t < 14; t++) { const a = rnd() * Math.PI * 2, rr = 2 + rnd() * 7, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; const d = pts.length ? Math.min(...pts.map(([px, py]) => Math.hypot(px - x, py - y))) : 1 + rnd(); if (d > bd) { bd = d; best = [x, y]; } }
        }
        pts.push(best); placed.set(m.id, { xy: best, exact: false });
      });
    }
    const now = Date.now(), overdue = (m) => m.stage === "active" && m.next_refill_at && new Date(m.next_refill_at) < now;

    v.innerHTML = `<div class="gmap ${dark ? "dk" : ""}">
      <div class="rmap ${dark ? "dk" : ""}" id="rmap" tabindex="0" aria-label="خريطة مساجد المشروع في الرياض">
        <svg class="rm-svg"><defs><radialGradient id="gm-glow"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><g id="rm-g">
          <g class="rm-cells">${geo.polys.map((p, i) => `<path d="${pathOf(p.r)}" data-c="${i}"/>`).join("")}</g>
          <g class="rm-roads">${(geo.roads || []).map((rd) => `<polyline class="${rd.k === 1 ? "m" : "t"}" points="${rd.p.map((p) => proj(p).map((n) => n.toFixed(1)).join(",")).join(" ")}"/>`).join("")}</g>
          <g class="rm-shade" id="rm-shade"></g>
          <g class="rm-dots" id="rm-dots"></g>
        </g></svg>
        <div class="rm-labels" id="rm-labels"></div>
        <div class="rm-tip" id="rm-tip" hidden></div>
        <div class="gm-bar glass">
          ${r !== "association" && S.associations.length ? `<select class="input" id="mp-assoc" aria-label="الجمعية"><option value="">كل الجمعيات</option>${S.associations.map((a) => `<option value="${a.id}" ${mapState.assoc === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : ""}
          <select class="input" id="mp-region" aria-label="الجهة"><option value="">كل الجهات</option>${Object.entries(REGIONS).map(([k, l]) => `<option value="${k}" ${mapState.region === k ? "selected" : ""}>${l}</option>`).join("")}</select>
          <label class="gm-tg"><input type="checkbox" id="mp-lbl" ${mapState.labels ? "checked" : ""}><span>الأسماء</span></label>
          <label class="gm-tg"><input type="checkbox" id="mp-shade" ${mapState.shade ? "checked" : ""}><span>تظليل الأحياء</span></label>
        </div>
        <div class="rm-zoom glass"><button data-z="in" aria-label="تكبير">+</button><button data-z="out" aria-label="تصغير">−</button><button data-z="home" aria-label="كل المساجد" title="كل المساجد">${svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>')}</button></div>
        <aside class="gm-panel glass ${mobile ? "" : "open"}" id="gm-panel">
          <button class="gm-handle" id="gm-handle" aria-label="عرض التفاصيل"><i></i></button>
          <div class="gm-head"><div><b>مساجد المشروع</b><span>الرياض</span></div><div class="gm-kpis" id="gm-kpis"></div></div>
          <div class="gm-sec"><div class="gm-t"><span>الحالات</span><button id="gm-all" hidden>إظهار الكل</button></div><div class="gm-status" id="gm-status"></div></div>
          <div class="gm-sec gm-grow"><div class="gm-t"><span>الأحياء</span><small id="mp-n"></small></div><div class="gm-list" id="mp-list"></div></div>
          <div class="gm-note" id="gm-note"></div>
        </aside>
        <div class="rm-card glass" id="rm-card" hidden></div>
        <div class="rm-attr">© مساهمو OpenStreetMap</div>
      </div></div>`;

    const box = $("#rmap", v), G = $("#rm-g", v), labelsEl = $("#rm-labels", v), tip = $("#rm-tip", v), card = $("#rm-card", v), panel = $("#gm-panel", v);
    // ───── المشهد: تحويل واحد (k, x, y) مع حركة ناعمة نحو الهدف ─────
    const view = { k: 1, x: 0, y: 0 }, goal = { k: 1, x: 0, y: 0 };
    let raf = 0, size = { w: 1, h: 1 }, kMin = 1, labels = [];
    // المساحة المرئية فعلًا (يمين اللوحة الجانبية على الكمبيوتر)
    const vis = () => { const p = !isMobile() && panel.classList.contains("open") ? panel.offsetWidth + 24 : 0; return { l: 0, r: size.w - p, t: isMobile() ? 60 : 70, b: size.h - (isMobile() ? 120 : 0) }; };
    const fitBox = (b, pad = 40) => { const a = vis(), w = a.r - a.l - pad * 2, h = a.b - a.t - pad * 2; const k = Math.min(w / (b[2] - b[0] || 1), h / (b[3] - b[1] || 1)); return { k, x: (a.l + a.r) / 2 - ((b[0] + b[2]) / 2) * k, y: (a.t + a.b) / 2 - ((b[1] + b[3]) / 2) * k }; };
    const clampK = (k) => Math.max(kMin * 0.85, Math.min(kMin * 18, k));
    const clampXY = (t) => { const m = 90; t.x = Math.min(size.w - m - W[0] * t.k, Math.max(m - W[2] * t.k, t.x)); t.y = Math.min(size.h - m - W[1] * t.k, Math.max(m - W[3] * t.k, t.y)); return t; };
    const apply = () => {
      G.setAttribute("transform", `translate(${view.x.toFixed(2)},${view.y.toFixed(2)}) scale(${view.k.toFixed(5)})`);
      box.style.setProperty("--k", view.k);
      box.classList.toggle("far", view.k < kMin * 2.2);
      for (const l of labels) l.el.style.transform = `translate(${(l.x * view.k + view.x).toFixed(1)}px,${(l.y * view.k + view.y).toFixed(1)}px)`;
      if (card._at) placeCard();
    };
    const tick = () => {
      const e = 0.2;
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
    const resize = () => { const rc = box.getBoundingClientRect(), first = size.w === 1; size = { w: rc.width, h: rc.height }; kMin = fitBox(W, 10).k; setGoal(first ? (this.home?.() || fitBox(W, 10)) : goal, true); };
    const ro = new ResizeObserver(resize); ro.observe(box);
    this.stop = () => { ro.disconnect(); cancelAnimationFrame(raf); };

    // ───── التفاعل: سحب مع قصور ذاتي، عجلة، قرص بإصبعين، نقر مزدوج، لوحة المفاتيح ─────
    const ptrs = new Map(); let drag = null, moved = 0, vel = { x: 0, y: 0 }, lastT = 0;
    const local = (e) => { const rc = box.getBoundingClientRect(); return [e.clientX - rc.left, e.clientY - rc.top]; };
    const onUi = (e) => e.target.closest(".glass");
    box.addEventListener("pointerdown", (e) => {
      if (onUi(e)) return;
      box.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, local(e));
      cancelAnimationFrame(raf); raf = 0; Object.assign(goal, view);
      moved = 0; vel = { x: 0, y: 0 }; lastT = performance.now();
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k, x: view.x, y: view.y, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; }
      else drag = { last: local(e) };
      box.classList.add("grabbing"); tip.hidden = true;
    });
    box.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return onUi(e) ? (tip.hidden = true) : hover(e);
      ptrs.set(e.pointerId, local(e));
      if (drag?.pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const k = clampK(drag.k * d / drag.pinch), s = k / drag.k;
        Object.assign(view, clampXY({ k, x: drag.c[0] - (drag.c[0] - drag.x) * s, y: drag.c[1] - (drag.c[1] - drag.y) * s })); Object.assign(goal, view); apply(); moved += 10;
      } else if (drag?.last) {
        const p = local(e), dx = p[0] - drag.last[0], dy = p[1] - drag.last[1], t = performance.now(), dt = Math.max(1, t - lastT);
        drag.last = p; lastT = t; moved += Math.abs(dx) + Math.abs(dy); vel = { x: dx / dt * 16, y: dy / dt * 16 };
        Object.assign(view, clampXY({ k: view.k, x: view.x + dx, y: view.y + dy })); Object.assign(goal, view); apply();
      }
    });
    const end = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 1) { drag = { last: [...ptrs.values()][0] }; return; }
      if (ptrs.size) return;
      box.classList.remove("grabbing");
      if (moved < 6 && e.type === "pointerup") { drag = null; return pick(e); }
      const sp = Math.hypot(vel.x, vel.y), cap = Math.min(1, 28 / (sp || 1));
      if (sp > 1.5 && performance.now() - lastT < 80) setGoal({ k: view.k, x: view.x + vel.x * cap * 10, y: view.y + vel.y * cap * 10 }); else declutter();
      drag = null;
    };
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
    box.addEventListener("wheel", (e) => { if (onUi(e)) return; e.preventDefault(); const [x, y] = local(e); zoomAt(Math.exp(-Math.max(-50, Math.min(50, e.deltaY * (e.deltaMode ? 30 : 1))) * 0.005), x, y); }, { passive: false });
    box.addEventListener("dblclick", (e) => { if (onUi(e)) return; const [x, y] = local(e); zoomAt(e.shiftKey ? 0.5 : 2, x, y); });
    box.addEventListener("pointerleave", () => { tip.hidden = true; });
    box.addEventListener("keydown", (e) => {
      if (e.target.closest("select, input")) return;
      const s = 60, d = { ArrowLeft: [s, 0], ArrowRight: [-s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
      if (d) { e.preventDefault(); setGoal({ k: goal.k, x: goal.x + d[0], y: goal.y + d[1] }); }
      if (e.key === "+" || e.key === "=") zoomAt(1.6, size.w / 2, size.h / 2);
      if (e.key === "-") zoomAt(1 / 1.6, size.w / 2, size.h / 2);
      if (e.key === "Escape") closeCard();
    });
    $(".rm-zoom", v).onclick = (e) => { const z = e.target.closest("[data-z]")?.dataset.z; if (!z) return; if (z === "home") { closeCard(); setGoal(this.home?.() || fitBox(W, 10)); } else zoomAt(z === "in" ? 1.8 : 1 / 1.8, size.w / 2, size.h / 2); };
    $("#gm-handle", v).onclick = () => { panel.classList.toggle("open"); };

    // ───── التلميح والبطاقة ─────
    let groups = new Map(), selected = null, shown = [];
    function hover(e) {
      if (e.pointerType === "touch") return;
      const t = e.target.closest("[data-m], [data-g], [data-c]");
      if (!t) { tip.hidden = true; return; }
      const [x, y] = local(e);
      const m = t.dataset.m && mosques.find((q) => q.id === t.dataset.m), g = t.dataset.g && groups.get(t.dataset.g);
      tip.innerHTML = m ? `<b>${esc(m.name)}</b><span><i style="background:${statusOf(m.stage).c}"></i>${esc(STAGES[m.stage]?.s || "")}${overdue(m) ? " • تعبئة متأخرة" : ""}</span>`
        : g ? `<b>${esc(g.label)}</b><span>${fmtNum(g.all.length)} مسجد</span>` : `<span>${esc(geo.polys[+t.dataset.c].n.replace(/^حي\s+/, ""))}</span>`;
      tip.hidden = false; tip.style.transform = `translate(${x}px,${y - 14}px)`;
    }
    function pick(e) {
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-m], [data-g]");
      if (!t) return closeCard();
      if (t.dataset.m) return openMosque(mosques.find((q) => q.id === t.dataset.m));
      openGroup(groups.get(t.dataset.g), false);
    }
    const placeCard = () => {
      if (isMobile() || !card._at) return;
      const [wx, wy] = card._at, x = wx * view.k + view.x, y = wy * view.k + view.y, a = vis();
      card.style.setProperty("--x", `${Math.max(150, Math.min(a.r - 150, x))}px`); card.style.setProperty("--y", `${y}px`);
      card.classList.toggle("below", y - card.offsetHeight - 24 < a.t);
    };
    const closeCard = () => { card.hidden = true; card._at = null; selected?.classList.remove("sel"); selected = null; $$(".gm-item.on", v).forEach((b) => b.classList.remove("on")); };
    const showCard = (html, at) => {
      card.innerHTML = `<button class="rm-x" aria-label="إغلاق">×</button>${html}`; card.hidden = false; card._at = at; placeCard(); $(".rm-x", card).onclick = closeCard;
      // على الجوال البطاقة أسفل الخريطة: نحرّك المشهد ليبقى الموقع ظاهرًا فوقها
      if (isMobile() && at) { const top = card.offsetTop - 30, sy = at[1] * goal.k + goal.y; if (sy > top && top > 90) setGoal({ k: goal.k, x: goal.x, y: goal.y - (sy - top) }); }
    };
    const mix = (list) => MAP_STATUS.map((s) => [s, list.filter((m) => s.st.includes(m.stage)).length]).filter(([, n]) => n);
    const mixBar = (list) => `<div class="gm-mix">${mix(list).map(([s, n]) => `<i style="flex:${n};background:${s.c}" title="${s.l}: ${n}"></i>`).join("")}</div>`;
    function openGroup(g, fly) {
      if (!g) return;
      if (isMobile()) panel.classList.remove("open");
      selected?.classList.remove("sel"); selected = $(`[data-g="${CSS.escape(g.key)}"]`, v); selected?.classList.add("sel");
      $$(".gm-item", v).forEach((b) => b.classList.toggle("on", b.dataset.k === g.key));
      showCard(`<div class="mp-pop"><div class="mp-pt"><b>${esc(g.label)}</b>${Object.keys(g.regions).length ? `<span class="chip plain">${Object.entries(g.regions).sort((a, b) => b[1] - a[1]).map(([k]) => regionName(k)).join("، ")}</span>` : ""}</div>
        ${mixBar(g.all)}
        <div class="gm-legs">${mix(g.all).map(([s, n]) => `<span><i style="background:${s.c}"></i>${s.l}<b>${fmtNum(n)}</b></span>`).join("")}</div>
        ${g.devices ? `<div class="mp-sub">${fmtNum(g.devices)} جهاز تعطير يعمل</div>` : ""}
        ${g.assocs.size ? `<div class="mp-sub">${I.org} ${[...g.assocs].map(esc).join("، ")}</div>` : ""}
        ${canOpen ? `<a class="btn sm primary" href="#/mosques?district=${encodeURIComponent([...g.raws][0])}">${I.mosque} مساجد الحي (${fmtNum(g.all.length)})</a>` : ""}</div>`, centerOf(g.hit));
      if (fly) { const b = boxOf(g.hit), a = vis(), t = fitBox(b, Math.min(a.r - a.l, a.b - a.t) * 0.25); t.k = Math.min(t.k, kMin * 8); const c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; setGoal({ k: t.k, x: (a.l + a.r) / 2 - c[0] * t.k, y: (a.t + a.b) / 2 - c[1] * t.k + (isMobile() ? -70 : 60) }); }
    }
    function openMosque(m) {
      if (!m) return;
      if (isMobile()) panel.classList.remove("open");
      const p = placed.get(m.id), s = statusOf(m.stage);
      showCard(`<div class="mp-pop"><div class="gm-mh"><i style="background:${s.c}"></i><div><b>${esc(m.name)}</b><div class="mp-sub"><span class="ltr">${esc(m.code || "")}</span> • ${esc(m.district || "")}${m.region ? ` • ${regionName(m.region)}` : ""}</div></div></div>
        <div class="gm-kv"><span>الحالة</span><b style="color:${s.c}">${esc(STAGES[m.stage]?.l || m.stage)}</b></div>
        ${m.association_id ? `<div class="gm-kv"><span>الجمعية</span><b>${esc(assocName(m.association_id))}</b></div>` : ""}
        ${m.devices_count ? `<div class="gm-kv"><span>أجهزة التعطير</span><b>${fmtNum(m.devices_count)}</b></div>` : ""}
        ${m.next_refill_at ? `<div class="gm-kv"><span>التعبئة القادمة</span><b class="${overdue(m) ? "bad" : ""}">${fmtDate(m.next_refill_at)}${overdue(m) ? " — متأخرة" : ""}</b></div>` : ""}
        <div class="mp-sub">${p?.exact ? "● موقع دقيق من رابط الخرائط" : "◌ موقع تقريبي داخل الحي — أضف رابطًا بالإحداثيات لموقع دقيق"}</div>
        ${canOpen ? `<a class="btn sm primary" href="#/mosque/${m.id}">${I.mosque} صفحة المسجد</a>` : ""}</div>`, p?.xy || null);
      $$(".rm-dots .sel", v).forEach((x) => x.classList.remove("sel")); $(`[data-m="${m.id}"]`, v)?.classList.add("sel");
    }

    const declutter = () => {
      const kept = [];
      for (const l of labels) {
        l.el.classList.remove("off");
        const b = l.el.firstElementChild.getBoundingClientRect(); if (!b.width) continue;
        if (kept.some((k) => b.left < k.right + 4 && b.right > k.left - 4 && b.top < k.bottom + 3 && b.bottom > k.top - 3)) l.el.classList.add("off"); else kept.push(b);
      }
    };

    const paint = (refit = true) => {
      closeCard();
      const base = mosques.filter((m) => (!mapState.assoc || m.association_id === mapState.assoc) && (!mapState.region || m.region === mapState.region));
      shown = base.filter((m) => !mapState.off.has(statusOf(m.stage).k));
      groups = new Map();
      shown.forEach((m) => {
        const raw = (m.district || "").trim() || "غير محدد", hit = m._hit, key = hit ? hit.kind + hit.i : "?" + normDist(raw);
        const g = groups.get(key) || { key, hit, label: hit ? hit.name.replace(/^حي\s+/, "") : raw, raws: new Set(), all: [], active: 0, devices: 0, assocs: new Set(), regions: {} };
        g.raws.add(raw); g.all.push(m);
        if (m.stage === "active") { g.active++; g.devices += m.devices_count || 0; }
        if (m.association_id) g.assocs.add(assocName(m.association_id));
        if (m.region) g.regions[m.region] = (g.regions[m.region] || 0) + 1;
        groups.set(key, g);
      });
      const all = [...groups.values()].sort((a, b) => b.all.length - a.all.length);
      const mapped = all.filter((g) => g.hit), unmapped = all.filter((g) => !g.hit);
      const max = Math.max(1, ...mapped.map((g) => g.all.length));
      // تظليل خفيف للأحياء التي نتواجد فيها
      $("#rm-shade", v).innerHTML = mapState.shade ? mapped.map((g) => g.hit.kind === "poly"
        ? `<path d="${pathOf(geo.polys[g.hit.i].r)}" data-g="${esc(g.key)}" style="--o:${(0.14 + 0.32 * g.all.length / max).toFixed(2)}"/>` : "").join("") : "";
      // نقاط المساجد حسب الحالة (الدقيقة بهالة، والتقريبية بحلقة)
      const order = (m) => MAP_STATUS.indexOf(statusOf(m.stage));
      $("#rm-dots", v).innerHTML = shown.filter((m) => placed.has(m.id)).sort((a, b) => order(a) - order(b)).map((m) => {
        const p = placed.get(m.id), [x, y] = p.xy, s = statusOf(m.stage);
        return `<g class="pt${p.exact ? "" : " ap"}${overdue(m) ? " od" : ""}" data-m="${m.id}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" style="--c:${s.c}">${overdue(m) ? `<circle class="pulse"/>` : ""}<circle class="halo"/><circle class="core"/></g>`;
      }).join("");
      // أسماء الأحياء
      labels = mapState.labels ? mapped.map((g) => { const [x, y] = centerOf(g.hit); const el = document.createElement("div"); el.className = "rm-l"; el.innerHTML = `<span>${esc(g.label)}<b>${fmtNum(g.all.length)}</b></span>`; return { x, y, el }; }) : [];
      labelsEl.replaceChildren(...labels.map((l) => l.el));

      // اللوحة: المؤشرات والحالات والأحياء
      const exact = shown.filter((m) => placed.get(m.id)?.exact).length, od = base.filter(overdue).length;
      $("#gm-kpis", v).innerHTML = [[shown.length, "مسجد"], [shown.filter((m) => m.stage === "active").length, "قيد التشغيل"], [all.length, "حي"], ...(od ? [[od, "تعبئة متأخرة", "bad"]] : [])]
        .map(([n, l, c]) => `<div class="${c || ""}"><b class="num">${fmtNum(n)}</b><span>${l}</span></div>`).join("");
      $("#gm-status", v).innerHTML = MAP_STATUS.map((s) => { const n = base.filter((m) => s.st.includes(m.stage)).length; return `<button class="gm-st ${mapState.off.has(s.k) ? "off" : ""}" data-s="${s.k}" ${n ? "" : "data-zero"} style="--c:${s.c}"><i></i><span>${s.l}</span><b class="num">${fmtNum(n)}</b></button>`; }).join("");
      $("#gm-all", v).hidden = !mapState.off.size;
      $("#mp-n", v).textContent = `${fmtNum(all.length)} حي`;
      $("#mp-list", v).innerHTML = mapped.map((g) => `<button class="gm-item" data-k="${esc(g.key)}"><div class="gm-ir"><b>${esc(g.label)}</b><span class="num">${fmtNum(g.all.length)}</span></div>${mixBar(g.all)}</button>`).join("") +
        (unmapped.length ? `<div class="mp-unmapped"><div class="small"><b>${I.alert} أحياء لم تُحدَّد على الخريطة</b></div>${unmapped.map((g) => `<div class="mp-u"><span>${esc(g.label)}</span><span class="num">${fmtNum(g.all.length)}</span></div>`).join("")}</div>` : "") ||
        `<div class="empty">${I.map}لا توجد مساجد</div>`;
      $("#gm-note", v).innerHTML = shown.length ? `<span class="dot-e"></span> موقع دقيق (${fmtNum(exact)}) <span class="dot-a"></span> تقريبي داخل الحي (${fmtNum(shown.length - exact)})` : "";
      $$(".gm-item", v).forEach((b) => {
        b.onclick = () => openGroup(groups.get(b.dataset.k), true);
        b.onmouseenter = () => $(`[data-g="${CSS.escape(b.dataset.k)}"]`, v)?.classList.add("hov");
        b.onmouseleave = () => $(`[data-g="${CSS.escape(b.dataset.k)}"]`, v)?.classList.remove("hov");
      });
      // الإطار الافتراضي: كل النقاط الظاهرة
      this.home = () => { const pts = shown.map((m) => placed.get(m.id)?.xy).filter(Boolean); if (!pts.length) return null; const b = bbox(pts), pad = 8; const t = fitBox([b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad], 30); t.k = Math.min(t.k, kMin * 7); return clampXY(t); };
      if (refit && size.w > 1) setGoal(this.home() || fitBox(W, 10)); else apply();
      requestAnimationFrame(declutter);
    };
    resize(); paint();

    $("#gm-status", v).onclick = (e) => { const b = e.target.closest("[data-s]"); if (!b) return; const k = b.dataset.s; mapState.off.has(k) ? mapState.off.delete(k) : mapState.off.add(k); paint(false); };
    $("#gm-status", v).ondblclick = (e) => { const b = e.target.closest("[data-s]"); if (!b) return; mapState.off = new Set(MAP_STATUS.map((s) => s.k).filter((k) => k !== b.dataset.s)); paint(false); };
    $("#gm-all", v).onclick = () => { mapState.off.clear(); paint(false); };
    $("#mp-assoc", v)?.addEventListener("change", (e) => { mapState.assoc = e.target.value; paint(); });
    $("#mp-region", v).onchange = (e) => { mapState.region = e.target.value; paint(); };
    $("#mp-lbl", v).onchange = (e) => { mapState.labels = e.target.checked; paint(false); };
    $("#mp-shade", v).onchange = (e) => { mapState.shade = e.target.checked; paint(false); };
  },
});
