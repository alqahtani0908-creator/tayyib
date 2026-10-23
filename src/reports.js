// ───────────────────────── التقارير ─────────────────────────
const SCENT = ["قوي", "مناسب", "ضعيف", "منعدم"];
const REPORT_TYPES = {
  feasibility: { l: "تقرير التواصل مع الإمام", step: 4, icon: I.phone, by: "الجمعية",
    fields: () => [
      fld("date", "تاريخ التواصل", { type: "date", value: isoDay(), req: true }),
      fld("method", "طريقة التواصل", { opts: ["اتصال هاتفي", "زيارة ميدانية", "واتساب"] }),
      fld("contact", "تم التواصل مع", { opts: ["الإمام", "المؤذن", "خادم المسجد", "جماعة المسجد"] }),
      fld("result", "قابلية تطبيق المشروع", { opts: [["yes", "قابل للتطبيق — الإمام موافق"], ["no", "غير قابل للتطبيق"]], req: true }),
      fld("best_time", "الوقت المناسب للزيارة والتركيب", { ph: "مثال: بعد صلاة العصر" }),
      fld("notes", "ملاحظات وتفاصيل", { type: "textarea", full: true }),
    ],
    summary: (d) => (d.result === "yes" ? "قابل للتطبيق" : "غير قابل للتطبيق") + (d.method ? ` — ${d.method}` : ""),
    labels: { date: "تاريخ التواصل", method: "الطريقة", contact: "تم التواصل مع", result: "النتيجة", best_time: "الوقت المناسب", notes: "ملاحظات" },
    show: { result: (v) => v === "yes" ? "قابل للتطبيق" : "غير قابل للتطبيق" } },
  needs_study: { l: "تقرير دراسة الاحتياج", step: 5, icon: I.study, by: "الشركة المنفذة",
    fields: () => [
      fld("date", "تاريخ الزيارة", { type: "date", value: isoDay(), req: true }),
      fld("devices", "عدد الأجهزة المقترحة", { type: "number", req: true, attrs: 'min="1"' }),
      fld("device_type", "نوع الجهاز", { ph: "مثال: جهاز تعطير مركزي / جداري" }),
      fld("area", "المساحة التقريبية (م²)", { type: "number" }),
      fld("power", "توفر نقاط الكهرباء", { opts: ["متوفرة", "تحتاج تمديد", "غير متوفرة"] }),
      fld("fragrance", "العطر المقترح", { ph: "مثال: عود، مسك، ورد طائفي" }),
      fld("placement", "مواقع التركيب المقترحة", { type: "textarea", full: true, ph: "المصلى الرئيسي، مصلى النساء، المدخل، دورات المياه…" }),
      fld("notes", "ملاحظات فنية", { type: "textarea", full: true }),
    ],
    summary: (d) => `${d.devices || "?"} أجهزة${d.fragrance ? ` — ${d.fragrance}` : ""}`,
    labels: { date: "تاريخ الزيارة", devices: "عدد الأجهزة", device_type: "نوع الجهاز", area: "المساحة م²", power: "الكهرباء", fragrance: "العطر المقترح", placement: "مواقع التركيب", notes: "ملاحظات" } },
  decision: { l: "قرار مدير النظام", step: 6, icon: I.check, by: "مدير النظام", fields: () => [],
    labels: { approved: "القرار", note: "ملاحظة" }, show: { approved: (v) => v ? "اعتماد التركيب" : "إعادة الدراسة" } },
  installation: { l: "تقرير التركيب", step: 7, icon: I.install, by: "الشركة المنفذة",
    fields: (m) => [
      fld("date", "تاريخ التركيب", { type: "date", value: isoDay(), req: true }),
      fld("devices", "عدد الأجهزة المركبة", { type: "number", req: true, value: m?.devices_count || "", attrs: 'min="1"' }),
      fld("fragrance", "العطر المستخدم", { req: true, value: m?.fragrance || "" }),
      fld("cycle", "دورة التعبئة (يوم)", { type: "number", value: m?.refill_cycle_days || S.settings.refill_cycle_days || 30, hint: "يُحسب موعد التعبئة التالية تلقائيًا" }),
      fld("serials", "الأرقام التسلسلية للأجهزة", { type: "textarea", full: true }),
      fld("notes", "ملاحظات التركيب", { type: "textarea", full: true }),
    ],
    summary: (d) => `تركيب ${d.devices} أجهزة — ${d.fragrance}`,
    labels: { date: "تاريخ التركيب", devices: "عدد الأجهزة", fragrance: "العطر", cycle: "دورة التعبئة", serials: "الأرقام التسلسلية", notes: "ملاحظات" } },
  visit: { l: "تقرير الزيارة الأسبوعية", step: 8, icon: I.visit, by: "الجمعية",
    fields: (m) => [
      fld("date", "تاريخ الزيارة", { type: "date", value: isoDay(), req: true }),
      fld("status", "حالة الأجهزة", { opts: [["ok", "تعمل بشكل سليم"], ["issue", "توجد ملاحظة فنية"]], req: true }),
      fld("working", "عدد الأجهزة العاملة", { type: "number", value: m?.devices_count || "" }),
      fld("scent", "مستوى الرائحة", { opts: SCENT }),
      ratingFld("cleanliness", "نظافة الأجهزة ومحيطها"),
      fld("notes", "ملاحظات الزيارة", { type: "textarea", full: true }),
    ],
    summary: (d) => (d.status === "issue" ? "ملاحظة فنية" : "الأجهزة سليمة") + (d.scent ? ` — الرائحة ${d.scent}` : "") + (d.notes ? ` — ${d.notes.slice(0, 60)}` : ""),
    labels: { date: "تاريخ الزيارة", status: "حالة الأجهزة", working: "الأجهزة العاملة", scent: "مستوى الرائحة", cleanliness: "النظافة", notes: "ملاحظات" },
    show: { status: (v) => v === "issue" ? "⚠️ توجد ملاحظة فنية" : "✓ سليمة", cleanliness: (v) => v ? `${v} / 5` : "—" } },
  satisfaction: { l: "قياس الرضا عن الرائحة والعطر", step: 9, icon: I.star, by: "الجمعية",
    fields: () => [
      fld("date", "تاريخ القياس", { type: "date", value: isoDay(), req: true }),
      fld("respondent", "الفئة المستطلعة", { opts: ["الإمام", "المؤذن", "خادم المسجد", "عينة من المصلين", "جماعة المسجد"] }),
      fld("sample", "عدد المستطلعين", { type: "number", value: 1, attrs: 'min="1"' }),
      ratingFld("scent", "الرضا عن نوع العطر"),
      ratingFld("intensity", "الرضا عن قوة الرائحة وانتشارها"),
      ratingFld("overall", "الرضا العام", null),
      fld("comments", "آراء ومقترحات", { type: "textarea", full: true }),
    ],
    validate: (d) => d.overall ? null : "حدد درجة الرضا العام",
    summary: (d) => `الرضا العام ${d.overall}/5 — ${d.respondent}`,
    labels: { date: "تاريخ القياس", respondent: "الفئة", sample: "العدد", scent: "نوع العطر", intensity: "قوة الرائحة", overall: "الرضا العام", comments: "آراء" },
    show: { scent: (v) => v ? `${v} / 5` : "—", intensity: (v) => v ? `${v} / 5` : "—", overall: (v) => v ? `${v} / 5` : "—" } },
  monthly: { l: "التقرير الشهري لأداء التعطير", step: 10, icon: I.report, by: "الجمعية",
    fields: (m, ctx = {}) => [
      fld("month", "الشهر", { type: "month", value: ctx.month || monthKey(), req: true }),
      ratingFld("performance", "تقييم أداء التعطير خلال الشهر"),
      fld("visits", "عدد الزيارات", { type: "number", value: ctx.visits ?? "", hint: "محسوب من تقارير الزيارات" }),
      fld("satisfaction", "متوسط الرضا", { value: ctx.satisfaction ?? "", hint: "محسوب من قياسات الرضا" }),
      fld("refills", "عدد مرات التعبئة", { type: "number", value: ctx.refills ?? "" }),
      fld("scent", "مستوى الرائحة الغالب", { opts: SCENT }),
      fld("issues", "الملاحظات والمشكلات", { type: "textarea", full: true }),
      fld("recommendations", "التوصيات", { type: "textarea", full: true }),
    ],
    validate: (d) => d.performance ? null : "حدد تقييم الأداء",
    summary: (d) => `${monthName(d.month)} — الأداء ${d.performance}/5`,
    labels: { month: "الشهر", performance: "تقييم الأداء", visits: "الزيارات", satisfaction: "متوسط الرضا", refills: "التعبئات", scent: "الرائحة", issues: "الملاحظات", recommendations: "التوصيات" },
    show: { performance: (v) => v ? `${v} / 5` : "—", month: (v) => v ? monthName(v) : "—" } },
  refill: { l: "تقرير التعبئة الشهرية", step: 11, icon: I.drop, by: "الشركة المنفذة",
    fields: (m) => [
      fld("date", "تاريخ ووقت التعبئة", { type: "datetime-local", value: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16), req: true }),
      fld("fragrance", "العطر", { value: m?.fragrance || "" }),
      fld("quantity", "الكمية (مل)", { type: "number" }),
      fld("devices", "عدد الأجهزة التي عُبّئت", { type: "number", value: m?.devices_count || "" }),
      fld("notes", "ملاحظات", { type: "textarea", full: true }),
    ],
    summary: (d) => `تعبئة ${d.devices || ""} أجهزة${d.quantity ? ` — ${d.quantity} مل` : ""}${d.fragrance ? ` — ${d.fragrance}` : ""}`,
    labels: { date: "التاريخ", fragrance: "العطر", quantity: "الكمية (مل)", devices: "الأجهزة", notes: "ملاحظات" },
    show: { date: (v) => fmtDateTime(v) } },
  note: { l: "ملاحظة", icon: I.chat, by: "", fields: () => [fld("text", "الملاحظة", { type: "textarea", full: true, req: true })],
    summary: (d) => d.text.slice(0, 120), labels: { text: "الملاحظة" } },
};

