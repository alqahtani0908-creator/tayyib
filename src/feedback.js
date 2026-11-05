// ───────────────────────── الشكاوى والاقتراحات، واستبيان الرضا، والباركود ─────────────────────────
// يصل الجمهور عبر صفحة docs/f/ (باركود المسجد أو رابط عام)، ويتعامل معها المدير والجمعيات من هنا.
const C_STATUS = { new: ["جديدة", "warn"], assigned: ["لدى الجمعية", "info"], responded: ["أجابت الجمعية", "gold"], closed: ["مغلقة", "ok"] };
const C_ACTION = { contact: "تواصل", dismiss: "صرف نظر", fix: "تعديل", other: "أخرى" };
const C_KIND = { complaint: "شكوى", suggestion: "اقتراح" };
const cStatus = (s) => `<span class="chip ${C_STATUS[s]?.[1] || ""}">${C_STATUS[s]?.[0] || s}</span>`;
const cKind = (k) => `<span class="chip ${k === "suggestion" ? "gold" : "plain"} plain">${C_KIND[k] || k}</span>`;

// روابط الصفحة العامة: باركود المسجد (اختيار تقييم أو شكوى)، أو رابط عام يحدد المسجد بالأسئلة
const publicBase = () => new URL(ASSETS.replace(/assets\/$/, "f/"), location.href).href;
const mosqueLink = (m, act = "") => `${publicBase()}?m=${encodeURIComponent(m.public_token || "")}${act ? `&do=${act}` : ""}`;
const surveyLink = (sid) => `${publicBase()}?do=survey${sid ? `&s=${sid}` : ""}`;

// مولّد الباركود (يُحمّل عند الحاجة فقط)
let qrReady = null;
const loadQR = () => qrReady ||= new Promise((ok, fail) => {
  const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  s.onload = ok; s.onerror = () => { qrReady = null; fail(new Error("تعذر تحميل مولّد الباركود")); }; document.head.appendChild(s);
});
const qrSvg = (text) => { const q = qrcode(0, "M"); q.addData(text, "Byte"); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); };

// نافذة باركود المسجد: باركود واحد يفتح صفحة التقييم والشكوى، مع الروابط المباشرة
async function qrDialog(m) {
  try { await loadQR(); } catch (e) { return toast(errMsg(e), "err"); }
  const link = mosqueLink(m);
  const body = `<div class="qrd"><div class="qr-box">${qrSvg(link)}</div><div class="stack" style="gap:10px">
      <div><b style="font-size:17px">${esc(m.name)}</b><div class="muted small">${esc([m.district, regionName(m.region)].filter(Boolean).join(" • "))} • الرمز <span class="num">${esc(m.public_token)}</span></div></div>
      <div class="hint">يمسحه المصلّي بكاميرا الجوال فتظهر له صفحة «قيّم رائحة المسجد» و«شكوى أو اقتراح»، ويُسجَّل المسجد تلقائيًا.</div>
      ${[["رابط المسجد (تقييم أو شكوى)", link], ["رابط الاستبيان مباشرة", mosqueLink(m, "survey")], ["رابط الشكوى مباشرة", mosqueLink(m, "complaint")]].map(([l, u]) =>
        `<div class="qr-link"><span class="small muted">${l}</span><div class="row" style="gap:6px;flex-wrap:nowrap"><input class="input" readonly value="${esc(u)}" dir="ltr"><button class="btn sm" data-copy="${esc(u)}" title="نسخ">${I.copy}</button></div></div>`).join("")}
    </div></div>`;
  modal({ title: "باركود المسجد", body, wide: true, onOpen: (mb) => mb.querySelectorAll("[data-copy]").forEach((b) => b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast("تم نسخ الرابط"))),
    actions: [{ label: `${I.print} طباعة الملصق`, cls: "primary", onClick: () => { printPosters([m]); return true; } }, { label: "إغلاق" }] });
}

// ملصقات الباركود للطباعة (ملصق لكل مسجد في صفحة، أو ملصق عام للاستبيان)
async function printPosters(list, general = null) {
  try { await loadQR(); } catch (e) { return toast(errMsg(e), "err"); }
  const pages = (general ? [{ name: general.title, sub: "اختر المسجد من الأسئلة ثم أجب عن الاستبيان", link: general.link }] : list.map((m) => ({ name: m.name, sub: [m.district, regionName(m.region)].filter(Boolean).join(" • "), link: mosqueLink(m), code: m.public_token })))
    .map((p) => `<section class="poster"><div class="pt-head">${logoSvg()}<span>${esc(S.settings.org_name || "مشروع تعطير مساجد الرياض")}</span></div>
      <h1>${general ? "رأيك يهمّنا" : "عطّرنا بيت الله.. فما رأيك؟"}</h1><h2>${esc(p.name)}</h2>${p.sub ? `<div class="pt-sub">${esc(p.sub)}</div>` : ""}
      <div class="pt-qr">${qrSvg(p.link)}</div>
      <div class="pt-do"><span>⭐ قيّم رائحة المسجد</span><span>💬 شكوى أو اقتراح</span></div>
      <p class="pt-how">وجّه كاميرا جوالك نحو الرمز ثم اضغط على الرابط الظاهر</p>
      <div class="pt-foot"><img src="${foundationLogo()}" alt="">${p.code ? `<span class="num">${esc(p.code)}</span>` : ""}</div></section>`).join("");
  let el = $("#printdoc");
  if (!el) { el = document.createElement("div"); el.id = "printdoc"; document.body.appendChild(el); }
  el.innerHTML = `<style>@page { size: A4; margin: 0; }</style><div class="posters" dir="rtl">${pages}</div>`;
  document.body.classList.add("printing-doc");
  const oldTitle = document.title; document.title = general ? "باركود-الاستبيان" : list.length === 1 ? `باركود-${list[0].name}` : `باركود-${list.length}-مسجد`;
  const done = () => { document.body.classList.remove("printing-doc"); document.title = oldTitle; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 300);
}

