// ───────────────────────── لوحة المؤشرات ─────────────────────────
const charts = [];
function destroyCharts() { while (charts.length) charts.pop().destroy(); }
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

route("dashboard", {
  title: "لوحة المؤشرات",
  async render(v) {
    v.innerHTML = `<div class="empty">جارٍ تحميل المؤشرات…</div>`;
    const [{ data: st, error }] = await Promise.all([sb.rpc("dashboard_stats"), loadMosques()]);
    if (error) { v.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    const r = role();
    const stg = st.stages || {};
    const kpi = (lbl, val, sub = "", icon = I.mosque, cls = "", href = "") =>
      `<div class="card kpi ${cls}"><div class="lbl">${icon}${esc(lbl)}</div><div class="val">${val}</div>${sub ? `<div class="sub">${sub}</div>` : ""}${href ? `<a class="more" href="#${href}" aria-label="${esc(lbl)}"></a>` : ""}</div>`;
    const pct = st.total ? Math.round((st.active / st.total) * 100) : 0;
    const hello = r === "association" ? assocName(S.me.association_id) : r === "company" ? S.settings.company_name : S.settings.org_name;

    v.innerHTML = `
      <div class="row" style="margin-bottom:16px">
        <div><div class="muted small">${esc(hello || "")}</div><h2 style="margin:0;font-size:22px">أهلًا ${esc(S.me.name)} 👋</h2></div>
        <div class="right row no-print">
          ${r !== "viewer" ? `<button class="btn" data-print>${I.print} طباعة اللوحة</button>` : ""}
        </div>
      </div>
      <div class="kpis">
        ${kpi("المساجد في المشروع", fmtNum(st.total), `${fmtNum(st.active)} مُركّب · ${pct}% إنجاز`, I.mosque, "hero", r !== "viewer" ? "/mosques" : "")}
        ${kpi("أجهزة التعطير العاملة", fmtNum(st.devices), "في المساجد قيد التشغيل", I.sparkle)}
        ${kpi("متوسط الرضا", st.satisfaction ? `${Number(st.satisfaction).toFixed(2)}<small> / 5</small>` : "—", st.satisfaction ? stars(st.satisfaction) : "لا توجد قياسات بعد", I.star)}
        ${kpi("تعبئات هذا الشهر", fmtNum(st.refills_month), `${fmtNum(st.visits_week)} زيارة خلال ٧ أيام`, I.drop)}
        ${kpi(`تعبئة خلال ${S.settings.reminder_hours || 72} ساعة`, fmtNum(st.due_soon), "تذكير آلي للشركة", I.clock, st.due_soon ? "warn" : "", r !== "viewer" ? "/refills" : "")}
        ${kpi("تعبئات متأخرة", fmtNum(st.overdue), `${fmtNum(st.visit_overdue)} مسجد تأخرت زيارته`, I.alert, st.overdue ? "alert" : "", r !== "viewer" ? "/refills" : "")}
        ${r === "viewer" ? kpi("التقارير المرفوعة", fmtNum(st.reports_total), "زيارات وقياسات وتعبئات", I.report) :
          kpi("بانتظار اعتماد التركيب", fmtNum(st.pending_approval), "دراسات احتياج مرفوعة", I.check, st.pending_approval && r === "admin" ? "warn" : "", "/mosques?stage=study_done")}
        ${kpi("المهام المفتوحة", fmtNum(st.open_tasks), st.overdue_tasks ? `<span style="color:var(--bad)">${fmtNum(st.overdue_tasks)} متأخرة</span>` : "لا مهام متأخرة", I.tasks, "", r !== "viewer" ? "/tasks" : "")}
      </div>

      <div class="card" style="margin-top:16px"><div class="hd"><h3>مسار المشروع</h3><span class="muted small">عدد المساجد في كل مرحلة — اضغط للتصفية</span></div>
        <div class="bd"><div class="pipe">${STAGE_ORDER.concat(["not_feasible"]).map((s) => `<div class="st ${s === "active" ? "on" : ""}" ${r !== "viewer" ? `data-stage="${s}"` : ""}>
          <div class="n">${fmtNum(stg[s] || 0)}</div><div class="l">${esc(STAGES[s].l)}</div><div class="who">${esc(STAGES[s].who)}</div></div>`).join("")}</div>
          <div class="bar gold" style="margin-top:14px"><i style="width:${pct}%"></i></div>
          <div class="row small muted" style="margin-top:6px"><span>نسبة الإنجاز (التركيب)</span><b class="right num">${pct}%</b></div></div></div>

      <div class="grid g3" style="margin-top:16px">
        <div class="card span2"><div class="hd"><h3>النشاط خلال ٦ أشهر</h3></div><div class="bd" style="height:280px"><canvas id="c-series"></canvas></div></div>
        <div class="card"><div class="hd"><h3>توزيع المراحل</h3></div><div class="bd" style="height:280px"><canvas id="c-stages"></canvas></div></div>
      </div>

      <div class="grid g3" style="margin-top:16px">
        <div class="card"><div class="hd"><h3>اتجاه الرضا</h3></div><div class="bd" style="height:240px"><canvas id="c-sat"></canvas></div></div>
        <div class="card span2"><div class="hd"><h3>الأحياء</h3><span class="muted small">إجمالي ومُركّب</span></div><div class="bd" style="height:240px"><canvas id="c-dist"></canvas></div></div>
      </div>

      ${r === "admin" || r === "viewer" ? `<div class="card" style="margin-top:16px"><div class="hd"><h3>أداء الجمعيات المشرفة</h3></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الجمعية</th><th>المساجد</th><th>مُركّب</th><th>قيد الاستكمال</th><th>زيارات ٣٠ يومًا</th><th>الرضا</th><th style="width:20%">الإنجاز</th></tr></thead>
        <tbody>${(st.by_association || []).map((a) => `<tr><td class="t-name">${esc(a.name)}</td><td class="num">${a.total}</td><td class="num">${a.active}</td><td class="num">${a.pending}</td>
          <td class="num">${a.visits}</td><td>${stars(a.satisfaction)}</td><td><div class="bar"><i style="width:${a.total ? Math.round(a.active / a.total * 100) : 0}%"></i></div></td></tr>`).join("") ||
          `<tr><td colspan="7" class="empty">لا توجد جمعيات مسند لها مساجد بعد</td></tr>`}</tbody></table></div></div>` : ""}

      <div class="grid g2" style="margin-top:16px">
        ${r !== "viewer" ? `<div class="card"><div class="hd"><h3>يتطلب إجراءك</h3><span class="chip gold plain" id="todo-n"></span></div><div class="bd" id="todo"></div></div>` : ""}
        <div class="card ${r === "viewer" ? "span2" : ""}"><div class="hd"><h3>آخر المستجدات</h3></div><div class="bd"><div class="tl">${(st.recent || []).map((a) => `
          <div class="row" style="gap:10px;${r !== "viewer" ? "cursor:pointer" : ""}" ${r !== "viewer" ? `data-m="${a.mosque_id}"` : ""}><span class="chip plain">${ago(a.at)}</span><b class="small">${esc(a.mosque)}</b><span class="small muted">${esc(a.action)}</span></div>`).join("") || `<div class="empty">لا يوجد نشاط بعد</div>`}</div></div></div>
      </div>`;

    $$("[data-stage]", v).forEach((el) => el.onclick = () => go("/mosques?stage=" + el.dataset.stage));
    $$("[data-m]", v).forEach((el) => el.onclick = () => go("/mosque/" + el.dataset.m));
    $("[data-print]", v)?.addEventListener("click", () => window.print());
    if (r !== "viewer") drawTodo(v);
    drawCharts(st);
  },
  leave: destroyCharts,
});

function drawTodo(v) {
  const r = role();
  const items = [];
  for (const m of S.mosques || []) {
    const a = nextAction(m);
    if (a && !a.waiting) items.push({ m, t: a.title, c: "gold" });
    if (m.stage === "active") {
      const h = m.next_refill_at ? (new Date(m.next_refill_at) - Date.now()) / 36e5 : null;
      if ((r === "company" || r === "admin") && h != null && h <= (S.settings.reminder_hours || 72)) items.push({ m, t: h < 0 ? "تعبئة متأخرة" : `تعبئة ${untilText(m.next_refill_at)}`, c: h < 0 ? "bad" : "warn" });
      const lv = m.last_visit_at || m.installed_at;
      if ((r === "association") && lv && Date.now() - new Date(lv) > (S.settings.visit_every_days || 7) * 864e5) items.push({ m, t: "زيارة أسبوعية مستحقة", c: "warn" });
    }
  }
  $("#todo-n", v).textContent = items.length;
  $("#todo", v).innerHTML = items.length ? `<div class="tl">${items.slice(0, 12).map((x) => `<div class="row" style="cursor:pointer" data-m="${x.m.id}">
    <span class="chip ${x.c}">${esc(x.t)}</span><b class="small">${esc(x.m.name)}</b><span class="muted small">${esc(x.m.district || "")}</span></div>`).join("")}
    ${items.length > 12 ? `<a href="#/mosques" class="small">و${items.length - 12} أخرى…</a>` : ""}</div>` : `<div class="empty">${I.check}لا توجد إجراءات معلّقة 🎉</div>`;
  $$("#todo [data-m]", v).forEach((el) => el.onclick = () => go("/mosque/" + el.dataset.m));
}

function drawCharts(st) {
  destroyCharts();
  if (!window.Chart) {
    // مكتبة الرسوم تُحمّل مؤجلة؛ نرسم عند اكتمالها
    if (document.readyState !== "complete") window.addEventListener("load", () => $("#c-series") && drawCharts(st), { once: true });
    return;
  }
  Chart.defaults.font.family = cssVar("--font") || "IBM Plex Sans Arabic";
  Chart.defaults.color = cssVar("--ink-3");
  Chart.defaults.borderColor = cssVar("--line");
  const brand = cssVar("--brand"), gold = cssVar("--gold"), info = cssVar("--info");
  const labels = (st.series || []).map((s) => monthName(s.month).split(" ")[0]);
  const base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", rtl: true, labels: { usePointStyle: true, boxWidth: 8 } } } };
  const c1 = $("#c-series");
  if (c1) charts.push(new Chart(c1, { type: "bar", data: { labels, datasets: [
    { label: "تركيب", data: st.series.map((s) => s.installs), backgroundColor: gold, borderRadius: 6, maxBarThickness: 26 },
    { label: "تعبئة", data: st.series.map((s) => s.refills), backgroundColor: brand, borderRadius: 6, maxBarThickness: 26 },
    { label: "زيارات", data: st.series.map((s) => s.visits), backgroundColor: info, borderRadius: 6, maxBarThickness: 26 },
  ] }, options: { ...base, scales: { x: { reverse: true, grid: { display: false } }, y: { position: "right", beginAtZero: true, ticks: { precision: 0 } } } } }));
  const stg = st.stages || {};
  const keys = STAGE_ORDER.concat(["not_feasible", "suspended"]).filter((k) => stg[k]);
  const palette = { selected: "#b8b2a3", assigned: "#7fb2d4", data_done: "#2c6e9b", feasible: "#e2c27f", study_done: "#d99a3a", approved: gold, active: brand, not_feasible: "#c0392b", suspended: "#7d1f16" };
  const c2 = $("#c-stages");
  if (c2) charts.push(new Chart(c2, { type: "doughnut", data: { labels: keys.map((k) => STAGES[k].s), datasets: [{ data: keys.map((k) => stg[k]), backgroundColor: keys.map((k) => palette[k]), borderWidth: 2, borderColor: cssVar("--surface") }] },
    options: { ...base, cutout: "66%" } }));
  const c3 = $("#c-sat");
  if (c3) charts.push(new Chart(c3, { type: "line", data: { labels, datasets: [{ label: "متوسط الرضا", data: st.series.map((s) => s.satisfaction), borderColor: gold, backgroundColor: gold + "33", fill: true, tension: .35, spanGaps: true, pointRadius: 4 }] },
    options: { ...base, plugins: { legend: { display: false } }, scales: { y: { position: "right", min: 0, max: 5, ticks: { stepSize: 1 } }, x: { reverse: true, grid: { display: false } } } } }));
  const c4 = $("#c-dist");
  const dist = st.by_district || [];
  if (c4) charts.push(new Chart(c4, { type: "bar", data: { labels: dist.map((d) => d.district), datasets: [
    { label: "إجمالي", data: dist.map((d) => d.total), backgroundColor: cssVar("--line"), borderRadius: 5, maxBarThickness: 22 },
    { label: "مُركّب", data: dist.map((d) => d.active), backgroundColor: brand, borderRadius: 5, maxBarThickness: 22 },
  ] }, options: { ...base, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } } }));
}