function reportDetails(r) {
  const T = REPORT_TYPES[r.type] || { labels: {} };
  const d = r.data || {};
  const rows = Object.entries(T.labels || {}).filter(([k]) => d[k] !== undefined && d[k] !== "" && d[k] !== null)
    .map(([k, l]) => [l, T.show?.[k] ? T.show[k](d[k]) : (k === "date" ? fmtDate(d[k]) : d[k])]);
  return rows;
}
function reportCard(r, atts = [], authors = {}) {
  const T = REPORT_TYPES[r.type] || { l: r.type, icon: I.report };
  const rows = reportDetails(r);
  return `<div class="tl-item" data-report="${r.id}"><div class="ti">${T.icon}</div><div class="tb">
    <div class="th"><b>${esc(T.l)}</b>${T.step ? `<span class="chip plain">الخطوة ${T.step}</span>` : ""}
      ${r.type === "visit" && r.data?.status === "issue" ? `<span class="chip bad">ملاحظة فنية</span>` : ""}
      ${r.type === "decision" ? `<span class="chip ${r.data?.approved ? "ok" : "warn"}">${r.data?.approved ? "معتمد" : "أعيدت الدراسة"}</span>` : ""}
      <span class="muted small right">${esc(authors[r.author_id] || ROLES[r.author_role] || "")} · ${fmtDateTime(r.created_at)}</span>
      <button class="btn ghost sm no-print" data-print-report="${r.id}" title="طباعة">${I.print}</button></div>
    ${rows.length ? `<dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd style="white-space:pre-wrap">${esc(v)}</dd></div>`).join("")}</dl>` : r.summary ? `<div class="small">${esc(r.summary)}</div>` : ""}
    ${filesHtml(atts)}</div></div>`;
}
function printReport(r, m) {
  const T = REPORT_TYPES[r.type] || { l: r.type };
  const rows = reportDetails(r);
  printDoc(T.l, `<h2>${esc(m?.name || "")} <small style="color:#777">${esc(m?.code || "")}</small></h2>
    <table><tr><th>الحي</th><td>${esc(m?.district || "—")}</td></tr><tr><th>الجمعية المشرفة</th><td>${esc(assocName(m?.association_id))}</td></tr>
    <tr><th>تاريخ الرفع</th><td>${fmtDateTime(r.created_at)}</td></tr><tr><th>الجهة</th><td>${esc(ROLES[r.author_role] || "")}</td></tr></table>
    <h2>تفاصيل التقرير</h2><table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td style="white-space:pre-wrap">${esc(v)}</td></tr>`).join("")}</table>`);
}

