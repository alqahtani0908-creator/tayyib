// ───────────────────────── المستودع: طلبات الزيت العطري ─────────────────────────
// الشركة تختار المساجد وأجهزتها ← يُحسب الزيت (مل لكل جهاز) والجوالين ← يعتمد مدير النظام بتوقيع إلكتروني
// ← تطبع الشركة الورقة المعتمدة وتسلمها للمستودع. مشرف المشروع لا يرى هذا القسم (يُفرض في الخادم أيضًا).
const OIL_ST = {
  pending: ["بانتظار الاعتماد", "warn"], approved: ["معتمد — جاهز للاستلام", "ok"], received: ["تم الاستلام", "info"],
  rejected: ["مرفوض", "bad"], cancelled: ["ملغى", "plain"],
};
const oilChip = (s) => `<span class="chip ${OIL_ST[s]?.[1] || "plain"}">${OIL_ST[s]?.[0] || s}</span>`;
const oilPer = () => +S.settings.oil_ml_per_device || 800;
const oilGal = () => +S.settings.oil_gallon_ml || 5000;
const fmtMl = (ml) => ml >= 1000 ? `${fmtNum(+(ml / 1000).toFixed(2))} لتر` : `${fmtNum(ml)} مل`;
// الكمية المطلوبة والجوالين (تقريب لأعلى) والفائض بعد التعبئة
function oilCalc(devices, per = oilPer(), gal = oilGal()) {
  const ml = devices * per, gallons = Math.ceil(ml / gal);
  return { ml, gallons, spare: gallons * gal - ml };
}
const canWarehouse = () => ["admin", "company"].includes(realRole());
const oilState = { st: "", sel: {}, q: "", view: "" };

