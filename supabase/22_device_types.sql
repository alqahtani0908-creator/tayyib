-- ═════ أنواع الأجهزة: AF 5000 Pro (٨٠٠ مل) و AF 2000 Pro (٥٠٠ مل) ═════
-- دراسة الاحتياج تحدد العدد المقترح من كل نوع، وتقرير التركيب يؤكده، وطلب الزيت يُحسب لكل نوع بسعته.

alter table public.settings add column if not exists oil_ml_af5000 int not null default 800;
alter table public.settings add column if not exists oil_ml_af2000 int not null default 500;
update public.settings set oil_ml_af5000 = oil_ml_per_device where oil_ml_per_device is not null and oil_ml_per_device <> 800;

alter table public.mosques add column if not exists devices_af5000 int check (devices_af5000 between 0 and 100);
alter table public.mosques add column if not exists devices_af2000 int check (devices_af2000 between 0 and 100);
update public.mosques set devices_af5000 = devices_count, devices_af2000 = 0 where devices_count is not null and devices_af5000 is null;

alter table public.oil_requests add column if not exists ml_af5000 int;
alter table public.oil_requests add column if not exists ml_af2000 int;
alter table public.oil_requests add column if not exists total_af5000 int not null default 0;
alter table public.oil_requests add column if not exists total_af2000 int not null default 0;
update public.oil_requests set ml_af5000 = ml_per_device, ml_af2000 = 500, total_af5000 = total_devices where ml_af5000 is null;

alter table public.oil_request_items add column if not exists devices_af5000 int not null default 0;
alter table public.oil_request_items add column if not exists devices_af2000 int not null default 0;
update public.oil_request_items set devices_af5000 = devices where devices_af5000 = 0 and devices_af2000 = 0;
alter table public.oil_request_items drop constraint if exists oil_request_items_devices_check;
alter table public.oil_request_items add constraint oil_request_items_devices_check check (devices between 1 and 200);

-- الجمعية لا تعدّل أعداد الأجهزة
create or replace function public.guard_mosque() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tayyib.bypass', true) = 'on' or public.my_role() = 'admin' then return new; end if;
  if public.my_role() = 'association' then
    if (new.stage, new.association_id, new.devices_count, new.devices_af5000, new.devices_af2000, new.fragrance, new.refill_cycle_days, new.planned_install_at,
        new.installed_at, new.last_refill_at, new.next_refill_at, new.last_visit_at, new.satisfaction_avg, new.code)
       is distinct from
       (old.stage, old.association_id, old.devices_count, old.devices_af5000, old.devices_af2000, old.fragrance, old.refill_cycle_days, old.planned_install_at,
        old.installed_at, old.last_refill_at, old.next_refill_at, old.last_visit_at, old.satisfaction_avg, old.code) then
      raise exception 'لا تملك صلاحية تعديل حقول المرحلة أو التشغيل';
    end if;
    return new;
  end if;
  if public.my_role() = 'company' then
    if (to_jsonb(new) - 'planned_install_at' - 'updated_at') is distinct from (to_jsonb(old) - 'planned_install_at' - 'updated_at') then
      raise exception 'لا تملك صلاحية تعديل بيانات المسجد';
    end if;
    return new;
  end if;
  raise exception 'لا تملك صلاحية التعديل';
end $$;

-- عدد كل نوع في التقرير: يُتحقق منه ويُحسب الإجمالي devices على الخادم
create or replace function public.devices_split(p_data jsonb, out a int, out b int)
language plpgsql immutable as $$
begin
  a := case when coalesce(p_data ->> 'af5000', '') ~ '^[0-9]{1,3}$' then (p_data ->> 'af5000')::int else 0 end;
  b := case when coalesce(p_data ->> 'af2000', '') ~ '^[0-9]{1,3}$' then (p_data ->> 'af2000')::int else 0 end;
  if a > 100 or b > 100 then raise exception 'عدد الأجهزة من كل نوع لا يتجاوز ١٠٠'; end if;
  if a + b = 0 then raise exception 'حدد عدد الأجهزة من نوع واحد على الأقل'; end if;
end $$;

