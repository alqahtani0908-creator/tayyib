// ───────────────────────── المهام والطلبات ─────────────────────────
const T_STATUS = { open: ["مفتوحة", "info"], in_progress: ["قيد التنفيذ", "warn"], done: ["منجزة", "ok"], cancelled: ["ملغاة", "plain"] };
const T_PRIO = { low: ["منخفضة", "plain"], normal: ["عادية", "plain"], high: ["عالية", "warn"], urgent: ["عاجلة", "bad"] };
const T_ASSIGNEE = { admin: "مدير النظام", association: "الجمعية", company: "الشركة المنفذة" };
const taskWho = (t) => t.assignee === "association" ? assocName(t.association_id) : T_ASSIGNEE[t.assignee];

function tasksTable(tasks, { mosque = true } = {}) {
  if (!tasks.length) return `<div class="empty">${I.tasks}لا توجد مهام أو طلبات</div>`;
  return `<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>المهمة</th>${mosque ? "<th>المسجد</th>" : ""}<th>الجهة المكلفة</th><th>الأولوية</th><th>الاستحقاق</th><th>الحالة</th></tr></thead><tbody>
    ${tasks.map((t) => {
      const late = t.due_date && !["done", "cancelled"].includes(t.status) && t.due_date < isoDay();
      return `<tr class="click" data-task="${t.id}"><td><div class="t-name">${t.kind === "request" ? `<span class="chip gold plain small">طلب</span> ` : ""}${esc(t.title)}</div><div class="muted small">${ago(t.created_at)}</div></td>
      ${mosque ? `<td data-hide-sm>${t.mosque_id ? esc(mosqueById(t.mosque_id)?.name || "—") : `<span class="muted">عام</span>`}</td>` : ""}
      <td data-hide-sm>${esc(taskWho(t))}</td><td data-hide-sm><span class="chip ${T_PRIO[t.priority][1]}">${T_PRIO[t.priority][0]}</span></td>
      <td data-hide-sm class="${late ? "" : "muted"}" style="${late ? "color:var(--bad);font-weight:600" : ""}">${t.due_date ? fmtDate(t.due_date) : "—"}</td>
      <td><span class="chip ${T_STATUS[t.status][1]}">${T_STATUS[t.status][0]}</span></td></tr>`;
    }).join("")}</tbody></table></div>`;
}
function bindTaskRows(root) { $$("[data-task]", root).forEach((tr) => tr.onclick = () => go("/tasks/" + tr.dataset.task)); }