route("warehouse", {
  title: "المستودع",
  async render(v) {
    if (!canWarehouse()) { v.innerHTML = `<div class="empty">${I.box}هذا القسم خاص بمدير النظام والشركة المنفذة</div>`; return; }
    if (S.params.id === "new") return oilNew(v);
    if (S.params.id) return oilDetail(v, S.params.id);
    const { data: list, error } = await sb.from("oil_requests").select("*").order("created_at", { ascending: false });
    if (error) { v.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    const { data: items } = await sb.from("oil_request_items").select("request_id");
    const nM = (id) => (items || []).filter((x) => x.request_id === id).length;
    const co = realRole() === "company";
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const done = list.filter((q) => ["approved", "received"].includes(q.status));
    const monthGal = done.filter((q) => new Date(q.decided_at) >= month).reduce((a, q) => a + q.gallons, 0);
    const tabs = [["", "الكل", () => true], ["pending", "بانتظار الاعتماد", (q) => q.status === "pending"], ["approved", "جاهزة للاستلام", (q) => q.status === "approved"],
      ["received", "تم الاستلام", (q) => q.status === "received"], ["closed", "مرفوضة وملغاة", (q) => ["rejected", "cancelled"].includes(q.status)]];
    const tab = tabs.find(([k]) => k === oilState.st) || tabs[0];
    const rows = list.filter(tab[2]);
    v.innerHTML = `<div class="pagehead"><div class="grow"><div class="muted small">طلب الزيت العطري: ${fmtNum(oilPer())} مل لكل جهاز • الجالون ${fmtNum(oilGal() / 1000)} كجم (≈ ${fmtNum(oilGal())} مل)</div></div>
        ${co ? `<a class="btn primary" href="#/warehouse/new">${I.plus} طلب زيت جديد</a>` : ""}</div>
      <div class="kpis" style="margin-bottom:14px">
        <div class="card kpi ${list.some((q) => q.status === "pending") ? "warn" : ""}"><div class="lbl">${I.clock}بانتظار الاعتماد</div><div class="val">${fmtNum(list.filter((q) => q.status === "pending").length)}</div><div class="sub">${co ? "لدى مدير النظام" : "تنتظر توقيعك"}</div></div>
        <div class="card kpi"><div class="lbl">${I.check}جاهزة للاستلام</div><div class="val">${fmtNum(list.filter((q) => q.status === "approved").length)}</div><div class="sub">معتمدة وموقّعة</div></div>
        <div class="card kpi"><div class="lbl">${I.drop}جوالين هذا الشهر</div><div class="val">${fmtNum(monthGal)}</div><div class="sub">من الطلبات المعتمدة</div></div>
        <div class="card kpi"><div class="lbl">${I.box}إجمالي الطلبات</div><div class="val">${fmtNum(list.length)}</div><div class="sub">${fmtNum(done.reduce((a, q) => a + q.gallons, 0))} جالون معتمد</div></div>
      </div>
      <div class="card"><div class="toolbar"><div class="seg" id="o-tabs">${tabs.map(([k, l, fn]) => `<button data-st="${k}" class="${tab[0] === k ? "on" : ""}">${l} <span class="num">${list.filter(fn).length}</span></button>`).join("")}</div>
        <button class="btn sm right" id="o-exp">${I.download} تصدير</button></div>
      ${rows.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>رقم الطلب</th><th>التاريخ</th><th data-hide-sm>مقدم الطلب</th><th>المساجد</th><th data-hide-sm>الأجهزة</th><th>الكمية</th><th>الحالة</th></tr></thead><tbody>
        ${rows.map((q) => `<tr class="click" data-q="${q.id}"><td><b class="num">#${q.ref}</b></td><td class="small">${fmtDate(q.created_at)}</td><td data-hide-sm>${esc(q.requester_name)}</td>
          <td class="num">${fmtNum(nM(q.id))}</td><td data-hide-sm class="num">${fmtNum(q.total_devices)}</td><td><b class="num">${fmtNum(q.gallons)}</b> <span class="muted small">جالون</span></td><td>${oilChip(q.status)}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="bd empty" style="padding:40px">${I.box}${list.length ? "لا توجد طلبات في هذا التصنيف" : co ? "لا توجد طلبات بعد — ابدأ بـ «طلب زيت جديد»" : "لا توجد طلبات من الشركة بعد"}</div>`}</div>`;
    $("#o-tabs", v).onclick = (e) => { const b = e.target.closest("[data-st]"); if (!b) return; oilState.st = b.dataset.st; render(); };
    $$("[data-q]", v).forEach((tr) => tr.onclick = () => go("/warehouse/" + tr.dataset.q));
    $("#o-exp", v).onclick = () => exportXlsx(rows.map((q) => ({ "رقم الطلب": q.ref, "التاريخ": fmtDate(q.created_at), "مقدم الطلب": q.requester_name, "المساجد": nM(q.id),
      "الأجهزة": q.total_devices, "الكمية (مل)": q.total_ml, "الجوالين": q.gallons, "الحالة": OIL_ST[q.status]?.[0] || q.status, "المعتمد": q.approver_name || "", "تاريخ الاعتماد": q.decided_at ? fmtDate(q.decided_at) : "",
      "المستلم": q.received_by || "" })), "طلبات-المستودع.xlsx", "طلبات الزيت", { title: "طلبات الزيت العطري من المستودع" });
  },
});

// ───── طلب جديد (الشركة) ─────
async function oilNew(v) {
  if (realRole() !== "company") { go("/warehouse"); return; }
  await loadMosques();
  const list = S.mosques.filter((m) => m.stage === "active").sort((a, b) => (a.next_refill_at || "9") < (b.next_refill_at || "9") ? -1 : 1);
  // «وصلت للتعبئة»: المتأخرة والمستحقة خلال نافذة التذكير (افتراضيًا ٧٢ ساعة)
  const soon = Date.now() + (+S.settings.reminder_hours || 72) * 36e5, isDue = (m) => m.next_refill_at && new Date(m.next_refill_at) <= soon;
  const nDue = list.filter(isDue).length;
  if (!oilState.view) oilState.view = nDue ? "due" : "all";
  const sel = oilState.sel;
  if (!Object.keys(sel).length) list.filter(isDue).forEach((m) => sel[m.id] = Math.max(1, +m.devices_count || 1));
  v.innerHTML = `<div class="pagehead"><a class="btn ghost sm" href="#/warehouse">→ المستودع</a><h2 style="margin:0;font-size:19px">طلب زيت عطري جديد</h2></div>
    ${!list.length ? `<div class="card"><div class="bd empty" style="padding:40px">${I.mosque}لا توجد مساجد مركّبة بعد — يُطلب الزيت للمساجد التي تم تركيب أجهزتها.</div></div>` : `
    <div class="oil-new">
      <div class="card"><div class="toolbar">
        <div class="search">${I.search}<input class="input" id="o-q" type="search" placeholder="ابحث بالاسم أو الرمز أو الحي…" value="${esc(oilState.q)}"></div>
        <div class="seg" id="o-view"><button data-v="due">${I.drop} وصلت للتعبئة <span class="num">${nDue}</span></button><button data-v="all">كل المساجد المركّبة <span class="num">${list.length}</span></button></div>
        <button class="btn sm" id="o-all">تحديد المعروض</button><button class="btn sm ghost" id="o-none">إلغاء التحديد</button></div>
        <div class="hint" id="o-vhint" style="margin:0 16px 10px"></div>
        <div class="oil-list" id="o-list"></div></div>
      <aside class="card oil-sum" id="o-sum"></aside>
    </div>`}`;
  if (!list.length) return;
  const paintList = () => {
    const q = oilState.q.trim().toLowerCase();
    $$("#o-view [data-v]", v).forEach((b) => b.classList.toggle("on", b.dataset.v === oilState.view));
    const extra = Object.keys(sel).filter((k) => !isDue(list.find((m) => m.id === k) || {})).length;
    $("#o-vhint", v).innerHTML = oilState.view === "due"
      ? `تظهر المساجد التي وصل موعد تعبئتها (المتأخرة والمستحقة خلال ${fmtNum(+S.settings.reminder_hours || 72)} ساعة) ومحددة مسبقًا. لإضافة غيرها افتح «كل المساجد المركّبة».${extra ? ` <b>محدد من خارجها: ${fmtNum(extra)}</b>` : ""}`
      : "كل المساجد المركّبة — حدّد ما تريد إضافته للطلب.";
    const rows = list.filter((m) => (oilState.view === "all" || isDue(m) || m.id in sel) && (!q || [m.name, m.code, m.district].some((x) => String(x || "").toLowerCase().includes(q))));
    if (!rows.length && oilState.view === "due" && !q) { $("#o-list", v).innerHTML = `<div class="empty" style="padding:30px">${I.drop}لا توجد مساجد وصلت للتعبئة الآن — افتح «كل المساجد المركّبة» للاختيار منها.</div>`; return; }
    $("#o-list", v).innerHTML = rows.map((m) => {
      const on = m.id in sel, due = m.next_refill_at ? new Date(m.next_refill_at) : null;
      return `<label class="oil-row ${on ? "on" : ""}" data-m="${m.id}"><input type="checkbox" ${on ? "checked" : ""}>
        <span class="grow"><b>${esc(m.name)}</b><span class="muted small">${esc(m.code)} • ${esc(m.district || "—")}${due ? ` • التعبئة: <span class="${due < new Date() ? "t-bad" : isDue(m) ? "t-warn" : ""}">${fmtDate(due)}</span>` : ""}</span></span>
        <span class="oil-dev"><span class="small muted">الأجهزة</span><input class="input num" type="number" min="1" max="100" value="${on ? sel[m.id] : Math.max(1, +m.devices_count || 1)}" ${on ? "" : "disabled"}></span></label>`;
    }).join("") || `<div class="empty" style="padding:30px">لا نتائج</div>`;
    $$("#o-list [data-m]", v).forEach((row) => {
      const id = row.dataset.m, cb = $("input[type=checkbox]", row), n = $("input[type=number]", row);
      cb.onchange = () => { if (cb.checked) sel[id] = Math.max(1, Math.min(100, +n.value || 1)); else delete sel[id]; row.classList.toggle("on", cb.checked); n.disabled = !cb.checked; paintSum(); };
      n.oninput = () => { if (id in sel) { sel[id] = Math.max(1, Math.min(100, Math.round(+n.value) || 1)); paintSum(); } };
      n.onclick = (e) => e.stopPropagation();
    });
  };
  const paintSum = () => {
    const ids = Object.keys(sel), dev = ids.reduce((a, k) => a + sel[k], 0), c = oilCalc(dev);
    $("#o-sum", v).innerHTML = `<div class="hd"><h3>ملخص الطلب</h3></div><div class="bd">
      <div class="oil-big"><b class="num">${fmtNum(c.gallons)}</b><span>جالون</span></div>
      <div class="oil-lines">
        <div><span>المساجد</span><b class="num">${fmtNum(ids.length)}</b></div>
        <div><span>إجمالي الأجهزة</span><b class="num">${fmtNum(dev)}</b></div>
        <div><span>الزيت المطلوب</span><b>${fmtNum(c.ml)} مل</b></div>
        <div><span>سعة الجوالين</span><b>${fmtNum(c.gallons * oilGal())} مل</b></div>
        ${dev ? `<div><span>الفائض بعد التعبئة</span><b>${fmtNum(c.spare)} مل</b></div>` : ""}
      </div>
      <div class="hint">${fmtNum(dev)} جهاز × ${fmtNum(oilPer())} مل = ${fmtNum(c.ml)} مل ÷ ${fmtNum(oilGal())} مل للجالون (${fmtNum(oilGal() / 1000)} كجم)، مقرّبًا لأعلى.</div>
      <div class="field" style="margin-top:12px"><label>ملاحظة للمدير (اختياري)</label><textarea class="input" id="o-note" rows="2" placeholder="مثال: تعبئة دورة ديسمبر">${esc(oilState.note || "")}</textarea></div>
      <button class="btn primary" id="o-send" style="width:100%;margin-top:12px" ${ids.length ? "" : "disabled"}>${I.send} إرسال للاعتماد</button></div>`;
    $("#o-note", v).oninput = (e) => oilState.note = e.target.value;
    $("#o-send", v).onclick = async () => {
      const b = $("#o-send", v); b.disabled = true;
      const id = await run(sb.rpc("oil_request_create", { p_items: ids.map((k) => ({ mosque_id: k, devices: sel[k] })), p_note: oilState.note || null }), "أُرسل الطلب لمدير النظام للاعتماد");
      b.disabled = false;
      if (id) { oilState.sel = {}; oilState.note = ""; oilState.q = ""; oilState.view = ""; go("/warehouse/" + id); }
    };
  };
  $("#o-q", v).oninput = (e) => { oilState.q = e.target.value; paintList(); };
  $("#o-view", v).onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; oilState.view = b.dataset.v; paintList(); };
  $("#o-all", v).onclick = () => { $$("#o-list [data-m]", v).forEach((r) => { const m = list.find((x) => x.id === r.dataset.m); if (m && !(m.id in sel)) sel[m.id] = Math.max(1, +m.devices_count || 1); }); paintList(); paintSum(); };
  $("#o-none", v).onclick = () => { Object.keys(sel).forEach((k) => delete sel[k]); paintList(); paintSum(); };
  paintList(); paintSum();
}