create or replace function public.submit_report(p_mosque uuid, p_type text, p_data jsonb, p_summary text default null) returns public.reports
language plpgsql security definer set search_path = public as $$
declare m public.mosques; r public.reports; role text := public.my_role(); cycle int; d timestamptz; s text; da int; db int;
begin
  select * into m from public.mosques where id = p_mosque for update;
  if not found or not public.can_see_mosque(p_mosque) then raise exception 'غير مصرح'; end if;
  if role = 'viewer' or role is null then raise exception 'غير مصرح'; end if;
  select coalesce(case when p_type = 'installation' and (p_data ->> 'cycle') ~ '^[0-9]{1,3}$' and (p_data ->> 'cycle')::int > 0 then (p_data ->> 'cycle')::int end, m.refill_cycle_days, st.refill_cycle_days) into cycle from public.settings st;

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

  -- الدراسة والتركيب: عدد كل نوع إلزامي، والإجمالي يُحسب هنا
  if p_type in ('needs_study', 'installation') then
    select a, b into da, db from public.devices_split(p_data);
    p_data := coalesce(p_data, '{}') || jsonb_build_object('af5000', da, 'af2000', db, 'devices', da + db);
  end if;

  insert into public.reports (mosque_id, type, data, summary, author_id, author_role)
  values (p_mosque, p_type, coalesce(p_data, '{}') || case when p_type = 'refill' and m.next_refill_at is not null then jsonb_build_object('due', m.next_refill_at) else '{}'::jsonb end, p_summary, public.my_id(), role) returning * into r;

  perform set_config('tayyib.bypass', 'on', true);
  if s is not null then update public.mosques set stage = s where id = p_mosque; end if;

  if p_type = 'installation' then
    d := coalesce((p_data ->> 'date')::timestamptz, now());
    update public.mosques set installed_at = d, last_refill_at = d, refill_cycle_days = cycle, next_refill_at = d + make_interval(days => cycle),
      devices_af5000 = da, devices_af2000 = db, devices_count = da + db,
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

-- الشركة: طلب زيت  p_items = [{mosque_id, af5000, af2000}]
create or replace function public.oil_request_create(p_items jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.accounts; st public.settings; v jsonb; rid uuid; na int; nb int; tot int; pa int; pb int; gal int; r int;
begin
  select * into me from public.accounts where user_id = auth.uid() and active;
  if me.role is distinct from 'company' then raise exception 'طلب الزيت من صلاحية الشركة المنفذة'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'اختر مسجدًا واحدًا على الأقل'; end if;
  if jsonb_array_length(p_items) > 300 then raise exception 'عدد المساجد كبير'; end if;
  select * into st from public.settings limit 1;
  pa := coalesce(st.oil_ml_af5000, 800); pb := coalesce(st.oil_ml_af2000, 500); gal := greatest(1, coalesce(st.oil_gallon_ml, 5000));
  select jsonb_agg(jsonb_build_object('mosque_id', e ->> 'mosque_id',
      'a', case when coalesce(e ->> 'af5000', '') ~ '^[0-9]{1,3}$' then (e ->> 'af5000')::int else 0 end,
      'b', case when coalesce(e ->> 'af2000', '') ~ '^[0-9]{1,3}$' then (e ->> 'af2000')::int else 0 end)) into v
    from jsonb_array_elements(p_items) e;
  if exists (select 1 from jsonb_to_recordset(v) x(mosque_id uuid, a int, b int) where a > 100 or b > 100 or a + b = 0) then raise exception 'حدد عدد الأجهزة لكل مسجد (١ إلى ١٠٠ من كل نوع)'; end if;
  if (select count(distinct mosque_id) from jsonb_to_recordset(v) x(mosque_id uuid, a int, b int)) <> jsonb_array_length(p_items) then raise exception 'مسجد مكرر في الطلب'; end if;
  if exists (select 1 from jsonb_to_recordset(v) o(mosque_id uuid, a int, b int) left join public.mosques m on m.id = o.mosque_id where m.id is null or m.stage <> 'active')
    then raise exception 'يمكن الطلب للمساجد المركّبة فقط'; end if;
  select sum(a), sum(b) into na, nb from jsonb_to_recordset(v) x(mosque_id uuid, a int, b int);
  tot := na * pa + nb * pb;
  insert into public.oil_requests (requested_by, requester_name, requester_title, ml_per_device, ml_af5000, ml_af2000, gallon_ml,
    total_devices, total_af5000, total_af2000, total_ml, gallons, note)
  values (me.id, me.name, me.title, pa, pa, pb, gal, na + nb, na, nb, tot, ceil(tot::numeric / gal)::int, nullif(trim(p_note), '')) returning id, ref into rid, r;
  insert into public.oil_request_items (request_id, mosque_id, mosque_code, mosque_name, district, devices, devices_af5000, devices_af2000, ml)
  select rid, m.id, m.code, m.name, m.district, o.a + o.b, o.a, o.b, o.a * pa + o.b * pb
  from jsonb_to_recordset(v) o(mosque_id uuid, a int, b int) join public.mosques m on m.id = o.mosque_id
  order by m.district nulls last, m.name;
  perform public.notify_real('admin', 'طلب زيت عطري #' || r || ' بانتظار اعتمادك',
    me.name || ' — ' || jsonb_array_length(p_items) || ' مسجد، ' || (na + nb) || ' جهاز، ' || ceil(tot::numeric / gal)::int || ' جالون', 'alert', '/warehouse/' || rid);
  return rid;
end $$;

create or replace function public.guard_settings_oil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.my_real_role() = 'supervisor' and (new.oil_ml_af5000, new.oil_ml_af2000, new.oil_gallon_ml) is distinct from (old.oil_ml_af5000, old.oil_ml_af2000, old.oil_gallon_ml) then
    raise exception 'إعدادات المستودع من صلاحية مدير النظام فقط';
  end if;
  return new;
end $$;

revoke execute on function public.devices_split(jsonb) from public, anon;
