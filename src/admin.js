// ───────────────────────── الجمعيات ─────────────────────────
route("associations", {
  title: "الجمعيات المشرفة",
  async render(v) {
    await Promise.all([loadAssociations(), loadMosques()]);
    const count = (id, fn = () => true) => S.mosques.filter((m) => m.association_id === id && fn(m)).length;
    v.innerHTML = `<div class="row" style="margin-bottom:14px"><span class="muted small">${S.associations.length} جمعية</span><button class="btn primary right" id="add">${I.plus} إضافة جمعية</button></div>
      <div class="grid g3">${S.associations.map((a) => `<div class="card" style="${a.active ? "" : "opacity:.6"}"><div class="bd stack" style="gap:8px">
        <div class="row"><div class="mic" style="width:42px;height:42px;border-radius:12px;background:var(--gold-soft);color:var(--gold);display:grid;place-items:center">${I.org}</div>
          <div class="grow"><b>${esc(a.name)}</b><div class="muted small">${esc(a.district || "")}</div></div>${a.active ? "" : `<span class="chip plain">موقوفة</span>`}</div>
        <div class="row small" style="gap:14px"><span><b class="num">${count(a.id)}</b> مسجد</span><span><b class="num">${count(a.id, (m) => m.stage === "active")}</b> مُركّب</span><span><b class="num">${count(a.id, (m) => ["assigned", "data_done"].includes(m.stage))}</b> قيد الاستكمال</span></div>
        <div class="bar"><i style="width:${count(a.id) ? count(a.id, (m) => m.stage === "active") / count(a.id) * 100 : 0}%"></i></div>
        <div class="row small">${a.contact_name ? `<span>${esc(a.contact_name)}</span>` : ""}<span class="right">${contactBtns({ phone: a.phone, email: a.email, name: a.contact_name || a.name, text: `السلام عليكم ${a.contact_name || ""}، ` })}</span></div>
        <div class="row"><button class="btn sm" data-edit="${a.id}">${I.edit} تعديل</button><a class="btn sm" href="#/mosques?assoc=${a.id}">${I.mosque} المساجد</a></div>
      </div></div>`).join("") || `<div class="card empty" style="grid-column:1/-1">${I.org}لا توجد جمعيات — أضف أول جمعية مشرفة</div>`}</div>`;
    $("#add", v).onclick = async () => { if (await assocForm()) render(); };
    $$("[data-edit]", v).forEach((b) => b.onclick = async () => { if (await assocForm(S.associations.find((a) => a.id === b.dataset.edit))) render(); });
  },
});
async function assocForm(a = null) {
  return modal({
    title: a ? "تعديل الجمعية" : "إضافة جمعية مشرفة",
    body: `<form class="form" onsubmit="return false">${fld("name", "اسم الجمعية", { value: a?.name, req: true, full: true })}${fld("district", "النطاق / الأحياء", { value: a?.district })}
      ${fld("contact_name", "اسم المسؤول", { value: a?.contact_name })}${fld("phone", "جوال المسؤول", { type: "tel", value: a?.phone })}${fld("email", "البريد الإلكتروني", { type: "email", value: a?.email })}
      ${a ? fld("active", "الحالة", { value: a.active ? "1" : "0", opts: [["1", "نشطة"], ["0", "موقوفة"]] }) : ""}${fld("notes", "ملاحظات", { type: "textarea", value: a?.notes, full: true })}</form>`,
    actions: [{ label: `${I.check} حفظ`, cls: "primary", onClick: async (mb) => {
      const d = formData(mb);
      if (!d.name) { toast("الاسم مطلوب", "err"); return false; }
      if (d.active !== undefined) d.active = d.active === "1";
      if (d.phone) d.phone = displayPhone(d.phone);
      const q = a ? sb.from("associations").update(d).eq("id", a.id) : sb.from("associations").insert(d);
      const ok = await run(q, "تم الحفظ");
      if (ok) await loadAssociations();
      return ok ? true : false;
    } }, { label: "إلغاء" }],
  });
}