// ───── تفاصيل الطلب ─────
async function oilDetail(v, id) {
  const [{ data: q, error }, { data: items }] = await Promise.all([
    sb.from("oil_requests").select("*").eq("id", id).maybeSingle(),
    sb.from("oil_request_items").select("*").eq("request_id", id).order("district"),
  ]);
  if (error || !q) { v.innerHTML = `<div class="empty">${esc(error ? errMsg(error) : "الطلب غير موجود")}</div>`; return; }
  const rr = realRole(), its = items || [];
  const steps = [["تقديم الطلب", q.requester_name, q.created_at, true], ["اعتماد مدير النظام", q.status === "rejected" ? "مرفوض" : q.approver_name || "بانتظار التوقيع", q.decided_at, ["approved", "received"].includes(q.status)],
    ["الاستلام من المستودع", q.received_by || "بعد الطباعة والتسليم", q.received_at, q.status === "received"]];
  v.innerHTML = `<div class="pagehead"><a class="btn ghost sm" href="#/warehouse">→ المستودع</a><h2 style="margin:0;font-size:19px">طلب زيت عطري <span class="num">#${q.ref}</span></h2>${oilChip(q.status)}
      <div class="right row" style="gap:8px">
        ${["approved", "received"].includes(q.status) ? `<button class="btn primary" id="o-print">${I.print} طباعة الورقة الموقّعة</button>` : ""}
        ${q.status === "pending" && rr === "admin" ? `<button class="btn primary" id="o-approve">${I.sign} اعتماد وتوقيع</button><button class="btn danger" id="o-reject">رفض</button>` : ""}
        ${q.status === "pending" && rr === "company" ? `<button class="btn danger" id="o-cancel">إلغاء الطلب</button>` : ""}
        ${q.status === "approved" ? `<button class="btn" id="o-recv">${I.check} تأكيد الاستلام</button>` : ""}
      </div></div>
    <div class="oil-steps">${steps.map(([t, w, at, ok], i) => `<div class="oil-step ${ok ? "ok" : q.status === "rejected" && i === 1 ? "bad" : ""}"><i>${ok ? I.check : i + 1}</i><div><b>${t}</b><span>${esc(w)}${at ? ` • ${fmtDateTime(at)}` : ""}</span></div></div>`).join("")}</div>
    <div class="kpis" style="margin:14px 0">
      <div class="card kpi"><div class="lbl">${I.mosque}المساجد</div><div class="val">${fmtNum(its.length)}</div></div>
      <div class="card kpi"><div class="lbl">${I.install}الأجهزة</div><div class="val">${fmtNum(q.total_devices)}</div><div class="sub">× ${fmtNum(q.ml_per_device)} مل</div></div>
      <div class="card kpi"><div class="lbl">${I.drop}الزيت المطلوب</div><div class="val">${fmtMl(q.total_ml)}</div><div class="sub">${fmtNum(q.total_ml)} مل</div></div>
      <div class="card kpi gold"><div class="lbl">${I.box}الجوالين</div><div class="val">${fmtNum(q.gallons)}</div><div class="sub">جالون ${fmtNum(q.gallon_ml / 1000)} كجم</div></div>
    </div>
    <div class="grid g2 oil-detail">
      <div class="card"><div class="hd"><h3>المساجد المطلوبة</h3></div><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>م</th><th>المسجد</th><th data-hide-sm>الحي</th><th>الأجهزة</th><th>الكمية</th></tr></thead><tbody>
        ${its.map((x, i) => `<tr${x.mosque_id ? ` class="click" data-m="${x.mosque_id}"` : ""}><td class="num muted">${i + 1}</td><td><b>${esc(x.mosque_name)}</b> <span class="muted small">${esc(x.mosque_code || "")}</span></td><td data-hide-sm>${esc(x.district || "—")}</td><td class="num">${fmtNum(x.devices)}</td><td class="num">${fmtNum(x.ml)} مل</td></tr>`).join("")}
        <tr class="oil-tot"><td></td><td><b>الإجمالي</b></td><td data-hide-sm></td><td class="num"><b>${fmtNum(q.total_devices)}</b></td><td class="num"><b>${fmtNum(q.total_ml)} مل</b></td></tr>
      </tbody></table></div></div>
      <div class="stack">
        <div class="card"><div class="hd"><h3>بيانات الطلب</h3></div><div class="bd"><table class="oil-kv">
          <tr><th>مقدم الطلب</th><td><b>${esc(q.requester_name)}</b>${q.requester_title ? ` <span class="muted small">— ${esc(q.requester_title)}</span>` : ""}</td></tr>
          <tr><th>تاريخ الطلب</th><td>${fmtDateTime(q.created_at)}</td></tr>
          ${q.note ? `<tr><th>ملاحظة</th><td style="white-space:pre-wrap">${esc(q.note)}</td></tr>` : ""}
          <tr><th>طريقة الحساب</th><td class="small">${fmtNum(q.total_devices)} جهاز × ${fmtNum(q.ml_per_device)} مل = ${fmtNum(q.total_ml)} مل ← ${fmtNum(q.gallons)} جالون (الفائض ${fmtNum(q.gallons * q.gallon_ml - q.total_ml)} مل)</td></tr>
        </table></div></div>
        ${q.decided_at ? `<div class="card"><div class="hd"><h3>${q.status === "rejected" ? "قرار الرفض" : "الاعتماد والتوقيع"}</h3></div><div class="bd">
          <table class="oil-kv"><tr><th>${q.status === "rejected" ? "رفضه" : "اعتمده"}</th><td><b>${esc(q.approver_name || "")}</b>${q.approver_title ? ` <span class="muted small">— ${esc(q.approver_title)}</span>` : ""}</td></tr>
          <tr><th>التاريخ</th><td>${fmtDateTime(q.decided_at)}</td></tr>${q.decision_note ? `<tr><th>${q.status === "rejected" ? "السبب" : "ملاحظة"}</th><td style="white-space:pre-wrap">${esc(q.decision_note)}</td></tr>` : ""}
          ${q.verify_code ? `<tr><th>رمز التحقق</th><td><b class="num" dir="ltr">${esc(q.verify_code)}</b></td></tr>` : ""}</table>
          ${q.signature ? `<div class="oil-sig"><img src="${esc(q.signature)}" alt="التوقيع الإلكتروني"></div>` : ""}
          ${q.received_at ? `<div class="hint" style="margin-top:8px">${I.check} استلمه من المستودع: <b>${esc(q.received_by || "")}</b> • ${fmtDateTime(q.received_at)}</div>` : ""}</div></div>` : ""}
      </div>
    </div>`;
  $$("[data-m]", v).forEach((tr) => tr.onclick = () => go("/mosque/" + tr.dataset.m));
  $("#o-print", v)?.addEventListener("click", () => printOilSheet(q, its));
  $("#o-approve", v)?.addEventListener("click", () => oilApprove(q, its));
  $("#o-reject", v)?.addEventListener("click", async () => {
    const note = await modal({ title: `رفض الطلب #${q.ref}`, body: `<div class="field"><label>سبب الرفض (يصل للشركة)</label><textarea class="input" rows="3" name="note"></textarea></div>`,
      actions: [{ label: "رفض الطلب", cls: "danger", onClick: (mb) => { const t = $("[name=note]", mb).value.trim(); if (!t) { toast("اكتب سبب الرفض", "err"); return false; } return t; } }, { label: "رجوع" }] });
    if (note && await run(sb.rpc("oil_request_decide", { p_id: q.id, p_approve: false, p_note: note }), "تم رفض الطلب وإشعار الشركة")) render();
  });
  $("#o-cancel", v)?.addEventListener("click", async () => {
    if (await confirmBox(`إلغاء طلب الزيت #${q.ref}؟`, "إلغاء الطلب", "danger") && await run(sb.rpc("oil_request_update", { p_id: q.id, p_action: "cancel" }), "تم إلغاء الطلب")) render();
  });
  $("#o-recv", v)?.addEventListener("click", async () => {
    const name = await modal({ title: "تأكيد الاستلام من المستودع", body: `<p class="muted" style="margin-top:0">${fmtNum(q.gallons)} جالون للطلب #${q.ref}</p><div class="field"><label>اسم المستلم</label><input class="input" name="n" value="${esc(S.me.name)}"></div>`,
      actions: [{ label: "تأكيد الاستلام", cls: "primary", onClick: (mb) => $("[name=n]", mb).value.trim() || S.me.name }, { label: "إلغاء" }] });
    if (name && await run(sb.rpc("oil_request_update", { p_id: q.id, p_action: "received", p_name: name }), "تم تسجيل الاستلام")) render();
  });
}

