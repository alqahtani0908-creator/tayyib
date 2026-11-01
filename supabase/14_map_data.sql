-- بيانات خريطة الأحياء: حقول العرض فقط (بلا أرقام جوالات) لكل المساجد المرئية للدور، ومنها حساب العرض
create or replace function public.map_data() returns table (id uuid, name text, district text, stage text, association_id uuid, devices_count int, map_url text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.district, m.stage, m.association_id, m.devices_count, m.map_url
  from public.visible_mosques() m where public.my_role() is not null
$$;
revoke execute on function public.map_data() from public, anon;
grant execute on function public.map_data() to authenticated;
