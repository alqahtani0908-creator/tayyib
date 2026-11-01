-- تفعيل الحساب من الخادم برمز التفعيل: ينشئ مستخدم الدخول مؤكدًا مباشرة دون رسالة بريد
-- (لا يعتمد على إعداد «Confirm email» ولا على حد إرسال البريد في Supabase)
create or replace function public.activate_account(p_email text, p_code text, p_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare a public.accounts; em text := lower(trim(p_email)); u auth.users; uid uuid;
begin
  if length(coalesce(p_password, '')) < 8 then raise exception 'كلمة المرور ٨ أحرف على الأقل'; end if;
  select * into a from public.accounts where email = em and active;
  if not found or upper(trim(coalesce(p_code, ''))) <> a.invite_code then
    raise exception 'البريد أو رمز التفعيل غير صحيح';
  end if;
  if a.user_id is not null then raise exception 'هذا الحساب مفعّل مسبقًا — سجّل الدخول، أو اطلب من المدير إعادة تعيين الدخول'; end if;

  select * into u from auth.users where lower(email) = em;
  if found then
    -- مستخدم سابق غير مرتبط بحساب (مثل تسجيل لم يُؤكَّد): نعتمد كلمة المرور الجديدة ونؤكده
    uid := u.id;
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now(),
      confirmation_token = '', recovery_token = ''
    where id = uid;
  else
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
      crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '');
  end if;
  if not exists (select 1 from auth.identities where user_id = uid and provider = 'email') then
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now());
  end if;

  perform set_config('tayyib.bypass', 'on', true);
  update public.accounts set user_id = uid, claimed_at = now() where id = a.id;
  perform set_config('tayyib.bypass', 'off', true);
end $$;
revoke execute on function public.activate_account(text, text, text) from public;
grant execute on function public.activate_account(text, text, text) to anon, authenticated;
