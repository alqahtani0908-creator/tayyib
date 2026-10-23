// ───────────────────────── الرسائل الجماعية (واتساب / بريد) ─────────────────────────
route("messages", {
  title: "الرسائل الجماعية",
  async render(v) {
    await loadMosques();
    const r = role();
    let accounts = [];
    if (r === "admin") { const { data } = await sb.from("accounts").select("id,name,phone,email,role,association_id,active").eq("active", true); accounts = data || []; }
    const { data: history } = await sb.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(30);
    const districts = [...new Set(S.mosques.map((m) => m.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
    v.innerHTML = `<div class="grid g3">
      <div class="card span2"><div class="hd"><h3>رسالة جديدة</h3></div><div class="bd stack">
        <div><div class="small" style="font-weight:600;margin-bottom:6px">المستلمون</div><div class="row" id="aud">
          ${[["imam", "الأئمة"], ["muezzin", "المؤذنون"], ["servant", "خدام المساجد"], ...(r === "admin" ? [["assoc", "مسؤولو الجمعيات"], ["accounts", "حسابات المنصة"]] : [])]
            .map(([k, l], i) => `<label class="chip plain" style="cursor:pointer;padding:6px 12px"><input type="checkbox" value="${k}" ${i === 0 ? "checked" : ""}> ${l}</label>`).join("")}</div></div>
        <div class="form" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          ${r === "admin" ? fld("f_assoc", "الجمعية", { opts: [["", "كل الجمعيات"], ...S.associations.map((a) => [a.id, a.name])] }) : ""}
          ${fld("f_stage", "المرحلة", { opts: [["", "كل المراحل"], ...Object.entries(STAGES).map(([k, s]) => [k, s.l])] })}
          ${fld("f_district", "الحي", { opts: [["", "كل الأحياء"], ...districts] })}
        </div>
        ${fld("extra", "أرقام إضافية (اختياري)", { type: "textarea", ph: "رقم في كل سطر — يمكن إضافة الاسم بعد فاصلة: 0500000000, أحمد", attrs: 'style="min-height:60px" dir="auto"' })}
        <div class="field"><label>نص الرسالة</label><textarea class="input" name="body" style="min-height:130px" placeholder="السلام عليكم {الاسم}، …"></textarea>
          <div class="row small muted">متغيرات: ${["{الاسم}", "{المسجد}", "{الحي}"].map((x) => `<button type="button" class="btn sm ghost" data-var="${x}">${x}</button>`).join("")}</div></div>
        <div class="row"><button class="btn primary" id="prep">${I.send} تجهيز قائمة الإرسال</button><span class="muted small" id="cnt"></span></div>
      </div></div>
      <div class="card"><div class="hd"><h3>السجل</h3></div><div class="bd"><div class="tl">${(history || []).map((b) => {
        const sent = (b.recipients || []).filter((x) => x.sent).length;
        return `<div style="cursor:pointer" data-b="${b.id}"><div class="row small"><b>${esc(b.title || "رسالة")}</b><span class="muted right">${ago(b.created_at)}</span></div>
          <div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.body)}</div>
          <div class="bar" style="margin-top:4px"><i style="width:${b.recipients?.length ? sent / b.recipients.length * 100 : 0}%"></i></div><div class="small muted">${sent} / ${b.recipients?.length || 0} أُرسلت</div></div>`;
      }).join("") || `<div class="muted small">لا توجد رسائل سابقة</div>`}</div></div></div></div>`;

    const body = $('[name="body"]', v);
    $$("[data-var]", v).forEach((b) => b.onclick = () => { body.setRangeText(b.dataset.var, body.selectionStart, body.selectionEnd, "end"); body.focus(); });
    const collect = () => {
      const aud = $$("#aud input:checked", v).map((x) => x.value);
      const fa = $('[name="f_assoc"]', v)?.value || "", fs = $('[name="f_stage"]', v).value, fd = $('[name="f_district"]', v).value;
      const ms = S.mosques.filter((m) => (!fa || m.association_id === fa) && (!fs || m.stage === fs) && (!fd || m.district === fd));
      const out = new Map();
      const add = (phone, name, mosque = "", district = "") => { const n = normPhone(phone); if (n.length >= 11 && !out.has(n)) out.set(n, { phone: n, name: name || "", mosque, district, sent: false }); };
      for (const m of ms) {
        if (aud.includes("imam")) add(m.imam_phone, m.imam_name, m.name, m.district);
        if (aud.includes("muezzin")) add(m.muezzin_phone, m.muezzin_name, m.name, m.district);
        if (aud.includes("servant")) add(m.servant_phone, m.servant_name, m.name, m.district);
      }
      if (aud.includes("assoc")) S.associations.filter((a) => !fa || a.id === fa).forEach((a) => add(a.phone, a.contact_name || a.name));
      if (aud.includes("accounts")) accounts.filter((a) => !fa || a.association_id === fa).forEach((a) => add(a.phone, a.name));
      $('[name="extra"]', v).value.split(/\n+/).forEach((line) => { const [p, n] = line.split(/[,،]/); if (p?.trim()) add(p, n?.trim()); });
      return [...out.values()];
    };
    const updCount = () => { $("#cnt", v).textContent = `${collect().length} رقم بعد إزالة التكرار`; };
    v.addEventListener("change", updCount); v.addEventListener("input", (e) => { if (e.target.name === "extra") updCount(); });
    updCount();
    $("#prep", v).onclick = async () => {
      const recipients = collect();
      if (!body.value.trim()) return toast("اكتب نص الرسالة", "err");
      if (!recipients.length) return toast("لا توجد أرقام مطابقة", "err");
      const { data, error } = await sb.from("broadcasts").insert({ title: body.value.trim().slice(0, 40), body: body.value.trim(), recipients }).select().single();
      if (error) return toast(errMsg(error), "err");
      await sendQueue(data);
      render();
    };
    $$("[data-b]", v).forEach((el) => el.onclick = async () => { await sendQueue(history.find((b) => b.id === el.dataset.b)); render(); });
  },
});

const fillVars = (t, x) => t.replace(/\{الاسم\}/g, x.name || "").replace(/\{المسجد\}/g, x.mosque || "").replace(/\{الحي\}/g, x.district || "").replace(/\s+،/g, "،").trim();

// قائمة إرسال: كل رقم يُفتح في واتساب برسالة مخصصة، مع تتبع ما أُرسل
async function sendQueue(b) {
  const rec = b.recipients || [];
  const body = document.createElement("div");
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => sb.from("broadcasts").update({ recipients: rec }).eq("id", b.id), 600); };
  const draw = () => {
    const sent = rec.filter((x) => x.sent).length;
    body.innerHTML = `<div class="hint" style="margin-bottom:10px">يفتح زر «إرسال» محادثة واتساب بالرسالة جاهزة لكل رقم — اضغط «إرسال» في واتساب ثم عد للقائمة. يمكنك أيضًا «إرسال التالي» للتنقل السريع.</div>
      <div class="row" style="margin-bottom:10px"><div class="bar grow"><i style="width:${rec.length ? sent / rec.length * 100 : 0}%"></i></div><b class="num">${sent} / ${rec.length}</b></div>
      <div class="row" style="margin-bottom:12px"><button class="btn primary" data-next ${sent === rec.length ? "disabled" : ""}>${I.wa} إرسال التالي</button>
        <button class="btn sm" data-copy>${I.copy} نسخ الأرقام</button><button class="btn sm" data-xls>${I.download} تصدير القائمة</button></div>
      <div class="tbl-wrap" style="max-height:50vh;border:1px solid var(--line);border-radius:10px"><table class="tbl"><tbody>${rec.map((x, i) => `<tr style="${x.sent ? "opacity:.55" : ""}">
        <td><b>${esc(x.name || "—")}</b><div class="small muted">${esc(x.mosque || "")}</div></td><td class="num" dir="ltr">${esc(displayPhone(x.phone))}</td>
        <td><a class="btn sm ${x.sent ? "" : "primary"}" data-send="${i}" href="${esc(waLink(x.phone, fillVars(b.body, x)))}" target="_blank" rel="noopener">${I.wa} ${x.sent ? "أُرسلت ✓" : "إرسال"}</a></td>
        <td><label class="small"><input type="checkbox" data-mark="${i}" ${x.sent ? "checked" : ""}> تم</label></td></tr>`).join("")}</tbody></table></div>`;
  };
  body.onclick = (e) => {
    const s = e.target.closest("[data-send]");
    if (s) { rec[+s.dataset.send].sent = true; save(); setTimeout(draw, 50); return; }
    const mk = e.target.closest("[data-mark]");
    if (mk) { rec[+mk.dataset.mark].sent = mk.checked; save(); draw(); return; }
    if (e.target.closest("[data-next]")) { const i = rec.findIndex((x) => !x.sent); if (i >= 0) { window.open(waLink(rec[i].phone, fillVars(b.body, rec[i])), "_blank", "noopener"); rec[i].sent = true; save(); draw(); } }
    if (e.target.closest("[data-copy]")) { navigator.clipboard.writeText(rec.map((x) => "+" + x.phone).join("\n")).then(() => toast("تم نسخ الأرقام")); }
    if (e.target.closest("[data-xls]")) exportXlsx(rec.map((x) => ({ "الاسم": x.name, "الجوال": displayPhone(x.phone), "المسجد": x.mosque, "الحي": x.district, "الرسالة": fillVars(b.body, x), "أُرسلت": x.sent ? "نعم" : "لا" })), "قائمة-الإرسال.xlsx", "الإرسال");
  };
  draw();
  await modal({ title: "قائمة الإرسال عبر واتساب", body, wide: true, actions: [{ label: "إغلاق" }] });
  clearTimeout(saveT);
  await sb.from("broadcasts").update({ recipients: rec }).eq("id", b.id);
}
