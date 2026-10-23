// ───────────────────────── الهيكل والدخول ─────────────────────────
const NAV = [
  { r: "dashboard", l: "لوحة المؤشرات", i: "dash", roles: ["admin", "association", "company", "viewer"] },
  { r: "mosques", l: "المساجد", i: "mosque", roles: ["admin", "association", "company"] },
  { r: "tasks", l: "المهام والطلبات", i: "tasks", roles: ["admin", "association", "company"] },
  { r: "refills", l: "جدول التعبئة", i: "drop", roles: ["admin", "association", "company"] },
  { r: "reports", l: "التقارير", i: "report", roles: ["admin", "association", "company"] },
  { r: "achievements", l: "المنجزات", i: "sparkle", roles: ["admin", "association", "company", "viewer"] },
  { r: "notifications", l: "الإشعارات", i: "bell", roles: ["admin", "association", "company", "viewer"], badge: true },
  { r: "messages", l: "الرسائل الجماعية", i: "send", roles: ["admin", "association"], sec: "التواصل" },
  { r: "associations", l: "الجمعيات", i: "org", roles: ["admin"], sec: "الإدارة" },
  { r: "accounts", l: "الحسابات", i: "users", roles: ["admin"] },
  { r: "settings", l: "الإعدادات", i: "gear", roles: ["admin"] },
];
const BNAV = { admin: ["dashboard", "mosques", "tasks", "refills", "notifications"], association: ["dashboard", "mosques", "tasks", "refills", "notifications"],
  company: ["dashboard", "mosques", "refills", "tasks", "notifications"], viewer: ["dashboard", "achievements", "notifications"] };

function paintShell() {
  const app = $("#app");
  app.classList.remove("auth");
  const items = NAV.filter((n) => n.roles.includes(role()));
  let lastSec = null;
  $(".side").innerHTML = `<div class="brand"><div class="logo">${logoHtml()}</div><div><div class="name">${esc(S.settings.platform_name || "طيب")}</div><div class="sub">${esc(S.settings.org_name || "")}</div></div></div>
    <nav class="nav">${items.map((n) => { const sec = n.sec && n.sec !== lastSec ? ((lastSec = n.sec), `<div class="sec">${n.sec}</div>`) : ""; return `${sec}<a href="#/${n.r}" data-r="${n.r}">${I[n.i]}<span>${n.l}</span>${n.badge ? `<span class="badge" hidden></span>` : ""}</a>`; }).join("")}</nav>
    <div class="me"><b>${esc(S.me.name)}</b><span class="role">${ROLES[role()]}${role() === "association" ? ` — ${esc(assocName(S.me.association_id))}` : ""}</span>
      <div class="row" style="gap:6px"><button id="theme">${document.documentElement.dataset.theme === "dark" ? "☀️ فاتح" : "🌙 داكن"}</button><button id="logout">${"تسجيل الخروج"}</button></div></div>`;
  $(".topbar").innerHTML = `<button class="iconbtn menu-btn" id="menu" aria-label="القائمة">${I.menu}</button><div><div class="crumbs">${esc(S.settings.platform_name || "طيب")}</div><h1></h1></div>
    <div class="right row" style="gap:8px">${role() !== "viewer" ? `<button class="iconbtn" id="search-btn" title="بحث سريع">${I.search}</button>` : ""}<button class="iconbtn" id="bell" title="الإشعارات">${I.bell}<span class="dot" hidden></span></button></div>`;
  $(".bnav").innerHTML = (BNAV[role()] || []).map((r) => { const n = NAV.find((x) => x.r === r); return `<a href="#/${r}" data-r="${r}">${I[n.i]}<span>${n.l.split(" ")[0]}</span></a>`; }).join("");
  $("#logout").onclick = async () => { await sb.auth.signOut(); location.hash = ""; location.reload(); };
  $("#theme").onclick = () => {
    const dark = document.documentElement.dataset.theme !== "dark" && !(document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("tayyib.theme", document.documentElement.dataset.theme); } catch {}
    paintShell(); render();
  };
  $("#menu").onclick = () => app.classList.toggle("menu");
  $("#bell").onclick = toggleNotifPanel;
  $("#search-btn")?.addEventListener("click", quickSearch);
  app.addEventListener("click", (e) => { if (e.target.closest(".nav a")) app.classList.remove("menu"); if (app.classList.contains("menu") && !e.target.closest(".side") && !e.target.closest("#menu")) app.classList.remove("menu"); });
  paintBell();
}

