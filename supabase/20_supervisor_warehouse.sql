-- ───────────────────────── صلاحية «مشرف المشروع» + «المستودع» (طلبات الزيت العطري) ─────────────────────────
select set_config('tayyib.bypass', 'on', true);

-- ═════ ١) مشرف المشروع: صلاحيات مدير النظام كاملة عدا المستودع وإدارة حسابات المدير ═════
alter table public.accounts drop constraint if exists accounts_role_check;
alter table public.accounts add constraint accounts_role_check check (role in ('admin', 'supervisor', 'association', 'company', 'viewer'));

-- الصلاحية الفعلية المسجلة في الحساب (للمستودع وحماية حسابات المدير)
create or replace function public.my_real_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.accounts where user_id = auth.uid() and active limit 1
$$;
-- الصلاحية التشغيلية: المشرف يعامل كمدير في كل السياسات والإجراءات
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select case role when 'supervisor' then 'admin' else role end from public.accounts where user_id = auth.uid() and active limit 1
$$;

-- الإشعارات الموجهة للمدير تصل للمشرف أيضًا
create or replace function public.notify(p_role text, p_assoc uuid, p_mosque uuid, p_title text, p_body text,
  p_kind text default 'info', p_task uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (account_id, kind, title, body, mosque_id, task_id)
  select a.id, p_kind, p_title, p_body, p_mosque, p_task from public.accounts a
  where a.active and (a.role = p_role or (p_role = 'admin' and a.role = 'supervisor'))
    and (p_role <> 'association' or a.association_id = p_assoc)
    and a.id is distinct from public.my_id();
end $$;
create or replace function public.notify_link(p_role text, p_assoc uuid, p_mosque uuid, p_title text, p_body text, p_kind text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (account_id, kind, title, body, mosque_id, link)
  select a.id, p_kind, p_title, p_body, p_mosque, p_link from public.accounts a
  where a.active and (a.role = p_role or (p_role = 'admin' and a.role = 'supervisor')) and (p_role <> 'association' or a.association_id = p_assoc)
    and a.id is distinct from public.my_id()
$$;

create or replace function public.comment_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = new.task_id;
  if not found or not public.can_see_task(t) or coalesce(public.my_role(), 'viewer') = 'viewer' then raise exception 'غير مصرح'; end if;
  new.author_id = public.my_id();
  insert into public.notifications (account_id, kind, title, body, mosque_id, task_id)
    select a.id, 'task', 'تعليق على: ' || t.title, left(new.body, 140), t.mosque_id, t.id
    from public.accounts a
    where a.active and a.id is distinct from public.my_id()
      and (a.id = t.created_by or ((a.role = t.assignee or (t.assignee = 'admin' and a.role = 'supervisor')) and (t.assignee <> 'association' or a.association_id = t.association_id)));
  return new;
end $$;

-- المشرف لا ينشئ حسابات مدير ولا يعدّلها ولا يحذفها (حتى لا يصل للمستودع بطريق غير مباشر)
create or replace function public.guard_account() returns trigger
language plpgsql security definer set search_path = public as $$
declare rr text := public.my_real_role();
begin
  if rr = 'supervisor' and (new.role = 'admin' or (tg_op = 'UPDATE' and old.role = 'admin')) then
    raise exception 'إدارة حسابات مدير النظام من صلاحية المدير فقط';
  end if;
  if tg_op = 'UPDATE' then
    new.email = lower(trim(new.email));
    if old.user_id = auth.uid() and old.role in ('admin', 'supervisor') and (new.role <> old.role or not new.active) then
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
create or replace function public.guard_account_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.my_real_role() = 'supervisor' and old.role = 'admin' then raise exception 'حذف حسابات مدير النظام من صلاحية المدير فقط'; end if;
  if old.user_id = auth.uid() then raise exception 'لا يمكنك حذف حسابك'; end if;
  return old;
end $$;
drop trigger if exists accounts_guard_delete on public.accounts;
create trigger accounts_guard_delete before delete on public.accounts for each row execute function public.guard_account_delete();

-- ═════ ٢) المستودع: طلبات الزيت العطري ═════
alter table public.settings add column if not exists oil_ml_per_device int not null default 800;   -- كمية تعبئة الجهاز (مل)
alter table public.settings add column if not exists oil_gallon_ml int not null default 5000;      -- سعة الجالون (٥ كجم ≈ ٥٠٠٠ مل)

create table if not exists public.oil_requests (
  id uuid primary key default gen_random_uuid(),
  ref int generated always as identity unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'received')),
  requested_by uuid references public.accounts(id) on delete set null,
  requester_name text not null,
  requester_title text,
  ml_per_device int not null,
  gallon_ml int not null,
  total_devices int not null,
  total_ml int not null,
  gallons int not null,
  note text,
  decided_by uuid references public.accounts(id) on delete set null,
  approver_name text,
  approver_title text,
  signature text,
  decision_note text,
  decided_at timestamptz,
  verify_code text,
  received_at timestamptz,
  received_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.oil_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.oil_requests(id) on delete cascade,
  mosque_id uuid references public.mosques(id) on delete set null,
  mosque_code text, mosque_name text not null, district text,
  devices int not null check (devices between 1 and 100),
  ml int not null
);
create index if not exists oil_items_req on public.oil_request_items (request_id);
create index if not exists oil_req_status on public.oil_requests (status, created_at desc);

