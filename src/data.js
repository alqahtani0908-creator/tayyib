// ───────────────────────── البيانات ─────────────────────────
async function loadSettings() {
  const { data } = await sb.from("settings").select("*").eq("id", 1).maybeSingle();
  S.settings = data || {};
  S.logoUrl = S.settings.logo_path ? sb.storage.from("brand").getPublicUrl(S.settings.logo_path).data.publicUrl : null;
  document.title = S.settings.platform_name ? `${S.settings.platform_name} — ${S.settings.org_name || ""}` : "طيب";
}
async function loadAssociations() {
  const { data } = await sb.from("associations").select("*").order("name");
  S.associations = data || [];
}
async function loadMosques(force = false) {
  if (S.mosques && !force) return S.mosques;
  if (role() === "viewer") return (S.mosques = []);
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("mosques").select("*").order("code").range(from, from + 999);
    if (error) { toast(errMsg(error), "err"); break; }
    all.push(...data);
    if (data.length < 1000) break;
  }
  S.mosques = all;
  return all;
}
const mosqueById = (id) => S.mosques?.find((m) => m.id === id);
async function refreshMosque(id) {
  const { data } = await sb.from("mosques").select("*").eq("id", id).maybeSingle();
  if (!S.mosques) return data;
  const i = S.mosques.findIndex((m) => m.id === id);
  if (data) { if (i >= 0) S.mosques[i] = data; else S.mosques.push(data); }
  else if (i >= 0) S.mosques.splice(i, 1);
  return data;
}

// ───── الإشعارات (لحظية مع تنبيه صوتي) ─────
let notifChannel = null;
async function loadNotifications() {
  const { data } = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
  S.notifications = data || [];
  S.unread = S.notifications.filter((n) => !n.read_at).length;
  paintBell();
}
function subscribeNotifications() {
  if (notifChannel || !S.me) return;
  notifChannel = sb.channel("notif-" + S.me.id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `account_id=eq.${S.me.id}` }, (p) => {
      const n = p.new;
      if (S.notifications.some((x) => x.id === n.id)) return;
      S.notifications.unshift(n);
      S.unread++;
      paintBell(true);
      chime(n.kind);
      toast(n.body || "", "notif", { title: n.title, ms: 7000, onClick: () => openNotification(n) });
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        try { new Notification(n.title, { body: n.body || "", icon: S.logoUrl || undefined, tag: n.id }); } catch {}
      }
      if (n.mosque_id && S.mosques) refreshMosque(n.mosque_id);
    })
    .subscribe();
}
let audioCtx = null;
function chime(kind) {
  if (localStorage.getItem("tayyib.mute") === "1") return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === "alert" ? [880, 660] : kind === "reminder" ? [660, 880, 990] : [740, 988];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t = audioCtx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.4);
    });
  } catch {}
}
function paintBell(ring = false) {
  const b = $("#bell");
  if (!b) return;
  const dot = $(".dot", b);
  dot.textContent = S.unread > 99 ? "99+" : S.unread;
  dot.hidden = !S.unread;
  if (ring) { b.classList.remove("ring"); void b.offsetWidth; b.classList.add("ring"); }
  const nb = $('.nav a[data-r="notifications"] .badge');
  if (nb) { nb.textContent = S.unread; nb.hidden = !S.unread; }
}
async function markRead(ids) {
  if (!ids.length) return;
  const now = new Date().toISOString();
  await sb.from("notifications").update({ read_at: now }).in("id", ids);
  S.notifications.forEach((n) => { if (ids.includes(n.id)) n.read_at = now; });
  S.unread = S.notifications.filter((n) => !n.read_at).length;
  paintBell();
}
function openNotification(n) {
  if (!n.read_at) markRead([n.id]);
  closeNotifPanel();
  if (n.task_id) go("/tasks/" + n.task_id);
  else if (n.mosque_id) go("/mosque/" + n.mosque_id);
}
const N_ICON = { reminder: I.clock, alert: I.alert, approval: I.star, refill: I.drop, stage: I.check, task: I.tasks, assign: I.mosque, report: I.report, info: I.bell };
const notifItem = (n) => `<div class="nitem k-${esc(n.kind)} ${n.read_at ? "" : "unread"}" data-n="${n.id}">
  <div class="ni">${N_ICON[n.kind] || I.bell}</div>
  <div><b>${esc(n.title)}</b>${n.body ? `<div class="nb">${esc(n.body)}</div>` : ""}<div class="nt">${ago(n.created_at)}</div></div></div>`;
