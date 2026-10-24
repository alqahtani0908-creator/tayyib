// عميل Supabase وهمي في الذاكرة لاختبار الواجهة محليًا — لا يُنشر مع الموقع.
// الاستخدام: tests/index.html?as=admin|association|company|viewer
(function () {
  const as = new URLSearchParams(location.search).get("as") || "admin";
  const now = Date.now(), day = 864e5;
  const iso = (t) => new Date(t).toISOString();
  const id = () => crypto.randomUUID();
  const A1 = id(), A2 = id();
  const acc = {
    admin: { id: id(), name: "مدير الاختبار", email: "admin@test.local", role: "admin", user_id: "u-admin", active: true, invite_code: "AAAA1111", created_at: iso(now) },
    association: { id: id(), name: "مشرف الجمعية", email: "assoc@test.local", role: "association", association_id: A1, user_id: "u-assoc", active: true, invite_code: "BBBB1111", phone: "0500000010", created_at: iso(now) },
    company: { id: id(), name: "مهندس الشركة", email: "co@test.local", role: "company", user_id: "u-co", active: true, invite_code: "CCCC1111", created_at: iso(now) },
    viewer: { id: id(), name: "حساب العرض", email: "view@test.local", role: "viewer", user_id: "u-view", active: true, invite_code: "DDDD1111", created_at: iso(now) },
  };
  const db = {
    settings: [{ id: 1, platform_name: "طيب", org_name: "مشروع تعطير مساجد الرياض", company_name: "شركة الاختبار", refill_cycle_days: 30, reminder_hours: 72, visit_every_days: 7, font_files: { regular: "./fonts/Brando-Arabic-Regular.otf", semibold: "./fonts/Brando-Arabic-SemiBold.otf", bold: "./fonts/Brando-Arabic-Bold.otf" } }],
    associations: [{ id: A1, name: "جمعية اختبار أ", district: "شمال الرياض", contact_name: "مسؤول أ", phone: "0500000001", active: true }, { id: A2, name: "جمعية اختبار ب", active: true }],
    accounts: Object.values(acc).concat([{ id: id(), name: "حساب بانتظار التفعيل", email: "new@test.local", role: "association", association_id: A2, active: true, invite_code: "EEEE2222", phone: "0500000099", created_at: iso(now) }]),
    mosques: [], reports: [], tasks: [], task_comments: [], attachments: [], notifications: [], activity: [], broadcasts: [],
  };
  let seq = 0;
  const M = (o) => { const m = { id: id(), code: "M-" + String(++seq).padStart(4, "0"), kind: "جامع", stage: "selected", created_at: iso(now - seq * day), ...o }; db.mosques.push(m); return m; };
  const full = { imam_name: "إمام اختبار", imam_phone: "0501111111", muezzin_name: "مؤذن اختبار", muezzin_phone: "0502222222", servant_name: "خادم اختبار", servant_phone: "0503333333" };
  M({ name: "جامع اختبار ١", district: "حي أ" });
  M({ name: "جامع اختبار ٢", district: "حي ب", association_id: A1, stage: "assigned", imam_name: "إمام ناقص" });
  M({ name: "جامع اختبار ٣", district: "حي أ", association_id: A1, stage: "data_done", ...full });
  M({ name: "جامع اختبار ٤", district: "حي ج", association_id: A1, stage: "feasible", ...full });
  const m5 = M({ name: "جامع اختبار ٥", district: "حي ب", association_id: A2, stage: "study_done", ...full });
  M({ name: "جامع اختبار ٦", district: "حي ج", association_id: A1, stage: "approved", ...full });
  const m7 = M({ name: "جامع اختبار ٧", district: "حي أ", association_id: A1, stage: "active", ...full, devices_count: 4, fragrance: "عطر اختبار", installed_at: iso(now - 40 * day), last_refill_at: iso(now - 28 * day), next_refill_at: iso(now + 40 * 36e5), last_visit_at: iso(now - 9 * day), satisfaction_avg: 4.5 });
  const m8 = M({ name: "جامع اختبار ٨", district: "حي د", association_id: A2, stage: "active", ...full, devices_count: 2, fragrance: "عطر اختبار", installed_at: iso(now - 70 * day), last_refill_at: iso(now - 33 * day), next_refill_at: iso(now - 3 * day), last_visit_at: iso(now - 2 * day), satisfaction_avg: 3.8 });
  db.reports.push(
    { id: id(), mosque_id: m5.id, type: "needs_study", data: { date: "2026-10-01", devices: "3", fragrance: "عطر اختبار", placement: "المصلى الرئيسي" }, summary: "3 أجهزة", author_role: "company", created_at: iso(now - 5 * day) },
    { id: id(), mosque_id: m7.id, type: "installation", data: { date: iso(now - 40 * day), devices: "4", fragrance: "عطر اختبار" }, summary: "تركيب 4 أجهزة", author_role: "company", created_at: iso(now - 40 * day) },
    { id: id(), mosque_id: m7.id, type: "visit", data: { date: iso(now - 9 * day), status: "ok", scent: "مناسب", cleanliness: 4 }, summary: "الأجهزة سليمة", author_role: "association", created_at: iso(now - 9 * day) },
    { id: id(), mosque_id: m7.id, type: "satisfaction", data: { date: "2026-10-10", overall: 5, scent: 5, intensity: 4, respondent: "الإمام" }, summary: "الرضا العام 5/5", author_role: "association", created_at: iso(now - 12 * day) },
    { id: id(), mosque_id: m8.id, type: "refill", data: { date: iso(now - 33 * day), quantity: "500" }, summary: "تعبئة", author_role: "company", created_at: iso(now - 33 * day) },
    { id: id(), mosque_id: m8.id, type: "satisfaction", data: { overall: 4 }, summary: "الرضا العام 4/5", author_role: "association", created_at: iso(now - 60 * day) },
  );

  // بيانات اختبار إضافية لملء اللوحة
  const rnd = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  const DIST = ["حي أ", "حي ب", "حي ج", "حي د", "حي هـ", "حي و", "حي ز"];
  const STG = ["selected", "assigned", "assigned", "data_done", "feasible", "study_done", "approved", "active", "active", "active", "active", "not_feasible"];
  for (let i = 0; i < 46; i++) {
    const st = STG[Math.floor(rnd() * STG.length)], act = st === "active";
    const inst = now - (20 + rnd() * 70) * day;
    const m = M({ name: "جامع تجريبي " + (i + 9), district: DIST[Math.floor(rnd() * DIST.length)], association_id: st === "selected" ? null : (rnd() > .45 ? A1 : A2), stage: st, ...(st !== "assigned" ? full : {}),
      ...(act ? { devices_count: 2 + Math.floor(rnd() * 4), fragrance: "عطر اختبار", installed_at: iso(inst), last_refill_at: iso(now - rnd() * 30 * day), next_refill_at: iso(now + (rnd() * 20 - 4) * day), last_visit_at: iso(now - rnd() * 12 * day) } : {}) });
    m.created_at = iso(inst - (10 + rnd() * 30) * day);
    if (act) for (let w = 0; w < 12; w++) {
      const t = now - w * 7 * day - rnd() * 6 * day;
      if (t < inst) continue;
      if (rnd() > .25) db.reports.push({ id: id(), mosque_id: m.id, type: "visit", data: { date: iso(t), status: rnd() > .9 ? "issue" : "ok" }, author_role: "association", created_at: iso(t) });
      if (w % 4 === 0) db.reports.push({ id: id(), mosque_id: m.id, type: "refill", data: { date: iso(t), due: iso(t + (rnd() > .2 ? 1 : -3) * day) }, author_role: "company", created_at: iso(t) });
      if (rnd() > .7) db.reports.push({ id: id(), mosque_id: m.id, type: "satisfaction", data: { overall: rnd() > .2 ? 4 + Math.round(rnd()) : 3 - Math.round(rnd()) }, author_role: "association", created_at: iso(t) });
    }
    if (act) db.reports.push({ id: id(), mosque_id: m.id, type: "installation", data: { date: iso(inst) }, author_role: "company", created_at: iso(inst) });
  }
  db.tasks.push({ id: id(), mosque_id: m7.id, kind: "task", title: "مهمة اختبار للشركة", assignee: "company", priority: "urgent", status: "open", due_date: "2026-10-20", created_by: acc.admin.id, creator_role: "admin", created_at: iso(now - 4 * day) });
  const me = acc[as] || acc.admin;
  const loggedOut = as === "none"; // لمعاينة شاشة الدخول
  db.notifications.push({ id: id(), account_id: me.id, kind: "reminder", title: "إشعار اختبار: موعد تعبئة", body: "جامع اختبار ٧", mosque_id: m7.id, created_at: iso(now - 3600e3) },
    { id: id(), account_id: me.id, kind: "approval", title: "إشعار اختبار مقروء", created_at: iso(now - 2 * day), read_at: iso(now - day) });

  const companyStage = (s) => ["feasible", "study_done", "approved", "active", "suspended"].includes(s);
  const seeM = (m) => me.role === "admin" || (me.role === "association" && m.association_id === me.association_id) || (me.role === "company" && companyStage(m.stage));
  const seeMid = (mid) => { const m = db.mosques.find((x) => x.id === mid); return m && seeM(m); };
  const seeTask = (t) => me.role === "admin" || (me.role === "association" && (t.association_id === me.association_id || (t.mosque_id && t.assignee !== "company" && db.mosques.find((m) => m.id === t.mosque_id)?.association_id === me.association_id) || t.created_by === me.id)) || (me.role === "company" && (t.assignee === "company" || t.created_by === me.id));
  const VIS = {
    mosques: seeM, reports: (r) => seeMid(r.mosque_id), activity: (a) => seeMid(a.mosque_id), tasks: seeTask,
    attachments: (a) => me.role === "admin" || (a.mosque_id ? seeMid(a.mosque_id) : seeTask(db.tasks.find((t) => t.id === a.task_id) || {})),
    notifications: (n) => n.account_id === me.id, accounts: (a) => me.role === "admin" || a.id === me.id,
    associations: (a) => me.role !== "association" || a.id === me.association_id,
    broadcasts: (b) => me.role === "admin" || b.created_by === me.id,
  };
  const log = (mid, action, details = null) => db.activity.push({ id: id(), mosque_id: mid, actor_id: me.id, action, details, created_at: iso(Date.now()) });
  const notify = (role, assoc, mid, title, body, kind = "info") => db.accounts.filter((a) => a.active && a.role === role && (role !== "association" || a.association_id === assoc) && a.id !== me.id)
    .forEach((a) => db.notifications.push({ id: id(), account_id: a.id, kind, title, body, mosque_id: mid, created_at: iso(Date.now()) }));
  const get = (row, col) => col.includes("->>") ? (row[col.split("->>")[0]] || {})[col.split("->>")[1]] : row[col];

  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = "select"; this.one = null; }
    select() { if (this.op === "select") this.op = "select"; this.ret = true; return this; }
    insert(rows) { this.op = "insert"; this.payload = [].concat(rows); return this; }
    update(o) { this.op = "update"; this.payload = o; return this; }
    delete() { this.op = "delete"; return this; }
    eq(c, v) { this.f.push((r) => String(get(r, c)) === String(v)); return this; }
    neq(c, v) { this.f.push((r) => get(r, c) !== v); return this; }
    in(c, vs) { this.f.push((r) => vs.includes(get(r, c))); return this; }
    gte(c, v) { this.f.push((r) => get(r, c) >= v); return this; }
    lte(c, v) { this.f.push((r) => get(r, c) <= v); return this; }
    lt(c, v) { this.f.push((r) => get(r, c) < v); return this; }
    gt(c, v) { this.f.push((r) => get(r, c) > v); return this; }
    filter(c, op, v) { return this[op](c, v); }
    order(c, o = {}) { this.ord = [c, o.ascending !== false]; return this; }
    limit(n) { this.lim = n; return this; }
    range(a, b) { this.rng = [a, b]; return this; }
    single() { this.one = "single"; return this; }
    maybeSingle() { this.one = "maybe"; return this; }
    then(res, rej) { return Promise.resolve().then(() => this.exec()).then(res, rej); }
    exec() {
      const T = db[this.t]; const vis = VIS[this.t] || (() => true);
      const err = (message) => ({ data: null, error: { message } });
      if (this.op === "insert") {
        if (me.role === "viewer") return err("permission denied");
        if (this.t === "mosques" && me.role !== "admin") return err("new row violates row-level security policy");
        const out = this.payload.map((p) => {
          const r = { id: id(), created_at: iso(Date.now()), ...p };
          if (this.t === "mosques") { r.code = "M-" + String(++seq).padStart(4, "0"); r.stage = r.stage || "selected"; r.kind = r.kind || "جامع"; log(r.id, "إضافة المسجد"); }
          if (this.t === "tasks") { r.created_by = me.id; r.creator_role = me.role; r.status = "open"; if (me.role !== "admin") { r.kind = "request"; if (!(r.assignee === "association" && me.role === "association")) r.assignee = "admin"; }
            if (r.assignee === "association" && !r.association_id && r.mosque_id) r.association_id = db.mosques.find((m) => m.id === r.mosque_id)?.association_id;
            notify(r.assignee, r.association_id, r.mosque_id, (r.kind === "request" ? "طلب جديد: " : "مهمة جديدة: ") + r.title, "", "task"); }
          if (this.t === "accounts") { r.invite_code = Math.random().toString(16).slice(2, 10).toUpperCase(); r.active = true; }
          if (this.t === "attachments" || this.t === "broadcasts" || this.t === "task_comments") { r.uploaded_by = me.id; r.created_by = me.id; r.author_id = me.id; }
          T.push(r); return r;
        });
        return { data: this.one ? out[0] : out, error: null };
      }
      let rows = T.filter(vis).filter((r) => this.f.every((fn) => fn(r)));
      if (this.op === "update") {
        if (me.role === "viewer") return err("permission denied");
        if (this.t === "mosques" && me.role === "association" && ["stage", "association_id"].some((k) => k in this.payload)) return err("لا تملك صلاحية تعديل حقول المرحلة أو التشغيل");
        rows.forEach((r) => { Object.assign(r, this.payload); if (this.t === "mosques") log(r.id, "تحديث بيانات المسجد"); });
        return { data: this.one ? rows[0] : rows, error: null };
      }
      if (this.op === "delete") { rows.forEach((r) => T.splice(T.indexOf(r), 1)); return { data: null, error: null }; }
      if (this.ord) { const [c, asc] = this.ord; rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
      if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
      if (this.lim) rows = rows.slice(0, this.lim);
      rows = rows.map((r) => JSON.parse(JSON.stringify(r)));
      if (this.one) return rows.length || this.one === "maybe" ? { data: rows[0] || null, error: null } : err("no rows");
      return { data: rows, error: null };
    }
  }

  const avg = (a) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null;
  const RPC = {
    me: () => me,
    touch_seen: () => null,
    claim_account: () => me,
    reset_account_login: () => "NEWC0DE1",
    assign_mosques: ({ p_ids, p_assoc }) => { if (me.role !== "admin") throw "صلاحية المدير فقط"; let n = 0; db.mosques.forEach((m) => { if (p_ids.includes(m.id)) { m.association_id = p_assoc; if (m.stage === "selected") m.stage = "assigned"; n++; log(m.id, "إسناد للجمعية"); } }); notify("association", p_assoc, null, "مساجد جديدة مسندة لجمعيتكم", `تم إسناد ${n}`, "assign"); return n; },
    complete_data: ({ p_mosque }) => { const m = db.mosques.find((x) => x.id === p_mosque); if (m.stage !== "assigned") throw "المسجد ليس في مرحلة استكمال البيانات"; if (["district", "imam_name", "imam_phone", "muezzin_name", "muezzin_phone", "servant_name", "servant_phone"].some((k) => !m[k])) throw "البيانات غير مكتملة"; m.stage = "data_done"; log(m.id, "اكتمال البيانات"); return null; },
    decide_study: ({ p_mosque, p_approve, p_note }) => { if (me.role !== "admin") throw "الاعتماد من صلاحية مدير النظام"; const m = db.mosques.find((x) => x.id === p_mosque); if (m.stage !== "study_done") throw "لا توجد دراسة"; db.reports.push({ id: id(), mosque_id: m.id, type: "decision", data: { approved: p_approve, note: p_note }, summary: p_approve ? "اعتماد التركيب" : "إعادة الدراسة", author_role: "admin", author_id: me.id, created_at: iso(Date.now()) }); m.stage = p_approve ? "approved" : "feasible"; log(m.id, p_approve ? "اعتماد التركيب" : "إعادة دراسة الاحتياج", p_note); return null; },
    set_stage: ({ p_mosque, p_stage }) => { db.mosques.find((x) => x.id === p_mosque).stage = p_stage; return null; },
    submit_report: ({ p_mosque, p_type, p_data, p_summary }) => {
      const m = db.mosques.find((x) => x.id === p_mosque); if (!m || !seeM(m) || me.role === "viewer") throw "غير مصرح";
      const need = { feasibility: [["association", "admin"], ["data_done", "not_feasible"]], needs_study: [["company", "admin"], ["feasible"]], installation: [["company", "admin"], ["approved"]], visit: [["association", "admin"], ["active"]], satisfaction: [["association", "admin"], ["active"]], monthly: [["association", "admin"], ["active"]], refill: [["company", "admin"], ["active"]] }[p_type];
      if (need && !need[0].includes(me.role)) throw "ليس من مهامك"; if (need && !need[1].includes(m.stage)) throw "المسجد ليس في المرحلة المناسبة";
      const r = { id: id(), mosque_id: m.id, type: p_type, data: p_data, summary: p_summary, author_id: me.id, author_role: me.role, created_at: iso(Date.now()) }; db.reports.push(r);
      const cyc = (m.refill_cycle_days || 30) * day, d = p_data.date ? new Date(p_data.date).getTime() : Date.now();
      if (p_type === "feasibility") m.stage = p_data.result === "yes" ? "feasible" : "not_feasible";
      if (p_type === "needs_study") m.stage = "study_done";
      if (p_type === "installation") Object.assign(m, { stage: "active", installed_at: iso(d), last_refill_at: iso(d), next_refill_at: iso(d + cyc), devices_count: +p_data.devices, fragrance: p_data.fragrance });
      if (p_type === "refill") Object.assign(m, { last_refill_at: iso(d), next_refill_at: iso(d + cyc) });
      if (p_type === "visit") m.last_visit_at = iso(d);
      if (p_type === "satisfaction") m.satisfaction_avg = avg(db.reports.filter((x) => x.mosque_id === m.id && x.type === "satisfaction").map((x) => +x.data.overall));
      log(m.id, "تقرير: " + p_type, p_summary); return r;
    },
    dashboard: ({ p_days = 30, p_assoc = null }) => {
      const t0 = Date.now() - p_days * day, t1 = Date.now() - 2 * p_days * day;
      let vm = me.role === "viewer" ? db.mosques : db.mosques.filter(seeM);
      if (p_assoc) vm = vm.filter((m) => m.association_id === p_assoc);
      const ids = new Set(vm.map((m) => m.id));
      const rp = db.reports.filter((r) => ids.has(r.mosque_id)).map((r) => ({ ...r, at: new Date(r.data?.date || r.created_at).getTime() }));
      const act = vm.filter((m) => m.stage === "active");
      const sat = rp.filter((r) => r.type === "satisfaction" && r.data?.overall);
      const inP = (r, a, b = Infinity) => r.at >= a && r.at < b;
      const av = (rs) => rs.length ? +(rs.reduce((s, r) => s + +r.data.overall, 0) / rs.length).toFixed(2) : null;
      const cnt = (t, a, b) => rp.filter((r) => r.type === t && inP(r, a, b)).length;
      const ORD = { selected: 1, assigned: 2, data_done: 3, not_feasible: 3, feasible: 4, study_done: 5, approved: 6, active: 7, suspended: 7 };
      const stages = {}; vm.forEach((m) => stages[m.stage] = (stages[m.stage] || 0) + 1);
      const wk0 = new Date(); wk0.setHours(0, 0, 0, 0); wk0.setDate(wk0.getDate() - ((wk0.getDay() + 6) % 7));
      const weeks = Array.from({ length: 12 }, (_, i) => wk0.getTime() - (11 - i) * 7 * day);
      const complete = (m) => ["district", "imam_name", "imam_phone", "muezzin_name", "muezzin_phone", "servant_name", "servant_phone"].every((k) => m[k]);
      const refP = rp.filter((r) => r.type === "refill" && inP(r, t0) && r.data?.due);
      return { days: p_days, generated_at: iso(Date.now()), reminder_hours: 72, visit_every_days: 7, total: vm.length, active: act.length,
        devices: act.reduce((a, m) => a + (m.devices_count || 0), 0), stages,
        funnel: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ step: i, n: vm.filter((m) => ORD[m.stage] >= i).length })),
        data_complete: vm.filter(complete).length,
        refills: cnt("refill", t0), refills_prev: cnt("refill", t1, t0), visits: cnt("visit", t0), visits_prev: cnt("visit", t1, t0),
        installs: cnt("installation", t0), installs_prev: cnt("installation", t1, t0),
        sat: av(sat.filter((r) => inP(r, t0))), sat_prev: av(sat.filter((r) => inP(r, t1, t0))), sat_all: av(sat), sat_n: sat.filter((r) => inP(r, t0)).length,
        ratings: [1, 2, 3, 4, 5].map((g) => ({ r: g, n: sat.filter((r) => inP(r, t0) && Math.round(r.data.overall) === g).length })),
        ontime_n: refP.length, ontime_ok: refP.filter((r) => r.at <= new Date(r.data.due).getTime() + day).length,
        visit_ok: act.filter((m) => Date.now() - new Date(m.last_visit_at || m.installed_at) <= 7 * day).length,
        avg_install_days: act.length ? Math.round(act.reduce((a, m) => a + Math.max(0, (new Date(m.installed_at) - new Date(m.created_at)) / day), 0) / act.length) : null,
        alerts: { overdue: act.filter((m) => new Date(m.next_refill_at) < Date.now()).length, due_soon: act.filter((m) => { const h = (new Date(m.next_refill_at) - Date.now()) / 36e5; return h >= 0 && h <= 72; }).length,
          visit_overdue: act.filter((m) => Date.now() - new Date(m.last_visit_at || m.installed_at) > 8 * day).length, pending_approval: stages.study_done || 0,
          issues: rp.filter((r) => r.type === "visit" && r.data?.status === "issue" && inP(r, t0)).length, missing_data: stages.assigned || 0, not_feasible: stages.not_feasible || 0,
          open_tasks: db.tasks.filter((t) => t.status === "open").length, overdue_tasks: db.tasks.filter((t) => t.status === "open" && t.due_date < new Date().toISOString().slice(0, 10)).length },
        weekly: weeks.map((w) => ({ w: new Date(w).toISOString().slice(0, 10), visits: rp.filter((r) => r.type === "visit" && inP(r, w, w + 7 * day)).length, refills: rp.filter((r) => r.type === "refill" && inP(r, w, w + 7 * day)).length, installs: rp.filter((r) => r.type === "installation" && inP(r, w, w + 7 * day)).length, sat: av(sat.filter((r) => inP(r, w, w + 7 * day))) })),
        upcoming: Array.from({ length: 14 }, (_, i) => { const d0 = new Date(); d0.setHours(0, 0, 0, 0); const a = d0.getTime() + i * day; return { d: new Date(a).toISOString().slice(0, 10), n: act.filter((m) => { const t = new Date(m.next_refill_at).getTime(); return t >= a && t < a + day; }).length }; }),
        by_association: db.associations.map((a) => { const ms = vm.filter((m) => m.association_id === a.id); const ac = ms.filter((m) => m.stage === "active");
          return { id: a.id, name: a.name, total: ms.length, active: ac.length, pending: ms.filter((m) => ["assigned", "data_done"].includes(m.stage)).length,
            visit_ok: ac.filter((m) => Date.now() - new Date(m.last_visit_at || m.installed_at) <= 7 * day).length, overdue: ac.filter((m) => new Date(m.next_refill_at) < Date.now()).length,
            visits: rp.filter((r) => r.type === "visit" && inP(r, t0) && ms.some((m) => m.id === r.mosque_id)).length, open_tasks: db.tasks.filter((t) => t.association_id === a.id && t.status === "open").length }; }).filter((a) => a.total),
        assoc_sat: Object.fromEntries(db.associations.map((a) => [a.id, av(sat.filter((r) => vm.find((m) => m.id === r.mosque_id)?.association_id === a.id))])),
        by_district: Object.entries(vm.reduce((o, m) => (o[m.district || "غير محدد"] = (o[m.district || "غير محدد"] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([district, total]) => ({ district, total, active: vm.filter((m) => (m.district || "غير محدد") === district && m.stage === "active").length })),
        recent: db.activity.filter((a) => ids.has(a.mosque_id)).slice(-10).reverse().map((a) => ({ mosque: db.mosques.find((m) => m.id === a.mosque_id)?.name, mosque_id: a.mosque_id, action: a.action, at: a.created_at })) };
    },
    dashboard_stats: () => {
      const vm = me.role === "viewer" ? db.mosques : db.mosques.filter(seeM);
      const rp = db.reports.filter((r) => vm.some((m) => m.id === r.mosque_id));
      const stages = {}; vm.forEach((m) => stages[m.stage] = (stages[m.stage] || 0) + 1);
      const sat = (rs) => avg(rs.filter((r) => r.type === "satisfaction").map((r) => +r.data.overall));
      const months = [5, 4, 3, 2, 1, 0].map((g) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - g); return d.toISOString().slice(0, 7); });
      const act = vm.filter((m) => m.stage === "active");
      return { total: vm.length, stages, active: act.length, devices: act.reduce((a, m) => a + (m.devices_count || 0), 0), satisfaction: sat(rp),
        refills_month: rp.filter((r) => r.type === "refill" && r.created_at.slice(0, 7) === months[5]).length, visits_week: rp.filter((r) => r.type === "visit" && Date.now() - new Date(r.created_at) < 7 * day).length,
        reports_total: rp.length, due_soon: act.filter((m) => { const h = (new Date(m.next_refill_at) - Date.now()) / 36e5; return h >= 0 && h <= 72; }).length, overdue: act.filter((m) => new Date(m.next_refill_at) < Date.now()).length,
        visit_overdue: act.filter((m) => Date.now() - new Date(m.last_visit_at || m.installed_at) > 8 * day).length, pending_approval: stages.study_done || 0,
        open_tasks: db.tasks.filter((t) => t.status === "open" && (me.role === "admin" || me.role === "viewer" || seeTask(t))).length, overdue_tasks: 1,
        series: months.map((ym) => ({ month: ym, installs: rp.filter((r) => r.type === "installation" && r.created_at.slice(0, 7) === ym).length, refills: rp.filter((r) => r.type === "refill" && r.created_at.slice(0, 7) === ym).length, visits: rp.filter((r) => r.type === "visit" && r.created_at.slice(0, 7) === ym).length, satisfaction: sat(rp.filter((r) => r.created_at.slice(0, 7) === ym)) })),
        by_association: db.associations.map((a) => ({ id: a.id, name: a.name, total: vm.filter((m) => m.association_id === a.id).length, active: vm.filter((m) => m.association_id === a.id && m.stage === "active").length, pending: vm.filter((m) => m.association_id === a.id && ["assigned", "data_done"].includes(m.stage)).length, visits: 1, satisfaction: sat(rp.filter((r) => vm.find((m) => m.id === r.mosque_id)?.association_id === a.id)) })).filter((a) => a.total),
        by_district: Object.entries(vm.reduce((o, m) => (o[m.district || "غير محدد"] = (o[m.district || "غير محدد"] || 0) + 1, o), {})).map(([district, total]) => ({ district, total, active: vm.filter((m) => m.district === district && m.stage === "active").length })),
        recent: db.activity.filter((a) => vm.some((m) => m.id === a.mosque_id)).slice(-12).reverse().map((a) => ({ mosque: db.mosques.find((m) => m.id === a.mosque_id)?.name, mosque_id: a.mosque_id, action: a.action, at: a.created_at })) };
    },
    achievements: () => db.mosques.filter((m) => m.stage === "active").map((m) => ({ ...m, devices: m.devices_count, satisfaction: m.satisfaction_avg, association: db.associations.find((a) => a.id === m.association_id)?.name, refills: db.reports.filter((r) => r.mosque_id === m.id && r.type === "refill").length, visits: db.reports.filter((r) => r.mosque_id === m.id && r.type === "visit").length, photos: db.attachments.filter((a) => a.mosque_id === m.id && a.mime?.startsWith("image/")).map((a) => a.path) })),
  };
  const blobs = new Map();
  const chans = [];
  window.TAYYIB_CLIENT = {
    from: (t) => new Q(t),
    rpc: (n, args = {}) => ({ then(res, rej) { return Promise.resolve().then(() => { try { return { data: RPC[n](args), error: null }; } catch (e) { return { data: null, error: { message: String(e) } }; } }).then(res, rej); } }),
    auth: { getSession: async () => ({ data: { session: loggedOut ? null : { user: { id: me.user_id, email: me.email } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}), signInWithPassword: async () => ({ data: {}, error: null }), signUp: async () => ({ data: {}, error: null }) },
    storage: { from: () => ({ upload: async (p, f) => { blobs.set(p, URL.createObjectURL(f)); return { data: { path: p }, error: null }; }, createSignedUrl: async (p) => ({ data: { signedUrl: blobs.get(p) || "data:," }, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: blobs.get(p) || "" } }) }) },
    channel: () => { const c = { handlers: [], on(_, __, fn) { this.handlers.push(fn); return this; }, subscribe() { chans.push(this); return this; } }; return c; },
  };
  // لاختبار الإشعار اللحظي من وحدة التحكم
  window.mockPush = (title = "إشعار لحظي تجريبي", kind = "reminder") => { const n = { id: id(), account_id: me.id, kind, title, body: "اختبار", created_at: iso(Date.now()) }; db.notifications.push(n); chans.forEach((c) => c.handlers.forEach((h) => h({ new: n }))); };
  window.mockDb = db;
  window.supabase = window.supabase || { createClient: () => window.TAYYIB_CLIENT };
})();
