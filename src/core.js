// ───────────────────────── الأساسيات ─────────────────────────
const CFG = window.TAYYIB_CONFIG || {};
const sb = window.TAYYIB_CLIENT || window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
const MAX_FILE = 50 * 1024 * 1024;

const S = {
  me: null, settings: {}, associations: [], mosques: null, notifications: [], unread: 0,
  route: "", params: {}, logoUrl: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// ───── التواريخ والأرقام ─────
const AR_LOCALE = "ar-SA-u-ca-gregory-nu-latn";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString(AR_LOCALE, { year: "numeric", month: "short", day: "numeric" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString(AR_LOCALE, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const fmtNum = (n) => n == null ? "—" : Number(n).toLocaleString("en-US");
const isoDay = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const monthKey = (d = new Date()) => isoDay(d).slice(0, 7);
const monthName = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m - 1, 1).toLocaleDateString(AR_LOCALE, { month: "long", year: "numeric" }); };
function ago(d) {
  if (!d) return "";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "الآن";
  if (s < 3600) return `قبل ${Math.floor(s / 60)} د`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} س`;
  if (s < 86400 * 30) return `قبل ${Math.floor(s / 86400)} يوم`;
  return fmtDate(d);
}
function untilText(d) {
  if (!d) return "—";
  const h = (new Date(d) - Date.now()) / 36e5;
  if (h < 0) { const dd = Math.ceil(-h / 24); return `متأخر ${dd} يوم`; }
  if (h < 72) return `خلال ${Math.max(1, Math.round(h))} ساعة`;
  return `بعد ${Math.round(h / 24)} يوم`;
}
function refillChip(m) {
  if (m.stage !== "active" || !m.next_refill_at) return `<span class="muted">—</span>`;
  const h = (new Date(m.next_refill_at) - Date.now()) / 36e5;
  const reminder = S.settings.reminder_hours || 72;
  const cls = h < 0 ? "bad" : h <= reminder ? "warn" : "ok";
  return `<span class="chip ${cls}" title="${esc(fmtDateTime(m.next_refill_at))}">${untilText(m.next_refill_at)}</span>`;
}
const stars = (v) => v == null ? `<span class="muted">—</span>` :
  `<span class="stars" title="${Number(v).toFixed(2)} / 5">${"★".repeat(Math.round(v))}<span class="off">${"★".repeat(5 - Math.round(v))}</span></span> <b class="num">${Number(v).toFixed(1)}</b>`;
const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.ceil(b / 1024) + " KB";

// ───── الهاتف والتواصل ─────
function normPhone(p) {
  let d = String(p || "").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("05") && d.length === 10) d = "966" + d.slice(1);
  else if (d.startsWith("5") && d.length === 9) d = "966" + d;
  return d;
}
const waLink = (phone, text = "") => `https://wa.me/${normPhone(phone)}${text ? "?text=" + encodeURIComponent(text) : ""}`;
const displayPhone = (p) => { const n = normPhone(p); return n.startsWith("966") && n.length === 12 ? "0" + n.slice(3) : (p || ""); };
function contactBtns({ phone, email, text = "", name = "" } = {}) {
  const parts = [];
  if (phone && normPhone(phone)) {
    parts.push(`<a class="wa" href="${esc(waLink(phone, text))}" target="_blank" rel="noopener" title="واتساب ${esc(name)}">${I.wa}</a>`);
    parts.push(`<a class="tel" href="tel:+${normPhone(phone)}" title="اتصال">${I.phone}</a>`);
  }
  if (email) parts.push(`<a class="mail" href="mailto:${esc(email)}" title="بريد إلكتروني">${I.mail}</a>`);
  return parts.length ? `<span class="contact" onclick="event.stopPropagation()">${parts.join("")}</span>` : "";
}

// ───── الأيقونات ─────
const svg = (p, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const I = {
  dash: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  mosque: svg('<path d="M12 3c-3 2.2-5 4.2-5 6.5V11h10V9.5C17 7.2 15 5.2 12 3z"/><path d="M4 21V13h16v8"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M2 21h20"/><path d="M12 1.5V3"/>'),
  tasks: svg('<path d="M9 11l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="3"/>'),
  drop: svg('<path d="M12 2.7C8.5 7 6 10.3 6 14a6 6 0 0 0 12 0c0-3.7-2.5-7-6-11.3z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/>'),
  report: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
  star: svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  send: svg('<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>'),
  org: svg('<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3.5 6"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  wa: svg('<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8c-1-.4-2.3-1.7-2.7-2.7l.8-1-1-2z" fill="currentColor" stroke-width="1"/>'),
  phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>'),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>'),
  excel: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>'),
  file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  check: svg('<path d="M20 6L9 17l-5-5"/>'),
  menu: svg('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  alert: svg('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  map: svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  print: svg('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>'),
  key: svg('<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M18 5l2 2"/>'),
  visit: svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  chat: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  sparkle: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  install: svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>'),
  study: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6M11 8v6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>'),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
};
// شعار «طيب» المعتمد: حروف بلون الحبر (currentColor) وقائم الطاء الذهبي المتموج ونقاط معيّنة ذهبية
const ASSETS = window.TAYYIB_ASSETS || "assets/";
const LOGO_GLYPH = `<g fill="none" stroke-width="27" stroke-linejoin="round"><path stroke="currentColor" d="M687 453 V516 A61.5 61.5 0 0 0 748.5 577.5 H1247 A62.5 62.5 0 0 0 1247 452.5 H1098 M962 453 V577.5"/><path stroke="#ceb26b" d="M1097.5 591 V380 C1097.5 345 1148.5 320 1148.5 275 C1148.5 235 1112 215 1112 182"/></g><g fill="#ceb26b"><path d="M810.5 637 l24.5 24.5 -24.5 24.5 -24.5 -24.5z"/><path d="M936.5 637 l24.5 24.5 -24.5 24.5 -24.5 -24.5z"/><path d="M988 637 l24.5 24.5 -24.5 24.5 -24.5 -24.5z"/></g>`;
const logoSvg = () => `<svg viewBox="660 168 680 532" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="طيب">${LOGO_GLYPH}</svg>`;
const logoHtml = () => S.logoUrl ? `<img src="${esc(S.logoUrl)}" alt="طيب">` : logoSvg();
const foundationLogo = (white = false) => `${ASSETS}foundation-${white ? "white" : "primary"}.png`;

// ───── الأدوار والمراحل ─────
const ROLES = { admin: "مدير النظام", association: "جمعية مشرفة", company: "الشركة المنفذة", viewer: "حساب عرض" };
const STAGES = {
  selected: { l: "مختار — بانتظار الإسناد", s: "بانتظار الإسناد", c: "plain", who: "مدير النظام" },
  assigned: { l: "استكمال البيانات", s: "استكمال البيانات", c: "info", who: "الجمعية" },
  data_done: { l: "التواصل مع الإمام", s: "التواصل مع الإمام", c: "info", who: "الجمعية" },
  feasible: { l: "دراسة الاحتياج", s: "دراسة الاحتياج", c: "gold", who: "الشركة" },
  not_feasible: { l: "غير قابل للتطبيق", s: "غير قابل للتطبيق", c: "bad", who: "—" },
  study_done: { l: "بانتظار اعتماد التركيب", s: "بانتظار الاعتماد", c: "warn", who: "مدير النظام" },
  approved: { l: "معتمد — بانتظار التركيب", s: "بانتظار التركيب", c: "gold", who: "الشركة" },
  active: { l: "مُركّب — قيد التشغيل", s: "قيد التشغيل", c: "ok", who: "الجمعية والشركة" },
  suspended: { l: "موقوف", s: "موقوف", c: "bad", who: "—" },
};
const STAGE_ORDER = ["selected", "assigned", "data_done", "feasible", "study_done", "approved", "active"];
const stageChip = (s) => `<span class="chip ${STAGES[s]?.c || ""}">${esc(STAGES[s]?.s || s)}</span>`;
const isAdmin = () => S.me?.role === "admin";
const role = () => S.me?.role;
const assocName = (id) => S.associations.find((a) => a.id === id)?.name || "—";

// ───── واجهة عامة ─────
function toast(msg, type = "", opts = {}) {
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.innerHTML = opts.title ? `<b>${esc(opts.title)}</b>${esc(msg || "")}` : esc(msg);
  if (opts.onClick) el.onclick = () => { opts.onClick(); el.remove(); };
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), opts.ms || (type === "err" ? 6500 : 4000));
}
function errMsg(e) {
  const m = e?.message || String(e);
  if (/row-level security|permission denied/i.test(m)) return "لا تملك صلاحية تنفيذ هذا الإجراء";
  if (/duplicate key/i.test(m)) return "القيمة موجودة مسبقًا";
  if (/Failed to fetch|NetworkError/i.test(m)) return "تعذّر الاتصال بالخادم — تحقق من الإنترنت";
  return m;
}
async function run(promise, okMsg) {
  try {
    const r = await promise;
    if (r && r.error) throw r.error;
    if (okMsg) toast(okMsg);
    return r ? (r.data ?? true) : true;
  } catch (e) { toast(errMsg(e), "err"); return null; }
}

function modal({ title, body, actions = [], wide = false, onOpen } = {}) {
  return new Promise((resolve) => {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
      <div class="mh"><h3>${esc(title)}</h3><button class="btn ghost sm right" data-x>${I.x}</button></div>
      <div class="mb"></div><div class="mf"></div></div>`;
    const mb = $(".mb", bg), mf = $(".mf", bg);
    if (typeof body === "string") mb.innerHTML = body; else if (body) mb.appendChild(body);
    const close = (v) => { bg.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") close(null); };
    document.addEventListener("keydown", onKey);
    $("[data-x]", bg).onclick = () => close(null);
    bg.addEventListener("mousedown", (e) => { if (e.target === bg) close(null); });
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.cls || "");
      b.innerHTML = a.label;
      b.onclick = async () => {
        if (!a.onClick) return close(a.value);
        b.disabled = true;
        try { const v = await a.onClick(mb, close); if (v !== false && v !== undefined) close(v); }
        finally { b.disabled = false; }
      };
      mf.appendChild(b);
    });
    if (!actions.length) mf.remove();
    document.body.appendChild(bg);
    onOpen && onOpen(mb, close);
    setTimeout(() => $("input,select,textarea", mb)?.focus(), 30);
  });
}
const confirmBox = (text, label = "تأكيد", cls = "primary") =>
  modal({ title: "تأكيد", body: `<p style="margin:0">${esc(text)}</p>`, actions: [{ label, cls, value: true }, { label: "إلغاء", value: false }] });

function lightbox(src) {
  const el = document.createElement("div");
  el.className = "lightbox";
  el.innerHTML = `<img src="${esc(src)}" alt="">`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
}

// قراءة نموذج إلى كائن
function formData(root) {
  const o = {};
  $$("[name]", root).forEach((el) => {
    if (el.type === "checkbox") o[el.name] = el.checked;
    else if (el.type === "radio") { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  });
  $$("[data-rating]", root).forEach((el) => { o[el.dataset.rating] = el.dataset.value ? +el.dataset.value : null; });
  return o;
}
const fld = (name, label, { type = "text", value = "", req = false, opts = null, full = false, hint = "", attrs = "", ph = "" } = {}) => {
  let input;
  if (opts) input = `<select class="input" name="${name}" ${attrs}>${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value ?? "") ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select>`;
  else if (type === "textarea") input = `<textarea class="input" name="${name}" placeholder="${esc(ph)}" ${attrs}>${esc(value)}</textarea>`;
  else input = `<input class="input" type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(ph)}" ${type === "tel" ? 'dir="ltr" inputmode="tel"' : ""} ${type === "email" ? 'dir="ltr"' : ""} ${attrs}>`;
  return `<div class="field ${full ? "full" : ""}"><label>${esc(label)}${req ? ' <span class="req">*</span>' : ""}</label>${input}${hint ? `<div class="hint">${esc(hint)}</div>` : ""}</div>`;
};
const ratingFld = (name, label, value = null, full = false) => `<div class="field ${full ? "full" : ""}"><label>${esc(label)}</label>
  <div class="rating" data-rating="${name}" data-value="${value ?? ""}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" class="${value >= n ? "on" : ""}">${n}</button>`).join("")}</div></div>`;
function bindRatings(root) {
  $$("[data-rating]", root).forEach((r) => r.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    r.dataset.value = b.dataset.n;
    $$("button", r).forEach((x) => x.classList.toggle("on", +x.dataset.n <= +b.dataset.n));
  }));
}

// ───── رفع الملفات (حتى ٥٠ ميقابايت لكل ملف) ─────
function uploader({ accept = "image/*,application/pdf", label = "اسحب الصور أو ملفات PDF هنا أو اضغط للاختيار" } = {}) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="drop">${I.upload.replace("<svg", '<svg style="width:26px;height:26px;display:block;margin:0 auto 6px"')}${esc(label)}<div class="hint">حتى ${MAX_FILE / 1048576} ميقابايت للملف الواحد</div></div>
    <input type="file" multiple accept="${accept}" hidden><div class="uplist"></div>`;
  const files = [];
  const input = $("input", wrap), drop = $(".drop", wrap), list = $(".uplist", wrap);
  const render = () => {
    list.innerHTML = files.map((f, i) => `<div class="u">${f.type.startsWith("image/") ? I.file : I.report}<span class="grow">${esc(f.name)}</span><span class="muted small num">${fmtSize(f.size)}</span>
      <button type="button" class="btn ghost sm" data-rm="${i}">${I.x}</button></div>`).join("");
  };
  const add = (fl) => {
    for (const f of fl) {
      if (f.size > MAX_FILE) { toast(`«${f.name}» أكبر من ٥٠ ميقابايت`, "err"); continue; }
      files.push(f);
    }
    render();
  };
  drop.onclick = () => input.click();
  input.onchange = () => { add(input.files); input.value = ""; };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); add(e.dataTransfer.files); };
  list.onclick = (e) => { const b = e.target.closest("[data-rm]"); if (b) { files.splice(+b.dataset.rm, 1); render(); } };
  wrap.files = files;
  wrap.progress = (i, txt) => { const row = list.children[i]; if (row) $(".num", row).textContent = txt; };
  return wrap;
}
const safeName = (n) => n.replace(/[^\w.\-؀-ۿ]+/g, "_").slice(-80);
// يرفع الملفات ثم يسجلها في جدول المرفقات
async function uploadFiles(files, { mosqueId = null, taskId = null, reportId = null, ui = null } = {}) {
  const out = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const base = mosqueId ? `m/${mosqueId}` : `t/${taskId}`;
    const path = `${base}/${uid()}-${safeName(f.name)}`;
    ui?.progress(i, "جارٍ الرفع…");
    const { error } = await sb.storage.from("files").upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
    if (error) { toast(`تعذّر رفع «${f.name}»: ${errMsg(error)}`, "err"); ui?.progress(i, "فشل"); continue; }
    const { data, error: e2 } = await sb.from("attachments").insert({ mosque_id: mosqueId, task_id: taskId, report_id: reportId, path, name: f.name, size: f.size, mime: f.type }).select().single();
    if (e2) { toast(errMsg(e2), "err"); continue; }
    ui?.progress(i, "✓");
    out.push(data);
  }
  return out;
}
const urlCache = new Map();
async function fileUrl(path) {
  const c = urlCache.get(path);
  if (c && c.exp > Date.now()) return c.url;
  const { data, error } = await sb.storage.from("files").createSignedUrl(path, 3600);
  if (error) throw error;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3500e3 });
  return data.signedUrl;
}
function filesHtml(atts) {
  if (!atts?.length) return "";
  return `<div class="files">${atts.map((a) => a.mime?.startsWith("image/")
    ? `<img class="thumb" data-img="${esc(a.path)}" alt="${esc(a.name)}" title="${esc(a.name)}">`
    : `<span class="file" data-open="${esc(a.path)}" title="${esc(a.name)}">${I.file}<span>${esc(a.name)}</span><small class="muted num">${a.size ? fmtSize(a.size) : ""}</small></span>`).join("")}</div>`;
}
// يحمّل الصور المصغرة ويربط فتح الملفات
function hydrateFiles(root) {
  $$("img[data-img]", root).forEach(async (img) => {
    try { img.src = await fileUrl(img.dataset.img); img.onclick = () => lightbox(img.src); } catch { img.alt = "تعذّر التحميل"; }
  });
  $$("[data-open]", root).forEach((el) => el.onclick = async () => {
    try { window.open(await fileUrl(el.dataset.open), "_blank", "noopener"); } catch (e) { toast(errMsg(e), "err"); }
  });
}

