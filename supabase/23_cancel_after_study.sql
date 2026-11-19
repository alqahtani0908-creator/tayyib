-- ═════ إلغاء المسجد بعد دراسة الاحتياج (قرار مدير النظام) ═════
-- مرحلة جديدة cancelled «ملغى بعد الدراسة»: تتوقف عندها المهام، ويبقى المسجد وتقاريره للرجوع إليها،
-- ويمكن للمدير إعادته لأي مرحلة من «إجراءات المدير» (set_stage).

alter table public.mosques drop constraint if exists mosques_stage_check;
alter table public.mosques add constraint mosques_stage_check check (stage in
  ('selected', 'assigned', 'data_done', 'feasible', 'not_feasible', 'study_done', 'approved', 'active', 'suspended', 'cancelled'));

-- الشركة أجرت الدراسة فتبقى ترى المسجد الملغى
create or replace function public.company_stage(s text) returns boolean
language sql immutable set search_path = public as $$ select s in ('feasible', 'study_done', 'approved', 'active', 'suspended', 'cancelled') $$;

create or replace function public.stage_label(s text) returns text
language sql immutable set search_path = public as $$
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
    when 'cancelled' then 'ملغى بعد الدراسة'
    else s end
$$;

-- المؤشرات: الملغى وصل لمرحلة الدراسة في القمع
do $$
declare d text;
begin
  select pg_get_functiondef('public.dashboard(integer, uuid)'::regprocedure) into d;
  if position('(''cancelled''' in d) = 0 then
    d := replace(d, '(''active'', 7), (''suspended'', 7))', '(''active'', 7), (''suspended'', 7), (''cancelled'', 5))');
    if position('(''cancelled'', 5)' in d) = 0 then raise exception 'dashboard: stage order not found'; end if;
    execute d;
  end if;
end $$;

create or replace function public.cancel_mosque(p_mosque uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.mosques; why text := nullif(trim(p_reason), '');
begin
  if public.my_role() is distinct from 'admin' then raise exception 'الإلغاء من صلاحية مدير النظام'; end if;
  if why is null then raise exception 'اكتب سبب الإلغاء'; end if;
  select * into m from public.mosques where id = p_mosque for update;
  if not found then raise exception 'المسجد غير موجود'; end if;
  if m.stage <> 'study_done' then raise exception 'الإلغاء متاح بعد رفع دراسة الاحتياج وقبل الاعتماد'; end if;
  insert into public.reports (mosque_id, type, data, summary, author_id, author_role)
  values (p_mosque, 'decision', jsonb_build_object('approved', false, 'cancelled', true, 'note', why), 'إلغاء المسجد — ' || why, public.my_id(), 'admin');
  perform set_config('tayyib.bypass', 'on', true);
  update public.mosques set stage = 'cancelled' where id = p_mosque;
  perform public.log_activity(p_mosque, 'إلغاء المسجد بعد دراسة الاحتياج', why);
  perform public.notify('company', null, p_mosque, 'أُلغي المسجد بعد الدراسة: ' || m.name, why, 'alert');
  perform public.notify('association', m.association_id, p_mosque, 'أُلغي المسجد بعد الدراسة: ' || m.name, why, 'stage');
  perform set_config('tayyib.bypass', 'off', true);
end $$;

revoke execute on function public.cancel_mosque(uuid, text) from public, anon;
grant execute on function public.cancel_mosque(uuid, text) to authenticated;