async function taskForm(pre = {}) {
  const r = role();
  await loadMosques();
  const mosques = S.mosques;
  const assignees = r === "admin" ? [["association", "الجمعية المشرفة"], ["company", "الشركة المنفذة"], ["admin", "مدير النظام"]]
    : r === "association" ? [["admin", "طلب إلى مدير النظام"], ["association", "مهمة داخلية للجمعية"]] : [["admin", "طلب إلى مدير النظام"]];
  const body = document.createElement("div");
  body.innerHTML = `<form class="form" onsubmit="return false">
    ${fld("title", r === "admin" ? "عنوان المهمة" : "عنوان الطلب", { req: true, full: true, ph: r === "admin" ? "مثال: التحقق من جهاز المصلى الرئيسي" : "مثال: طلب تغيير نوع العطر" })}
    ${fld("mosque_id", "المسجد", { value: pre.mosque_id || "", opts: [["", "— عام (غير مرتبط بمسجد) —"], ...mosques.map((m) => [m.id, `${m.name} — ${m.code}`])] })}
    ${fld("assignee", r === "admin" ? "الجهة المكلفة" : "الوجهة", { value: pre.assignee || assignees[0][0], opts: assignees })}
    ${r === "admin" ? `<div data-assoc-wrap>${fld("association_id", "الجمعية", { opts: [["", "— جمعية المسجد —"], ...S.associations.map((a) => [a.id, a.name])] })}</div>` : ""}
    ${fld("priority", "الأولوية", { value: "normal", opts: Object.entries(T_PRIO).map(([k, x]) => [k, x[0]]) })}
    ${fld("due_date", "تاريخ الاستحقاق", { type: "date" })}
    ${fld("details", "التفاصيل", { type: "textarea", full: true })}
  </form><div class="field" style="margin-top:12px"><label>مرفقات</label><div data-up></div></div>`;
  const up = uploader(); $("[data-up]", body).appendChild(up);
  const syncAssoc = () => { const w = $("[data-assoc-wrap]", body); if (w) w.hidden = $('[name="assignee"]', body).value !== "association"; };
  $('[name="assignee"]', body).onchange = syncAssoc; syncAssoc();
  return modal({
    title: r === "admin" ? "إيعاز مهمة" : "رفع طلب", body, wide: true,
    actions: [{ label: `${I.send} إرسال`, cls: "primary", onClick: async (mb) => {
      const d = formData($("form", mb));
      if (!d.title) { toast("العنوان مطلوب", "err"); return false; }
      const rec = { title: d.title, details: d.details || null, mosque_id: d.mosque_id || null, assignee: d.assignee, priority: d.priority, due_date: d.due_date || null,
        association_id: d.assignee === "association" ? (d.association_id || (r === "association" ? S.me.association_id : null)) : null, kind: r === "admin" ? "task" : "request" };
      if (rec.assignee === "association" && !rec.association_id && !rec.mosque_id) { toast("حدد الجمعية أو المسجد", "err"); return false; }
      const { data, error } = await sb.from("tasks").insert(rec).select().single();
      if (error) { toast(errMsg(error), "err"); return false; }
      if (up.files.length) await uploadFiles(up.files, { taskId: data.id, mosqueId: null, ui: up });
      toast(r === "admin" ? "تم إيعاز المهمة وإشعار الجهة المكلفة" : "تم رفع الطلب لمدير النظام");
      return data;
    } }, { label: "إلغاء" }],
  });
}

route("tasks", {
  title: "المهام والطلبات",
  async render(v) {
    if (S.params.id) return taskDetail(v, S.params.id);
    await loadMosques();
    const { data: tasks, error } = await sb.from("tasks").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) { v.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    const r = role();
    let f = S.params.f || "open";
    const mine = (t) => t.assignee === r && (r !== "association" || t.association_id === S.me.association_id);
    const groups = {
      open: ["المفتوحة", (t) => ["open", "in_progress"].includes(t.status)],
      mine: [r === "admin" ? "الواردة لي" : "المكلفة بها", (t) => mine(t) && ["open", "in_progress"].includes(t.status)],
      sent: ["المرسلة مني", (t) => t.created_by === S.me.id],
      requests: ["الطلبات", (t) => t.kind === "request"],
      late: ["المتأخرة", (t) => t.due_date && t.due_date < isoDay() && ["open", "in_progress"].includes(t.status)],
      done: ["المنجزة", (t) => t.status === "done"],
      all: ["الكل", () => true],
    };
    v.innerHTML = `<div class="pagehead"><div class="seg" id="seg">${Object.entries(groups).map(([k, [l, fn]]) => `<button data-f="${k}" class="${k === f ? "on" : ""}">${l} <span class="num">${tasks.filter(fn).length}</span></button>`).join("")}</div>
      ${r !== "viewer" ? `<button class="btn primary right" id="new">${I.plus} ${r === "admin" ? "إيعاز مهمة" : "رفع طلب"}</button>` : ""}</div>
      <div class="card" id="list"></div>`;
    const draw = () => { $("#list", v).innerHTML = tasksTable(tasks.filter(groups[f][1])); bindTaskRows(v); };
    $("#seg", v).onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; f = b.dataset.f; $$("#seg button", v).forEach((x) => x.classList.toggle("on", x === b)); draw(); history.replaceState(null, "", "#/tasks?f=" + f); };
    $("#new", v)?.addEventListener("click", async () => { if (await taskForm()) render(); });
    draw();
  },
});