-- التوقيع المحفوظ لكل حساب (لا يراه غير صاحبه)
create table if not exists public.signatures (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  image text not null,
  updated_at timestamptz not null default now()
);

alter table public.oil_requests enable row level security;
alter table public.oil_request_items enable row level security;
alter table public.signatures enable row level security;
drop policy if exists oil_read on public.oil_requests;
create policy oil_read on public.oil_requests for select using (public.my_real_role() in ('admin', 'company'));
drop policy if exists oil_items_read on public.oil_request_items;
create policy oil_items_read on public.oil_request_items for select using (public.my_real_role() in ('admin', 'company'));
drop policy if exists sig_own on public.signatures;
create policy sig_own on public.signatures for select using (account_id = public.my_id());
-- كل الكتابة عبر الإجراءات أدناه فقط
revoke insert, update, delete on public.oil_requests, public.oil_request_items, public.signatures from anon, authenticated;
revoke all on public.oil_requests, public.oil_request_items, public.signatures from anon;
grant select on public.oil_requests, public.oil_request_items, public.signatures to authenticated;

-- إشعار المدير الفعلي فقط (ليس المشرف)
create or replace function public.notify_real(p_role text, p_title text, p_body text, p_kind text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (account_id, kind, title, body, link)
  select a.id, p_kind, p_title, p_body, p_link from public.accounts a
  where a.active and a.role = p_role and a.id is distinct from public.my_id()
$$;

-- الشركة: طلب جديد  p_items = [{mosque_id, devices}]
create or replace function public.oil_request_create(p_items jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.accounts; st public.settings; rid uuid; n int; tot int; per int; gal int; r int;
begin
  select * into me from public.accounts where user_id = auth.uid() and active;
  if me.role is distinct from 'company' then raise exception 'طلب الزيت من صلاحية الشركة المنفذة'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'اختر مسجدًا واحدًا على الأقل'; end if;
  if jsonb_array_length(p_items) > 300 then raise exception 'عدد المساجد كبير'; end if;
  select * into st from public.settings limit 1;
  per := coalesce(st.oil_ml_per_device, 800); gal := greatest(1, coalesce(st.oil_gallon_ml, 5000));
  if exists (select 1 from jsonb_array_elements(p_items) e where coalesce((e ->> 'devices')::int, 0) not between 1 and 100) then raise exception 'عدد الأجهزة لكل مسجد بين ١ و١٠٠'; end if;
  if (select count(distinct e ->> 'mosque_id') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then raise exception 'مسجد مكرر في الطلب'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) e left join public.mosques m on m.id = (e ->> 'mosque_id')::uuid where m.id is null or m.stage <> 'active')
    then raise exception 'يمكن الطلب للمساجد المركّبة فقط'; end if;
  select sum((e ->> 'devices')::int) into n from jsonb_array_elements(p_items) e;
  tot := n * per;
  insert into public.oil_requests (requested_by, requester_name, requester_title, ml_per_device, gallon_ml, total_devices, total_ml, gallons, note)
  values (me.id, me.name, me.title, per, gal, n, tot, ceil(tot::numeric / gal)::int, nullif(trim(p_note), '')) returning id, ref into rid, r;
  insert into public.oil_request_items (request_id, mosque_id, mosque_code, mosque_name, district, devices, ml)
  select rid, m.id, m.code, m.name, m.district, (e ->> 'devices')::int, (e ->> 'devices')::int * per
  from jsonb_array_elements(p_items) e join public.mosques m on m.id = (e ->> 'mosque_id')::uuid
  order by m.district nulls last, m.name;
  perform public.notify_real('admin', 'طلب زيت عطري #' || r || ' بانتظار اعتمادك',
    me.name || ' — ' || jsonb_array_length(p_items) || ' مسجد، ' || n || ' جهاز، ' || ceil(tot::numeric / gal)::int || ' جالون', 'alert', '/warehouse/' || rid);
  return rid;
end $$;

-- مدير النظام: اعتماد مع توقيع إلكتروني أو رفض
create or replace function public.oil_request_decide(p_id uuid, p_approve boolean, p_note text default null, p_signature text default null, p_save boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare me public.accounts; q public.oil_requests; sig text := p_signature;
begin
  select * into me from public.accounts where user_id = auth.uid() and active;
  if me.role is distinct from 'admin' then raise exception 'اعتماد طلبات المستودع من صلاحية مدير النظام فقط'; end if;
  select * into q from public.oil_requests where id = p_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if q.status <> 'pending' then raise exception 'تم البت في هذا الطلب مسبقًا'; end if;
  if p_approve then
    if sig is null then select image into sig from public.signatures where account_id = me.id; end if;
    if sig is null or sig !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(sig) > 300000 then raise exception 'التوقيع الإلكتروني مطلوب للاعتماد'; end if;
    if p_save then
      insert into public.signatures (account_id, image) values (me.id, sig)
      on conflict (account_id) do update set image = excluded.image, updated_at = now();
    end if;
    update public.oil_requests set status = 'approved', decided_by = me.id, approver_name = me.name, approver_title = me.title, signature = sig,
      decision_note = nullif(trim(p_note), ''), decided_at = now(),
      verify_code = upper(substr(md5(id::text || now()::text || md5(sig)), 1, 10)), updated_at = now()
    where id = p_id;
  else
    if nullif(trim(p_note), '') is null then raise exception 'اكتب سبب الرفض'; end if;
    update public.oil_requests set status = 'rejected', decided_by = me.id, approver_name = me.name, approver_title = me.title,
      decision_note = trim(p_note), decided_at = now(), updated_at = now() where id = p_id;
  end if;
  insert into public.notifications (account_id, kind, title, body, link)
  select a.id, case when p_approve then 'approval' else 'alert' end,
    case when p_approve then 'تم اعتماد طلب الزيت #' || q.ref || ' — جاهز للطباعة والاستلام' else 'تم رفض طلب الزيت #' || q.ref end,
    coalesce(nullif(trim(p_note), ''), q.gallons || ' جالون'), '/warehouse/' || p_id
  from public.accounts a where a.active and a.role = 'company';
end $$;

-- الشركة: إلغاء طلب معلّق، أو تأكيد الاستلام من المستودع
create or replace function public.oil_request_update(p_id uuid, p_action text, p_name text default null) returns void
language plpgsql security definer set search_path = public as $$
declare q public.oil_requests; rr text := public.my_real_role();
begin
  select * into q from public.oil_requests where id = p_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if p_action = 'cancel' then
    if rr is distinct from 'company' or q.status <> 'pending' then raise exception 'لا يمكن إلغاء هذا الطلب'; end if;
    update public.oil_requests set status = 'cancelled', updated_at = now() where id = p_id;
  elsif p_action = 'received' then
    if coalesce(rr, '') not in ('company', 'admin') or q.status <> 'approved' then raise exception 'لا يمكن تأكيد الاستلام'; end if;
    update public.oil_requests set status = 'received', received_at = now(), received_by = coalesce(nullif(trim(p_name), ''), (select name from public.accounts where id = public.my_id())), updated_at = now() where id = p_id;
  else raise exception 'إجراء غير معروف'; end if;
end $$;

create or replace function public.save_signature(p_image text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_real_role() is distinct from 'admin' then raise exception 'غير مصرح'; end if;
  if p_image is null then delete from public.signatures where account_id = public.my_id(); return; end if;
  if p_image !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(p_image) > 300000 then raise exception 'صيغة التوقيع غير صحيحة'; end if;
  insert into public.signatures (account_id, image) values (public.my_id(), p_image)
  on conflict (account_id) do update set image = excluded.image, updated_at = now();
end $$;

revoke execute on function public.notify_real(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.oil_request_create(jsonb, text), public.oil_request_decide(uuid, boolean, text, text, boolean),
  public.oil_request_update(uuid, text, text), public.save_signature(text), public.my_real_role() from public, anon;
grant execute on function public.oil_request_create(jsonb, text), public.oil_request_decide(uuid, boolean, text, text, boolean),
  public.oil_request_update(uuid, text, text), public.save_signature(text), public.my_real_role() to authenticated;

-- ═════ ٣) «مهامي»: المشرف كالمدير (بلا المستودع)، والمدير يعتمد الطلبات، والشركة تستلم ═════
alter table public.settings alter column task_sla set default
  '{"assign": 3, "complete": 7, "feasibility": 7, "study": 10, "decide": 3, "install": 14, "complaint": 2, "assoc_complaint": 3, "monthly": 5, "weekly": 5, "oil": 1}';
update public.settings set task_sla = task_sla || '{"oil": 1}' where not task_sla ? 'oil';

create or replace function public.tasks_for(p_account uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; st public.settings; sla jsonb; v_out jsonb := '[]'; v_role text;
  ym text := to_char((now() at time zone 'Asia/Riyadh') - interval '1 month', 'YYYY-MM');
  month_due timestamptz;
  -- الأسبوع يبدأ الأحد (بتوقيت الرياض)؛ التقرير الأسبوعي مستحق نهاية اليوم المحدد (الافتراضي الخميس)
  ws_local timestamp := date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '1 day') - interval '1 day';
  ws timestamptz := ws_local at time zone 'Asia/Riyadh';
  week_due timestamptz;
begin
  select * into a from public.accounts where id = p_account and active;
  if not found then return '[]'; end if;
  v_role := case a.role when 'supervisor' then 'admin' else a.role end;
  select * into st from public.settings limit 1;
  sla := coalesce(st.task_sla, '{}');
  week_due := ws + make_interval(days => least(7, greatest(1, coalesce((sla ->> 'weekly')::int, 5))));
  month_due := (date_trunc('month', now() at time zone 'Asia/Riyadh') + make_interval(days => coalesce((sla ->> 'monthly')::int, 5))) at time zone 'Asia/Riyadh';

  if v_role = 'admin' then
    v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('k', 'assign', 'title', 'إسناد المسجد لجمعية مشرفة', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', m.stage_at + make_interval(days => coalesce((sla ->> 'assign')::int, 3)), 'link', '/mosque/' || m.id)) from public.mosques m where m.stage = 'selected'), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'decide', 'title', 'مراجعة دراسة الاحتياج واعتماد التركيب', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', m.stage_at + make_interval(days => coalesce((sla ->> 'decide')::int, 3)), 'link', '/mosque/' || m.id)) from public.mosques m where m.stage = 'study_done'), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'complaint', 'title', case when c.status = 'responded' then 'إغلاق ' || case c.kind when 'suggestion' then 'اقتراح' else 'شكوى' end || ' بعد ردّ الجمعية' else 'التعامل مع ' || case c.kind when 'suggestion' then 'اقتراح' else 'شكوى' end || ' جديدة' end,
        'mosque_id', m.id, 'mosque', m.name, 'district', m.district, 'note', left(c.body, 90),
        'due', case when c.status = 'responded' then c.updated_at + interval '2 days' else c.created_at + make_interval(days => coalesce((sla ->> 'complaint')::int, 2)) end, 'link', '/complaints/' || c.id))
        from public.complaints c left join public.mosques m on m.id = c.mosque_id where c.status in ('new', 'responded')), '[]');
  elsif v_role = 'association' then
    v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('k', 'complete', 'title', 'استكمال بيانات المسجد', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', m.stage_at + make_interval(days => coalesce((sla ->> 'complete')::int, 7)), 'link', '/mosque/' || m.id)) from public.mosques m where m.association_id = a.association_id and m.stage = 'assigned'), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'feasibility', 'title', 'التواصل مع الإمام ورفع التقرير', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', m.stage_at + make_interval(days => coalesce((sla ->> 'feasibility')::int, 7)), 'link', '/mosque/' || m.id)) from public.mosques m where m.association_id = a.association_id and m.stage = 'data_done'), '[]')
      -- التقرير الأسبوعي (تقرير الزيارة): مطلوب كل أسبوع لكل مسجد مركّب — الأسبوع الحالي، والأسبوع الماضي إن لم يُرفع
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'visit', 'title', case when w.off = 0 then 'التقرير الأسبوعي — هذا الأسبوع' else 'التقرير الأسبوعي — الأسبوع الماضي' end,
          'mosque_id', m.id, 'mosque', m.name, 'district', m.district, 'due', week_due - make_interval(days => 7 * w.off),
          'note', 'أسبوع ' || to_char(ws_local - make_interval(days => 7 * w.off), 'DD/MM') || ' – ' || to_char(ws_local - make_interval(days => 7 * w.off - 6), 'DD/MM') || ' • يتكرر أسبوعيًا', 'link', '/mosque/' || m.id))
        from public.mosques m cross join (values (0), (1)) w(off)
        where m.association_id = a.association_id and m.stage = 'active' and m.installed_at < ws - make_interval(days => 7 * w.off)
          and not exists (select 1 from public.reports r where r.mosque_id = m.id and r.type = 'visit'
            and coalesce((r.data ->> 'date')::timestamptz, r.created_at) >= ws - make_interval(days => 7 * w.off)
            and coalesce((r.data ->> 'date')::timestamptz, r.created_at) < ws - make_interval(days => 7 * w.off - 7))), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'monthly', 'title', 'التقرير الشهري لشهر ' || ym, 'mosque_id', m.id, 'mosque', m.name, 'district', m.district, 'due', month_due, 'link', '/mosque/' || m.id))
        from public.mosques m where m.association_id = a.association_id and m.stage = 'active' and m.installed_at < date_trunc('month', now())
          and not exists (select 1 from public.reports r where r.mosque_id = m.id and r.type = 'monthly' and r.data ->> 'month' = ym)), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'complaint', 'title', 'الرد على ' || case c.kind when 'suggestion' then 'اقتراح' else 'شكوى' end || ' موجّهة للجمعية', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'note', left(c.body, 90), 'due', c.updated_at + make_interval(days => coalesce((sla ->> 'assoc_complaint')::int, 3)), 'link', '/complaints/' || c.id))
        from public.complaints c left join public.mosques m on m.id = c.mosque_id where c.association_id = a.association_id and c.status = 'assigned'), '[]');
  elsif v_role = 'company' then
    v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('k', 'study', 'title', 'دراسة احتياج الجامع ورفع التقرير', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', m.stage_at + make_interval(days => coalesce((sla ->> 'study')::int, 10)), 'link', '/mosque/' || m.id)) from public.mosques m where m.stage = 'feasible'), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'install', 'title', 'تركيب الأجهزة ورفع تقرير التركيب', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', coalesce(m.planned_install_at::timestamptz, m.stage_at + make_interval(days => coalesce((sla ->> 'install')::int, 14))), 'link', '/mosque/' || m.id)) from public.mosques m where m.stage = 'approved'), '[]')
      -- التعبئة: تظهر خلال أسبوعين من موعدها
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'refill', 'title', 'تعبئة العطر', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district, 'due', m.next_refill_at, 'link', '/mosque/' || m.id))
        from public.mosques m where m.stage = 'active' and m.next_refill_at is not null and m.next_refill_at <= now() + interval '14 days'), '[]');
  else
    return '[]';
  end if;

  -- المستودع: اعتماد طلبات الزيت (المدير الفعلي فقط)، واستلامها من المستودع (الشركة)
  if a.role = 'admin' then
    v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('k', 'oil', 'title', 'اعتماد طلب زيت عطري #' || q.ref, 'mosque', q.requester_name,
        'note', q.total_devices || ' جهاز • ' || q.gallons || ' جالون', 'due', q.created_at + make_interval(days => coalesce((sla ->> 'oil')::int, 1)), 'link', '/warehouse/' || q.id))
      from public.oil_requests q where q.status = 'pending'), '[]');
  elsif a.role = 'company' then
    v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('k', 'oil', 'title', 'استلام الزيت من المستودع — طلب #' || q.ref,
        'note', q.gallons || ' جالون • اطبع الورقة المعتمدة وسلّمها للمستودع', 'due', q.decided_at + interval '3 days', 'link', '/warehouse/' || q.id))
      from public.oil_requests q where q.status = 'approved'), '[]');
  end if;

  -- المهام والطلبات المسندة للحساب
  v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('k', 'task', 'title', case t.kind when 'request' then 'طلب: ' else 'مهمة: ' end || t.title, 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
      'note', left(t.details, 90), 'priority', t.priority,
      'due', coalesce(t.due_date::timestamptz + interval '20 hours', t.created_at + interval '3 days'), 'link', '/tasks/' || t.id))
    from public.tasks t left join public.mosques m on m.id = t.mosque_id
    where t.status not in ('done', 'cancelled', 'closed') and t.assignee = v_role and (v_role <> 'association' or t.association_id = a.association_id)), '[]');
  return v_out;
