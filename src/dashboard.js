// ───────────────────────── لوحة المؤشرات ─────────────────────────
const charts = [];
function destroyCharts() { while (charts.length) charts.pop().destroy(); }
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ألوان الرسوم: فُحصت بأداة التحقق (عمى الألوان والتباين) للوضعين الفاتح والداكن
const VIZ = {
  light: { series: ["#9a4a3a", "#3b74a8", "#a9831f"], ordinal: ["#cda796", "#b78874", "#a06c57", "#895643", "#714434", "#5a3428", "#40231b"] },
  dark: { series: ["#b04f45", "#4f86c6", "#b0902a"], ordinal: ["#6a4034", "#80503f", "#97624f", "#ae7863", "#c48f7a", "#d6a895", "#e6c3b4"] },
};
const viz = () => VIZ[isDark() ? "dark" : "light"];
const PERIODS = [[7, "7 أيام"], [30, "30 يومًا"], [90, "90 يومًا"], [365, "12 شهرًا"]];
const FUNNEL = ["مختار", "مسند لجمعية", "اكتملت بياناته", "قابل للتطبيق", "دُرس احتياجه", "معتمد للتركيب", "مُركّب"];
const pct = (a, b) => b ? Math.round((a / b) * 100) : null;
const fmtPct = (v) => v == null ? "—" : `${v}٪`;
const shortDate = (d) => new Date(d).toLocaleDateString(AR_LOCALE, { day: "numeric", month: "short" });

// تغيّر القيمة مقارنة بالفترة السابقة: السهم للاتجاه، واللون حسب ما إذا كان الارتفاع جيدًا
function delta(cur, prev, { goodUp = true } = {}) {
  if (cur == null || prev == null) return `<span class="delta flat">لا توجد فترة سابقة للمقارنة</span>`;
  const d = Math.round((cur - prev) * 100) / 100;
  if (!d) return `<span class="delta flat">بلا تغيير عن الفترة السابقة</span>`;
  const up = d > 0, good = up === goodUp;
  return `<span class="delta ${good ? "good" : "bad"}">${up ? "▲" : "▼"} ${Math.abs(d)} <span class="muted">عن الفترة السابقة</span></span>`;
}
// خط اتجاه صغير (١٢ أسبوعًا) — آخر نقطة بلون التمييز
function sparkline(values, color) {
  const v = values.map((x) => x ?? null);
  const nums = v.filter((x) => x != null);
  if (nums.length < 2) return "";
  const w = 120, h = 32, max = Math.max(...nums, 1), min = Math.min(...nums, 0);
  const pts = v.map((x, i) => x == null ? null : [w - (i / (v.length - 1)) * w, h - 4 - ((x - min) / (max - min || 1)) * (h - 8)]);
  const path = pts.reduce((s, p, i) => p ? s + (s && pts[i - 1] ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1) : s, "");
  const last = [...pts].reverse().find(Boolean);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${path}" fill="none" stroke="var(--ink-3)" stroke-opacity=".7" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/></svg>`;
}

let dashState = { days: 30, assoc: "" };
try { dashState = { ...dashState, ...JSON.parse(localStorage.getItem("tayyib.dash") || "{}") }; } catch {}

