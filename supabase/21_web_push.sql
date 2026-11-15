-- ───────────────────────── إشعارات الجوال (Web Push) للمنصة المثبّتة كتطبيق ─────────────────────────
-- كل إشعار يُضاف في المنصة يُرسل أيضًا لأجهزة صاحبه المشتركة، عبر الدالة الطرفية push (Edge Function).
-- مفاتيح VAPID تُولَّد داخل الدالة الطرفية أول مرة وتُحفظ في Vault، فلا يخرج المفتاح الخاص من الخادم.
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  last_error text
);
create index if not exists push_subs_account on public.push_subscriptions (account_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for select using (account_id = public.my_id());
revoke all on public.push_subscriptions from anon;
revoke insert, update, delete on public.push_subscriptions from authenticated;
grant select on public.push_subscriptions to authenticated;

-- سر يربط المشغّل بالدالة الطرفية (يُولَّد داخل قاعدة البيانات)
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'push_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'push_hook_secret', 'سر استدعاء دالة إشعارات الجوال');
  end if;
end $$;

-- إعدادات الدالة الطرفية (لدور الخدمة فقط)
create or replace function public.push_config() returns jsonb
language sql stable security definer set search_path = public, vault as $$
  select jsonb_build_object(
    'public_key', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public'),
    'private_key', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private'),
    'hook_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_hook_secret'),
    'subject', 'https://tiyb.saom.sa')
$$;
create or replace function public.push_store_keys(p_public text, p_private text) returns void
language plpgsql security definer set search_path = public, vault as $$
begin
  if exists (select 1 from vault.secrets where name = 'push_vapid_public') then return; end if;
  perform vault.create_secret(p_public, 'push_vapid_public', 'VAPID public key');
  perform vault.create_secret(p_private, 'push_vapid_private', 'VAPID private key');
end $$;
-- المفتاح العام (يحتاجه المتصفح للاشتراك)
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public'
$$;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_device text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_id();
begin
  if me is null then raise exception 'غير مصرح'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then raise exception 'اشتراك غير صالح'; end if;
  insert into public.push_subscriptions (account_id, endpoint, p256dh, auth, device)
  values (me, p_endpoint, p_p256dh, p_auth, left(p_device, 120))
  on conflict (endpoint) do update set account_id = excluded.account_id, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, last_error = null;
end $$;
create or replace function public.push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and account_id = public.my_id()
$$;
-- إشعار تجريبي لصاحب الحساب
create or replace function public.push_test() returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_id() is null then raise exception 'غير مصرح'; end if;
  insert into public.notifications (account_id, kind, title, body, link)
  values (public.my_id(), 'info', 'تم تفعيل إشعارات الجوال ✓', 'ستصلك تنبيهات منصة طيب على هذا الجهاز حتى والتطبيق مغلق.', '/my');
end $$;

-- إرسال كل إشعار جديد للأجهزة المشتركة
create or replace function public.push_on_notification() returns trigger
language plpgsql security definer set search_path = public, vault, net as $$
declare s text;
begin
  if not exists (select 1 from public.push_subscriptions where account_id = new.account_id) then return new; end if;
  select decrypted_secret into s from vault.decrypted_secrets where name = 'push_hook_secret';
  perform net.http_post(
    url := 'https://ffgtvivvivxhszxxmrnw.supabase.co/functions/v1/push',
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', s),
    timeout_milliseconds := 8000);
  return new;
exception when others then
  return new; -- لا يتعطل إنشاء الإشعار إن تعذّر الإرسال
end $$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications for each row execute function public.push_on_notification();

-- تهيئة المفاتيح: استدعاء الدالة الطرفية مرة واحدة
create or replace function public.push_init() returns bigint
language sql security definer set search_path = public, vault, net as $$
  select net.http_post(
    url := 'https://ffgtvivvivxhszxxmrnw.supabase.co/functions/v1/push',
    body := '{"init": true}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_hook_secret')))
$$;

revoke execute on function public.push_config(), public.push_store_keys(text, text), public.push_on_notification(), public.push_init() from public, anon, authenticated;
grant execute on function public.push_config(), public.push_store_keys(text, text) to service_role;
revoke execute on function public.push_public_key(), public.push_subscribe(text, text, text, text), public.push_unsubscribe(text), public.push_test() from public, anon;
grant execute on function public.push_public_key(), public.push_subscribe(text, text, text, text), public.push_unsubscribe(text), public.push_test() to authenticated;