// ───────────────────────── الحسابات ─────────────────────────
const siteUrl = () => location.origin + location.pathname;
const inviteText = (a) => `السلام عليكم ${a.name}،\nتم إنشاء حسابك في منصة «${S.settings.platform_name || "طيب"}» لمشروع تعطير المساجد بصفة: ${ROLES[a.role]}${a.role === "association" ? ` (${assocName(a.association_id)})` : ""}.\n\nرابط المنصة: ${siteUrl()}\nالبريد: ${a.email}\nرمز التفعيل: ${a.invite_code}\n\nاختر «تفعيل حساب جديد» وأدخل بريدك ورمز التفعيل واختر كلمة مرور.`;

route("accounts", {
  title: "الحسابات",
  async render(v) {
    await loadAssociations();
    const { data: list, error } = await sb.from("accounts").select("*").order("created_at");
    if (error) { v.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    let f = "";
    v.innerHTML = `<div class="row" style="margin-bottom:14px"><div class="seg" id="seg"><button data-f="" class="on">الكل ${list.length}</button>${Object.entries(ROLES).map(([k, l]) => `<button data-f="${k}">${l} ${list.filter((a) => a.role === k).length}</button>`).join("")}</div>
      <button class="btn primary right" id="add">${I.plus} إنشاء حساب</button></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>الاسم</th><th>الصلاحية</th><th>البريد</th><th>الجوال</th><th>الحالة</th><th>آخر دخول</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>
      <div class="hint" style="margin-top:12px">💡 بعد إنشاء الحساب أرسل للمستخدم رابط المنصة ورمز التفعيل (زر واتساب). يدخل المستخدم بريده والرمز ويختار كلمة مروره. لنسيان كلمة المرور استخدم «إعادة تعيين الدخول».</div>`;
    const draw = () => {
      $("#rows", v).innerHTML = list.filter((a) => !f || a.role === f).map((a) => `<tr>
        <td><div class="t-name">${esc(a.name)}</div><div class="small muted">${esc(a.title || "")}${a.role === "association" ? ` · ${esc(assocName(a.association_id))}` : ""}</div></td>
        <td><span class="chip ${a.role === "admin" ? "gold" : a.role === "company" ? "info" : a.role === "viewer" ? "plain" : "ok"}">${ROLES[a.role]}</span></td>
        <td data-hide-sm class="small" dir="ltr" style="text-align:end">${esc(a.email)}</td><td data-hide-sm class="num small">${esc(displayPhone(a.phone) || "—")} ${contactBtns({ phone: a.phone, email: a.email, name: a.name })}</td>
        <td>${!a.active ? `<span class="chip bad">معطل</span>` : a.user_id ? `<span class="chip ok">مفعّل</span>` : `<span class="chip warn" title="رمز التفعيل">بانتظار التفعيل · <b class="num">${esc(a.invite_code)}</b></span>`}</td>
        <td data-hide-sm class="small muted">${a.last_seen_at ? ago(a.last_seen_at) : "—"}</td>
        <td data-hide-sm><div class="row" style="gap:4px;flex-wrap:nowrap">
          ${!a.user_id && a.active ? `<a class="btn sm" title="إرسال الدعوة عبر واتساب" ${a.phone ? `href="${esc(waLink(a.phone, inviteText(a)))}" target="_blank" rel="noopener"` : `data-copyinv="${a.id}"`}>${a.phone ? I.wa : I.copy} الدعوة</a>` : ""}
          <button class="btn sm ghost" data-edit="${a.id}" title="تعديل">${I.edit}</button>
          ${a.user_id && a.user_id !== S.me.user_id ? `<button class="btn sm ghost" data-reset="${a.id}" title="إعادة تعيين الدخول">${I.key}</button>` : ""}</div></td></tr>`).join("") || `<tr><td colspan="7" class="empty">لا توجد حسابات</td></tr>`;
    };
    $("#seg", v).onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; f = b.dataset.f; $$("#seg button", v).forEach((x) => x.classList.toggle("on", x === b)); draw(); };
    $("#rows", v).onclick = async (e) => {
      const ed = e.target.closest("[data-edit]"), rs = e.target.closest("[data-reset]"), cp = e.target.closest("[data-copyinv]");
      if (ed && await accountForm(list.find((a) => a.id === ed.dataset.edit))) render();
      if (cp) { navigator.clipboard.writeText(inviteText(list.find((a) => a.id === cp.dataset.copyinv))).then(() => toast("تم نسخ نص الدعوة")); }
      if (rs) {
        const a = list.find((x) => x.id === rs.dataset.reset);
        if (!(await confirmBox(`إعادة تعيين دخول «${a.name}»؟ سيُلغى دخوله الحالي ويحصل على رمز تفعيل جديد ليختار كلمة مرور جديدة.`, "إعادة التعيين"))) return;
        const code = await run(sb.rpc("reset_account_login", { p_account: a.id }));
        if (code) { toast(`رمز التفعيل الجديد: ${code}`, "", { ms: 12000 }); render(); }
      }
    };
    $("#add", v).onclick = async () => { const a = await accountForm(); if (a) { render(); inviteDialog(a); } };
    draw();
  },
});
async function accountForm(a = null) {
  const body = document.createElement("div");
  body.innerHTML = `<form class="form" onsubmit="return false">${fld("name", "الاسم", { value: a?.name, req: true })}${fld("title", "المسمى", { value: a?.title, ph: "مثال: مشرف ميداني" })}
    ${fld("email", "البريد الإلكتروني (اسم الدخول)", { type: "email", value: a?.email, req: true, attrs: a?.user_id ? "readonly" : "" })}${fld("phone", "الجوال", { type: "tel", value: a?.phone, ph: "05xxxxxxxx" })}
    ${fld("role", "الصلاحية", { value: a?.role || "association", opts: Object.entries(ROLES), attrs: a?.user_id === S.me.user_id ? "disabled" : "" })}
    <div data-aw>${fld("association_id", "الجمعية", { value: a?.association_id || "", opts: [["", "— اختر —"], ...S.associations.filter((x) => x.active || x.id === a?.association_id).map((x) => [x.id, x.name])] })}</div>
    ${a ? fld("active", "الحالة", { value: a.active ? "1" : "0", opts: [["1", "نشط"], ["0", "معطل"]], attrs: a.user_id === S.me.user_id ? "disabled" : "" }) : ""}</form>
    <div class="hint" style="margin-top:10px"><b>الصلاحيات:</b> مدير النظام: كل شيء · الجمعية: مساجدها فقط (استكمال البيانات، التواصل، الزيارات، الرضا، التقرير الشهري) · الشركة: المساجد الجاهزة للدراسة والتركيب والتعبئة · حساب العرض: لوحة المؤشرات والمنجزات فقط.</div>`;
  const sync = () => { $("[data-aw]", body).hidden = $('[name="role"]', body).value !== "association"; };
  $('[name="role"]', body).onchange = sync; sync();
  return modal({
    title: a ? "تعديل الحساب" : "إنشاء حساب", body, wide: true,
    actions: [{ label: `${I.check} حفظ`, cls: "primary", onClick: async (mb) => {
      const d = formData(mb);
      if (!d.name || !d.email) { toast("الاسم والبريد مطلوبان", "err"); return false; }
      d.email = d.email.toLowerCase();
      if (d.role !== "association") d.association_id = null;
      else if (!d.association_id) { toast("اختر الجمعية", "err"); return false; }
      if (d.active !== undefined) d.active = d.active === "1";
      if (d.phone) d.phone = displayPhone(d.phone);
      if (a?.user_id === S.me.user_id) { delete d.role; delete d.active; }
      Object.keys(d).forEach((k) => { if (d[k] === "") d[k] = null; });
      const { data, error } = a ? await sb.from("accounts").update(d).eq("id", a.id).select().single() : await sb.from("accounts").insert(d).select().single();
      if (error) { toast(errMsg(error), "err"); return false; }
      toast("تم الحفظ"); return data;
    } }, { label: "إلغاء" }],
  });
}
function inviteDialog(a) {
  modal({ title: "تم إنشاء الحساب", body: `<div class="stack"><p style="margin:0">أرسل للمستخدم بيانات التفعيل:</p>
    <div class="card pad" style="background:var(--surface-2);white-space:pre-wrap;font-size:14px">${esc(inviteText(a))}</div>
    <div class="row">${a.phone ? `<a class="btn primary" href="${esc(waLink(a.phone, inviteText(a)))}" target="_blank" rel="noopener">${I.wa} إرسال عبر واتساب</a>` : ""}
    <a class="btn" href="mailto:${esc(a.email)}?subject=${encodeURIComponent("دعوة منصة " + (S.settings.platform_name || "طيب"))}&body=${encodeURIComponent(inviteText(a))}">${I.mail} إرسال بالبريد</a>
    <button class="btn" data-cp>${I.copy} نسخ</button></div></div>`,
    onOpen: (mb) => { $("[data-cp]", mb).onclick = () => navigator.clipboard.writeText(inviteText(a)).then(() => toast("تم النسخ")); } });
}

