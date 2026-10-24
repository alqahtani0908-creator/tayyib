-- لوحة المؤشرات الاحترافية: مؤشرات بالفترة ومقارنة بالفترة السابقة، اتجاهات أسبوعية، مسار تحويلي، أداء الجمعيات
-- تسجيل موعد الاستحقاق داخل تقرير التعبئة لحساب نسبة الالتزام بالموعد
do $do$
declare d text; n1 int;
begin
  d := pg_get_functiondef('public.submit_report(uuid,text,jsonb,text)'::regprocedure);
  n1 := length(d);
  d := replace(d, $r$values (p_mosque, p_type, coalesce(p_data, '{}'), p_summary, public.my_id(), role) returning * into r;$r$,
    $r$values (p_mosque, p_type, coalesce(p_data, '{}') || case when p_type = 'refill' and m.next_refill_at is not null then jsonb_build_object('due', m.next_refill_at) else '{}'::jsonb end, p_summary, public.my_id(), role) returning * into r;$r$);
  if length(d) = n1 then raise exception 'patch did not apply'; end if;
  execute d;
end $do$;

create or replace function public.dashboard(p_days int default 30, p_assoc uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb; st public.settings; role text := public.my_role(); t0 timestamptz; t1 timestamptz;
begin
  if role is null then raise exception 'غير مصرح'; end if;
  p_days := greatest(7, least(coalesce(p_days, 30), 730));
  t0 := now() - make_interval(days => p_days);
  t1 := now() - make_interval(days => p_days * 2);
  select * into st from public.settings;
  with vm as (select * from public.visible_mosques() m where p_assoc is null or m.association_id = p_assoc),
  act as (select * from vm where stage = 'active'),
  rp as (select r.*, coalesce((r.data ->> 'date')::timestamptz, r.created_at) as at from public.reports r join vm on vm.id = r.mosque_id),
  sat as (select at, (data ->> 'overall')::numeric v from rp where type = 'satisfaction' and (data ->> 'overall') ~ '^[1-5](\.[0-9]+)?$'),
  tk as (select t.* from public.tasks t where (role in ('admin', 'viewer') or public.can_see_task(t))
           and (p_assoc is null or t.association_id = p_assoc or t.mosque_id in (select id from vm))),
  weeks as (select date_trunc('week', now()) - make_interval(weeks => g) w from generate_series(11, 0, -1) g),
  ord(stage, i) as (values ('selected', 1), ('assigned', 2), ('data_done', 3), ('not_feasible', 3), ('feasible', 4), ('study_done', 5), ('approved', 6), ('active', 7), ('suspended', 7)),
  vmo as (select vm.*, ord.i from vm join ord using (stage))
  select jsonb_build_object(
    'days', p_days, 'generated_at', now(), 'reminder_hours', st.reminder_hours, 'visit_every_days', st.visit_every_days,
    'total', (select count(*) from vm),
    'active', (select count(*) from act),
    'devices', (select coalesce(sum(devices_count), 0) from act),
    'stages', (select coalesce(jsonb_object_agg(stage, n), '{}') from (select stage, count(*) n from vm group by stage) x),
    -- المسار التحويلي: عدد المساجد التي بلغت كل مرحلة أو تجاوزتها
    'funnel', (select jsonb_agg(jsonb_build_object('step', s.i, 'n', (select count(*) from vmo where vmo.i >= s.i)) order by s.i) from generate_series(1, 7) s(i)),
    'data_complete', (select count(*) from vm where coalesce(district, '') <> '' and coalesce(imam_name, '') <> '' and coalesce(imam_phone, '') <> ''
                        and coalesce(muezzin_name, '') <> '' and coalesce(muezzin_phone, '') <> '' and coalesce(servant_name, '') <> '' and coalesce(servant_phone, '') <> ''),
    'refills', (select count(*) from rp where type = 'refill' and at >= t0),
    'refills_prev', (select count(*) from rp where type = 'refill' and at >= t1 and at < t0),
    'visits', (select count(*) from rp where type = 'visit' and at >= t0),
    'visits_prev', (select count(*) from rp where type = 'visit' and at >= t1 and at < t0),
    'installs', (select count(*) from rp where type = 'installation' and at >= t0),
    'installs_prev', (select count(*) from rp where type = 'installation' and at >= t1 and at < t0),
    'sat', (select round(avg(v), 2) from sat where at >= t0),
    'sat_prev', (select round(avg(v), 2) from sat where at >= t1 and at < t0),
    'sat_all', (select round(avg(v), 2) from sat),
    'sat_n', (select count(*) from sat where at >= t0),
    'ratings', (select jsonb_agg(jsonb_build_object('r', g, 'n', (select count(*) from sat where at >= t0 and round(v) = g)) order by g) from generate_series(1, 5) g),
    'ontime_n', (select count(*) from rp where type = 'refill' and at >= t0 and data ? 'due'),
    'ontime_ok', (select count(*) from rp where type = 'refill' and at >= t0 and data ? 'due' and at <= (data ->> 'due')::timestamptz + interval '1 day'),
    'visit_ok', (select count(*) from act where coalesce(last_visit_at, installed_at) >= now() - make_interval(days => st.visit_every_days)),
    'avg_install_days', (select round(avg(greatest(0, extract(epoch from installed_at - created_at) / 86400))) from act where installed_at is not null),
    'alerts', jsonb_build_object(
      'overdue', (select count(*) from act where next_refill_at < now()),
      'due_soon', (select count(*) from act where next_refill_at between now() and now() + make_interval(hours => st.reminder_hours)),
      'visit_overdue', (select count(*) from act where coalesce(last_visit_at, installed_at) < now() - make_interval(days => st.visit_every_days + 1)),
      'pending_approval', (select count(*) from vm where stage = 'study_done'),
      'issues', (select count(*) from rp where type = 'visit' and data ->> 'status' = 'issue' and at >= t0),
      'missing_data', (select count(*) from vm where stage = 'assigned'),
      'not_feasible', (select count(*) from vm where stage = 'not_feasible'),
      'open_tasks', (select count(*) from tk where status in ('open', 'in_progress')),
      'overdue_tasks', (select count(*) from tk where status in ('open', 'in_progress') and due_date < current_date)),
    'weekly', (select jsonb_agg(jsonb_build_object('w', to_char(w, 'YYYY-MM-DD'),
        'visits', (select count(*) from rp where type = 'visit' and at >= w and at < w + interval '7 days'),
        'refills', (select count(*) from rp where type = 'refill' and at >= w and at < w + interval '7 days'),
        'installs', (select count(*) from rp where type = 'installation' and at >= w and at < w + interval '7 days'),
        'sat', (select round(avg(v), 2) from sat where at >= w and at < w + interval '7 days')) order by w) from weeks),
    'upcoming', (select jsonb_agg(jsonb_build_object('d', to_char(d, 'YYYY-MM-DD'),
        'n', (select count(*) from act where (next_refill_at at time zone 'Asia/Riyadh')::date = d::date)) order by d)
        from generate_series((now() at time zone 'Asia/Riyadh')::date, (now() at time zone 'Asia/Riyadh')::date + 13, interval '1 day') d),
    'by_association', (select coalesce(jsonb_agg(x order by (x ->> 'total')::int desc), '[]') from (
        select jsonb_build_object('id', a.id, 'name', a.name,
          'total', count(vm.id),
          'active', count(vm.id) filter (where vm.stage = 'active'),
          'pending', count(vm.id) filter (where vm.stage in ('assigned', 'data_done')),
          'visit_ok', count(vm.id) filter (where vm.stage = 'active' and coalesce(vm.last_visit_at, vm.installed_at) >= now() - make_interval(days => st.visit_every_days)),
          'overdue', count(vm.id) filter (where vm.stage = 'active' and vm.next_refill_at < now()),
          'visits', (select count(*) from rp where rp.type = 'visit' and rp.at >= t0 and rp.mosque_id in (select id from vm v2 where v2.association_id = a.id)),
          'open_tasks', (select count(*) from tk where tk.status in ('open', 'in_progress') and tk.association_id = a.id)
        ) x
        from public.associations a join vm on vm.association_id = a.id group by a.id, a.name) y),
    'assoc_sat', (select coalesce(jsonb_object_agg(association_id, s), '{}') from (
        select vm.association_id, round(avg((r.data ->> 'overall')::numeric), 2) s from rp r join vm on vm.id = r.mosque_id
        where r.type = 'satisfaction' and (r.data ->> 'overall') ~ '^[1-5](\.[0-9]+)?$' and vm.association_id is not null group by 1) z),
    'by_district', (select coalesce(jsonb_agg(jsonb_build_object('district', d, 'total', n, 'active', a) order by n desc, d), '[]') from (
        select coalesce(nullif(district, ''), 'غير محدد') d, count(*) n, count(*) filter (where stage = 'active') a from vm group by 1 order by 2 desc limit 10) z),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('mosque', m.name, 'mosque_id', m.id, 'action', a.action, 'at', a.created_at) order by a.created_at desc), '[]')
        from (select * from public.activity where mosque_id in (select id from vm) order by created_at desc limit 10) a join public.mosques m on m.id = a.mosque_id)
  ) into res;
  return res;
end $$;
revoke execute on function public.dashboard(int, uuid) from public, anon;
grant execute on function public.dashboard(int, uuid) to authenticated;