// نافذة رفع تقرير لمسجد — تعيد true عند النجاح
async function openReportForm(m, type, ctx = {}) {
  const T = REPORT_TYPES[type];
  if (type === "monthly" && !ctx.month) Object.assign(ctx, await monthlyContext(m, monthKey()));
  const body = document.createElement("div");
  body.innerHTML = `<div class="row" style="margin-bottom:14px">${stageChip(m.stage)}<b>${esc(m.name)}</b><span class="muted small">${esc(m.code)}</span></div>
    <form class="form" onsubmit="return false">${T.fields(m, ctx).join("")}</form>
    <div class="field" style="margin-top:14px"><label>المرفقات (صور وملفات PDF)</label><div data-up></div></div>`;
  const up = uploader();
  $("[data-up]", body).appendChild(up);
  bindRatings(body);
  if (type === "monthly") {
    $('[name="month"]', body).onchange = async (e) => {
      const c = await monthlyContext(m, e.target.value);
      $('[name="visits"]', body).value = c.visits; $('[name="satisfaction"]', body).value = c.satisfaction ?? ""; $('[name="refills"]', body).value = c.refills;
    };
  }
  return modal({
    title: T.l, body, wide: true,
    actions: [{
      label: `${I.check} رفع التقرير`, cls: "primary", onClick: async (mb) => {
        const d = formData($("form", mb));
        const missing = $$("[name]", mb).find((el) => el.closest(".field")?.querySelector(".req") && !el.value.trim());
        if (missing) { toast("أكمل الحقول المطلوبة", "err"); missing.focus(); return false; }
        const v = T.validate?.(d);
        if (v) { toast(v, "err"); return false; }
        if (type === "refill" && d.date) d.date = new Date(d.date).toISOString();
        if ((type === "installation" || type === "visit") && d.date) d.date = new Date(d.date + "T09:00:00").toISOString();
        const { data: rep, error } = await sb.rpc("submit_report", { p_mosque: m.id, p_type: type, p_data: d, p_summary: T.summary ? T.summary(d) : null });
        if (error) { toast(errMsg(error), "err"); return false; }
        if (up.files.length) await uploadFiles(up.files, { mosqueId: m.id, reportId: rep.id, ui: up });
        toast("تم رفع التقرير بنجاح");
        await refreshMosque(m.id);
        return true;
      },
    }, { label: "إلغاء" }],
  });
}
async function monthlyContext(m, ym) {
  const start = new Date(ym + "-01T00:00:00"), end = new Date(start); end.setMonth(end.getMonth() + 1);
  const { data } = await sb.from("reports").select("type,data,created_at").eq("mosque_id", m.id).gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
  const rs = data || [];
  const sat = rs.filter((r) => r.type === "satisfaction" && r.data?.overall).map((r) => +r.data.overall);
  return { month: ym, visits: rs.filter((r) => r.type === "visit").length, refills: rs.filter((r) => r.type === "refill").length,
    satisfaction: sat.length ? (sat.reduce((a, b) => a + b, 0) / sat.length).toFixed(2) : null };
}