route("dashboard", {
  title: "لوحة المؤشرات",
  async render(v) {
    const r = role();
    const canFilterAssoc = r !== "association";
    // تجاهل جمعية محفوظة لم تعد موجودة أو غير مرئية لهذا الحساب
    if (!canFilterAssoc || !S.associations.some((a) => a.id === dashState.assoc)) dashState.assoc = "";
    if (!v.querySelector(".dash")) v.innerHTML = `<div class="dash"><div class="dash-skel">${Array.from({ length: 6 }, () => `<div class="card sk"></div>`).join("")}</div></div>`;
    else v.querySelector(".dash").classList.add("loading");
    const [{ data: d, error }] = await Promise.all([
      sb.rpc("dashboard", { p_days: dashState.days, p_assoc: dashState.assoc || null }),
      r !== "viewer" ? loadMosques() : null,
    ]);
    if (error) { v.innerHTML = `<div class="empty">${I.alert}${esc(errMsg(error))}</div>`; return; }
    const P = viz();
    const A = d.alerts || {};
    const periodLbl = PERIODS.find(([k]) => k === d.days)?.[1] || `${d.days} يومًا`;
    const scope = dashState.assoc ? assocName(dashState.assoc) : r === "association" ? assocName(S.me.association_id) : r === "company" ? "المساجد الجاهزة للتنفيذ" : "جميع المساجد";
    const completion = pct(d.active, d.total);
    const visitOk = pct(d.visit_ok, d.active);
    const ontime = pct(d.ontime_ok, d.ontime_n);
    const wk = d.weekly || [];
    const link = (href) => r === "viewer" ? "" : `href="#${href}"`;

    const tile = ({ label, icon, value, unit = "", sub = "", spark = "", href = "" }) => `<a class="card stat" ${href ? link(href) : ""}>
      <div class="lbl">${icon}<span>${esc(label)}</span></div>
      <div class="val">${value}${unit ? `<small>${unit}</small>` : ""}</div>
      <div class="foot">${sub}</div>${spark}</a>`;

    // التنبيهات مرتبة حسب الخطورة، وكل بند بأيقونة ونص (لا يعتمد على اللون وحده)
    const alerts = [
      ["bad", A.overdue, "تعبئة متأخرة", I.alert, "/refills"],
      ["bad", A.overdue_tasks, "مهمة تجاوزت موعدها", I.tasks, "/tasks?f=late"],
      ["warn", A.due_soon, `تعبئة خلال ${d.reminder_hours} ساعة`, I.clock, "/refills"],
      ["warn", A.visit_overdue, "زيارة أسبوعية متأخرة", I.visit, "/refills"],
      ["warn", A.issues, `ملاحظة فنية خلال ${periodLbl}`, I.install, "/reports?type=visit"],
      ["gold", A.pending_approval, "دراسة بانتظار اعتماد التركيب", I.check, "/mosques?stage=study_done"],
      ["info", A.missing_data, "مسجد بانتظار استكمال البيانات", I.edit, "/mosques?stage=assigned"],
      ["info", A.open_tasks, "مهمة مفتوحة", I.tasks, "/tasks"],
    ].filter(([, n]) => n);
    const funnel = d.funnel || [];
    const fmax = funnel[0]?.n || 0;
    const ratings = (d.ratings || []).slice().reverse();
    const rmax = Math.max(...ratings.map((x) => x.n), 1);
    const dist = d.by_district || [];
    const dmax = Math.max(...dist.map((x) => x.total), 1);
    const assocs = d.by_association || [];

    v.innerHTML = `<div class="dash">
      <div class="dash-head">
        <div class="grow"><div class="muted small">${esc(new Date().toLocaleDateString(AR_LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</div>
          <h2>أهلًا ${esc(S.me.name)}</h2><div class="muted small">النطاق: <b>${esc(scope)}</b> • الفترة: <b>${esc(periodLbl)}</b></div></div>
        <div class="dash-filters no-print">
          <div class="seg" id="d-period">${PERIODS.map(([k, l]) => `<button data-d="${k}" class="${k === d.days ? "on" : ""}">${l}</button>`).join("")}</div>
          ${canFilterAssoc && S.associations.length ? `<select class="input" id="d-assoc" aria-label="الجمعية"><option value="">كل الجمعيات</option>${S.associations.map((a) => `<option value="${a.id}" ${dashState.assoc === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : ""}
          <button class="iconbtn" id="d-refresh" title="تحديث" aria-label="تحديث">${svg('<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/>')}</button>
          <button class="iconbtn hide-sm" id="d-print" title="طباعة اللوحة" aria-label="طباعة">${I.print}</button>
        </div>
      </div>

      <div class="dash-top">
        <div class="card hero2">
          <div class="lbl">${I.mosque}<span>إنجاز المشروع</span></div>
          <div class="big"><span>${fmtNum(d.active)}</span><small>من ${fmtNum(d.total)} مسجد مُركّب</small></div>
          <div class="meter" role="img" aria-label="نسبة الإنجاز ${completion ?? 0}٪"><i style="width:${completion ?? 0}%"></i></div>
          <div class="row small" style="justify-content:space-between"><span>نسبة الإنجاز</span><b>${fmtPct(completion)}</b></div>
          <div class="hero-sub">
            <div><b>${fmtNum(d.devices)}</b><span>جهاز تعطير يعمل</span></div>
            <div><b>${fmtPct(pct(d.data_complete, d.total))}</b><span>اكتمال بيانات المساجد</span></div>
            <div><b>${d.avg_install_days != null ? fmtNum(d.avg_install_days) : "—"}</b><span>يومًا متوسط مدة التنفيذ</span></div>
          </div>
        </div>
        ${tile({ label: "التعبئات", icon: I.drop, value: fmtNum(d.refills), sub: delta(d.refills, d.refills_prev), spark: sparkline(wk.map((x) => x.refills), P.series[2]), href: "/reports?type=refill" })}
        ${tile({ label: "الزيارات الميدانية", icon: I.visit, value: fmtNum(d.visits), sub: delta(d.visits, d.visits_prev), spark: sparkline(wk.map((x) => x.visits), P.series[0]), href: "/reports?type=visit" })}
        ${tile({ label: "رضا المصلين عن العطر", icon: I.star, value: d.sat != null ? Number(d.sat).toFixed(1) : "—", unit: d.sat != null ? " / 5" : "",
          sub: d.sat != null ? delta(d.sat, d.sat_prev) : `<span class="delta flat">لا قياسات في الفترة${d.sat_all ? ` • المتوسط العام ${Number(d.sat_all).toFixed(1)}` : ""}</span>`,
          spark: sparkline(wk.map((x) => x.sat), P.series[1]), href: "/reports?type=satisfaction" })}
        ${tile({ label: "الالتزام بالمواعيد", icon: I.clock, value: fmtPct(ontime), sub: `<span class="delta flat">تعبئات في موعدها: ${fmtNum(d.ontime_ok)} من ${fmtNum(d.ontime_n)}</span>`,
          spark: `<div class="minimeter"><span>الزيارة الأسبوعية</span><div class="meter sm"><i style="width:${visitOk ?? 0}%"></i></div><b>${fmtPct(visitOk)}</b></div>` })}
      </div>

      <section class="card attn">
        <div class="hd"><h3>${I.bell}<span>يحتاج انتباهك</span></h3>${alerts.length ? `<span class="chip plain">${alerts.length}</span>` : ""}</div>
        ${alerts.length ? `<div class="attn-list">${alerts.map(([c, n, l, ic, href]) => `<a class="attn-item ${c}" ${link(href)}><span class="ai">${ic}</span><b>${fmtNum(n)}</b><span>${esc(l)}</span></a>`).join("")}</div>`
          : `<div class="attn-ok">${I.check}<span>لا توجد بنود متأخرة أو معلّقة — كل شيء يسير وفق الخطة</span></div>`}
      </section>

      <div class="dash-grid">
        <section class="card c-wide">
          <div class="hd"><h3>مسار التنفيذ</h3><span class="muted small">عدد المساجد التي بلغت كل مرحلة</span><button class="btn sm ghost right no-print" data-tv>جدول</button></div>
          <div class="bd"><div class="funnel">${funnel.map((f, i) => {
            const w = fmax ? (f.n / fmax) * 100 : 0, conv = i ? pct(f.n, funnel[i - 1].n) : null;
            return `<div class="fr" title="${esc(FUNNEL[i])}: ${f.n}"><div class="fl"><span class="fs">${i + 1}</span>${esc(FUNNEL[i])}</div>
              <div class="ft"><i style="width:${f.n ? Math.max(w, 2) : 0}%;background:${P.ordinal[i]}"></i></div>
              <div class="fv"><b>${fmtNum(f.n)}</b><span class="muted">${i ? fmtPct(conv) : "الأساس"}</span></div></div>`;
          }).join("")}</div>
          <div class="hint" style="margin-top:10px">النسبة = التحويل من المرحلة السابقة${A.not_feasible ? ` • ${fmtNum(A.not_feasible)} مسجد غير قابل للتطبيق` : ""}</div></div>
          <div class="tblview" hidden>${miniTable(["المرحلة", "عدد المساجد", "التحويل"], funnel.map((f, i) => [FUNNEL[i], fmtNum(f.n), i ? fmtPct(pct(f.n, funnel[i - 1].n)) : "—"]))}</div>
        </section>

        <section class="card">
          <div class="hd"><h3>التعبئات القادمة</h3><span class="muted small">14 يومًا</span><button class="btn sm ghost right no-print" data-tv>جدول</button></div>
          <div class="bd"><div class="legend sm"><span><i style="background:${P.series[2]}"></i>خلال ${d.reminder_hours} ساعة</span><span><i style="background:${P.series[0]}"></i>لاحقًا</span></div>
            <div class="ch" style="height:210px"><canvas id="c-up" role="img" aria-label="عدد التعبئات المجدولة لكل يوم خلال 14 يومًا"></canvas></div></div>
          <div class="tblview" hidden>${miniTable(["اليوم", "تعبئات"], (d.upcoming || []).map((x) => [shortDate(x.d), x.n]))}</div>
        </section>

        <section class="card c-wide">
          <div class="hd"><h3>النشاط الميداني</h3><span class="muted small">آخر 12 أسبوعًا</span><button class="btn sm ghost right no-print" data-tv>جدول</button></div>
          <div class="bd"><div class="legend">${[["الزيارات", P.series[0]], ["التعبئات", P.series[2]], ["التركيبات", P.series[1]]].map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}</div>
            <div class="ch" style="height:250px"><canvas id="c-trend" role="img" aria-label="الزيارات والتعبئات والتركيبات أسبوعيًا خلال 12 أسبوعًا"></canvas></div></div>
          <div class="tblview" hidden>${miniTable(["الأسبوع", "الزيارات", "التعبئات", "التركيبات"], wk.map((x) => [shortDate(x.w), x.visits, x.refills, x.installs]))}</div>
        </section>

        <section class="card">
          <div class="hd"><h3>رضا المصلين</h3><span class="muted small">${esc(periodLbl)}</span></div>
          <div class="bd">
            <div class="sat-head"><div class="big">${d.sat != null ? Number(d.sat).toFixed(1) : "—"}<small> / 5</small></div><div>${stars(d.sat)}<div class="muted small">${fmtNum(d.sat_n)} قياس</div></div></div>
            <div class="rbars">${ratings.map((x) => `<div class="rb" title="${x.r} من 5: ${x.n} قياس"><span>${x.r} ★</span><div class="ft"><i style="width:${(x.n / rmax) * 100}%;background:${P.ordinal[x.r + 1]}"></i></div><b>${fmtNum(x.n)}</b></div>`).join("")}</div>
            ${d.sat_n ? "" : `<div class="hint" style="margin-top:8px">لا توجد قياسات رضا في هذه الفترة — جرّب فترة أطول</div>`}
          </div>
        </section>

        ${r !== "association" && assocs.length ? `<section class="card c-full">
          <div class="hd"><h3>أداء الجمعيات المشرفة</h3><span class="muted small hide-sm">اضغط عنوان العمود للترتيب</span></div>
          <div class="tbl-wrap"><table class="tbl perf" id="perf"><thead><tr>
            <th data-k="name">الجمعية</th><th data-k="total" class="n">المساجد</th><th data-k="cp">نسبة التركيب</th><th data-k="pending" class="n">قيد الاستكمال</th>
            <th data-k="vp">الالتزام بالزيارة</th><th data-k="visits" class="n">زيارات الفترة</th><th data-k="overdue" class="n">تعبئات متأخرة</th><th data-k="sat">الرضا</th><th data-k="open_tasks" class="n">مهام مفتوحة</th></tr></thead><tbody></tbody></table></div>
        </section>` : ""}

        <section class="card c-wide">
          <div class="hd"><h3>التوزيع حسب الأحياء</h3><div class="legend sm right"><span><i style="background:${P.series[0]}"></i>مُركّب</span><span><i style="background:var(--line-2)"></i>لم يُركّب بعد</span></div></div>
          <div class="bd"><div class="dbars">${dist.map((x) => `<div class="db" title="${esc(x.district)}: ${x.active} مُركّب من ${x.total}"><span class="dn">${esc(x.district)}</span>
            <div class="dt"><div class="ft" style="width:${(x.total / dmax) * 100}%"><i style="width:${x.total ? (x.active / x.total) * 100 : 0}%;background:${P.series[0]}"></i></div></div><b>${x.active}<span class="muted">/${x.total}</span></b></div>`).join("") || `<div class="empty">لا توجد بيانات</div>`}</div></div>
        </section>

        <section class="card">
          <div class="hd"><h3>آخر المستجدات</h3></div>
          <div class="bd"><div class="feed">${(d.recent || []).map((a) => `<a class="fi" ${link("/mosque/" + a.mosque_id)}><i></i><div><b>${esc(a.mosque)}</b><span>${esc(a.action)}</span></div><time>${ago(a.at)}</time></a>`).join("") || `<div class="empty">لا يوجد نشاط بعد</div>`}</div></div>
        </section>
      </div>
      <div class="muted small dash-stamp">آخر تحديث ${new Date(d.generated_at).toLocaleTimeString(AR_LOCALE, { hour: "numeric", minute: "2-digit" })}</div>
    </div>`;

    // جدول الجمعيات القابل للترتيب
    const perf = $("#perf", v);
    if (perf) {
      const rows = assocs.map((a) => ({ ...a, cp: pct(a.active, a.total) ?? 0, vp: pct(a.visit_ok, a.active), sat: d.assoc_sat?.[a.id] ?? null }));
      let sort = { k: "total", dir: -1 };
      const drawPerf = () => {
        rows.sort((x, y) => { const a = x[sort.k], b = y[sort.k]; return (a == null) - (b == null) || (typeof a === "string" ? a.localeCompare(b, "ar") : a - b) * sort.dir; });
        $("tbody", perf).innerHTML = rows.map((a) => `<tr class="${r === "viewer" ? "" : "click"}" data-a="${a.id}"><td class="t-name">${esc(a.name)}</td><td class="n">${fmtNum(a.total)}</td>
          <td><div class="cell-meter"><div class="meter sm"><i style="width:${a.cp}%"></i></div><b>${a.cp}٪</b></div></td><td class="n">${fmtNum(a.pending)}</td>
          <td>${a.vp == null ? `<span class="muted">—</span>` : `<div class="cell-meter"><div class="meter sm ${a.vp < 60 ? "low" : ""}"><i style="width:${a.vp}%"></i></div><b>${a.vp}٪</b></div>`}</td>
          <td class="n">${fmtNum(a.visits)}</td><td class="n">${a.overdue ? `<span class="chip bad">${a.overdue}</span>` : `<span class="muted">0</span>`}</td>
          <td>${a.sat == null ? `<span class="muted">—</span>` : stars(a.sat)}</td><td class="n">${fmtNum(a.open_tasks)}</td></tr>`).join("");
        $$("th", perf).forEach((th) => { th.classList.toggle("sorted", th.dataset.k === sort.k); th.dataset.dir = sort.dir > 0 ? "asc" : "desc"; });
      };
      $("thead", perf).onclick = (e) => { const th = e.target.closest("th[data-k]"); if (!th) return; sort = { k: th.dataset.k, dir: sort.k === th.dataset.k ? -sort.dir : (th.dataset.k === "name" ? 1 : -1) }; drawPerf(); };
      $("tbody", perf).onclick = (e) => { const tr = e.target.closest("tr[data-a]"); if (tr && r !== "viewer") go("/mosques?assoc=" + tr.dataset.a); };
      drawPerf();
    }
    $$("[data-tv]", v).forEach((b) => b.onclick = () => {
      const card = b.closest(".card"), tv = $(".tblview", card), on = tv.hidden;
      tv.hidden = !on; $$(":scope > .bd", card).forEach((x) => x.hidden = on); b.textContent = on ? "رسم" : "جدول";
    });
    $("#d-period", v).onclick = (e) => { const b = e.target.closest("[data-d]"); if (!b) return; dashState.days = +b.dataset.d; saveDash(); render(); };
    $("#d-assoc", v)?.addEventListener("change", (e) => { dashState.assoc = e.target.value; saveDash(); render(); });
    $("#d-refresh", v).onclick = () => render();
    $("#d-print", v).onclick = () => window.print();
    drawCharts(d);
  },
  leave: destroyCharts,
});
function saveDash() { try { localStorage.setItem("tayyib.dash", JSON.stringify(dashState)); } catch {} }
function miniTable(head, rows) {
  return `<div class="tbl-wrap" style="max-height:320px"><table class="tbl"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td class="num">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function drawCharts(d) {
  destroyCharts();
  if (!window.Chart) {
    // مكتبة الرسوم تُحمّل مؤجلة؛ نرسم عند اكتمالها
    if (document.readyState !== "complete") window.addEventListener("load", () => $("#c-trend") && drawCharts(d), { once: true });
    return;
  }
  const P = viz(), line = cssVar("--line"), surface = cssVar("--surface");
  Chart.defaults.font.family = cssVar("--font");
  Chart.defaults.font.size = 12;
  Chart.defaults.color = cssVar("--ink-3");
  const tooltip = { rtl: true, textDirection: "rtl", backgroundColor: cssVar("--ink"), titleColor: cssVar("--bg"), bodyColor: cssVar("--bg"), padding: 10, cornerRadius: 10, boxPadding: 4, usePointStyle: true };
  const axes = { x: { reverse: true, grid: { display: false }, border: { color: line }, ticks: { maxRotation: 0, autoSkipPadding: 14 } },
    y: { position: "right", beginAtZero: true, grid: { color: line, lineWidth: 1 }, border: { display: false }, ticks: { precision: 0, maxTicksLimit: 5 } } };

  const wk = d.weekly || [];
  const ct = $("#c-trend");
  if (ct) charts.push(new Chart(ct, {
    type: "line",
    data: { labels: wk.map((x) => shortDate(x.w)), datasets: [
      { label: "الزيارات", data: wk.map((x) => x.visits), borderColor: P.series[0], backgroundColor: P.series[0] + "1a", fill: "origin" },
      { label: "التعبئات", data: wk.map((x) => x.refills), borderColor: P.series[2] },
      { label: "التركيبات", data: wk.map((x) => x.installs), borderColor: P.series[1] },
    ].map((s) => ({ borderWidth: 2, cubicInterpolationMode: "monotone", pointRadius: 0, pointHitRadius: 14, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: surface, pointBackgroundColor: s.borderColor, ...s })) },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip }, scales: axes },
  }));
  const up = d.upcoming || [];
  const soon = Math.ceil((d.reminder_hours || 72) / 24);
  const cu = $("#c-up");
  if (cu) charts.push(new Chart(cu, {
    type: "bar",
    data: { labels: up.map((x, i) => i === 0 ? "اليوم" : shortDate(x.d)), datasets: [{ label: "تعبئات مجدولة", data: up.map((x) => x.n),
      backgroundColor: up.map((x, i) => i < soon ? P.series[2] : P.series[0]), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start", maxBarThickness: 18 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip },
      scales: { ...axes, x: { ...axes.x, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5 } } } },
  }));
}
