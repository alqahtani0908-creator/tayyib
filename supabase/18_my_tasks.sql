-- ───────────────────────── «مهامي»: ما يجب على كل مستخدم اتخاذ إجراء فيه حسب الموعد ─────────────────────────

-- تاريخ دخول المسجد مرحلته الحالية (لحساب مهلة كل خطوة)
select set_config('tayyib.bypass', 'on', true);
alter table public.mosques add column if not exists stage_at timestamptz;
update public.mosques set stage_at = coalesce(installed_at, updated_at, created_at) where stage_at is null;
alter table public.mosques alter column stage_at set default now();

create or replace function public.track_stage() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then new.stage_at := now(); end if;
  return new;
end $$;
drop trigger if exists mosques_stage_at on public.mosques;
create trigger mosques_stage_at before insert or update of stage on public.mosques for each row execute function public.track_stage();

-- مهل الإنجاز بالأيام (يعدّلها مدير النظام من الإعدادات)
alter table public.settings add column if not exists task_sla jsonb not null default
  '{"assign": 3, "complete": 7, "feasibility": 7, "study": 10, "decide": 3, "install": 14, "complaint": 2, "assoc_complaint": 3, "monthly": 5}';
-- آخر يوم أُرسل فيه ملخص المهام لكل حساب (لمنع التكرار)
alter table public.accounts add column if not exists digest_on date;

-- كل المهام المفتوحة لحساب معيّن: [{k, title, mosque_id, mosque, district, due, link, note}]
create or replace function public.tasks_for(p_account uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; st public.settings; sla jsonb; d int;  v_out jsonb := '[]';
  ym text := to_char((now() at time zone 'Asia/Riyadh') - interval '1 month', 'YYYY-MM');
  month_due timestamptz;
begin
  select * into a from public.accounts where id = p_account and active;
  if not found then return '[]'; end if;
  select * into st from public.settings limit 1;
  sla := coalesce(st.task_sla, '{}');
  d := coalesce(st.visit_every_days, 7);
  month_due := (date_trunc('month', now() at time zone 'Asia/Riyadh') + make_interval(days => coalesce((sla ->> 'monthly')::int, 5))) at time zone 'Asia/Riyadh';

  if a.role = 'admin' then
    v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('k', 'assign', 'title', 'إسناد المسجد لجمعية مشرفة', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', m.stage_at + make_interval(days => coalesce((sla ->> 'assign')::int, 3)), 'link', '/mosque/' || m.id)) from public.mosques m where m.stage = 'selected'), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'decide', 'title', 'مراجعة دراسة الاحتياج واعتماد التركيب', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', m.stage_at + make_interval(days => coalesce((sla ->> 'decide')::int, 3)), 'link', '/mosque/' || m.id)) from public.mosques m where m.stage = 'study_done'), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'complaint', 'title', case when c.status = 'responded' then 'إغلاق ' || case c.kind when 'suggestion' then 'اقتراح' else 'شكوى' end || ' بعد ردّ الجمعية' else 'التعامل مع ' || case c.kind when 'suggestion' then 'اقتراح' else 'شكوى' end || ' جديدة' end,
        'mosque_id', m.id, 'mosque', m.name, 'district', m.district, 'note', left(c.body, 90),
        'due', case when c.status = 'responded' then c.updated_at + interval '2 days' else c.created_at + make_interval(days => coalesce((sla ->> 'complaint')::int, 2)) end, 'link', '/complaints/' || c.id))
        from public.complaints c left join public.mosques m on m.id = c.mosque_id where c.status in ('new', 'responded')), '[]');
  elsif a.role = 'association' then
    v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('k', 'complete', 'title', 'استكمال بيانات المسجد', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', m.stage_at + make_interval(days => coalesce((sla ->> 'complete')::int, 7)), 'link', '/mosque/' || m.id)) from public.mosques m where m.association_id = a.association_id and m.stage = 'assigned'), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'feasibility', 'title', 'التواصل مع الإمام ورفع التقرير', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', m.stage_at + make_interval(days => coalesce((sla ->> 'feasibility')::int, 7)), 'link', '/mosque/' || m.id)) from public.mosques m where m.association_id = a.association_id and m.stage = 'data_done'), '[]')
      -- الزيارة الأسبوعية: تظهر قبل موعدها بيومين
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'visit', 'title', 'الزيارة الأسبوعية', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'due', coalesce(m.last_visit_at, m.installed_at) + make_interval(days => d), 'link', '/mosque/' || m.id))
        from public.mosques m where m.association_id = a.association_id and m.stage = 'active' and coalesce(m.last_visit_at, m.installed_at) + make_interval(days => d) <= now() + interval '2 days'), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'monthly', 'title', 'التقرير الشهري لشهر ' || ym, 'mosque_id', m.id, 'mosque', m.name, 'district', m.district, 'due', month_due, 'link', '/mosque/' || m.id))
        from public.mosques m where m.association_id = a.association_id and m.stage = 'active' and m.installed_at < date_trunc('month', now())
          and not exists (select 1 from public.reports r where r.mosque_id = m.id and r.type = 'monthly' and r.data ->> 'month' = ym)), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('k', 'complaint', 'title', 'الرد على ' || case c.kind when 'suggestion' then 'اقتراح' else 'شكوى' end || ' موجّهة للجمعية', 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
        'note', left(c.body, 90), 'due', c.updated_at + make_interval(days => coalesce((sla ->> 'assoc_complaint')::int, 3)), 'link', '/complaints/' || c.id))
        from public.complaints c left join public.mosques m on m.id = c.mosque_id where c.association_id = a.association_id and c.status = 'assigned'), '[]');
  elsif a.role = 'company' then
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

  -- المهام والطلبات المسندة للحساب
  v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('k', 'task', 'title', case t.kind when 'request' then 'طلب: ' else 'مهمة: ' end || t.title, 'mosque_id', m.id, 'mosque', m.name, 'district', m.district,
      'note', left(t.details, 90), 'priority', t.priority,
      'due', coalesce(t.due_date::timestamptz + interval '20 hours', t.created_at + interval '3 days'), 'link', '/tasks/' || t.id))
    from public.tasks t left join public.mosques m on m.id = t.mosque_id
    where t.status not in ('done', 'cancelled', 'closed') and t.assignee = a.role and (a.role <> 'association' or t.association_id = a.association_id)), '[]');
  return v_out;