function toggleNotifPanel() {
  if ($(".npanel")) return closeNotifPanel();
  const p = document.createElement("div");
  p.className = "npanel card";
  const draw = () => {
    const items = S.notifications.slice(0, 30);
    p.innerHTML = `<div class="hd"><h3>الإشعارات</h3><span class="chip gold plain">${S.unread} غير مقروء</span>
      <button class="btn sm ghost right" data-all>تحديد الكل كمقروء</button></div>
      <div class="list">${items.length ? items.map(notifItem).join("") : `<div class="empty">${I.bell}لا توجد إشعارات</div>`}</div>
      <div style="padding:10px 16px;border-top:1px solid var(--line)" class="row"><a href="#/notifications" data-go>عرض كل الإشعارات</a>
      ${"Notification" in window && Notification.permission === "default" ? `<button class="btn sm right" data-perm>تفعيل تنبيهات المتصفح</button>` : ""}</div>`;
  };
  draw();
  p.onclick = async (e) => {
    const it = e.target.closest("[data-n]");
    if (it) return openNotification(S.notifications.find((n) => n.id === it.dataset.n));
    if (e.target.closest("[data-all]")) { await markRead(S.notifications.filter((n) => !n.read_at).map((n) => n.id)); draw(); }
    if (e.target.closest("[data-perm]")) { await Notification.requestPermission(); draw(); }
    if (e.target.closest("[data-go]")) closeNotifPanel();
  };
  document.body.appendChild(p);
  setTimeout(() => document.addEventListener("mousedown", outsideNotif), 0);
}
function outsideNotif(e) { if (!e.target.closest(".npanel") && !e.target.closest("#bell")) closeNotifPanel(); }
function closeNotifPanel() { $(".npanel")?.remove(); document.removeEventListener("mousedown", outsideNotif); }

// ───── المسار: ما الإجراء التالي لكل مسجد ولكل دور ─────
// يعيد {title, desc, action, who} أو null
function nextAction(m, r = role()) {
  const s = m.stage;
  const A = {
    selected: { who: "admin", title: "إسناد المسجد لجمعية مشرفة", desc: "اختر الجمعية المشرفة على هذا المسجد", action: "assign" },
    assigned: { who: "association", title: "استكمال البيانات الناقصة", desc: "أكمل الحي وأسماء وأرقام الإمام والمؤذن والخادم ثم اعتمد الاكتمال", action: "complete" },
    data_done: { who: "association", title: "التواصل مع الإمام ورفع التقرير", desc: "تأكد من قابلية تطبيق المشروع وارفع تقرير التواصل", action: "feasibility" },
    not_feasible: { who: "association", title: "إعادة التواصل مع الإمام", desc: "أفادت الجمعية بعدم القابلية — يمكن رفع تقرير جديد عند تغيّر الحال", action: "feasibility" },
    feasible: { who: "company", title: "دراسة احتياج الجامع", desc: "زيارة الموقع ورفع تقرير دراسة الاحتياج (عدد الأجهزة ومواقعها)", action: "needs_study" },
    study_done: { who: "admin", title: "اعتماد التركيب", desc: "راجع دراسة الاحتياج واعتمد التركيب أو أعدها للشركة", action: "decide" },
    approved: { who: "company", title: "التركيب ورفع التقرير", desc: "نفّذ التركيب وارفع تقرير التركيب مع الصور", action: "installation" },
  }[s];
  if (!A) return null;
  if (r === "admin" || A.who === r) return A;
  return { ...A, waiting: true };
}
// الإجراءات الدورية المتاحة لمسجد قيد التشغيل
function opsActions(r = role()) {
  const a = [];
  if (r === "association" || r === "admin") a.push(["visit", "زيارة أسبوعية", I.visit], ["satisfaction", "قياس الرضا", I.star], ["monthly", "التقرير الشهري", I.report]);
  if (r === "company" || r === "admin") a.push(["refill", "تعبئة العطر", I.drop]);
  return a;
}