async function quickSearch() {
  await loadMosques();
  const body = document.createElement("div");
  body.innerHTML = `<div class="search">${I.search}<input class="input" placeholder="اسم المسجد، الرمز، الحي، اسم أو جوال الإمام…"></div><div class="stack" style="margin-top:12px;gap:4px" data-res></div>`;
  const inp = $("input", body), res = $("[data-res]", body);
  inp.oninput = () => {
    const q = inp.value.trim().toLowerCase();
    if (!q) { res.innerHTML = ""; return; }
    const hits = S.mosques.filter((m) => [m.name, m.code, m.district, m.imam_name, normPhone(m.imam_phone), m.muezzin_name, m.servant_name].some((x) => String(x || "").toLowerCase().includes(q))).slice(0, 12);
    res.innerHTML = hits.map((m) => `<a class="row" href="#/mosque/${m.id}" style="padding:8px 10px;border-radius:10px;color:var(--ink)" data-hit><b>${esc(m.name)}</b><span class="muted small">${esc(m.code)} · ${esc(m.district || "")}</span><span class="right">${stageChip(m.stage)}</span></a>`).join("") || `<div class="muted small">لا نتائج</div>`;
  };
  modal({ title: "بحث سريع", body, onOpen: (mb, close) => { mb.addEventListener("click", (e) => { if (e.target.closest("[data-hit]")) close(); }); } });
}

let current = null;
async function render() {
  if (!S.me) return;
  parseHash();
  const allowed = NAV.find((n) => n.r === S.route)?.roles || (S.route === "mosque" ? ["admin", "association", "company"] : null);
  if (!ROUTES[S.route] || (allowed && !allowed.includes(role()))) { location.hash = "/dashboard"; return; }
  current?.leave?.();
  current = ROUTES[S.route];
  const navKey = S.route === "mosque" ? "mosques" : S.route;
  $$(".nav a, .bnav a").forEach((a) => a.classList.toggle("on", a.dataset.r === navKey));
  $(".topbar h1").textContent = current.title;
  const v = $("#view");
  v.scrollTop = 0; window.scrollTo(0, 0);
  try { await current.render(v); } catch (e) { console.error(e); v.innerHTML = `<div class="empty">${I.alert}حدث خطأ: ${esc(errMsg(e))}</div>`; }
}