// ───── اعتماد بتوقيع إلكتروني (مدير النظام) ─────
async function oilApprove(q, its) {
  const { data: saved } = await sb.from("signatures").select("image").eq("account_id", S.me.id).maybeSingle();
  let useSaved = !!saved?.image, pad = null;
  const body = document.createElement("div");
  const draw = () => {
    body.innerHTML = `<div class="oil-confirm">أعتمد صرف <b>${fmtNum(q.gallons)} جالون</b> (${fmtNum(q.total_ml)} مل) لعدد <b>${fmtNum(its.length)} مسجد</b> و<b>${fmtNum(q.total_devices)} جهاز</b> بطلب من ${esc(q.requester_name)}.</div>
      <div class="row" style="justify-content:space-between;margin:14px 0 6px"><b>التوقيع الإلكتروني</b>
        ${saved?.image ? `<div class="seg" id="sg-mode"><button data-u="1" class="${useSaved ? "on" : ""}">توقيعي المحفوظ</button><button data-u="0" class="${useSaved ? "" : "on"}">توقيع جديد</button></div>` : ""}</div>
      ${useSaved ? `<div class="sig-box saved"><img src="${esc(saved.image)}" alt="التوقيع المحفوظ"></div>` :
        `<div class="sig-box"><canvas id="sg-c" aria-label="مساحة التوقيع"></canvas><span class="sig-ph">وقّع هنا بالإصبع أو الفأرة</span><button type="button" class="btn sm ghost sig-clr" id="sg-clr">مسح</button></div>
        <label class="row small" style="gap:6px;margin-top:8px"><input type="checkbox" id="sg-save" ${saved?.image ? "" : "checked"}> حفظ هذا التوقيع لاستخدامه في الاعتمادات القادمة</label>`}
      <div class="field" style="margin-top:12px"><label>ملاحظة (اختياري)</label><input class="input" id="sg-note" placeholder="تظهر في الورقة المعتمدة"></div>
      <div class="hint">يُسجّل اسمك (${esc(S.me.name)}) ووقت الاعتماد ورمز تحقق فريد في الورقة المطبوعة.</div>`;
    $("#sg-mode", body)?.addEventListener("click", (e) => { const b = e.target.closest("[data-u]"); if (!b) return; useSaved = b.dataset.u === "1"; draw(); });
    pad = useSaved ? null : sigPad($("#sg-c", body), $("#sg-clr", body));
  };
  draw();
  await modal({ title: `اعتماد طلب الزيت #${q.ref}`, body, actions: [{ label: `${I.sign} اعتماد وتوقيع`, cls: "primary", onClick: async () => {
    if (!useSaved && !pad.ok()) { toast("وقّع في المساحة المخصصة أولًا", "err"); return false; }
    const ok = await run(sb.rpc("oil_request_decide", { p_id: q.id, p_approve: true, p_note: $("#sg-note", body).value.trim() || null,
      p_signature: useSaved ? null : pad.png(), p_save: !useSaved && !!$("#sg-save", body)?.checked }), "تم اعتماد الطلب وتوقيعه — أُشعرت الشركة");
    if (ok) { render(); return true; } return false;
  } }, { label: "إلغاء" }] });
}