// ───────────────────────── الإعدادات ─────────────────────────
route("settings", {
  title: "الإعدادات",
  async render(v) {
    const s = S.settings;
    v.innerHTML = `<div class="grid g2">
      <div class="card"><div class="hd"><h3>هوية المنصة</h3></div><div class="bd">
        <div class="row" style="margin-bottom:16px"><div style="width:72px;height:72px" class="brand-prev">${logoHtml()}</div>
          <div class="stack" style="gap:6px"><input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" id="logo" hidden>
          <button class="btn sm" id="logo-btn">${I.upload} رفع شعار المؤسسة</button>${s.logo_path ? `<button class="btn sm danger" id="logo-rm">إزالة الشعار</button>` : ""}<div class="hint">PNG أو SVG مربع، حتى ٥ ميقابايت</div></div></div>
        <form class="form" id="f1" onsubmit="return false">${fld("platform_name", "اسم المنصة", { value: s.platform_name })}${fld("org_name", "اسم المشروع / المؤسسة", { value: s.org_name })}
          ${fld("company_name", "اسم الشركة المنفذة", { value: s.company_name, full: true })}</form></div></div>
      <div class="card"><div class="hd"><h3>التشغيل والتذكيرات</h3></div><div class="bd">
        <form class="form" id="f2" onsubmit="return false">${fld("refill_cycle_days", "دورة التعبئة الافتراضية (يوم)", { type: "number", value: s.refill_cycle_days })}
          ${fld("reminder_hours", "التذكير قبل موعد التعبئة (ساعة)", { type: "number", value: s.reminder_hours })}
          ${fld("visit_every_days", "تكرار الزيارة الدورية (يوم)", { type: "number", value: s.visit_every_days })}</form>
        <div class="hint" style="margin-top:10px">يفحص الخادم المواعيد كل ساعة ويرسل: تذكير التعبئة للشركة والمدير، تنبيه التأخر، تذكير الزيارة الأسبوعية والتقرير الشهري للجمعية.</div></div></div>
      </div><button class="btn primary" style="margin-top:16px" id="save">${I.check} حفظ الإعدادات</button>`;
    $("#save", v).onclick = async () => {
      const d = { ...formData($("#f1", v)), ...formData($("#f2", v)) };
      ["refill_cycle_days", "reminder_hours", "visit_every_days"].forEach((k) => d[k] = Math.max(1, +d[k] || 1));
      if (await run(sb.from("settings").update({ ...d, updated_at: new Date().toISOString() }).eq("id", 1), "تم حفظ الإعدادات")) { await loadSettings(); paintShell(); }
    };
    $("#logo-btn", v).onclick = () => $("#logo", v).click();
    $("#logo", v).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const path = `logo-${Date.now()}.${(f.name.split(".").pop() || "png").toLowerCase()}`;
      const { error } = await sb.storage.from("brand").upload(path, f, { contentType: f.type });
      if (error) return toast(errMsg(error), "err");
      if (await run(sb.from("settings").update({ logo_path: path }).eq("id", 1), "تم تحديث الشعار")) { await loadSettings(); paintShell(); render(); }
    };
    $("#logo-rm", v)?.addEventListener("click", async () => { if (await run(sb.from("settings").update({ logo_path: null }).eq("id", 1), "تمت إزالة الشعار")) { await loadSettings(); paintShell(); render(); } });
  },
});
