// ───────────────────────── جدول التعبئة ─────────────────────────
route("refills", {
  title: "جدول التعبئة والزيارات",
  async render(v) {
    await loadMosques();
    const r = role();
    const active = S.mosques.filter((m) => m.stage === "active");
    const rh = S.settings.reminder_hours || 72, vd = S.settings.visit_every_days || 7;
    const h = (m) => m.next_refill_at ? (new Date(m.next_refill_at) - Date.now()) / 36e5 : Infinity;
    const overdue = active.filter((m) => h(m) < 0).sort((a, b) => h(a) - h(b));
    const soon = active.filter((m) => h(m) >= 0 && h(m) <= rh).sort((a, b) => h(a) - h(b));
    const later = active.filter((m) => h(m) > rh).sort((a, b) => h(a) - h(b));
    const visitDue = active.filter((m) => Date.now() - new Date(m.last_visit_at || m.installed_at) > vd * 864e5);
    const tbl = (list, empty) => list.length ? `<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>المسجد</th><th>الحي</th><th>الأجهزة</th><th>العطر</th><th>آخر تعبئة</th><th>الموعد</th><th>المتبقي</th><th></th></tr></thead><tbody>
      ${list.map((m) => `<tr class="click" data-id="${m.id}"><td><div class="t-name">${esc(m.name)}</div><div class="small muted">${esc(m.code)} ${contactBtns({ phone: m.servant_phone, name: m.servant_name, text: `السلام عليكم، نود إبلاغكم بموعد تعبئة عطر ${m.name}: ${fmtDateTime(m.next_refill_at)}` })}</div></td>
        <td data-hide-sm>${esc(m.district || "—")}</td><td data-hide-sm class="num">${m.devices_count ?? "—"}</td><td data-hide-sm>${esc(m.fragrance || "—")}</td>
        <td data-hide-sm>${fmtDate(m.last_refill_at)}</td><td data-hide-sm class="num">${fmtDateTime(m.next_refill_at)}</td><td>${refillChip(m)}</td>
        <td data-hide-sm onclick="event.stopPropagation()">${r === "company" || r === "admin" ? `<button class="btn sm gold" data-refill="${m.id}">${I.drop} تسجيل التعبئة</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${empty}</div>`;
    v.innerHTML = `<div class="kpis" style="margin-bottom:16px">
        <div class="card kpi alert"><div class="lbl">${I.alert}متأخرة</div><div class="val">${overdue.length}</div></div>
        <div class="card kpi warn"><div class="lbl">${I.clock}خلال ${rh} ساعة</div><div class="val">${soon.length}</div><div class="sub">يصل تذكير آلي للشركة</div></div>
        <div class="card kpi"><div class="lbl">${I.drop}مجدولة لاحقًا</div><div class="val">${later.length}</div></div>
        <div class="card kpi"><div class="lbl">${I.visit}زيارات أسبوعية مستحقة</div><div class="val">${visitDue.length}</div></div>
      </div>
      <div class="stack">
        <div class="card"><div class="hd"><h3>تعبئات متأخرة</h3><span class="chip bad">${overdue.length}</span></div>${tbl(overdue, "لا توجد تعبئات متأخرة ✓")}</div>
        <div class="card"><div class="hd"><h3>تعبئات خلال ${rh} ساعة</h3><span class="chip warn">${soon.length}</span></div>${tbl(soon, "لا توجد تعبئات قريبة")}</div>
        <div class="card"><div class="hd"><h3>الجدول القادم</h3><button class="btn sm right" id="exp">${I.download} تصدير</button></div>${tbl(later, "لا توجد مساجد قيد التشغيل بعد")}</div>
        ${r !== "company" ? `<div class="card"><div class="hd"><h3>زيارات أسبوعية مستحقة</h3><span class="chip warn">${visitDue.length}</span></div>
          ${visitDue.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المسجد</th><th>الجمعية</th><th>آخر زيارة</th><th></th></tr></thead><tbody>${visitDue.map((m) => `<tr class="click" data-id="${m.id}"><td class="t-name">${esc(m.name)}</td><td>${esc(assocName(m.association_id))}</td><td>${m.last_visit_at ? `${fmtDate(m.last_visit_at)} (${ago(m.last_visit_at)})` : "لا توجد"}</td>
            <td onclick="event.stopPropagation()">${r !== "viewer" ? `<button class="btn sm" data-visit="${m.id}">${I.visit} رفع زيارة</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">جميع الزيارات محدثة ✓</div>`}</div>` : ""}
      </div>`;
    $$("tr[data-id]", v).forEach((tr) => tr.onclick = () => go("/mosque/" + tr.dataset.id));
    $$("[data-refill]", v).forEach((b) => b.onclick = async () => { if (await openReportForm(mosqueById(b.dataset.refill), "refill")) render(); });
    $$("[data-visit]", v).forEach((b) => b.onclick = async () => { if (await openReportForm(mosqueById(b.dataset.visit), "visit")) render(); });
    $("#exp", v).onclick = () => exportXlsx(active.map(mosqueRow), `جدول-التعبئة-${isoDay()}.xlsx`, "التعبئة");
  },
});

// ───────────────────────── مركز التقارير ─────────────────────────
route("reports", {
  title: "التقارير",
  async render(v) {
    await loadMosques();
    const p = S.params;
    const f = { type: p.type || "", assoc: p.assoc || "", from: p.from || isoDay(new Date(Date.now() - 30 * 864e5)), to: p.to || isoDay() };
    const r = role();
    v.innerHTML = `<div class="card"><div class="toolbar">
        <select class="input" id="t" style="width:auto"><option value="">كل أنواع التقارير</option>${Object.entries(REPORT_TYPES).filter(([k]) => k !== "note").map(([k, x]) => `<option value="${k}" ${f.type === k ? "selected" : ""}>${esc(x.l)}</option>`).join("")}</select>
        ${r === "admin" ? `<select class="input" id="a" style="width:auto"><option value="">كل الجمعيات</option>${S.associations.map((a) => `<option value="${a.id}" ${f.assoc === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : ""}
        <label class="row small" style="gap:6px;flex-wrap:nowrap">من <input type="date" class="input" id="from" style="width:auto" value="${f.from}"></label>
        <label class="row small" style="gap:6px;flex-wrap:nowrap">إلى <input type="date" class="input" id="to" style="width:auto" value="${f.to}"></label>
        <div class="btn-row right"><button class="btn sm" id="monthly">${I.report} التقرير الشهري المجمع</button><button class="btn sm" id="exp">${I.download} تصدير Excel</button></div>
      </div><div id="sum" class="bd" style="border-bottom:1px solid var(--line)"></div><div id="list"></div></div>`;
    let rows = [];
    const load = async () => {
      let q = sb.from("reports").select("*").gte("created_at", f.from + "T00:00:00").lte("created_at", f.to + "T23:59:59").order("created_at", { ascending: false }).limit(2000);
      if (f.type) q = q.eq("type", f.type);
      const { data, error } = await q;
      if (error) { toast(errMsg(error), "err"); return; }
      rows = (data || []).filter((x) => !f.assoc || mosqueById(x.mosque_id)?.association_id === f.assoc);
      const count = (t) => rows.filter((x) => x.type === t).length;
      const sat = rows.filter((x) => x.type === "satisfaction" && x.data?.overall).map((x) => +x.data.overall);
      $("#sum", v).innerHTML = `<div class="row small" style="gap:16px"><b>${rows.length} تقرير</b>
        <span>زيارات: <b>${count("visit")}</b></span><span>تعبئات: <b>${count("refill")}</b></span><span>تركيب: <b>${count("installation")}</b></span>
        <span>قياسات رضا: <b>${sat.length}</b>${sat.length ? ` (متوسط ${(sat.reduce((a, b) => a + b, 0) / sat.length).toFixed(2)})` : ""}</span>
        <span>ملاحظات فنية: <b style="color:var(--bad)">${rows.filter((x) => x.type === "visit" && x.data?.status === "issue").length}</b></span></div>`;
      $("#list", v).innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>التاريخ</th><th>المسجد</th><th>التقرير</th><th>الملخص</th><th>الجهة</th></tr></thead><tbody>
        ${rows.map((x) => { const m = mosqueById(x.mosque_id); return `<tr class="click" data-m="${x.mosque_id}" data-r="${x.id}"><td class="num nowrap">${fmtDate(x.created_at)}</td><td class="t-name">${esc(m?.name || "—")}</td>
          <td><span class="chip plain">${esc(REPORT_TYPES[x.type]?.l || x.type)}</span></td><td data-hide-sm class="small">${esc(x.summary || "")}</td><td data-hide-sm class="small muted">${esc(ROLES[x.author_role] || "")}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">${I.report}لا توجد تقارير في هذه الفترة</div>`;
      $$("tr[data-m]", v).forEach((tr) => tr.onclick = () => go(`/mosque/${tr.dataset.m}?tab=reports`));
    };
    const upd = () => { f.type = $("#t", v).value; f.assoc = $("#a", v)?.value || ""; f.from = $("#from", v).value; f.to = $("#to", v).value; load(); };
    ["#t", "#a", "#from", "#to"].forEach((s) => $(s, v)?.addEventListener("change", upd));
    $("#exp", v).onclick = () => exportXlsx(rows.map((x) => { const m = mosqueById(x.mosque_id); return { "التاريخ": fmtDateTime(x.created_at), "الرمز": m?.code, "المسجد": m?.name, "الحي": m?.district, "الجمعية": assocName(m?.association_id),
      "نوع التقرير": REPORT_TYPES[x.type]?.l || x.type, "الملخص": x.summary || "", "الجهة": ROLES[x.author_role] || "", ...Object.fromEntries(reportDetails(x)) }; }), `تقارير-طيب-${f.from}_${f.to}.xlsx`, "التقارير");
    $("#monthly", v).onclick = () => monthlyCompound();
    load();
  },
});

// تقرير شهري مجمع: أداء التعطير في كل مسجد خلال شهر
async function monthlyCompound() {
  const ym = await modal({ title: "التقرير الشهري المجمع", body: fld("m", "الشهر", { type: "month", value: monthKey() }),
    actions: [{ label: `${I.print} إنشاء التقرير`, cls: "primary", onClick: (mb) => $('[name="m"]', mb).value }, { label: "إلغاء" }] });
  if (!ym) return;
  const start = new Date(ym + "-01T00:00:00"), end = new Date(start); end.setMonth(end.getMonth() + 1);
  const { data } = await sb.from("reports").select("*").gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
  const { data: monthlies } = await sb.from("reports").select("*").eq("type", "monthly").filter("data->>month", "eq", ym);
  const rs = data || [];
  const active = S.mosques.filter((m) => m.stage === "active" || rs.some((x) => x.mosque_id === m.id));
  const rows = active.map((m) => {
    const mine = rs.filter((x) => x.mosque_id === m.id);
    const sat = mine.filter((x) => x.type === "satisfaction" && x.data?.overall).map((x) => +x.data.overall);
    const mr = (monthlies || []).find((x) => x.mosque_id === m.id);
    return { m, visits: mine.filter((x) => x.type === "visit").length, issues: mine.filter((x) => x.type === "visit" && x.data?.status === "issue").length,
      refills: mine.filter((x) => x.type === "refill").length, sat: sat.length ? (sat.reduce((a, b) => a + b, 0) / sat.length).toFixed(2) : "—", perf: mr?.data?.performance ? `${mr.data.performance}/5` : "لم يُرفع" };
  });
  printDoc(`التقرير الشهري — ${monthName(ym)}`, `<h2>ملخص الشهر</h2><table>
    <tr><th>المساجد قيد التشغيل</th><td>${rows.length}</td></tr><tr><th>إجمالي الزيارات</th><td>${rows.reduce((a, x) => a + x.visits, 0)}</td></tr>
    <tr><th>إجمالي التعبئات</th><td>${rows.reduce((a, x) => a + x.refills, 0)}</td></tr><tr><th>الملاحظات الفنية</th><td>${rows.reduce((a, x) => a + x.issues, 0)}</td></tr>
    <tr><th>التقارير الشهرية المرفوعة</th><td>${rows.filter((x) => x.perf !== "لم يُرفع").length} من ${rows.length}</td></tr></table>
    <h2>أداء التعطير في كل مسجد</h2><table><tr><th style="width:auto">المسجد</th><th style="width:auto">الجمعية</th><th style="width:auto">زيارات</th><th style="width:auto">تعبئات</th><th style="width:auto">ملاحظات</th><th style="width:auto">الرضا</th><th style="width:auto">تقييم الأداء</th></tr>
    ${rows.map((x) => `<tr><td>${esc(x.m.name)}</td><td>${esc(assocName(x.m.association_id))}</td><td>${x.visits}</td><td>${x.refills}</td><td>${x.issues}</td><td>${x.sat}</td><td>${x.perf}</td></tr>`).join("")}</table>`);
}

// ───────────────────────── المنجزات ─────────────────────────
route("achievements", {
  title: "المنجزات",
  async render(v) {
    const [{ data: list, error }, { data: st }] = await Promise.all([sb.rpc("achievements"), sb.rpc("dashboard_stats")]);
    if (error) { v.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    const totalRefills = list.reduce((a, x) => a + (x.refills || 0), 0);
    v.innerHTML = `<div class="card kpi hero" style="padding:26px 28px;margin-bottom:16px">
        <div class="lbl">${I.sparkle} منجزات ${esc(S.settings.org_name || "المشروع")}</div>
        <div class="row" style="gap:36px;margin-top:10px;align-items:flex-end">
          <div><div class="val" style="font-size:44px">${fmtNum(list.length)}</div><div class="sub">مسجد وجامع معطّر</div></div>
          <div><div class="val">${fmtNum(st?.devices || 0)}</div><div class="sub">جهاز تعطير</div></div>
          <div><div class="val">${fmtNum(totalRefills)}</div><div class="sub">عملية تعبئة</div></div>
          <div><div class="val">${st?.satisfaction ? Number(st.satisfaction).toFixed(1) : "—"}<small style="color:#cfe7de"> / 5</small></div><div class="sub">متوسط رضا المصلين</div></div>
        </div></div>
      <div class="grid g3" id="gal">${list.map((x) => `<div class="card" style="overflow:hidden">
        <div class="arch" style="aspect-ratio:16/10;background:var(--surface-2);display:grid;place-items:center;color:var(--gold);margin:10px 10px 0;border-radius:14px;overflow:hidden">${x.photos?.length ? `<img data-img="${esc(x.photos[0])}" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in" alt="">` : I.mosque.replace("<svg", '<svg style="width:54px;height:54px"')}</div>
        <div class="bd"><div class="row"><b>${esc(x.name)}</b><span class="chip ok right">مُركّب</span></div>
          <div class="muted small">${esc(x.district || "")}${x.association ? ` · ${esc(x.association)}` : ""}</div>
          <div class="row small" style="margin-top:10px;gap:14px"><span>التركيب: ${fmtDate(x.installed_at)}</span><span><b>${x.devices ?? "—"}</b> أجهزة</span><span><b>${x.refills}</b> تعبئة</span><span><b>${x.visits}</b> زيارة</span></div>
          <div style="margin-top:6px">${stars(x.satisfaction)}</div>
          ${x.photos?.length > 1 ? `<div class="files">${x.photos.slice(1, 5).map((p) => `<img class="thumb" style="width:60px;height:60px" data-img="${esc(p)}" alt="">`).join("")}</div>` : ""}</div></div>`).join("") ||
        `<div class="card span2 empty" style="grid-column:1/-1">${I.sparkle}ستظهر هنا المساجد بعد تركيب أجهزة التعطير فيها</div>`}</div>`;
    hydrateFiles(v);
  },
});

// ───────────────────────── الإشعارات ─────────────────────────
route("notifications", {
  title: "الإشعارات",
  async render(v) {
    await loadNotifications();
    let f = "all";
    const kinds = { all: "الكل", unread: "غير المقروءة", reminder: "التذكيرات", alert: "التنبيهات", approval: "الاعتمادات", task: "المهام", report: "التقارير" };
    v.innerHTML = `<div class="pagehead"><div class="seg" id="seg">${Object.entries(kinds).map(([k, l]) => `<button data-f="${k}" class="${k === f ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="right row"><button class="btn sm" id="mute">${localStorage.getItem("tayyib.mute") === "1" ? "🔕 الصوت متوقف" : "🔔 الصوت مفعّل"}</button>
      ${"Notification" in window && Notification.permission !== "granted" ? `<button class="btn sm" id="perm">تفعيل تنبيهات المتصفح</button>` : ""}
      <button class="btn sm" id="all">تحديد الكل كمقروء</button></div></div><div class="card" id="list"></div>`;
    const draw = () => {
      const list = S.notifications.filter((n) => f === "all" || (f === "unread" ? !n.read_at : f === "task" ? ["task", "assign"].includes(n.kind) : f === "report" ? ["report", "stage", "refill"].includes(n.kind) : n.kind === f));
      $("#list", v).innerHTML = list.length ? list.map(notifItem).join("") : `<div class="empty">${I.bell}لا توجد إشعارات</div>`;
    };
    $("#seg", v).onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; f = b.dataset.f; $$("#seg button", v).forEach((x) => x.classList.toggle("on", x === b)); draw(); };
    $("#list", v).onclick = (e) => { const it = e.target.closest("[data-n]"); if (it) openNotification(S.notifications.find((n) => n.id === it.dataset.n)); };
    $("#all", v).onclick = async () => { await markRead(S.notifications.filter((n) => !n.read_at).map((n) => n.id)); draw(); };
    $("#mute", v).onclick = (e) => { const m = localStorage.getItem("tayyib.mute") === "1"; localStorage.setItem("tayyib.mute", m ? "0" : "1"); e.target.textContent = m ? "🔔 الصوت مفعّل" : "🔕 الصوت متوقف"; if (m) chime("info"); };
    $("#perm", v)?.addEventListener("click", async () => { await Notification.requestPermission(); render(); });
    draw();
  },
});