// لوحة توقيع: رسم بالمؤشر (إصبع/فأرة/قلم) وتصدير PNG مقصوص على حدود التوقيع
function sigPad(cv, clr) {
  const dpr = Math.max(2, devicePixelRatio || 1), ctx = cv.getContext("2d");
  let strokes = 0, last = null;
  const size = () => { const r = cv.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1d2a52"; ctx.lineWidth = 2.4; };
  requestAnimationFrame(size);
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); last = pt(e); strokes++; cv.parentElement.classList.add("has"); ctx.beginPath(); ctx.arc(last[0], last[1], 1.1, 0, 7); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); });
  cv.addEventListener("pointermove", (e) => { if (!last) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; });
  const end = () => last = null; cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  cv.style.touchAction = "none";
  clr.onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); strokes = 0; cv.parentElement.classList.remove("has"); };
  return {
    ok: () => strokes > 0,
    png: () => {
      const { width: w, height: h } = cv, d = ctx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const pad = 12 * dpr; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
      const out = document.createElement("canvas"); out.width = Math.max(1, x1 - x0); out.height = Math.max(1, y1 - y0);
      out.getContext("2d").drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      return out.toDataURL("image/png");
    },
  };
}

// ───── الورقة المعتمدة للتسليم للمستودع ─────
function printOilSheet(q, its) {
  printDoc("إذن صرف زيت عطري من المستودع", `
    <div class="dstats">${[["المساجد", its.length, "#563331"], ["الأجهزة", q.total_devices, "#8a6d3b"], ["الزيت المطلوب (مل)", q.total_ml, "#3b6c8c"], ["عدد الجوالين", q.gallons, "#ceb26b"]]
      .map(([l, n, c]) => `<div style="--a:${c}"><b>${fmtNum(n)}</b><span>${l}</span></div>`).join("")}</div>
    <h2>المساجد المطلوب تعبئتها</h2>
    <table class="list"><thead><tr><th class="n">م</th><th>رمز المسجد</th><th>المسجد</th><th>الحي</th><th>الأجهزة</th><th>الكمية (مل)</th></tr></thead><tbody>
      ${its.map((x, i) => `<tr><td class="n">${i + 1}</td><td>${esc(x.mosque_code || "")}</td><td><b>${esc(x.mosque_name)}</b></td><td>${esc(x.district || "")}</td><td>${fmtNum(x.devices)}</td><td>${fmtNum(x.ml)}</td></tr>`).join("")}
      <tr class="tot"><td></td><td></td><td><b>الإجمالي</b></td><td></td><td><b>${fmtNum(q.total_devices)}</b></td><td><b>${fmtNum(q.total_ml)}</b></td></tr></tbody></table>
    <p class="calc">طريقة الحساب: ${fmtNum(q.total_devices)} جهاز × ${fmtNum(q.ml_per_device)} مل = <b>${fmtNum(q.total_ml)} مل</b> — الجالون ${fmtNum(q.gallon_ml / 1000)} كجم (≈ ${fmtNum(q.gallon_ml)} مل) ← المطلوب صرفه <b>${fmtNum(q.gallons)} جالون</b>${q.note ? ` • ملاحظة الطلب: ${esc(q.note)}` : ""}.</p>
    <div class="sigs">
      <div class="sg"><div class="sg-h">مقدم الطلب — ${esc(S.settings.company_name || "الشركة المنفذة")}</div><div class="sg-n">${esc(q.requester_name)}</div>${q.requester_title ? `<div class="sg-t">${esc(q.requester_title)}</div>` : ""}<div class="sg-t">${fmtDateTime(q.created_at)}</div></div>
      <div class="sg main"><div class="sg-h">اعتماد مدير النظام</div><div class="sg-n">${esc(q.approver_name || "")}</div>${q.approver_title ? `<div class="sg-t">${esc(q.approver_title)}</div>` : ""}
        ${q.signature ? `<img class="sg-img" src="${esc(q.signature)}" alt="التوقيع">` : ""}<div class="sg-t">${fmtDateTime(q.decided_at)}</div>${q.decision_note ? `<div class="sg-t">${esc(q.decision_note)}</div>` : ""}
        <div class="sg-v">رمز التحقق: <b dir="ltr">${esc(q.verify_code || "")}</b></div></div>
      <div class="sg"><div class="sg-h">استلام المستودع</div>${q.received_at ? `<div class="sg-n">${esc(q.received_by || "")}</div><div class="sg-t">${fmtDateTime(q.received_at)}</div>` :
        `<div class="sg-line">الاسم:</div><div class="sg-line">التوقيع:</div><div class="sg-line">التاريخ:</div>`}</div>
    </div>
    <p class="calc" style="margin-top:10px">وُقّع هذا الإذن إلكترونيًا عبر منصة ${esc(S.settings.platform_name || "طيب")}، ويمكن التحقق منه برقم الطلب ورمز التحقق.</p>`,
    { file: `اذن-صرف-زيت-${q.ref}`, meta: [["رقم الطلب", "#" + q.ref], ["مقدم الطلب", q.requester_name], ["الحالة", OIL_ST[q.status]?.[0] || ""]] });
}
