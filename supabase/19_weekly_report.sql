-- التقرير الأسبوعي للجمعية مهمة متكررة كل أسبوع في «مهامي» (بدل الظهور قبل الموعد بيومين)
alter table public.settings alter column task_sla set default
  '{"assign": 3, "complete": 7, "feasibility": 7, "study": 10, "decide": 3, "install": 14, "complaint": 2, "assoc_complaint": 3, "monthly": 5, "weekly": 5}';
select set_config('tayyib.bypass', 'on', true);
update public.settings set task_sla = task_sla || '{"weekly": 5}' where not task_sla ? 'weekly';
select set_config('tayyib.bypass', 'off', true);

create or replace function public.tasks_for(p_account uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; st public.settings; sla jsonb; v_out jsonb := '[]';
  ym text := to_char((now() at time zone 'Asia/Riyadh') - interval '1 month', 'YYYY-MM');
  month_due timestamptz;
  -- الأسبوع يبدأ الأحد (بتوقيت الرياض)؛ التقرير الأسبوعي مستحق نهاية اليوم المحدد (الافتراضي الخميس)
  ws_local timestamp := date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '1 day') - interval '1 day';
  ws timestamptz := ws_local at time zone 'Asia/Riyadh';
  week_due timestamptz;
begin
  select * into a from public.accounts where id = p_account and active;
  if not found then return '[]'; end if;
  select * into st from public.settings limit 1;
  sla := coalesce(st.task_sla, '{}');
  week_due := ws + make_interval(days => least(7, greatest(1, coalesce((sla ->> 'weekly')::int, 5))));
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

revoke execute on function public.tasks_for(uuid) from public, anon, authenticated;
