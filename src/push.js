// ───────────────────────── تثبيت المنصة كتطبيق + إشعارات الجوال ─────────────────────────
// الإشعار يُرسل من الخادم (الدالة الطرفية push) لكل جهاز مشترك، فيصل والتطبيق مغلق.
// على الآيفون: تعمل الإشعارات فقط بعد إضافة المنصة إلى الشاشة الرئيسية وفتحها من أيقونتها (iOS 16.4+).
const isMockEnv = () => location.pathname.includes("/tests/");
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(navigator.userAgent);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushCapable = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const SHARE_I = svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>');
const DOTS_I = svg('<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>');
const PHONE_I = svg('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>');
let swRegP = null, installEvt = null;

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
window.addEventListener("appinstalled", () => { installEvt = null; toast("تم تثبيت «طيب» على جهازك — فعّل الإشعارات من داخل التطبيق"); });

function swReg() {
  if (isMockEnv() || !("serviceWorker" in navigator)) return Promise.resolve(null);
  return swRegP ||= navigator.serviceWorker.register("sw.js").catch(() => null);
}
// التسجيل مبكرًا ليكون التطبيق قابلًا للتثبيت من شاشة الدخول
if (!isMockEnv()) window.addEventListener("load", () => swReg());
// رسائل عامل الخدمة: فتح صفحة الإشعار، أو تحديث القائمة عند وصول إشعار
if ("serviceWorker" in navigator && !isMockEnv()) {
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "open") { const h = new URL(e.data.url).hash; if (h) location.hash = h.slice(1); }
    if (e.data?.type === "push" && S.me) { loadNotifications?.().then(() => paintBell?.()).catch(() => {}); }
  });
}
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const deviceName = () => `${isIOS() ? "iPhone/iPad" : isAndroid() ? "Android" : "متصفح"}${isStandalone() ? " • تطبيق" : ""}`;

// الحالة: on | off | install (آيفون من Safari) | denied | unsupported
async function pushState() {
  if (isMockEnv()) return window.__pushMock || "off";
  if (isIOS() && !isStandalone()) return "install";
  if (!pushCapable()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await swReg(); if (!reg) return "unsupported";
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}
async function pushEnable() {
  if (isMockEnv()) { window.__pushMock = "on"; toast("تم تفعيل الإشعارات على هذا الجهاز"); return true; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast(perm === "denied" ? "تم رفض الإشعارات — فعّلها من إعدادات الجوال" : "لم يتم التفعيل", "err"); return false; }
  try {
    const reg = await swReg(); await navigator.serviceWorker.ready;
    const { data: key, error } = await sb.rpc("push_public_key"); if (error || !key) throw error || new Error("مفتاح الإشعارات غير متاح");
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
    const j = sub.toJSON();
    const ok = await run(sb.rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_device: deviceName() }));
    if (ok) { await sb.rpc("push_test"); toast("تم التفعيل — وصلك إشعار تجريبي"); }
    return !!ok;
  } catch (e) { toast("تعذّر تفعيل الإشعارات: " + errMsg(e), "err"); return false; }
}
async function pushDisable() {
  if (isMockEnv()) { window.__pushMock = "off"; return; }
  const reg = await swReg(); const sub = await reg?.pushManager.getSubscription();
  if (sub) { await sb.rpc("push_unsubscribe", { p_endpoint: sub.endpoint }); await sub.unsubscribe().catch(() => {}); }
  toast("تم إيقاف الإشعارات على هذا الجهاز");
}
// بعد الدخول: ربط اشتراك الجهاز بالحساب الحالي (لو تغيّر المستخدم على نفس الجهاز)
async function pushSync() {
  if (isMockEnv() || !pushCapable() || Notification.permission !== "granted") { swReg(); return; }
  const reg = await swReg(); const sub = await reg?.pushManager.getSubscription(); if (!sub) return;
  const j = sub.toJSON();
  sb.rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_device: deviceName() });
  if ("clearAppBadge" in navigator && !S.notifications?.some((n) => !n.read_at)) navigator.clearAppBadge().catch(() => {});
}
// عند الخروج: يتوقف وصول إشعارات هذا الحساب لهذا الجهاز
async function pushLogout() {
  if (isMockEnv() || !("serviceWorker" in navigator)) return;
  const sub = await (await swReg())?.pushManager.getSubscription();
  if (sub) { try { await sb.rpc("push_unsubscribe", { p_endpoint: sub.endpoint }); } catch {} }
}

