-- نقاط المساجد على الخريطة: إضافة الرمز وموعد التعبئة القادمة (لإبراز التعبئات المتأخرة) دون أي بيانات تواصل
drop function if exists public.map_data();
create function public.map_data() returns table (id uuid, code text, name text, district text, region text, stage text, association_id uuid, devices_count int, map_url text, next_refill_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.code, m.name, m.district, m.region, m.stage, m.association_id, m.devices_count, m.map_url, m.next_refill_at
  from public.visible_mosques() m where public.my_role() is not null
$$;
revoke execute on function public.map_data() from public, anon;
grant execute on function public.map_data() to authenticated;
