-- مقارنات لوحة المؤشرات: الفترة الحالية مقابل السابقة، الأشهر الستة، الجمعيات، الجهات، الأحياء
create or replace function public.dashboard_compare(p_days int default 30, p_assoc uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb; st public.settings; role text := public.my_role(); t0 timestamptz; t1 timestamptz;
begin
  if role is null then raise exception 'غير مصرح'; end if;
  p_days := greatest(7, least(coalesce(p_days, 30), 730));
  t0 := now() - make_interval(days => p_days);
  t1 := now() - make_interval(days => p_days * 2);
  select * into st from public.settings;
  with vm as (select * from public.visible_mosques() m where p_assoc is null or m.association_id = p_assoc),
  rp as (select r.*, vm.association_id, coalesce(nullif(vm.district, ''), 'غير محدد') district,
           coalesce((r.data ->> 'date')::timestamptz, r.created_at) as at
         from public.reports r join vm on vm.id = r.mosque_id),
  sat as (select *, (data ->> 'overall')::numeric v from rp where type = 'satisfaction' and (data ->> 'overall') ~ '^[1-5](\.[0-9]+)?$'),
  months as (select date_trunc('month', now()) - make_interval(months => g) m from generate_series(5, 0, -1) g),
  per(k, a, b) as (values ('cur', t0, now() + interval '1 day'), ('prev', t1, t0))
  select jsonb_build_object(
    -- الفترة الحالية مقابل السابقة
    'periods', (select jsonb_object_agg(k, jsonb_build_object(
        'refills', (select count(*) from rp where type = 'refill' and at >= a and at < b),
        'visits', (select count(*) from rp where type = 'visit' and at >= a and at < b),
        'installs', (select count(*) from rp where type = 'installation' and at >= a and at < b),
        'issues', (select count(*) from rp where type = 'visit' and data ->> 'status' = 'issue' and at >= a and at < b),
        'monthly_reports', (select count(*) from rp where type = 'monthly' and at >= a and at < b),
        'new_mosques', (select count(*) from vm where created_at >= a and created_at < b),
        'sat', (select round(avg(v), 2) from sat where at >= a and at < b),
        'sat_n', (select count(*) from sat where at >= a and at < b),
        'ontime_n', (select count(*) from rp where type = 'refill' and at >= a and at < b and data ? 'due'),
        'ontime_ok', (select count(*) from rp where type = 'refill' and at >= a and at < b and data ? 'due' and at <= (data ->> 'due')::timestamptz + interval '1 day')
      )) from per),
    -- آخر ستة أشهر
    'monthly', (select jsonb_agg(jsonb_build_object('m', to_char(m, 'YYYY-MM'),
        'visits', (select count(*) from rp where type = 'visit' and at >= m and at < m + interval '1 month'),
        'refills', (select count(*) from rp where type = 'refill' and at >= m and at < m + interval '1 month'),
        'installs', (select count(*) from rp where type = 'installation' and at >= m and at < m + interval '1 month'),
        'sat', (select round(avg(v), 2) from sat where at >= m and at < m + interval '1 month')) order by m) from months),
    -- مقارنة الجمعيات في الفترتين
    'assoc', (select coalesce(jsonb_agg(x order by x ->> 'name'), '[]') from (
        select jsonb_build_object('id', a.id, 'name', a.name,
          'total', (select count(*) from vm where association_id = a.id),
          'active', (select count(*) from vm where association_id = a.id and stage = 'active'),
          'visit_ok', (select count(*) from vm where association_id = a.id and stage = 'active'
                         and coalesce(last_visit_at, installed_at) >= now() - make_interval(days => st.visit_every_days)),
          'visits', (select count(*) from rp where association_id = a.id and type = 'visit' and at >= t0),
          'visits_prev', (select count(*) from rp where association_id = a.id and type = 'visit' and at >= t1 and at < t0),
          'refills', (select count(*) from rp where association_id = a.id and type = 'refill' and at >= t0),
          'refills_prev', (select count(*) from rp where association_id = a.id and type = 'refill' and at >= t1 and at < t0),
          'issues', (select count(*) from rp where association_id = a.id and type = 'visit' and data ->> 'status' = 'issue' and at >= t0),
          'sat', (select round(avg(v), 2) from sat where association_id = a.id and at >= t0),
          'sat_prev', (select round(avg(v), 2) from sat where association_id = a.id and at >= t1 and at < t0),
          'sat_all', (select round(avg(v), 2) from sat where association_id = a.id)
        ) x
        from public.associations a where exists (select 1 from vm where vm.association_id = a.id)) y),
    -- مقارنة الجهات (شمال، جنوب، شرق، غرب، وسط)
    'region', (select coalesce(jsonb_agg(x order by x ->> 'k'), '[]') from (
        select jsonb_build_object('k', g, 'total', count(*), 'active', count(*) filter (where stage = 'active'),
          'visits', (select count(*) from rp join vm v2 on v2.id = rp.mosque_id where coalesce(v2.region, '') = z.g and rp.type = 'visit' and rp.at >= t0),
          'refills', (select count(*) from rp join vm v2 on v2.id = rp.mosque_id where coalesce(v2.region, '') = z.g and rp.type = 'refill' and rp.at >= t0),
          'sat', (select round(avg(sat.v), 2) from sat join vm v2 on v2.id = sat.mosque_id where coalesce(v2.region, '') = z.g)) x
        from (select coalesce(region, '') g, stage from vm) z group by g) y),
    -- مقارنة الأحياء
    'district', (select coalesce(jsonb_agg(x order by (x ->> 'total')::int desc), '[]') from (
        select jsonb_build_object('district', d,
          'total', count(*), 'active', count(*) filter (where stage = 'active'),
          'visits', (select count(*) from rp where rp.district = z.d and type = 'visit' and at >= t0),
          'sat', (select round(avg(v), 2) from sat where sat.district = z.d)) x
        from (select coalesce(nullif(district, ''), 'غير محدد') d, stage from vm) z group by d order by count(*) desc limit 12) y)
  ) into res;
  return res;
end $$;
revoke execute on function public.dashboard_compare(int, uuid) from public, anon;
grant execute on function public.dashboard_compare(int, uuid) to authenticated;
