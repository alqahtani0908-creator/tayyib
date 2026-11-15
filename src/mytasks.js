// ───────────────────────── مهامي ─────────────────────────
// كل ما يجب على المستخدم اتخاذ إجراء فيه حسب الموعد، محسوب في الخادم (my_tasks) حسب صلاحيته،
// ويصله ملخص يومي بالمتأخر والمستحق اليوم (send_task_digest).
const MT_KIND = {
  assign: [I.org, "الإسناد", "إسناد الآن"], decide: [I.check, "اعتماد التركيب", "مراجعة واعتماد"], complaint: [I.chat, "الشكاوى", "فتح الشكوى"],
  complete: [I.edit, "استكمال البيانات", "استكمال البيانات"], feasibility: [I.phone, "التواصل مع الإمام", "رفع التقرير"], visit: [I.visit, "التقرير الأسبوعي", "رفع التقرير الأسبوعي"],
  monthly: [I.report, "التقارير الشهرية", "رفع التقرير"], study: [I.study, "دراسة الاحتياج", "رفع الدراسة"], install: [I.install, "التركيب", "رفع تقرير التركيب"],
  refill: [I.drop, "التعبئة", "تسجيل التعبئة"], oil: [I.box, "المستودع", "فتح الطلب"], task: [I.tasks, "المهام والطلبات", "فتح المهمة"],
};
const MT_SLA = [["assign", "إسناد المسجد لجمعية (المدير)"], ["decide", "اعتماد التركيب بعد الدراسة (المدير)"], ["complaint", "التعامل مع شكوى جديدة (المدير)"],
  ["complete", "استكمال بيانات المسجد (الجمعية)"], ["feasibility", "التواصل مع الإمام (الجمعية)"], ["assoc_complaint", "الرد على شكوى موجّهة (الجمعية)"],
  ["weekly", "التقرير الأسبوعي: آخر يوم لرفعه (الجمعية)"], ["monthly", "التقرير الشهري: يوم من بداية الشهر (الجمعية)"], ["oil", "اعتماد طلب الزيت من المستودع (المدير)"], ["study", "دراسة الاحتياج (الشركة)"], ["install", "التركيب بعد الاعتماد (الشركة)"]];
const MT_DEFAULT = { assign: 3, complete: 7, feasibility: 7, study: 10, decide: 3, install: 14, complaint: 2, assoc_complaint: 3, monthly: 5, weekly: 5, oil: 1 };
const MT_WEEKDAYS = [["1", "الأحد"], ["2", "الاثنين"], ["3", "الثلاثاء"], ["4", "الأربعاء"], ["5", "الخميس"], ["6", "الجمعة"], ["7", "السبت"]];
const mtState = { filter: "", kind: "" };

// تصنيف الموعد: متأخرة / اليوم / غدًا / هذا الأسبوع / لاحقًا (بتوقيت الجهاز)
function mtBucket(due) {
  const d = new Date(due), now = new Date(), sod = new Date(now); sod.setHours(0, 0, 0, 0);
  const day = 864e5, t = d - sod;
  if (d < now) return "late";
  if (t < day) return "today";
  if (t < 2 * day) return "tomorrow";
  if (t < 7 * day) return "week";
  return "later";
}
const MT_BUCKETS = [["late", "متأخرة", "bad"], ["today", "اليوم", "warn"], ["tomorrow", "غدًا", "gold"], ["week", "خلال الأسبوع", "info"], ["later", "لاحقًا", "plain"]];
function mtDueText(due) {
  const d = new Date(due), now = new Date(), days = Math.round((d - now) / 864e5), b = mtBucket(due);
  if (b === "late") { const n = Math.max(1, Math.floor((now - d) / 864e5)); return n <= 1 && now - d < 864e5 ? `متأخرة منذ ${Math.max(1, Math.round((now - d) / 36e5))} ساعة` : `متأخرة ${fmtNum(n)} ${n <= 10 ? "أيام" : "يومًا"}`; }
  if (b === "today") return `اليوم ${d.toLocaleTimeString(AR_LOCALE, { hour: "numeric", minute: "2-digit" })}`;
  if (b === "tomorrow") return "غدًا";
  return `${fmtDate(due)} • بعد ${fmtNum(Math.max(2, days))} ${days <= 10 ? "أيام" : "يومًا"}`;
}

// شارة عدد المتأخر والمستحق اليوم في القائمة
async function paintMyBadge() {
  if (!["admin", "association", "company"].includes(role())) return;
  const { data } = await sb.rpc("my_tasks");
  const n = (data || []).filter((x) => ["late", "today"].includes(mtBucket(x.due))).length;
  $$('.nav a[data-r="my"] .badge, .bnav a[data-r="my"] .badge').forEach((b) => { b.textContent = n || ""; b.hidden = !n; });
  return data || [];
}