// ───── تصدير Excel ─────
function exportXlsx(rows, filename, sheet = "البيانات") {
  if (!window.XLSX) return toast("مكتبة Excel لم تُحمّل بعد", "err");
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(12, k.length + 4) }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, filename);
}

// ───── الطباعة ─────
function printDoc(title, inner) {
  let el = $("#printdoc");
  if (!el) { el = document.createElement("div"); el.id = "printdoc"; document.body.appendChild(el); }
  el.innerHTML = `<div class="doc" dir="rtl"><div class="dh"><div style="width:84px;height:66px;color:#563331">${logoHtml()}</div>
    <div><div class="t">${esc(S.settings.platform_name || "طيب")}</div><div class="s">${esc(S.settings.org_name || "")}</div><div class="s"><b>${esc(title)}</b> • ${fmtDateTime(new Date())}</div></div>
    <img class="fl" style="margin-inline-start:auto" src="${foundationLogo()}" alt="مؤسسة أبناء علي الماجد"></div>
    ${inner}<div class="foot">صدر من منصة ${esc(S.settings.platform_name || "طيب")} — ${esc(S.me?.name || "")}</div></div>`;
  document.body.classList.add("printing-doc");
  const done = () => { document.body.classList.remove("printing-doc"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 250);
}

// ───── التنقل ─────
const ROUTES = {};
function route(name, def) { ROUTES[name] = def; }
function go(path) { if (location.hash !== "#" + path) location.hash = path; else render(); }
function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1) || "/dashboard");
  const [path, qs] = h.split("?");
  const parts = path.split("/").filter(Boolean);
  S.route = parts[0] || "dashboard";
  S.params = { id: parts[1], ...Object.fromEntries(new URLSearchParams(qs || "")) };
}