async function taskDetail(v, id) {
  await loadMosques();
  const [{ data: t }, { data: comments }, { data: atts }] = await Promise.all([
    sb.from("tasks").select("*").eq("id", id).maybeSingle(),
    sb.from("task_comments").select("*").eq("task_id", id).order("created_at"),
    sb.from("attachments").select("*").eq("task_id", id),
  ]);
  if (!t) { v.innerHTML = `<div class="empty">المهمة غير موجودة أو لا تملك صلاحية عرضها</div>`; return; }
  $(".topbar h1").textContent = t.title;
  const m = t.mosque_id && mosqueById(t.mosque_id);
  const names = {};
  if (isAdmin()) { const ids = [t.created_by, ...(comments || []).map((c) => c.author_id)].filter(Boolean); const { data } = await sb.from("accounts").select("id,name,role").in("id", ids); (data || []).forEach((a) => names[a.id] = a.name); }
  const who = (aid) => aid === S.me.id ? "أنت" : names[aid] || "عضو";
  v.innerHTML = `<div class="grid g3"><div class="span2 stack">
    <div class="card pad"><div class="row"><a href="#/tasks" class="small">→ المهام</a></div>
      <div class="row" style="margin-top:8px">${t.kind === "request" ? `<span class="chip gold">طلب</span>` : `<span class="chip info">مهمة</span>`}<h2 style="margin:0;font-size:20px">${esc(t.title)}</h2></div>
      ${t.details ? `<p style="white-space:pre-wrap">${esc(t.details)}</p>` : `<p class="muted">لا توجد تفاصيل</p>`}${filesHtml(atts)}</div>
    <div class="card"><div class="hd"><h3>المتابعة والتعليقات</h3></div><div class="bd"><div class="tl">${(comments || []).map((c) => `<div class="tl-item"><div class="ti">${I.chat}</div><div class="tb"><div class="th"><b class="small">${esc(who(c.author_id))}</b><span class="muted small right">${fmtDateTime(c.created_at)}</span></div><div style="white-space:pre-wrap;margin-top:4px">${esc(c.body)}</div></div></div>`).join("") || `<div class="muted small">لا توجد تعليقات</div>`}</div>
      ${role() !== "viewer" ? `<div class="row" style="margin-top:14px;align-items:flex-end"><textarea class="input grow" id="cm" placeholder="اكتب تحديثًا أو ردًا…" style="min-height:60px"></textarea><button class="btn primary" id="cm-send">${I.send} إرسال</button></div>` : ""}</div></div>
  </div>
  <div class="card pad stack">
    <div><div class="muted small">الحالة</div><select class="input" id="st" ${role() === "viewer" ? "disabled" : ""}>${Object.entries(T_STATUS).map(([k, [l]]) => `<option value="${k}" ${t.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div><div class="muted small">الجهة المكلفة</div><b>${esc(taskWho(t))}</b></div>
    <div><div class="muted small">الأولوية</div><span class="chip ${T_PRIO[t.priority][1]}">${T_PRIO[t.priority][0]}</span></div>
    <div><div class="muted small">الاستحقاق</div><b>${t.due_date ? fmtDate(t.due_date) : "—"}</b></div>
    <div><div class="muted small">المسجد</div>${m ? `<a href="#/mosque/${m.id}"><b>${esc(m.name)}</b></a>` : "<b>عام</b>"}</div>
    <div><div class="muted small">أنشأها</div><b>${esc(who(t.created_by))}</b> <span class="muted small">(${ROLES[t.creator_role] || ""}) · ${fmtDateTime(t.created_at)}</span></div>
    ${t.closed_at ? `<div><div class="muted small">أُغلقت</div><b>${fmtDateTime(t.closed_at)}</b></div>` : ""}
    ${isAdmin() ? `<button class="btn danger sm" id="del">${I.trash} حذف</button>` : ""}
  </div></div>`;
  hydrateFiles(v);
  $("#st", v).onchange = async (e) => { if (await run(sb.from("tasks").update({ status: e.target.value }).eq("id", id), "تم تحديث الحالة")) render(); };
  $("#cm-send", v)?.addEventListener("click", async () => {
    const body = $("#cm", v).value.trim(); if (!body) return;
    if (await run(sb.from("task_comments").insert({ task_id: id, body }))) render();
  });
  $("#del", v)?.addEventListener("click", async () => { if (await confirmBox("حذف المهمة نهائيًا؟", "حذف", "danger") && await run(sb.from("tasks").delete().eq("id", id), "تم الحذف")) go("/tasks"); });
}