end $$;

create or replace function public.my_tasks() returns jsonb
language sql stable security definer set search_path = public as $$
  select public.tasks_for(public.my_id())
$$;

-- ملخص يومي لكل مستخدم بما تأخر وما يستحق اليوم (مرة واحدة يوميًا)
create or replace function public.send_task_digest() returns int
language plpgsql security definer set search_path = public as $$
declare a public.accounts; items jsonb; late int; today int; soon int; sent int := 0;
  day_end timestamptz := (date_trunc('day', now() at time zone 'Asia/Riyadh') + interval '1 day') at time zone 'Asia/Riyadh';
  d date := (now() at time zone 'Asia/Riyadh')::date;
begin
  perform set_config('tayyib.bypass', 'on', true);
  for a in select * from public.accounts where active and user_id is not null and role in ('admin', 'association', 'company') and digest_on is distinct from d loop
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

revoke execute on function public.tasks_for(uuid), public.send_task_digest(), public.track_stage() from public, anon, authenticated;
revoke execute on function public.my_tasks() from public, anon;
grant execute on function public.my_tasks() to authenticated;

-- كل يوم 7 صباحًا بتوقيت الرياض
select cron.unschedule('tayyib-digest') where exists (select 1 from cron.job where jobname = 'tayyib-digest');
select cron.schedule('tayyib-digest', '0 4 * * *', 'select public.send_task_digest()');
select set_config('tayyib.bypass', 'off', true);