// شارة عدد الشكاوى التي تنتظر التعامل في القائمة الجانبية
async function paintComplaintBadge() {
  const r = role(); if (r !== "admin" && r !== "association") return;
  const { count } = await sb.from("complaints").select("id", { count: "exact", head: true }).in("status", r === "admin" ? ["new", "responded"] : ["assigned"]);
  $$('.nav a[data-r="complaints"] .badge, .bnav a[data-r="complaints"] .badge').forEach((b) => { b.textContent = count || ""; b.hidden = !count; });
}

// ───── الشكاوى والاقتراحات ─────
route("complaints", {
  title: "الشكاوى والاقتراحات",
  async render(v) {
    if (S.params.id) return complaintDetail(v, S.params.id);
    await loadMosques();
    const r = role(), p = S.params;
    const { data: list, error } = await sb.from("complaints").select("*").order("created_at", { ascending: false });
    if (error) { v.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    const f = { st: p.st || (r === "association" ? "assigned" : "open"), kind: p.kind || "", q: p.q || "", mosque: p.mosque || "" };
    const mq = (id) => S.mosques.find((m) => m.id === id);
    const tabs = [["open", "تحتاج إجراء", (c) => c.status !== "closed"], ["new", "جديدة", (c) => c.status === "new"], ["assigned", "لدى الجمعية", (c) => c.status === "assigned"],
      ["responded", "أجابت الجمعية", (c) => c.status === "responded"], ["closed", "مغلقة", (c) => c.status === "closed"], ["all", "الكل", () => true]];
    v.innerHTML = `<div class="kpis" style="margin-bottom:14px">
        <div class="card kpi alert"><div class="lbl">${I.alert}جديدة</div><div class="val">${list.filter((c) => c.status === "new").length}</div></div>
        <div class="card kpi"><div class="lbl">${I.org}لدى الجمعيات</div><div class="val">${list.filter((c) => c.status === "assigned").length}</div></div>
        <div class="card kpi warn"><div class="lbl">${I.chat}أجابت الجمعية</div><div class="val">${list.filter((c) => c.status === "responded").length}</div><div class="sub">بانتظار الإغلاق</div></div>
        <div class="card kpi"><div class="lbl">${I.check}مغلقة</div><div class="val">${list.filter((c) => c.status === "closed").length}</div><div class="sub">${fmtNum(list.filter((c) => c.kind === "suggestion").length)} اقتراح • ${fmtNum(list.filter((c) => c.kind === "complaint").length)} شكوى</div></div>
      </div>
      <div class="card"><div class="toolbar">
        <div class="seg" id="c-tabs">${tabs.map(([k, l, fn]) => `<button data-st="${k}" class="${f.st === k ? "on" : ""}">${l} <span class="num">${list.filter(fn).length}</span></button>`).join("")}</div>
        <select class="input" id="c-kind" style="width:auto"><option value="">الشكاوى والاقتراحات</option><option value="complaint" ${f.kind === "complaint" ? "selected" : ""}>الشكاوى</option><option value="suggestion" ${f.kind === "suggestion" ? "selected" : ""}>الاقتراحات</option></select>
        <div class="search">${I.search}<input class="input" id="c-q" type="search" placeholder="بحث بالنص أو المسجد أو الاسم أو الجوال…" value="${esc(f.q)}"></div>
        <button class="btn sm" id="c-exp">${I.download} تصدير</button>
      </div>${f.mosque && mq(f.mosque) ? `<div class="adv-sum"><span class="sc"><b>المسجد:</b> ${esc(mq(f.mosque).name)}<button data-clr-m aria-label="إزالة">×</button></span></div>` : ""}
      <div id="c-rows"></div></div>`;
    const shown = () => {
      const q = f.q.trim().toLowerCase(), tab = tabs.find(([k]) => k === f.st)[2];
      return list.filter((c) => tab(c) && (!f.kind || c.kind === f.kind) && (!f.mosque || c.mosque_id === f.mosque)
        && (!q || [c.body, c.name, c.phone, mq(c.mosque_id)?.name, String(c.ref)].some((x) => String(x || "").toLowerCase().includes(q))));
    };
    const draw = () => {
      const rows = shown();
      $("#c-rows", v).innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>النوع</th><th>المسجد</th><th>النص</th><th>الإجراء</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
        ${rows.map((c) => `<tr class="click" data-c="${c.id}"><td class="num muted">${c.ref}</td><td>${cKind(c.kind)}</td>
          <td><b>${esc(mq(c.mosque_id)?.name || "—")}</b><div class="small muted">${esc(mq(c.mosque_id)?.district || "")}</div></td>
          <td style="max-width:360px"><div class="clip2">${esc(c.body)}</div>${c.name || c.phone ? `<div class="small muted">${esc([c.name, displayPhone(c.phone)].filter(Boolean).join(" • "))}</div>` : ""}</td>
          <td>${c.action ? `<span class="chip plain">${C_ACTION[c.action]}</span>` : `<span class="muted small">—</span>`}</td>
          <td>${cStatus(c.status)}</td><td class="small muted nowrap">${ago(c.created_at)}</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="empty">${I.chat}${list.length ? "لا توجد نتائج مطابقة" : "لم تصل أي شكوى أو اقتراح بعد. اطبع باركود المساجد من صفحة كل مسجد أو من قائمة المساجد."}</div>`;
    };
    const setParam = () => history.replaceState(null, "", "#/complaints?" + new URLSearchParams(Object.entries(f).filter(([, x]) => x)).toString());
    $("#c-tabs", v).onclick = (e) => { const b = e.target.closest("[data-st]"); if (!b) return; f.st = b.dataset.st; $$("#c-tabs button", v).forEach((x) => x.classList.toggle("on", x === b)); draw(); setParam(); };
    $("#c-kind", v).onchange = (e) => { f.kind = e.target.value; draw(); setParam(); };
    $("#c-q", v).oninput = (e) => { f.q = e.target.value; draw(); setParam(); };
    $("[data-clr-m]", v)?.addEventListener("click", () => { f.mosque = ""; setParam(); render(); });
    $("#c-rows", v).onclick = (e) => { const t = e.target.closest("[data-c]"); if (t) go("/complaints/" + t.dataset.c); };
    $("#c-exp", v).onclick = () => exportXlsx(shown().map((c) => ({ "رقم": c.ref, "النوع": C_KIND[c.kind], "المسجد": mq(c.mosque_id)?.name || "", "الحي": mq(c.mosque_id)?.district || "", "النص": c.body,
      "الاسم": c.name || "", "الجوال": displayPhone(c.phone) || "", "الإجراء": C_ACTION[c.action] || "", "الحالة": C_STATUS[c.status]?.[0] || c.status,
      "الجمعية": c.association_id ? assocName(c.association_id) : "", "التاريخ": fmtDateTime(c.created_at), "أُغلقت": c.closed_at ? fmtDateTime(c.closed_at) : "" })), `الشكاوى-${isoDay()}.xlsx`, "الشكاوى", { title: "سجل الشكاوى والاقتراحات" });
    draw();
  },
});

async function complaintDetail(v, id) {
  await Promise.all([loadMosques(), loadAssociations()]);
  const r = role();
  const [{ data: c, error }, { data: ev }] = await Promise.all([sb.from("complaints").select("*").eq("id", id).maybeSingle(), sb.from("complaint_events").select("*").eq("complaint_id", id).order("created_at")]);
  if (error || !c) { v.innerHTML = `<div class="empty">${I.chat}الشكوى غير موجودة أو لا تملك صلاحية عرضها</div>`; return; }
  const m = S.mosques.find((x) => x.id === c.mosque_id);
  $(".topbar h1").textContent = `${C_KIND[c.kind]} رقم ${c.ref}`;
  const EV = { created: [I.chat, "وصلت من المصلّي عبر الباركود"], action: [I.check, "اتخاذ إجراء"], note: [I.edit, "ملاحظة"], assigned: [I.org, "توجيه للجمعية"], response: [I.report, "ردّ الجمعية"], closed: [I.check, "إغلاق"], reopened: [I.clock, "إعادة فتح"] };
  const who = (e) => e.actor_role === "association" ? "الجمعية" : e.actor_role === "admin" ? "مدير النظام" : "";
  const greet = `السلام عليكم${c.name ? ` ${c.name}` : ""}، بخصوص ${C_KIND[c.kind]}ك رقم ${c.ref} عن ${m?.name || "المسجد"}: `;
  v.innerHTML = `<div class="row" style="margin-bottom:12px"><a class="btn sm ghost" href="#/complaints">→ كل الشكاوى</a></div>
    <div class="grid g3">
      <div class="span2 stack">
        <div class="card"><div class="bd stack" style="gap:12px">
          <div class="row" style="gap:8px;flex-wrap:wrap">${cKind(c.kind)}${cStatus(c.status)}${c.action ? `<span class="chip plain">الإجراء: ${C_ACTION[c.action]}</span>` : ""}<span class="muted small right">${fmtDateTime(c.created_at)} • ${ago(c.created_at)}</span></div>
          <div class="c-body">${esc(c.body)}</div>
          <div class="c-meta">
            <div><span>المسجد</span>${m ? `<a href="#/mosque/${m.id}"><b>${esc(m.name)}</b></a><small>${esc([m.district, regionName(m.region)].filter(Boolean).join(" • "))}</small>` : "<b>—</b>"}</div>
            <div><span>المرسل</span><b>${esc(c.name || "لم يذكر اسمه")}</b>${c.phone ? `<small class="num" dir="ltr">${esc(displayPhone(c.phone))}</small>` : `<small>لم يترك رقمًا</small>`}</div>
            ${c.phone ? `<div><span>التواصل</span>${contactBtns({ phone: c.phone, name: c.name, text: greet })}</div>` : ""}
            ${c.association_id ? `<div><span>الجمعية</span><b>${esc(assocName(c.association_id))}</b></div>` : ""}
          </div></div></div>
        <div class="card"><div class="hd"><h3>سجل التعامل</h3><span class="muted small right">${fmtNum((ev || []).length)} حدث</span></div><div class="bd"><div class="tl">
          ${(ev || []).map((e) => `<div class="tl-item"><div class="ti">${EV[e.kind]?.[0] || I.bell}</div><div class="tb"><div class="th"><b>${EV[e.kind]?.[1] || e.kind}${e.action ? `: ${C_ACTION[e.action]}` : ""}</b>${who(e) ? `<span class="chip plain">${who(e)}</span>` : ""}<span class="muted small right">${fmtDateTime(e.created_at)}</span></div>
            ${e.note ? `<div style="margin-top:6px;white-space:pre-wrap">${esc(e.kind === "assigned" ? `وُجّهت إلى: ${e.note}` : e.note)}</div>` : ""}</div></div>`).join("")}
        </div></div></div>
      </div>
      <div class="stack">${r === "admin" ? (c.status === "closed"
        ? `<div class="card"><div class="hd"><h3>الشكوى مغلقة</h3></div><div class="bd stack"><div class="muted small">أُغلقت ${fmtDateTime(c.closed_at)}</div>
            <textarea class="input" id="ro-note" placeholder="سبب إعادة الفتح (اختياري)"></textarea><button class="btn" id="reopen">${I.clock} إعادة فتح</button></div></div>`
        : `<div class="card c-act"><div class="hd"><h3>اتخاذ إجراء</h3></div><div class="bd stack">
            <div class="seg rg-pick c-actions">${Object.entries(C_ACTION).map(([k, l]) => `<label><input type="radio" name="act" value="${k}" ${c.action === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
            <div class="field"><label>الملاحظات</label><textarea class="input" id="a-note" rows="4" placeholder="ما الذي تم أو سيتم؟"></textarea></div>
            <label class="c-check"><input type="checkbox" id="a-assign" ${c.association_id ? "" : m?.association_id ? "checked" : ""}> توجيه الجمعية للتجاوب مع الشكوى</label>
            <select class="input" id="a-assoc">${S.associations.filter((a) => a.active || a.id === c.association_id).map((a) => `<option value="${a.id}" ${(c.association_id || m?.association_id) === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
            <label class="c-check"><input type="checkbox" id="a-close" ${c.status === "responded" ? "checked" : ""}> إغلاق الشكوى بعد الحفظ</label>
            <button class="btn primary" id="a-save">${I.check} حفظ الإجراء</button></div></div>`)
      : r === "association" && c.status !== "closed" ? `<div class="card c-act"><div class="hd"><h3>ردّ الجمعية</h3></div><div class="bd stack">
            <textarea class="input" id="r-note" rows="5" placeholder="ما الذي قامت به الجمعية؟"></textarea>
            <label class="c-check"><input type="checkbox" id="r-done" checked> تم التعامل مع الشكوى</label>
            <button class="btn primary" id="r-send">${I.send} إرسال الرد</button><div class="hint">يصل الرد لمدير النظام ليغلق الشكوى.</div></div></div>` : ""}
      </div>
    </div>`;
  const toggleAssoc = () => { const s = $("#a-assoc", v); if (s) s.hidden = !$("#a-assign", v).checked; };
  $("#a-assign", v)?.addEventListener("change", toggleAssoc); toggleAssoc();
  $("#a-save", v)?.addEventListener("click", async () => {
    const act = $('[name="act"]:checked', v)?.value || null, note = $("#a-note", v).value.trim(), assign = $("#a-assign", v).checked, close = $("#a-close", v).checked;
    if (!act && !note && !assign && !close) return toast("اختر إجراءً أو اكتب ملاحظة", "err");
    if (await run(sb.rpc("complaint_act", { p_id: id, p_action: act, p_note: note || null, p_assoc: assign ? $("#a-assoc", v).value : null, p_close: close, p_reopen: false }),
      close ? "تم حفظ الإجراء وإغلاق الشكوى" : assign ? "تم الحفظ وتوجيه الشكوى للجمعية" : "تم حفظ الإجراء")) { paintComplaintBadge(); render(); }
  });
  $("#reopen", v)?.addEventListener("click", async () => { if (await run(sb.rpc("complaint_act", { p_id: id, p_action: null, p_note: $("#ro-note", v).value.trim() || null, p_assoc: null, p_close: false, p_reopen: true }), "أُعيد فتح الشكوى")) { paintComplaintBadge(); render(); } });
  $("#r-send", v)?.addEventListener("click", async () => {
    const note = $("#r-note", v).value.trim(); if (note.length < 2) return toast("اكتب ردّ الجمعية", "err");
    if (await run(sb.rpc("complaint_respond", { p_id: id, p_note: note, p_done: $("#r-done", v).checked }), "تم إرسال الرد لمدير النظام")) { paintComplaintBadge(); render(); }
  });
}

// ───── استبيان رضا المصلين ─────
const Q_KIND = { rating: "تقييم بالنجوم (1–5)", choice: "اختيار من متعدد", yesno: "نعم / لا", text: "نص حر (بلا درجة)" };
// نموذج مقترح يضيفه المدير بضغطة (لا يُضاف تلقائيًا)
const SURVEY_TEMPLATE = [
  { text: "كيف تقيّم رائحة المسجد بشكل عام؟", kind: "rating", weight: 3, required: true, options: [] },
  { text: "هل نوع العطر مناسب لك؟", kind: "yesno", weight: 2, required: true, options: [{ label: "نعم", score: 1 }, { label: "لا", score: 0 }] },
  { text: "كيف تصف قوة الرائحة وانتشارها؟", kind: "choice", weight: 2, required: true, options: [{ label: "مناسبة", score: 4 }, { label: "قوية أكثر من اللازم", score: 2 }, { label: "ضعيفة", score: 1 }, { label: "لا ألاحظها", score: 0 }] },
  { text: "هل الرائحة موجودة في كل أوقات الصلاة؟", kind: "choice", weight: 1, required: true, options: [{ label: "دائمًا", score: 3 }, { label: "غالبًا", score: 2 }, { label: "أحيانًا", score: 1 }, { label: "نادرًا", score: 0 }] },
  { text: "هل تنصح بتعميم التعطير على المساجد الأخرى؟", kind: "yesno", weight: 1, required: true, options: [{ label: "نعم", score: 1 }, { label: "لا", score: 0 }] },
  { text: "ملاحظاتك واقتراحاتك", kind: "text", weight: 0, required: false, options: [] },
];
const surveyState = { sid: "", tab: "results", days: 90 };

route("survey", {
  title: "استبيان رضا المصلين",
  async render(v) {
    const r = role();
    const { data: surveys } = await sb.from("surveys").select("*").order("created_at", { ascending: false });
    if (!(surveys || []).length) {
      v.innerHTML = `<div class="card"><div class="bd empty" style="padding:40px 20px">${I.star}<b style="display:block;font-size:17px;margin:6px 0">لا يوجد استبيان بعد</b>
        ${r === "admin" ? `<div class="muted small" style="max-width:520px;margin:0 auto 14px">أنشئ استبيانًا بأسئلة تختارها، ولكل سؤال وزن ودرجات، فتُحسب نسبة رضا المصلين تلقائيًا من إجاباتهم عبر باركود المسجد.</div>
        <div class="row" style="justify-content:center;gap:8px"><button class="btn primary" id="s-tpl">${I.sparkle} البدء بالنموذج المقترح</button><button class="btn" id="s-new">${I.plus} استبيان فارغ</button></div>` : `<div class="muted small">سيظهر هنا عندما ينشئه مدير النظام.</div>`}</div></div>`;
      const create = async (tpl) => {
        const { data: s, error } = await sb.from("surveys").insert({ title: "استبيان رضا المصلين عن تعطير المسجد", intro: "إجابتك تساعدنا على تحسين تعطير المسجد. لن يستغرق الأمر أكثر من دقيقة.", thanks: "شكرًا لك، وصلت إجابتك", active: true }).select().single();
        if (error) return toast(errMsg(error), "err");
        if (tpl) await sb.from("survey_questions").insert(SURVEY_TEMPLATE.map((q, i) => ({ ...q, survey_id: s.id, ord: i + 1 })));
        surveyState.sid = s.id; surveyState.tab = "build"; render();
      };
      $("#s-tpl", v)?.addEventListener("click", () => create(true));
      $("#s-new", v)?.addEventListener("click", () => create(false));
      return;
    }
    if (!surveys.some((s) => s.id === surveyState.sid)) surveyState.sid = (surveys.find((s) => s.active) || surveys[0]).id;
    if (r !== "admin" && surveyState.tab === "build") surveyState.tab = "results";
    const s = surveys.find((x) => x.id === surveyState.sid);
    const tabs = [["results", "النتائج"], ...(r === "admin" ? [["build", "الأسئلة والأوزان"]] : []), ["share", "الباركود والروابط"]];
    v.innerHTML = `<div class="pagehead">
        ${surveys.length > 1 ? `<select class="input" id="s-pick" style="width:auto">${surveys.map((x) => `<option value="${x.id}" ${x.id === s.id ? "selected" : ""}>${esc(x.title)}${x.active ? "" : " (موقوف)"}</option>`).join("")}</select>` : `<b style="font-size:16px">${esc(s.title)}</b>`}
        ${s.active ? `<span class="chip ok">مفعّل</span>` : `<span class="chip plain">موقوف</span>`}
        <div class="seg right" id="s-tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${surveyState.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
        ${r === "admin" ? `<button class="btn sm" id="s-add">${I.plus} استبيان جديد</button>` : ""}</div><div id="s-body"></div>`;
    $("#s-tabs", v).onclick = (e) => { const b = e.target.closest("[data-t]"); if (!b) return; surveyState.tab = b.dataset.t; render(); };
    $("#s-pick", v)?.addEventListener("change", (e) => { surveyState.sid = e.target.value; render(); });
    $("#s-add", v)?.addEventListener("click", async () => {
      const { data: x, error } = await sb.from("surveys").insert({ title: "استبيان جديد", active: false, thanks: "شكرًا لك، وصلت إجابتك" }).select().single();
      if (error) return toast(errMsg(error), "err"); surveyState.sid = x.id; surveyState.tab = "build"; render();
    });
    const body = $("#s-body", v);
    if (surveyState.tab === "build") return surveyBuilder(body, s);
    if (surveyState.tab === "share") return surveyShare(body, s);
    return surveyResults(body, s);
  },
});

async function surveyResults(el, s) {
  el.innerHTML = `<div class="empty">${I.star}جارٍ التحميل…</div>`;
  const { data: d, error } = await sb.rpc("survey_results", { p_survey: s.id, p_days: surveyState.days });
  if (error) { el.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
  const pctTone = (p) => p == null ? "plain" : p >= 80 ? "ok" : p >= 60 ? "gold" : "bad";
  const bar = (p) => `<div class="s-bar"><i style="width:${Math.max(0, Math.min(100, p || 0))}%" class="t-${pctTone(p)}"></i></div>`;
  const qs = d.questions || [], ms = d.mosques || [], wk = d.weekly || [], wmax = Math.max(1, ...wk.map((w) => w.n));
  el.innerHTML = `<div class="row" style="margin:4px 0 14px"><div class="seg" id="s-days">${[[30, "30 يومًا"], [90, "90 يومًا"], [365, "سنة"], [3650, "الكل"]].map(([k, l]) => `<button data-d="${k}" class="${surveyState.days === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
    ${!d.n ? `<div class="card"><div class="bd empty" style="padding:36px">${I.star}لا توجد إجابات في هذه الفترة. اطبع باركود المساجد من تبويب «الباركود والروابط».</div></div>` : `
    <div class="s-top">
      <div class="card s-gauge"><div class="ring-g t-${pctTone(d.pct)}" style="--p:${d.pct || 0}"><b class="num">${d.pct ?? "—"}<small>٪</small></b></div><div><b>نسبة رضا المصلين</b><div class="muted small">محسوبة بالأوزان والدرجات من ${fmtNum(d.n)} إجابة</div></div></div>
      <div class="card kpi"><div class="lbl">${I.chat}الإجابات</div><div class="val">${fmtNum(d.n)}</div><div class="sub">${fmtNum(ms.length)} مسجد</div></div>
      <div class="card s-week"><div class="lbl small muted">الإجابات أسبوعيًا</div><div class="s-wk">${wk.slice(-12).map((w) => `<i style="height:${w.n / wmax * 100}%" title="${w.w}: ${w.n} إجابة • ${w.pct ?? "—"}٪" class="t-${pctTone(w.pct)}"></i>`).join("")}</div></div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><div class="hd"><h3>نتيجة كل سؤال</h3></div><div class="bd stack">${qs.map((q, i) => {
        const dist = q.dist || {}, tot = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
        const rows = q.kind === "rating" ? [5, 4, 3, 2, 1].map((n) => [`${"★".repeat(n)}`, dist[n] || 0]) : q.kind === "text" ? [] : (q.options || []).map((o, k) => [o.label, dist[k] || 0]);
        return `<div class="s-q"><div class="row"><b class="grow">${i + 1}. ${esc(q.text)}</b>${q.kind !== "text" ? `<span class="chip ${pctTone(q.pct)}">${q.pct ?? "—"}٪</span>` : ""}</div>
          <div class="muted small">${Q_KIND[q.kind]} • الوزن ${q.weight} • ${fmtNum(q.n)} إجابة</div>
          ${q.kind !== "text" ? bar(q.pct) + `<div class="s-dist">${rows.map(([l, n]) => `<div><span>${esc(l)}</span><div class="s-bar thin"><i style="width:${n / tot * 100}%"></i></div><b class="num">${fmtNum(n)}</b></div>`).join("")}</div>`
            : `<div class="s-texts">${(q.texts || []).map((t) => `<div>«${esc(t)}»</div>`).join("") || `<span class="muted small">لا توجد ملاحظات</span>`}</div>`}</div>`;
      }).join("")}</div></div>
      <div class="card"><div class="hd"><h3>الرضا حسب المسجد</h3><button class="btn sm right" id="s-exp">${I.download} تصدير</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>المسجد</th><th>الإجابات</th><th style="width:40%">نسبة الرضا</th></tr></thead><tbody>
        ${ms.map((m) => `<tr class="click" data-m="${m.id}"><td><b>${esc(m.name)}</b><div class="small muted">${esc([m.district, regionName(m.region)].filter(Boolean).join(" • "))}</div></td><td class="num">${fmtNum(m.n)}</td><td><div class="row" style="gap:8px;flex-wrap:nowrap">${bar(m.pct)}<b class="num">${m.pct ?? "—"}٪</b></div></td></tr>`).join("")}</tbody></table></div></div>
    </div>`}`;
  $("#s-days", el).onclick = (e) => { const b = e.target.closest("[data-d]"); if (!b) return; surveyState.days = +b.dataset.d; surveyResults(el, s); };
  $$("[data-m]", el).forEach((t) => t.onclick = () => role() !== "viewer" && go("/mosque/" + t.dataset.m));
  $("#s-exp", el)?.addEventListener("click", () => exportXlsx(ms.map((m, i) => ({ "م": i + 1, "المسجد": m.name, "الحي": m.district || "", "الجهة": regionName(m.region), "الإجابات": m.n, "نسبة الرضا ٪": m.pct })), `رضا-المصلين-${isoDay()}.xlsx`, "الرضا", { title: `${s.title} — حسب المسجد` }));
}

async function surveyBuilder(el, s) {
  const { data: qs0 } = await sb.from("survey_questions").select("*").eq("survey_id", s.id).order("ord");
  let qs = (qs0 || []).map((q) => ({ ...q, options: (q.options || []).map((o) => ({ ...o })) }));
  const removed = new Set();
  const total = () => qs.filter((q) => q.kind !== "text").reduce((a, q) => a + (+q.weight || 0), 0) || 1;
  const draw = () => {
    el.innerHTML = `<div class="grid g3">
      <div class="span2 stack">
        <div class="card"><div class="bd"><form class="form" id="s-meta" onsubmit="return false">
          ${fld("title", "عنوان الاستبيان", { value: s.title, req: true, full: true })}
          ${fld("intro", "مقدمة تظهر للمصلّي", { value: s.intro || "", type: "textarea", full: true })}
          ${fld("thanks", "رسالة الشكر بعد الإرسال", { value: s.thanks || "", full: true })}
          <label class="c-check" style="grid-column:1/-1"><input type="checkbox" name="active" ${s.active ? "checked" : ""}> الاستبيان مفعّل ويظهر للمصلين عبر الباركود</label></form></div></div>
        <div id="qs" class="stack">${qs.map((q, i) => qCard(q, i)).join("") || `<div class="card"><div class="bd empty">${I.star}لا توجد أسئلة بعد</div></div>`}</div>
        <div class="row" style="gap:8px"><button class="btn" id="q-add">${I.plus} إضافة سؤال</button>${qs.length ? "" : `<button class="btn" id="q-tpl">${I.sparkle} إضافة أسئلة النموذج المقترح</button>`}
          <button class="btn primary right" id="s-save">${I.check} حفظ الاستبيان</button></div>
      </div>
      <div class="stack"><div class="card"><div class="hd"><h3>طريقة حساب الرضا</h3></div><div class="bd stack small">
        <div>لكل سؤال <b>وزن</b> يحدد أهميته، ولكل إجابة <b>درجة</b>:</div>
        <div class="s-formula">نسبة الرضا = مجموع (الوزن × درجة الإجابة ÷ أعلى درجة في السؤال) ÷ مجموع أوزان الأسئلة المُجابة × 100</div>
        <div class="muted">• التقييم بالنجوم: الدرجة = عدد النجوم من 5.<br>• الاختيار ونعم/لا: تحدد درجة كل خيار بنفسك.<br>• النص الحر لا يدخل في الحساب.<br>• الوزن 0 يعني أن السؤال لا يؤثر في النسبة.</div>
        <div><b>تأثير كل سؤال في النسبة:</b></div>${qs.filter((q) => q.kind !== "text").map((q, i) => `<div class="row" style="gap:8px"><span class="grow clip1">${esc(q.text || "سؤال بلا نص")}</span><b class="num">${Math.round((+q.weight || 0) / total() * 100)}٪</b></div>`).join("") || `<span class="muted">—</span>`}
      </div></div>
      <div class="card"><div class="bd small muted">يعرض الاستبيان سؤالًا واحدًا في كل شاشة. ويُحدَّد المسجد تلقائيًا من باركوده، أو بأسئلة الجهة ثم الحي ثم المسجد في الرابط العام.</div></div></div>
    </div>`;
    bind();
  };
  const qCard = (q, i) => `<div class="card s-qc" data-i="${i}"><div class="bd stack" style="gap:10px">
    <div class="row" style="gap:8px;flex-wrap:nowrap"><span class="s-n">${i + 1}</span><input class="input grow" data-f="text" value="${esc(q.text)}" placeholder="نص السؤال">
      <button class="btn sm ghost" data-up ${i ? "" : "disabled"} title="لأعلى">↑</button><button class="btn sm ghost" data-down ${i < qs.length - 1 ? "" : "disabled"} title="لأسفل">↓</button><button class="btn sm ghost danger" data-del title="حذف">${I.trash}</button></div>
    <div class="row s-qrow"><label>النوع <select class="input" data-f="kind">${Object.entries(Q_KIND).map(([k, l]) => `<option value="${k}" ${q.kind === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${q.kind !== "text" ? `<label>الوزن <input class="input" type="number" min="0" max="100" step="0.5" data-f="weight" value="${q.weight}"></label>` : ""}
      <label class="c-check"><input type="checkbox" data-f="required" ${q.required ? "checked" : ""}> إجابة إلزامية</label></div>
    ${q.kind === "choice" || q.kind === "yesno" ? `<div class="s-opts"><div class="small muted">الخيارات ودرجاتها (الأعلى درجة = الأفضل)</div>${q.options.map((o, k) => `<div class="row s-opt" data-k="${k}"><input class="input grow" data-o="label" value="${esc(o.label)}" placeholder="نص الخيار"><label class="small">الدرجة <input class="input" type="number" step="0.5" data-o="score" value="${o.score}"></label>${q.kind === "choice" ? `<button class="btn sm ghost" data-odel title="حذف الخيار">×</button>` : ""}</div>`).join("")}
      ${q.kind === "choice" ? `<button class="btn sm ghost" data-oadd>${I.plus} خيار</button>` : ""}</div>` : q.kind === "rating" ? `<div class="small muted">يختار المصلّي من 1 إلى 5 نجوم، والدرجة = عدد النجوم ÷ 5</div>` : ""}
  </div></div>`;
  const bind = () => {
    $$(".s-qc", el).forEach((card) => {
      const q = qs[+card.dataset.i];
      card.querySelectorAll("[data-f]").forEach((inp) => inp.onchange = inp.oninput = () => {
        const k = inp.dataset.f; q[k] = inp.type === "checkbox" ? inp.checked : k === "weight" ? +inp.value : inp.value;
        if (k === "kind") { if (q.kind === "yesno") q.options = [{ label: "نعم", score: 1 }, { label: "لا", score: 0 }]; else if (q.kind === "choice" && !q.options.length) q.options = [{ label: "", score: 1 }, { label: "", score: 0 }]; else if (q.kind === "rating" || q.kind === "text") q.options = []; if (q.kind === "text") q.weight = 0; draw(); }
      });
      card.querySelectorAll(".s-opt").forEach((row) => { const o = q.options[+row.dataset.k]; row.querySelectorAll("[data-o]").forEach((inp) => inp.oninput = () => { o[inp.dataset.o] = inp.dataset.o === "score" ? +inp.value : inp.value; }); });
      card.querySelector("[data-oadd]")?.addEventListener("click", () => { q.options.push({ label: "", score: 0 }); draw(); });
      card.querySelectorAll("[data-odel]").forEach((b) => b.onclick = () => { q.options.splice(+b.closest(".s-opt").dataset.k, 1); draw(); });
      const i = +card.dataset.i;
      card.querySelector("[data-up]").onclick = () => { [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; draw(); };
      card.querySelector("[data-down]").onclick = () => { [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; draw(); };
      card.querySelector("[data-del]").onclick = () => { if (q.id) removed.add(q.id); qs.splice(i, 1); draw(); };
    });
    $("#q-add", el).onclick = () => { qs.push({ text: "", kind: "rating", weight: 1, required: true, options: [] }); draw(); };
    $("#q-tpl", el)?.addEventListener("click", () => { qs.push(...SURVEY_TEMPLATE.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) }))); draw(); });
    $("#s-save", el).onclick = async () => {
      const meta = formData($("#s-meta", el)); meta.active = $('#s-meta [name="active"]', el).checked;
      if (!meta.title) return toast("اكتب عنوان الاستبيان", "err");
      const bad = qs.findIndex((q) => !q.text.trim() || ((q.kind === "choice" || q.kind === "yesno") && (q.options.length < 2 || q.options.some((o) => !String(o.label).trim()))));
      if (bad >= 0) return toast(`أكمل السؤال رقم ${bad + 1}: النص والخيارات (خياران على الأقل)`, "err");
      if (!(await run(sb.from("surveys").update({ ...meta, updated_at: new Date().toISOString() }).eq("id", s.id)))) return;
      if (removed.size && !(await run(sb.from("survey_questions").delete().in("id", [...removed])))) return;
      for (const [i, q] of qs.entries()) {
        const row = { survey_id: s.id, ord: i + 1, text: q.text.trim(), kind: q.kind, weight: q.kind === "text" ? 0 : Math.max(0, +q.weight || 0), required: !!q.required, options: q.kind === "choice" || q.kind === "yesno" ? q.options.map((o) => ({ label: String(o.label).trim(), score: +o.score || 0 })) : [] };
        if (!(await run(q.id ? sb.from("survey_questions").update(row).eq("id", q.id) : sb.from("survey_questions").insert(row)))) return;
      }
      toast("تم حفظ الاستبيان"); render();
    };
  };
  draw();
}

async function surveyShare(el, s) {
  try { await loadQR(); } catch (e) { el.innerHTML = `<div class="empty">${esc(errMsg(e))}</div>`; return; }
  await loadMosques();
  const link = surveyLink(s.id);
  el.innerHTML = `<div class="grid g2">
    <div class="card"><div class="hd"><h3>الرابط العام للاستبيان</h3></div><div class="bd qrd"><div class="qr-box">${qrSvg(link)}</div><div class="stack" style="gap:10px">
      <div class="hint">يُرسَل عبر واتساب أو يُطبع في الإعلانات. يحدد المصلّي المسجد بثلاثة أسئلة: <b>الجهة ← الحي ← المسجد</b> (المساجد قيد التشغيل).</div>
      <div class="row" style="gap:6px;flex-wrap:nowrap"><input class="input" readonly value="${esc(link)}" dir="ltr"><button class="btn sm" data-copy="${esc(link)}">${I.copy}</button></div>
      <div class="row" style="gap:6px"><a class="btn sm" href="${esc(link)}" target="_blank" rel="noopener">↗ تجربة الاستبيان</a><button class="btn sm" id="p-gen">${I.print} طباعة ملصق عام</button>
        <a class="btn sm wa-btn" href="https://wa.me/?text=${encodeURIComponent(`شاركنا رأيك في تعطير المسجد: ${link}`)}" target="_blank" rel="noopener">${I.wa} مشاركة</a></div></div></div></div>
    <div class="card"><div class="hd"><h3>باركود كل مسجد</h3></div><div class="bd stack">
      <div class="hint">لكل مسجد باركود خاص يسجّل المسجد تلقائيًا، ويفتح «قيّم رائحة المسجد» و«شكوى أو اقتراح» معًا. افتحه من صفحة المسجد، أو اطبع ملصقات عدة مساجد دفعة واحدة:</div>
      <div class="row" style="gap:8px"><button class="btn primary" id="p-active">${I.print} ملصقات المساجد قيد التشغيل (${fmtNum(S.mosques.filter((m) => m.stage === "active").length)})</button>
        ${role() === "admin" ? `<a class="btn" href="#/mosques">${I.mosque} اختيار مساجد من القائمة</a>` : ""}</div></div></div></div>`;
  $$("[data-copy]", el).forEach((b) => b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast("تم نسخ الرابط")));
  $("#p-gen", el).onclick = () => printPosters([], { title: s.title, link });
  $("#p-active", el).onclick = () => { const l = S.mosques.filter((m) => m.stage === "active"); if (!l.length) return toast("لا توجد مساجد قيد التشغيل", "err"); printPosters(l); };
}