end $$;


create or replace function public.send_task_digest() returns int
language plpgsql security definer set search_path = public as $$
declare a public.accounts; items jsonb; late int; today int; soon int; sent int := 0;
  day_end timestamptz := (date_trunc('day', now() at time zone 'Asia/Riyadh') + interval '1 day') at time zone 'Asia/Riyadh';
  d date := (now() at time zone 'Asia/Riyadh')::date;
begin
  perform set_config('tayyib.bypass', 'on', true);
  for a in select * from public.accounts where active and user_id is not null and role in ('admin', 'supervisor', 'association', 'company') and digest_on is distinct from d loop
    items := public.tasks_for(a.id);
    select count(*) filter (where (x ->> 'due')::timestamptz < now()),
           count(*) filter (where (x ->> 'due')::timestamptz >= now() and (x ->> 'due')::timestamptz < day_end),
           count(*) filter (where (x ->> 'due')::timestamptz >= day_end and (x ->> 'due')::timestamptz < day_end + interval '2 days')
      into late, today, soon from jsonb_array_elements(items) x;
    if late + today + soon > 0 then
      insert into public.notifications (account_id, kind, title, body, link)
      values (a.id, case when late > 0 then 'alert' else 'reminder' end,
        'مهامك اليوم: ' || concat_ws('، ', case when late > 0 then late || ' متأخرة' end, case when today > 0 then today || ' مستحقة اليوم' end, case when soon > 0 then soon || ' خلال يومين' end),
        'افتح «مهامي» لاتخاذ الإجراء', '/my');
      sent := sent + 1;
    end if;
    update public.accounts set digest_on = d where id = a.id;
  end loop;
  perform set_config('tayyib.bypass', 'off', true);
  return sent;
end $$;


revoke execute on function public.tasks_for(uuid), public.send_task_digest() from public, anon, authenticated;

select set_config('tayyib.bypass', 'off', true);

-- المشرف لا يرى حسابات مدير النظام (حتى لا يطّلع على رموز التفعيل)
drop policy if exists accounts_self on public.accounts;
create policy accounts_self on public.accounts for select using (
  user_id = auth.uid() or public.my_real_role() = 'admin' or (public.my_real_role() = 'supervisor' and role <> 'admin'));

-- إعدادات المستودع لا يعدّلها المشرف
create or replace function public.guard_settings_oil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.my_real_role() = 'supervisor' and (new.oil_ml_per_device is distinct from old.oil_ml_per_device or new.oil_gallon_ml is distinct from old.oil_gallon_ml) then
    raise exception 'إعدادات المستودع من صلاحية مدير النظام فقط';
  end if;
  return new;
end $$;
drop trigger if exists settings_guard_oil on public.settings;
create trigger settings_guard_oil before update on public.settings for each row execute function public.guard_settings_oil();
revoke execute on function public.guard_account_delete(), public.guard_settings_oil() from public, anon, authenticated;