// بطاقة الحالة (صفحة الإشعارات + النافذة)
const PUSH_TXT = {
  on: ["ok", "إشعارات الجوال مفعّلة على هذا الجهاز", "تصلك تنبيهات المهام والاعتمادات والتذكيرات فورًا حتى والتطبيق مغلق."],
  off: ["gold", "فعّل إشعارات الجوال", "ليصلك كل جديد فورًا على جوالك حتى والتطبيق مغلق — كأي تطبيق."],
  install: ["warn", "ثبّت المنصة على الشاشة الرئيسية أولًا", "في الآيفون تعمل الإشعارات بعد إضافة «طيب» إلى الشاشة الرئيسية وفتحه من أيقونته."],
  denied: ["bad", "الإشعارات مرفوضة على هذا الجهاز", "فعّلها من: الإعدادات ← الإشعارات ← طيب (أو إعدادات الموقع في المتصفح)، ثم عد هنا."],
  unsupported: ["plain", "هذا المتصفح لا يدعم إشعارات الجوال", "استخدم Chrome على أندرويد، أو Safari على آيفون (iOS 16.4 فأحدث) بعد تثبيت المنصة."],
};
async function pushCard(el, { compact = false } = {}) {
  const st = await pushState(), [tone, title, sub] = PUSH_TXT[st];
  el.innerHTML = `<div class="push-card t-${tone}${compact ? " compact" : ""}"><div class="pc-ic">${st === "on" ? I.check : st === "install" ? PHONE_I : I.bell}</div>
    <div class="grow"><b>${title}</b><span>${sub}</span></div>
    <div class="pc-act">${st === "on" ? `<button class="btn sm" data-p="test">إشعار تجريبي</button><button class="btn sm ghost" data-p="off">إيقاف</button>`
      : st === "off" ? `<button class="btn primary sm" data-p="on">${I.bell} تفعيل الإشعارات</button>`
      : st === "install" ? `<button class="btn primary sm" data-p="help">${PHONE_I} طريقة التثبيت</button>`
      : `<button class="btn sm" data-p="help">المساعدة</button>`}</div></div>`;
  el.onclick = async (e) => {
    const b = e.target.closest("[data-p]"); if (!b) return;
    b.disabled = true;
    if (b.dataset.p === "on") await pushEnable();
    if (b.dataset.p === "off") await pushDisable();
    if (b.dataset.p === "test") await run(sb.rpc("push_test"), "أُرسل إشعار تجريبي — يصل خلال ثوانٍ");
    if (b.dataset.p === "help") installDialog();
    b.disabled = false; pushCard(el, { compact });
  };
}

// شرح التثبيت للآيفون والأندرويد
function installDialog(tab = isAndroid() ? "android" : "ios") {
  const url = location.origin + location.pathname.replace(/[^/]*$/, "");
  const STEPS = {
    ios: [[I.search, "افتح المنصة في <b>Safari</b>", `اكتب <b dir="ltr">${esc(url.replace(/^https?:\/\//, ""))}</b> — يجب أن يكون Safari وليس متصفحًا آخر.`],
      [SHARE_I, "اضغط زر <b>المشاركة</b>", "المربع والسهم للأعلى، أسفل الشاشة (أو أعلاها في الآيباد)."],
      [I.plus, "اختر <b>«إضافة إلى الشاشة الرئيسية»</b>", "مرّر القائمة للأسفل إن لم يظهر، ثم اضغط <b>«إضافة»</b>."],
      [I.bell, "افتح «طيب» من أيقونته وفعّل الإشعارات", "من «الإشعارات» اضغط <b>«تفعيل الإشعارات»</b> ثم <b>«سماح»</b>."]],
    android: [[I.search, "افتح المنصة في <b>Chrome</b>", `اكتب <b dir="ltr">${esc(url.replace(/^https?:\/\//, ""))}</b>`],
      [DOTS_I, "اضغط قائمة <b>⋮</b> أعلى الشاشة", "ثم <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>."],
      [I.plus, "اضغط <b>«تثبيت»</b>", "تظهر أيقونة «طيب» مع تطبيقاتك."],
      [I.bell, "افتح «طيب» وفعّل الإشعارات", "من «الإشعارات» اضغط <b>«تفعيل الإشعارات»</b> ثم <b>«سماح»</b>."]],
  };
  const body = document.createElement("div");
  const draw = () => {
    body.innerHTML = `<div class="seg" id="ins-tabs" style="margin-bottom:14px"><button data-t="ios" class="${tab === "ios" ? "on" : ""}">آيفون</button><button data-t="android" class="${tab === "android" ? "on" : ""}">أندرويد</button></div>
      ${tab === "android" && installEvt ? `<button class="btn primary" id="ins-now" style="width:100%;margin-bottom:12px">${PHONE_I} تثبيت «طيب» الآن</button>` : ""}
      <ol class="ins-steps">${STEPS[tab].map(([ic, t, d], i) => `<li><span class="ins-n">${i + 1}</span><span class="ins-ic">${ic}</span><div><b>${t}</b><span>${d}</span></div></li>`).join("")}</ol>
      <div class="hint">${tab === "ios" ? "الإشعارات على الآيفون تتطلب iOS 16.4 فأحدث، وتعمل فقط من أيقونة التطبيق على الشاشة الرئيسية." : "إن لم يظهر خيار التثبيت، حدّث Chrome من المتجر. يمكن تفعيل الإشعارات أيضًا من المتصفح مباشرة."}
        <a href="${esc(guideBase())}install.html" target="_blank" rel="noopener">الشرح المصوّر ←</a></div>`;
    $("#ins-tabs", body).onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) { tab = b.dataset.t; draw(); } };
    $("#ins-now", body)?.addEventListener("click", async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; draw(); });
  };
  draw();
  modal({ title: "تثبيت «طيب» كتطبيق وتفعيل الإشعارات", body });
}

// تنبيه لطيف في الرئيسية لمن لم يفعّل الإشعارات (يمكن إخفاؤه)
async function pushBanner(host) {
  try { if (localStorage.getItem("tayyib.pushBanner") === "hide") return; } catch {}
  const st = await pushState();
  if (!["off", "install"].includes(st) || !host.isConnected) return;
  const el = document.createElement("div"); el.className = "push-banner";
  host.prepend(el);
  await pushCard(el, { compact: true });
  const x = document.createElement("button"); x.className = "pb-x"; x.setAttribute("aria-label", "إخفاء"); x.innerHTML = I.x;
  x.onclick = () => { el.remove(); try { localStorage.setItem("tayyib.pushBanner", "hide"); } catch {} };
  $(".push-card", el)?.appendChild(x);
}
