-- منصة «طيب» — مشروع تعطير مساجد الرياض
-- قاعدة البيانات، الصلاحيات (RLS)، مسار الإجراءات، الإشعارات، والتذكيرات الآلية.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ───────────────────────── الجداول ─────────────────────────

create table public.settings (
  id int primary key default 1 check (id = 1),
  platform_name text not null default 'طيب',
  org_name text not null default 'مشروع تعطير مساجد الرياض',
  company_name text not null default 'الشركة المنفذة',
  logo_path text,
  refill_cycle_days int not null default 30,
  reminder_hours int not null default 72,
  visit_every_days int not null default 7,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

create table public.associations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique check (email = lower(email)),
  phone text,
  role text not null check (role in ('admin', 'association', 'company', 'viewer')),
  association_id uuid references public.associations(id) on delete restrict,
  title text,
  active boolean not null default true,
  invite_code text not null default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  user_id uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  check (role <> 'association' or association_id is not null)
);

create sequence public.mosque_code_seq;
create table public.mosques (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('M-' || lpad(nextval('public.mosque_code_seq')::text, 4, '0')),
  name text not null,
  kind text not null default 'جامع' check (kind in ('جامع', 'مسجد', 'مصلى')),
  district text,
  address text,
  map_url text,
  imam_name text, imam_phone text,
  muezzin_name text, muezzin_phone text,
  servant_name text, servant_phone text,
  association_id uuid references public.associations(id) on delete set null,
  stage text not null default 'selected' check (stage in
    ('selected', 'assigned', 'data_done', 'feasible', 'not_feasible', 'study_done', 'approved', 'active', 'suspended')),
  devices_count int,
  fragrance text,
  refill_cycle_days int,
  planned_install_at date,
  installed_at timestamptz,
  last_refill_at timestamptz,
  next_refill_at timestamptz,
  last_visit_at timestamptz,
  satisfaction_avg numeric(3, 2),
  notes text,
  refill_reminded_for timestamptz,
  overdue_notified_for timestamptz,
  visit_reminded_at timestamptz,
  monthly_reminded text,
  created_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.mosques (association_id);
create index on public.mosques (stage);
create index on public.mosques (next_refill_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  type text not null check (type in
    ('feasibility', 'needs_study', 'decision', 'installation', 'visit', 'satisfaction', 'monthly', 'refill', 'note')),
  data jsonb not null default '{}',
  summary text,
  author_id uuid references public.accounts(id) on delete set null,
  author_role text,
  created_at timestamptz not null default now()
);
create index on public.reports (mosque_id, created_at desc);
create index on public.reports (type, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid references public.mosques(id) on delete cascade,
  kind text not null default 'task' check (kind in ('task', 'request')),
  title text not null,
  details text,
  assignee text not null check (assignee in ('admin', 'association', 'company')),
  association_id uuid references public.associations(id) on delete cascade,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  created_by uuid references public.accounts(id) on delete set null,
  creator_role text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks (mosque_id);
create index on public.tasks (status);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  author_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid references public.mosques(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  path text not null unique,
  name text not null,
  size bigint check (size <= 52428800),
  mime text,
  uploaded_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.attachments (mosque_id);
create index on public.attachments (report_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  mosque_id uuid references public.mosques(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (account_id, created_at desc);

create table public.activity (
  id bigserial primary key,
  mosque_id uuid references public.mosques(id) on delete cascade,
  actor_id uuid references public.accounts(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);
create index on public.activity (mosque_id, created_at desc);

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text not null,
  recipients jsonb not null default '[]',
  created_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── دوال الهوية ─────────────────────────

create or replace function public.me() returns public.accounts
language sql stable security definer set search_path = public as $$
  select a.* from public.accounts a where a.user_id = auth.uid() and a.active limit 1
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.accounts where user_id = auth.uid() and active limit 1
$$;

create or replace function public.my_assoc() returns uuid
language sql stable security definer set search_path = public as $$
  select association_id from public.accounts where user_id = auth.uid() and active limit 1
$$;

create or replace function public.my_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.accounts where user_id = auth.uid() and active limit 1
$$;

-- المراحل التي تظهر فيها المساجد للشركة المنفذة (الجاهزة لدراسة الاحتياج فما بعد)
create or replace function public.company_stage(s text) returns boolean
language sql immutable as $$ select s in ('feasible', 'study_done', 'approved', 'active', 'suspended') $$;

create or replace function public.can_see_mosque(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'admin' then true
    when 'association' then exists (select 1 from public.mosques m where m.id = mid and m.association_id = public.my_assoc())
    when 'company' then exists (select 1 from public.mosques m where m.id = mid and public.company_stage(m.stage))
    else false end
$$;

-- ───────────────────────── أدوات داخلية ─────────────────────────

create or replace function public.notify(p_role text, p_assoc uuid, p_mosque uuid, p_title text, p_body text,
  p_kind text default 'info', p_task uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (account_id, kind, title, body, mosque_id, task_id)
  select a.id, p_kind, p_title, p_body, p_mosque, p_task from public.accounts a
  where a.active and a.role = p_role
    and (p_role <> 'association' or a.association_id = p_assoc)
    and a.id is distinct from public.my_id();
end $$;

create or replace function public.log_activity(p_mosque uuid, p_action text, p_details text default null) returns void
language sql security definer set search_path = public as $$
  insert into public.activity (mosque_id, actor_id, action, details) values (p_mosque, public.my_id(), p_action, p_details)
$$;

create or replace function public.stage_label(s text) returns text language sql immutable as $$
  select case s
    when 'selected' then 'مختار — بانتظار الإسناد'
    when 'assigned' then 'مسند للجمعية — استكمال البيانات'
    when 'data_done' then 'بانتظار التواصل مع الإمام'
    when 'feasible' then 'قابل للتطبيق — دراسة الاحتياج'
    when 'not_feasible' then 'غير قابل للتطبيق'
    when 'study_done' then 'بانتظار اعتماد التركيب'
    when 'approved' then 'معتمد — بانتظار التركيب'
    when 'active' then 'مُركّب — قيد التشغيل'
    when 'suspended' then 'موقوف'
    else s end
$$;

create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger mosques_touch before update on public.mosques for each row execute function public.touch();
create trigger tasks_touch before update on public.tasks for each row execute function public.touch();

-- يمنع غير المدير من تعديل حقول المرحلة والإسناد والتشغيل مباشرة (تمر عبر الإجراءات فقط)
create or replace function public.guard_mosque() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tayyib.bypass', true) = 'on' or public.my_role() = 'admin' then return new; end if;
  if public.my_role() = 'association' then
    if (new.stage, new.association_id, new.devices_count, new.fragrance, new.refill_cycle_days, new.planned_install_at,
        new.installed_at, new.last_refill_at, new.next_refill_at, new.last_visit_at, new.satisfaction_avg, new.code)
       is distinct from
       (old.stage, old.association_id, old.devices_count, old.fragrance, old.refill_cycle_days, old.planned_install_at,
        old.installed_at, old.last_refill_at, old.next_refill_at, old.last_visit_at, old.satisfaction_avg, old.code) then
      raise exception 'لا تملك صلاحية تعديل حقول المرحلة أو التشغيل';
    end if;
    return new;
  end if;
  if public.my_role() = 'company' then
    -- الشركة تحدد موعد التركيب المخطط فقط
    if (to_jsonb(new) - 'planned_install_at' - 'updated_at') is distinct from (to_jsonb(old) - 'planned_install_at' - 'updated_at') then
      raise exception 'لا تملك صلاحية تعديل بيانات المسجد';
    end if;
    return new;
  end if;
  raise exception 'لا تملك صلاحية التعديل';
end $$;
create trigger mosques_guard before update on public.mosques for each row execute function public.guard_mosque();

create or replace function public.mosque_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tayyib.bypass', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    perform public.log_activity(new.id, 'إضافة المسجد', null);
  elsif (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    perform public.log_activity(new.id, 'تحديث بيانات المسجد', null);
  end if;
  return new;
end $$;
create trigger mosques_audit after insert or update on public.mosques for each row execute function public.mosque_audit();

-- ───────────────────────── الحسابات والتفعيل ─────────────────────────

-- يربط مستخدم الدخول بالحساب الذي أنشأه المدير عبر رمز الدعوة
create or replace function public.claim_account(p_code text) returns public.accounts
language plpgsql security definer set search_path = public as $$
declare a public.accounts; em text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  select * into a from public.accounts where email = em and active;
  if not found then raise exception 'لا يوجد حساب مفعّل بهذا البريد — تواصل مع مدير النظام'; end if;
  if a.user_id = auth.uid() then return a; end if;
  if a.user_id is not null then raise exception 'هذا الحساب مرتبط بمستخدم آخر — اطلب من المدير إعادة تعيين الدخول'; end if;
  if upper(trim(p_code)) <> a.invite_code then raise exception 'رمز التفعيل غير صحيح'; end if;
  perform set_config('tayyib.bypass', 'on', true);
  update public.accounts set user_id = auth.uid(), claimed_at = now() where id = a.id returning * into a;
  perform set_config('tayyib.bypass', 'off', true);
  return a;
end $$;

-- إعادة تعيين دخول حساب (نسيان كلمة المرور أو تغيير المستخدم): يحذف مستخدم الدخول ويولد رمزًا جديدًا
create or replace function public.reset_account_login(p_account uuid) returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare a public.accounts; code text := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
begin
  if public.my_role() is distinct from 'admin' then raise exception 'صلاحية المدير فقط'; end if;
  select * into a from public.accounts where id = p_account;
  if not found then raise exception 'الحساب غير موجود'; end if;
  if a.user_id = auth.uid() then raise exception 'لا يمكنك إعادة تعيين حسابك الحالي'; end if;
  update public.accounts set user_id = null, claimed_at = null, invite_code = code where id = p_account;
  delete from auth.users where lower(email) = a.email;
  return code;
end $$;

create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update public.accounts set last_seen_at = now() where user_id = auth.uid()
$$;

-- يمنع المدير من حذف صلاحيته أو تعطيل حسابه بالخطأ
create or replace function public.guard_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.email = lower(trim(new.email));
    if old.user_id = auth.uid() and old.role = 'admin' and (new.role <> 'admin' or not new.active) then
      raise exception 'لا يمكنك تغيير صلاحية حسابك أو تعطيله';
    end if;
    if new.user_id is distinct from old.user_id and current_setting('tayyib.bypass', true) is distinct from 'on'
       and coalesce(auth.role(), '') = 'authenticated' and new.user_id is not null then
      raise exception 'الربط يتم عبر رمز التفعيل فقط';
    end if;
  else
    new.email = lower(trim(new.email));
    new.user_id = null;
  end if;
  return new;
end $$;
create trigger accounts_guard before insert or update on public.accounts for each row execute function public.guard_account();

-- ───────────────────────── مسار الإجراءات ─────────────────────────

-- ٢- إيعاز المساجد للجمعيات (مدير النظام)
create or replace function public.assign_mosques(p_ids uuid[], p_assoc uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int; aname text;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'صلاحية المدير فقط'; end if;
  select name into aname from public.associations where id = p_assoc and active;
  if aname is null then raise exception 'الجمعية غير موجودة'; end if;
  perform set_config('tayyib.bypass', 'on', true);
  update public.mosques set association_id = p_assoc,
    stage = case when stage = 'selected' then 'assigned' else stage end
  where id = any(p_ids);
  get diagnostics n = row_count;
  insert into public.activity (mosque_id, actor_id, action, details)
    select unnest(p_ids), public.my_id(), 'إسناد للجمعية', aname;
  perform public.notify('association', p_assoc, case when n = 1 then p_ids[1] end, 'مساجد جديدة مسندة لجمعيتكم',
    'تم إسناد ' || n || ' مسجد/جامع لجمعيتكم — يرجى استكمال البيانات الناقصة', 'assign');
  perform set_config('tayyib.bypass', 'off', true);
  return n;
end $$;

-- ٣- اعتماد اكتمال البيانات (الجمعية المشرفة)
create or replace function public.complete_data(p_mosque uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.mosques;
begin
  select * into m from public.mosques where id = p_mosque;
  if not public.can_see_mosque(p_mosque) or public.my_role() not in ('admin', 'association') then raise exception 'غير مصرح'; end if;
  if m.stage <> 'assigned' then raise exception 'المسجد ليس في مرحلة استكمال البيانات'; end if;
  if coalesce(m.imam_name, '') = '' or coalesce(m.imam_phone, '') = '' or coalesce(m.muezzin_name, '') = ''
     or coalesce(m.muezzin_phone, '') = '' or coalesce(m.servant_name, '') = '' or coalesce(m.servant_phone, '') = ''
     or coalesce(m.district, '') = '' then
    raise exception 'البيانات غير مكتملة: الحي وأسماء وأرقام الإمام والمؤذن والخادم مطلوبة';
  end if;
  perform set_config('tayyib.bypass', 'on', true);
  update public.mosques set stage = 'data_done' where id = p_mosque;
  perform public.log_activity(p_mosque, 'اكتمال البيانات', null);
  perform public.notify('admin', null, p_mosque, 'اكتملت بيانات ' || m.name, 'الجمعية أكملت بيانات المسجد وتنتقل للتواصل مع الإمام', 'stage');
  perform set_config('tayyib.bypass', 'off', true);
end $$;

-- رفع التقارير (٤، ٥، ٧، ٨، ٩، ١٠، ١٢) — كل تقرير يتحقق من الدور والمرحلة ويحرّك المسار
create or replace function public.submit_report(p_mosque uuid, p_type text, p_data jsonb, p_summary text default null)
returns public.reports
language plpgsql security definer set search_path = public as $$
declare m public.mosques; r public.reports; role text := public.my_role(); cycle int; d timestamptz; s text;
begin
  select * into m from public.mosques where id = p_mosque for update;
  if not found or not public.can_see_mosque(p_mosque) then raise exception 'غير مصرح'; end if;
  if role = 'viewer' or role is null then raise exception 'غير مصرح'; end if;
  select coalesce(case when p_type = 'installation' and (p_data ->> 'cycle') ~ '^[0-9]{1,3}$' and (p_data ->> 'cycle')::int > 0 then (p_data ->> 'cycle')::int end,
    m.refill_cycle_days, st.refill_cycle_days) into cycle from public.settings st;

  if p_type = 'feasibility' then
    if role not in ('association', 'admin') then raise exception 'تقرير التواصل مع الإمام من مهام الجمعية'; end if;
    if m.stage not in ('data_done', 'not_feasible') then raise exception 'المسجد ليس في مرحلة التواصل مع الإمام'; end if;
    s := case when (p_data ->> 'result') = 'yes' then 'feasible' else 'not_feasible' end;
  elsif p_type = 'needs_study' then
    if role not in ('company', 'admin') then raise exception 'دراسة الاحتياج من مهام الشركة المنفذة'; end if;
    if m.stage <> 'feasible' then raise exception 'المسجد ليس في مرحلة دراسة الاحتياج'; end if;
    s := 'study_done';
  elsif p_type = 'installation' then
    if role not in ('company', 'admin') then raise exception 'تقرير التركيب من مهام الشركة المنفذة'; end if;
    if m.stage <> 'approved' then raise exception 'لا يمكن التركيب قبل اعتماد مدير النظام'; end if;
    s := 'active';
  elsif p_type in ('visit', 'satisfaction', 'monthly') then
    if role not in ('association', 'admin') then raise exception 'هذا التقرير من مهام الجمعية'; end if;
    if m.stage <> 'active' then raise exception 'المسجد لم يُركّب بعد'; end if;
  elsif p_type = 'refill' then
    if role not in ('company', 'admin') then raise exception 'التعبئة من مهام الشركة المنفذة'; end if;
    if m.stage <> 'active' then raise exception 'المسجد لم يُركّب بعد'; end if;
  elsif p_type = 'note' then
    null;
  else
    raise exception 'نوع تقرير غير معروف';
  end if;

  insert into public.reports (mosque_id, type, data, summary, author_id, author_role)
  values (p_mosque, p_type, coalesce(p_data, '{}'), p_summary, public.my_id(), role) returning * into r;

  perform set_config('tayyib.bypass', 'on', true);
  if s is not null then update public.mosques set stage = s where id = p_mosque; end if;

  if p_type = 'installation' then
    d := coalesce((p_data ->> 'date')::timestamptz, now());
    update public.mosques set installed_at = d, last_refill_at = d, refill_cycle_days = cycle, next_refill_at = d + make_interval(days => cycle),
      devices_count = coalesce(nullif(p_data ->> 'devices', '')::int, devices_count),
      fragrance = coalesce(nullif(p_data ->> 'fragrance', ''), fragrance)
    where id = p_mosque;
  elsif p_type = 'refill' then
    d := coalesce((p_data ->> 'date')::timestamptz, now());
    update public.mosques set last_refill_at = d, next_refill_at = d + make_interval(days => cycle),
      fragrance = coalesce(nullif(p_data ->> 'fragrance', ''), fragrance)
    where id = p_mosque;
  elsif p_type = 'visit' then
    d := coalesce((p_data ->> 'date')::timestamptz, now());
    update public.mosques set last_visit_at = greatest(coalesce(last_visit_at, d), d) where id = p_mosque;
  elsif p_type = 'satisfaction' then
    update public.mosques set satisfaction_avg = (
      select round(avg((data ->> 'overall')::numeric), 2) from public.reports
      where mosque_id = p_mosque and type = 'satisfaction' and (data ->> 'overall') ~ '^[0-9.]+$')
    where id = p_mosque;
  end if;

  perform public.log_activity(p_mosque, case p_type
    when 'feasibility' then 'تقرير التواصل مع الإمام'
    when 'needs_study' then 'تقرير دراسة الاحتياج'
    when 'installation' then 'تقرير التركيب'
    when 'visit' then 'تقرير زيارة أسبوعية'
    when 'satisfaction' then 'قياس رضا'
    when 'monthly' then 'التقرير الشهري'
    when 'refill' then 'تقرير التعبئة'
    else 'ملاحظة' end, p_summary);

  -- الإشعارات
  if p_type = 'feasibility' then
    perform public.notify('admin', null, p_mosque, 'تقرير التواصل مع إمام ' || m.name,
      case when s = 'feasible' then 'المسجد قابل للتطبيق وانتقل لدراسة الاحتياج' else 'أفادت الجمعية بعدم قابلية التطبيق' end, 'report');
    if s = 'feasible' then
      perform public.notify('company', null, p_mosque, 'مسجد جاهز لدراسة الاحتياج', m.name || ' — ' || coalesce(m.district, ''), 'stage');
    end if;
  elsif p_type = 'needs_study' then
    perform public.notify('admin', null, p_mosque, 'دراسة احتياج بانتظار اعتمادك', m.name, 'approval');
    perform public.notify('association', m.association_id, p_mosque, 'رفعت الشركة دراسة الاحتياج', m.name, 'report');
  elsif p_type = 'installation' then
    perform public.notify('admin', null, p_mosque, 'تم التركيب في ' || m.name, 'رفعت الشركة تقرير التركيب', 'stage');
    perform public.notify('association', m.association_id, p_mosque, 'تم التركيب في ' || m.name, 'تبدأ الزيارات الأسبوعية وقياس الرضا', 'stage');
  elsif p_type = 'refill' then
    perform public.notify('admin', null, p_mosque, 'تمت تعبئة العطر — ' || m.name, null, 'refill');
    perform public.notify('association', m.association_id, p_mosque, 'تمت تعبئة العطر — ' || m.name, null, 'refill');
  elsif p_type in ('visit', 'satisfaction', 'monthly') then
    perform public.notify('admin', null, p_mosque, case p_type when 'visit' then 'تقرير زيارة: ' when 'satisfaction' then 'قياس رضا: ' else 'تقرير شهري: ' end || m.name,
      p_summary, 'report');
    if p_type = 'visit' and (p_data ->> 'status') = 'issue' then
      perform public.notify('company', null, p_mosque, 'ملاحظة فنية في زيارة ' || m.name, p_summary, 'alert');
    end if;
  end if;
  perform set_config('tayyib.bypass', 'off', true);
  return r;
end $$;

-- ٦- اعتماد التركيب (مدير النظام)
create or replace function public.decide_study(p_mosque uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare m public.mosques;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'الاعتماد من صلاحية مدير النظام'; end if;
  select * into m from public.mosques where id = p_mosque for update;
  if m.stage <> 'study_done' then raise exception 'لا توجد دراسة بانتظار الاعتماد'; end if;
  insert into public.reports (mosque_id, type, data, summary, author_id, author_role)
  values (p_mosque, 'decision', jsonb_build_object('approved', p_approve, 'note', p_note),
          case when p_approve then 'اعتماد التركيب' else 'إعادة الدراسة' end || coalesce(' — ' || p_note, ''), public.my_id(), 'admin');
  perform set_config('tayyib.bypass', 'on', true);
  update public.mosques set stage = case when p_approve then 'approved' else 'feasible' end where id = p_mosque;
  perform public.log_activity(p_mosque, case when p_approve then 'اعتماد التركيب' else 'إعادة دراسة الاحتياج' end, p_note);
  perform public.notify('company', null, p_mosque,
    case when p_approve then 'اعتُمد التركيب في ' else 'مطلوب إعادة دراسة ' end || m.name, p_note, case when p_approve then 'approval' else 'alert' end);
  perform public.notify('association', m.association_id, p_mosque,
    case when p_approve then 'اعتُمد التركيب في ' || m.name else 'أعيدت دراسة الاحتياج لـ ' || m.name end, p_note, 'stage');
  perform set_config('tayyib.bypass', 'off', true);
end $$;

-- تغيير المرحلة يدويًا (مدير النظام): إيقاف، إعادة تفعيل، تصحيح
create or replace function public.set_stage(p_mosque uuid, p_stage text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'admin' then raise exception 'صلاحية المدير فقط'; end if;
  perform set_config('tayyib.bypass', 'on', true);
  update public.mosques set stage = p_stage where id = p_mosque;
  perform public.log_activity(p_mosque, 'تغيير المرحلة إلى: ' || public.stage_label(p_stage), p_note);
  perform set_config('tayyib.bypass', 'off', true);
end $$;

-- ───────────────────────── المهام والطلبات ─────────────────────────

create or replace function public.can_see_task(t public.tasks) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'admin' then true
    when 'association' then t.association_id = public.my_assoc()
      or (t.mosque_id is not null and t.assignee <> 'company' and exists (select 1 from public.mosques m where m.id = t.mosque_id and m.association_id = public.my_assoc()))
      or t.created_by = public.my_id()
    when 'company' then t.assignee = 'company' or t.created_by = public.my_id()
    else false end
$$;

create or replace function public.task_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare role text := public.my_role();
begin
  if tg_op = 'INSERT' then
    if role is null or role = 'viewer' then raise exception 'غير مصرح'; end if;
    new.created_by = public.my_id(); new.creator_role = role;
    if new.mosque_id is not null and not public.can_see_mosque(new.mosque_id) then raise exception 'غير مصرح بهذا المسجد'; end if;
    if role <> 'admin' then
      -- غير المدير: الطلبات تُرفع للمدير، والجمعية تُسند لنفسها فقط
      if new.assignee = 'association' and role = 'association' then new.association_id = public.my_assoc();
      elsif new.assignee <> 'admin' then new.kind = 'request'; new.assignee = 'admin'; end if;
      if new.assignee = 'admin' then new.kind = 'request'; end if;
    end if;
    if new.assignee = 'association' and new.association_id is null and new.mosque_id is not null then
      select association_id into new.association_id from public.mosques where id = new.mosque_id;
    end if;
    if new.assignee = 'association' and new.association_id is null then raise exception 'حدد الجمعية'; end if;
  else
    if role is distinct from 'admin' and (new.title, new.assignee, new.association_id, new.mosque_id, new.created_by)
       is distinct from (old.title, old.assignee, old.association_id, old.mosque_id, old.created_by) then
      raise exception 'يمكنك تحديث الحالة فقط';
    end if;
    if new.status in ('done', 'cancelled') and old.status not in ('done', 'cancelled') then new.closed_at = now(); end if;
  end if;
  return new;
end $$;
create trigger tasks_before before insert or update on public.tasks for each row execute function public.task_before();

create or replace function public.task_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare mname text; label text;
begin
  select name into mname from public.mosques where id = new.mosque_id;
  label := coalesce(' — ' || mname, '');
  if tg_op = 'INSERT' then
    perform public.notify(new.assignee, new.association_id, new.mosque_id,
      case when new.kind = 'request' then 'طلب جديد: ' else 'مهمة جديدة: ' end || new.title, coalesce(mname, '') ||
      coalesce(' · الاستحقاق ' || new.due_date, ''), case when new.priority in ('high', 'urgent') then 'alert' else 'task' end, new.id);
    if new.mosque_id is not null then perform public.log_activity(new.mosque_id, case when new.kind = 'request' then 'طلب: ' else 'مهمة: ' end || new.title, null); end if;
  elsif new.status is distinct from old.status then
    insert into public.notifications (account_id, kind, title, body, mosque_id, task_id)
      select new.created_by, 'task', 'تحديث حالة: ' || new.title, case new.status when 'done' then 'تم الإنجاز' when 'in_progress' then 'قيد التنفيذ'
        when 'cancelled' then 'أُلغيت' else 'مفتوحة' end || label, new.mosque_id, new.id
      where new.created_by is not null and new.created_by is distinct from public.my_id();
    if new.mosque_id is not null then perform public.log_activity(new.mosque_id, 'تحديث مهمة: ' || new.title, new.status); end if;
  end if;
  return new;
end $$;
create trigger tasks_after after insert or update on public.tasks for each row execute function public.task_after();

create or replace function public.comment_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = new.task_id;
  if not found or not public.can_see_task(t) or coalesce(public.my_role(), 'viewer') = 'viewer' then raise exception 'غير مصرح'; end if;
  new.author_id = public.my_id();
  -- يُشعَر منشئ المهمة والجهة المسندة إليها
  insert into public.notifications (account_id, kind, title, body, mosque_id, task_id)
    select a.id, 'task', 'تعليق على: ' || t.title, left(new.body, 140), t.mosque_id, t.id
    from public.accounts a
    where a.active and a.id is distinct from public.my_id()
      and (a.id = t.created_by or (a.role = t.assignee and (t.assignee <> 'association' or a.association_id = t.association_id)));
  return new;
end $$;
create trigger comments_before before insert on public.task_comments for each row execute function public.comment_before();

create or replace function public.attachment_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.my_role(), 'viewer') = 'viewer' then raise exception 'غير مصرح'; end if;
  if new.mosque_id is not null and not public.can_see_mosque(new.mosque_id) then raise exception 'غير مصرح بهذا المسجد'; end if;
  new.uploaded_by = public.my_id();
  return new;
end $$;
create trigger attachments_before before insert on public.attachments for each row execute function public.attachment_before();

create or replace function public.broadcast_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.my_role(), '') not in ('admin', 'association') then raise exception 'غير مصرح'; end if;
  new.created_by = public.my_id();
  return new;
end $$;
create trigger broadcasts_before before insert on public.broadcasts for each row execute function public.broadcast_before();

-- ───────────────────────── لوحة المؤشرات ─────────────────────────

create or replace function public.visible_mosques() returns setof public.mosques
language sql stable security definer set search_path = public as $$
  select m.* from public.mosques m where case public.my_role()
    when 'admin' then true when 'viewer' then true
    when 'association' then m.association_id = public.my_assoc()
    when 'company' then public.company_stage(m.stage)
    else false end
$$;

create or replace function public.dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb; st public.settings;
begin
  if public.my_role() is null then raise exception 'غير مصرح'; end if;
  select * into st from public.settings;
  with vm as (select * from public.visible_mosques()),
  rp as (select r.* from public.reports r join vm on vm.id = r.mosque_id),
  months as (select to_char(date_trunc('month', now()) - make_interval(months => g), 'YYYY-MM') ym from generate_series(5, 0, -1) g)
  select jsonb_build_object(
    'total', (select count(*) from vm),
    'stages', (select coalesce(jsonb_object_agg(stage, n), '{}') from (select stage, count(*) n from vm group by stage) x),
    'active', (select count(*) from vm where stage = 'active'),
    'devices', (select coalesce(sum(devices_count), 0) from vm where stage = 'active'),
    'satisfaction', (select round(avg((data ->> 'overall')::numeric), 2) from rp where type = 'satisfaction' and (data ->> 'overall') ~ '^[0-9.]+$'),
    'refills_month', (select count(*) from rp where type = 'refill' and created_at >= date_trunc('month', now())),
    'visits_week', (select count(*) from rp where type = 'visit' and created_at >= now() - interval '7 days'),
    'reports_total', (select count(*) from rp where type <> 'decision'),
    'due_soon', (select count(*) from vm where stage = 'active' and next_refill_at between now() and now() + make_interval(hours => st.reminder_hours)),
    'overdue', (select count(*) from vm where stage = 'active' and next_refill_at < now()),
    'visit_overdue', (select count(*) from vm where stage = 'active' and coalesce(last_visit_at, installed_at) < now() - make_interval(days => st.visit_every_days + 1)),
    'pending_approval', (select count(*) from vm where stage = 'study_done'),
    'open_tasks', (select count(*) from public.tasks t where t.status in ('open', 'in_progress') and (public.my_role() in ('admin', 'viewer') or public.can_see_task(t))),
    'overdue_tasks', (select count(*) from public.tasks t where t.status in ('open', 'in_progress') and t.due_date < current_date and (public.my_role() in ('admin', 'viewer') or public.can_see_task(t))),
    'series', (select jsonb_agg(jsonb_build_object('month', ym,
        'installs', (select count(*) from rp where type = 'installation' and to_char(created_at, 'YYYY-MM') = ym),
        'refills', (select count(*) from rp where type = 'refill' and to_char(created_at, 'YYYY-MM') = ym),
        'visits', (select count(*) from rp where type = 'visit' and to_char(created_at, 'YYYY-MM') = ym),
        'satisfaction', (select round(avg((data ->> 'overall')::numeric), 2) from rp where type = 'satisfaction' and (data ->> 'overall') ~ '^[0-9.]+$' and to_char(created_at, 'YYYY-MM') = ym)
      ) order by ym) from months),
    'by_association', (select coalesce(jsonb_agg(x order by x ->> 'name'), '[]') from (
        select jsonb_build_object('id', a.id, 'name', a.name,
          'total', count(vm.id),
          'active', count(vm.id) filter (where vm.stage = 'active'),
          'pending', count(vm.id) filter (where vm.stage in ('assigned', 'data_done')),
          'visits', (select count(*) from rp where rp.type = 'visit' and rp.created_at >= now() - interval '30 days' and rp.mosque_id in (select id from vm v2 where v2.association_id = a.id)),
          'satisfaction', (select round(avg((data ->> 'overall')::numeric), 2) from rp where rp.type = 'satisfaction' and (data ->> 'overall') ~ '^[0-9.]+$' and rp.mosque_id in (select id from vm v2 where v2.association_id = a.id))
        ) x
        from public.associations a join vm on vm.association_id = a.id group by a.id, a.name) y),
    'by_district', (select coalesce(jsonb_agg(jsonb_build_object('district', d, 'total', n, 'active', act) order by n desc), '[]') from (
        select coalesce(nullif(district, ''), 'غير محدد') d, count(*) n, count(*) filter (where stage = 'active') act from vm group by 1 order by 2 desc limit 12) z),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('mosque', m.name, 'mosque_id', m.id, 'action', a.action, 'at', a.created_at) order by a.created_at desc), '[]')
        from (select * from public.activity where mosque_id in (select id from vm) order by created_at desc limit 12) a join public.mosques m on m.id = a.mosque_id)
  ) into res;
  return res;
end $$;

-- المنجزات: للعرض العام ولحساب العرض (بلا أرقام تواصل)
create or replace function public.achievements() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'code', m.code, 'name', m.name, 'kind', m.kind, 'district', m.district, 'installed_at', m.installed_at,
    'devices', m.devices_count, 'fragrance', m.fragrance, 'satisfaction', m.satisfaction_avg,
    'association', (select name from public.associations where id = m.association_id),
    'refills', (select count(*) from public.reports r where r.mosque_id = m.id and r.type = 'refill'),
    'visits', (select count(*) from public.reports r where r.mosque_id = m.id and r.type = 'visit'),
    'photos', (select coalesce(jsonb_agg(at.path order by at.created_at), '[]') from public.attachments at join public.reports r on r.id = at.report_id
               where r.mosque_id = m.id and r.type in ('installation', 'refill') and at.mime like 'image/%')
  ) order by m.installed_at desc), '[]')
  from public.visible_mosques() m where m.stage = 'active'
$$;

-- ───────────────────────── التذكيرات الآلية (كل ساعة) ─────────────────────────

create or replace function public.run_reminders() returns void
language plpgsql security definer set search_path = public as $$
declare st public.settings; m record; ym text := to_char(now() - interval '1 month', 'YYYY-MM');
begin
  select * into st from public.settings;
  perform set_config('tayyib.bypass', 'on', true);
  -- تذكير التعبئة قبل الموعد بـ ٧٢ ساعة
  for m in select * from public.mosques where stage = 'active' and next_refill_at is not null
      and next_refill_at <= now() + make_interval(hours => st.reminder_hours) and next_refill_at > now()
      and refill_reminded_for is distinct from next_refill_at loop
    perform public.notify('company', null, m.id, 'تذكير: موعد تعبئة العطر — ' || m.name,
      'الموعد ' || to_char(m.next_refill_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') || ' (خلال ' || st.reminder_hours || ' ساعة)', 'reminder');
    perform public.notify('admin', null, m.id, 'تعبئة قادمة — ' || m.name, to_char(m.next_refill_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD'), 'reminder');
    update public.mosques set refill_reminded_for = next_refill_at where id = m.id;
  end loop;
  -- تجاوز موعد التعبئة
  for m in select * from public.mosques where stage = 'active' and next_refill_at < now()
      and overdue_notified_for is distinct from next_refill_at loop
    perform public.notify('company', null, m.id, 'متأخر: تعبئة العطر — ' || m.name, 'تجاوز موعد التعبئة', 'alert');
    perform public.notify('admin', null, m.id, 'تأخر تعبئة العطر — ' || m.name, 'تجاوز موعد التعبئة', 'alert');
    update public.mosques set overdue_notified_for = next_refill_at where id = m.id;
  end loop;
  -- الزيارة الأسبوعية
  for m in select * from public.mosques where stage = 'active' and association_id is not null
      and coalesce(last_visit_at, installed_at) < now() - make_interval(days => st.visit_every_days)
      and (visit_reminded_at is null or visit_reminded_at < now() - make_interval(days => st.visit_every_days)) loop
    perform public.notify('association', m.association_id, m.id, 'حان موعد الزيارة الأسبوعية — ' || m.name, 'آخر زيارة: ' ||
      coalesce(to_char(m.last_visit_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD'), 'لا توجد'), 'reminder');
    update public.mosques set visit_reminded_at = now() where id = m.id;
  end loop;
  -- التقرير الشهري للشهر الماضي
  for m in select * from public.mosques mm where stage = 'active' and association_id is not null
      and installed_at < date_trunc('month', now()) and monthly_reminded is distinct from ym
      and not exists (select 1 from public.reports r where r.mosque_id = mm.id and r.type = 'monthly' and r.data ->> 'month' = ym) loop
    perform public.notify('association', m.association_id, m.id, 'التقرير الشهري مطلوب — ' || m.name, 'تقرير أداء التعطير لشهر ' || ym, 'reminder');
    update public.mosques set monthly_reminded = ym where id = m.id;
  end loop;
  perform set_config('tayyib.bypass', 'off', true);
end $$;

select cron.schedule('tayyib-reminders', '7 * * * *', $$select public.run_reminders()$$);

-- ───────────────────────── الصلاحيات (RLS) ─────────────────────────

alter table public.settings enable row level security;
alter table public.associations enable row level security;
alter table public.accounts enable row level security;
alter table public.mosques enable row level security;
alter table public.reports enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity enable row level security;
alter table public.broadcasts enable row level security;

create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_write on public.settings for update to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy assoc_read on public.associations for select to authenticated using (public.my_role() in ('admin', 'company', 'viewer') or id = public.my_assoc());
create policy assoc_write on public.associations for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy accounts_self on public.accounts for select to authenticated using (user_id = auth.uid() or public.my_role() = 'admin');
create policy accounts_write on public.accounts for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy mosques_read on public.mosques for select to authenticated using (public.can_see_mosque(id));
create policy mosques_insert on public.mosques for insert to authenticated with check (public.my_role() = 'admin');
create policy mosques_update on public.mosques for update to authenticated
  using (public.my_role() = 'admin' or (public.my_role() in ('association', 'company') and public.can_see_mosque(id)))
  with check (public.my_role() = 'admin' or (public.my_role() in ('association', 'company') and public.can_see_mosque(id)));
create policy mosques_delete on public.mosques for delete to authenticated using (public.my_role() = 'admin');

create policy reports_read on public.reports for select to authenticated using (public.can_see_mosque(mosque_id));
create policy reports_delete on public.reports for delete to authenticated using (public.my_role() = 'admin');

create policy tasks_read on public.tasks for select to authenticated using (public.can_see_task(tasks));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.my_role() in ('admin', 'association', 'company'));
create policy tasks_update on public.tasks for update to authenticated using (public.can_see_task(tasks)) with check (public.can_see_task(tasks));
create policy tasks_delete on public.tasks for delete to authenticated using (public.my_role() = 'admin');

create policy comments_read on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.can_see_task(t)));
create policy comments_insert on public.task_comments for insert to authenticated with check (true);

create policy att_read on public.attachments for select to authenticated using (
  (mosque_id is not null and public.can_see_mosque(mosque_id))
  or (task_id is not null and exists (select 1 from public.tasks t where t.id = task_id and public.can_see_task(t)))
  or public.my_role() = 'admin');
create policy att_insert on public.attachments for insert to authenticated with check (true);
create policy att_delete on public.attachments for delete to authenticated using (public.my_role() = 'admin' or uploaded_by = public.my_id());

create policy notif_read on public.notifications for select to authenticated using (account_id = public.my_id());
create policy notif_update on public.notifications for update to authenticated using (account_id = public.my_id()) with check (account_id = public.my_id());
create policy notif_delete on public.notifications for delete to authenticated using (account_id = public.my_id());

create policy activity_read on public.activity for select to authenticated using (mosque_id is not null and public.can_see_mosque(mosque_id));

create policy bc_read on public.broadcasts for select to authenticated using (public.my_role() = 'admin' or created_by = public.my_id());
create policy bc_insert on public.broadcasts for insert to authenticated with check (true);
create policy bc_update on public.broadcasts for update to authenticated using (public.my_role() = 'admin' or created_by = public.my_id());

-- لا تُنفّذ الدوال الداخلية من الواجهة
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.notify(text, uuid, uuid, text, text, text, uuid) from authenticated;
revoke execute on function public.log_activity(uuid, text, text) from authenticated;
revoke execute on function public.run_reminders() from authenticated;
grant execute on function public.company_stage(text), public.stage_label(text) to anon;

-- ───────────────────────── التخزين (حتى ٥٠ ميقابايت) ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800) on conflict (id) do update set file_size_limit = 52428800;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']) on conflict (id) do nothing;

-- المسار: m/{mosque_id}/... أو t/{task_id}/...
create or replace function public.can_read_object(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.my_role() is null then false
    when public.my_role() = 'admin' then true
    when split_part(p_name, '/', 1) = 'm' then
      public.can_see_mosque(nullif(split_part(p_name, '/', 2), '')::uuid)
      or (public.my_role() = 'viewer' and exists (select 1 from public.attachments at join public.reports r on r.id = at.report_id
           where at.path = p_name and r.type in ('installation', 'refill')))
    when split_part(p_name, '/', 1) = 't' then
      exists (select 1 from public.tasks t where t.id = nullif(split_part(p_name, '/', 2), '')::uuid and public.can_see_task(t))
    else false end
$$;

create or replace function public.can_write_object(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.my_role() is null or public.my_role() = 'viewer' then false
    when public.my_role() = 'admin' then true
    when split_part(p_name, '/', 1) = 'm' then public.can_see_mosque(nullif(split_part(p_name, '/', 2), '')::uuid)
    when split_part(p_name, '/', 1) = 't' then
      exists (select 1 from public.tasks t where t.id = nullif(split_part(p_name, '/', 2), '')::uuid and public.can_see_task(t))
    else false end
$$;

grant execute on function public.can_read_object(text), public.can_write_object(text) to authenticated;
revoke execute on function public.can_read_object(text), public.can_write_object(text) from anon, public;
-- دوال المشغلات والاستعلام الداخلي لا تُستدعى من الواجهة
revoke execute on function public.visible_mosques(), public.guard_mosque(), public.mosque_audit(), public.guard_account(),
  public.task_before(), public.task_after(), public.comment_before(), public.attachment_before(), public.broadcast_before()
  from authenticated, anon, public;
alter function public.touch() set search_path = public;
alter function public.company_stage(text) set search_path = public;
alter function public.stage_label(text) set search_path = public;
alter default privileges in schema public revoke execute on functions from anon, public;

create policy files_read on storage.objects for select to authenticated using (bucket_id = 'files' and public.can_read_object(name));
create policy files_insert on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.can_write_object(name));
create policy files_delete on storage.objects for delete to authenticated using (bucket_id = 'files' and (public.my_role() = 'admin' or owner = auth.uid()));
create policy brand_write on storage.objects for insert to authenticated with check (bucket_id = 'brand' and public.my_role() = 'admin');
create policy brand_update on storage.objects for update to authenticated using (bucket_id = 'brand' and public.my_role() = 'admin');
create policy brand_delete on storage.objects for delete to authenticated using (bucket_id = 'brand' and public.my_role() = 'admin');

-- الإشعارات اللحظية
alter publication supabase_realtime add table public.notifications;

-- أول مدير للنظام (عدّل البريد عند إعادة الإنشاء)
insert into public.accounts (name, email, role, title) values ('مدير النظام', 'admin@example.com', 'admin', 'مدير النظام');