// ───── شاشة الدخول والتفعيل ─────
function paintLogin(msg = "") {
  const app = $("#app");
  app.classList.add("auth");
  $(".side").innerHTML = ""; $(".topbar").innerHTML = ""; $(".bnav").innerHTML = "";
  $("#view").innerHTML = `<div class="login">
    <div class="art"><div class="pattern"></div>
      <div style="position:relative"><div style="width:76px;height:76px;margin-bottom:22px">${logoHtml()}</div>
        <h1>${esc(S.settings.platform_name || "طيب")}</h1><div class="tag">${esc(S.settings.org_name || "مشروع تعطير مساجد الرياض")}</div>
        <p>منصة متكاملة لإدارة تعطير بيوت الله: من اختيار المساجد وإسنادها للجمعيات المشرفة، إلى دراسة الاحتياج والتركيب والتعبئة الدورية وقياس رضا المصلين.</p></div>
      <div class="feat">${[["mosque", "ملف متكامل لكل مسجد وفريقه"], ["drop", "تذكير آلي قبل موعد التعبئة بـ ٧٢ ساعة"], ["report", "تقارير الزيارات والرضا والأداء الشهري"], ["wa", "تواصل مباشر عبر واتساب والبريد"]].map(([i, t]) => `<div>${I[i]}${t}</div>`).join("")}</div>
      <div class="small" style="position:relative;color:#9fc1b5">﴿ فِي بُيُوتٍ أَذِنَ اللَّهُ أَن تُرْفَعَ وَيُذْكَرَ فِيهَا اسْمُهُ ﴾</div></div>
    <div class="panel"><div class="box">
      <div class="seg" id="mode" style="margin-bottom:22px"><button data-m="in" class="on">تسجيل الدخول</button><button data-m="up">تفعيل حساب جديد</button></div>
      <h2 id="lt">مرحبًا بك</h2><p class="muted small" id="ls" style="margin-top:0">سجّل الدخول بالبريد وكلمة المرور</p>
      <form class="stack" id="lf">
        ${fld("email", "البريد الإلكتروني", { type: "email", req: true, attrs: 'autocomplete="email"' })}
        ${fld("password", "كلمة المرور", { type: "password", req: true, attrs: 'autocomplete="current-password" minlength="8"' })}
        <div data-code hidden>${fld("code", "رمز التفعيل", { hint: "يصلك من مدير النظام عند إنشاء حسابك", attrs: 'dir="ltr" autocomplete="one-time-code" style="letter-spacing:3px;text-transform:uppercase"' })}</div>
        <button class="btn primary" style="padding:11px" id="lb">دخول</button>
        <div class="hint" id="lh">نسيت كلمة المرور؟ تواصل مع مدير النظام لإعادة تعيين الدخول.</div>
        ${msg ? `<div class="chip bad plain" style="white-space:normal;padding:8px 12px">${esc(msg)}</div>` : ""}
      </form></div></div></div>`;
  let mode = "in";
  $("#mode").onclick = (e) => {
    const b = e.target.closest("[data-m]"); if (!b) return;
    mode = b.dataset.m;
    $$("#mode button").forEach((x) => x.classList.toggle("on", x === b));
    $("[data-code]").hidden = mode !== "up";
    $("#lt").textContent = mode === "in" ? "مرحبًا بك" : "تفعيل حساب جديد";
    $("#ls").textContent = mode === "in" ? "سجّل الدخول بالبريد وكلمة المرور" : "أدخل بريدك ورمز التفعيل، واختر كلمة مرور (٨ أحرف على الأقل)";
    $("#lb").textContent = mode === "in" ? "دخول" : "تفعيل الحساب";
    $('[name="password"]').autocomplete = mode === "in" ? "current-password" : "new-password";
  };
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    const d = formData($("#lf"));
    const btn = $("#lb"); btn.disabled = true;
    try {
      const email = d.email.toLowerCase();
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password: d.password });
        if (error) throw new Error(/invalid/i.test(error.message) ? "البريد أو كلمة المرور غير صحيحة" : error.message);
      } else {
        if (!d.code) throw new Error("أدخل رمز التفعيل");
        if (d.password.length < 8) throw new Error("كلمة المرور ٨ أحرف على الأقل");
        let { data, error } = await sb.auth.signUp({ email, password: d.password });
        if (error && /already|registered|exists/i.test(error.message)) ({ data, error } = await sb.auth.signInWithPassword({ email, password: d.password }));
        if (error) throw new Error(/already|registered|exists|invalid/i.test(error.message) ? "هذا البريد مسجل مسبقًا بكلمة مرور أخرى — اطلب من المدير إعادة تعيين الدخول" : error.message);
        if (!data.session) throw new Error("يتطلب الخادم تأكيد البريد — يرجى إبلاغ مدير النظام بتعطيل «Confirm email» في إعدادات Supabase");
        const { error: e2 } = await sb.rpc("claim_account", { p_code: d.code });
        if (e2) { await sb.auth.signOut(); throw new Error(e2.message); }
      }
      await boot();
    } catch (err) { toast(err.message, "err"); }
    finally { btn.disabled = false; }
  };
}

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return paintLogin();
  const { data: me, error } = await sb.rpc("me");
  if (error || !me?.id) {
    await sb.auth.signOut();
    return paintLogin("حسابك غير مفعّل في المنصة. إن كان لديك رمز تفعيل فاختر «تفعيل حساب جديد»، وإلا تواصل مع مدير النظام.");
  }
  S.me = me;
  await Promise.all([loadAssociations(), loadNotifications()]);
  sb.rpc("touch_seen").then(() => {});
  paintShell();
  subscribeNotifications();
  if (!location.hash) location.hash = "/dashboard";
  render();
}

(function init() {
  try { const t = localStorage.getItem("tayyib.theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  window.addEventListener("hashchange", render);
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && S.me) location.reload(); });
  loadSettings().then(boot).catch((e) => { console.error(e); paintLogin("تعذّر الاتصال بالخادم"); });
})();