route("my", {
  title: "مهامي",
  async render(v) {
    v.innerHTML = `<div class="empty">${I.tasks}جارٍ التحميل…</div>`;
    const { data, error } = await sb.rpc("my_tasks");
    if (error) { v.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    const items = (data || []).map((x) => ({ ...x, b: mtBucket(x.due) })).sort((a, b) => new Date(a.due) - new Date(b.due));
    const count = (b) => items.filter((x) => x.b === b).length;
    const kinds = [...new Set(items.map((x) => x.k))];
    if (mtState.kind && !kinds.includes(mtState.kind)) mtState.kind = "";
    const draw = () => {
      const list = items.filter((x) => (!mtState.filter || x.b === mtState.filter) && (!mtState.kind || x.k === mtState.kind));
      v.innerHTML = `<div class="mt-head">
          <div class="grow"><div class="muted small">${esc(new Date().toLocaleDateString(AR_LOCALE, { weekday: "long", day: "numeric", month: "long" }))}</div>
            <h2>${items.length ? `لديك ${fmtNum(items.length)} ${items.length <= 10 ? "مهام" : "مهمة"} تنتظر إجراءك` : "لا توجد مهام تنتظرك"}</h2>
            <div class="muted small">تُرتَّب حسب الموعد، ويصلك تذكير يومي الساعة 7 صباحًا بالمتأخر والمستحق اليوم.</div></div>
          <button class="iconbtn" id="mt-refresh" title="تحديث" aria-label="تحديث">${svg('<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/>')}</button></div>
        <div class="mt-stats">${MT_BUCKETS.slice(0, 4).map(([b, l, c]) => `<button class="card mt-stat t-${c} ${mtState.filter === b ? "on" : ""}" data-b="${b}"><span>${l}</span><b class="num">${fmtNum(count(b) + (b === "week" ? 0 : 0))}</b></button>`).join("")}
          <button class="card mt-stat ${!mtState.filter ? "on" : ""}" data-b=""><span>الكل</span><b class="num">${fmtNum(items.length)}</b></button></div>
        ${kinds.length > 1 ? `<div class="mt-kinds"><button class="fc ${!mtState.kind ? "inc" : ""}" data-k=""><span class="fc-i"></span>كل الأنواع</button>${kinds.map((k) => `<button class="fc ${mtState.kind === k ? "inc" : ""}" data-k="${k}"><span class="fc-i"></span>${MT_KIND[k]?.[1] || k}<small class="num">${fmtNum(items.filter((x) => x.k === k).length)}</small></button>`).join("")}</div>` : ""}
        <div class="mt-groups">${MT_BUCKETS.map(([b, l, c]) => {
          const g = list.filter((x) => x.b === b); if (!g.length) return "";
          return `<section class="mt-group"><div class="mt-gh t-${c}"><i></i><b>${l}</b><span class="num">${fmtNum(g.length)}</span></div><div class="mt-list">${g.map((x) => `<a class="card mt-item t-${c}" href="#${esc(x.link)}">
            <span class="mt-ic">${MT_KIND[x.k]?.[0] || I.tasks}</span>
            <span class="grow"><b>${esc(x.title)}</b>${x.mosque ? `<span class="mt-m">${I.mosque}${esc(x.mosque)}${x.district ? ` • ${esc(x.district)}` : ""}</span>` : ""}${x.note ? `<span class="mt-note">${esc(x.note)}</span>` : ""}</span>
            <span class="mt-due"><span class="chip ${c}">${esc(mtDueText(x.due))}</span>${x.priority === "urgent" || x.priority === "high" ? `<span class="chip bad plain">${x.priority === "urgent" ? "عاجلة" : "مهمة"}</span>` : ""}<span class="btn sm">${MT_KIND[x.k]?.[2] || "فتح"} ←</span></span></a>`).join("")}</div></section>`;
        }).join("") || `<div class="card"><div class="bd empty" style="padding:40px">${I.check}<b style="display:block;font-size:17px;margin:6px 0">${items.length ? "لا توجد مهام في هذا التصنيف" : "أحسنت! لا توجد مهام تنتظرك الآن"}</b><span class="muted small">تظهر هنا تلقائيًا كل خطوة تحتاج إجراءك مع موعدها.</span></div></div>`}</div>`;
      $$(".mt-stat", v).forEach((b) => b.onclick = () => { mtState.filter = mtState.filter === b.dataset.b ? "" : b.dataset.b; draw(); });
      $$(".mt-kinds [data-k]", v).forEach((b) => b.onclick = () => { mtState.kind = b.dataset.k; draw(); });
      $("#mt-refresh", v).onclick = () => render();
    };
    draw();
    paintMyBadge();
  },
});
