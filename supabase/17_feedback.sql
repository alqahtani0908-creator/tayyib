-- ───────────────────────── الشكاوى والاقتراحات، واستبيان رضا المصلين ─────────────────────────
-- يصل الجمهور عبر باركود المسجد (رمز عام قصير) أو رابط عام، بلا تسجيل دخول، ومن خلال دوال الخادم فقط.

-- رمز عام قصير لكل مسجد (يُطبع في الباركود بدل المعرّف الداخلي)
select set_config('tayyib.bypass', 'on', true);
alter table public.mosques add column if not exists public_token text;
update public.mosques set public_token = upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8)) where public_token is null;
alter table public.mosques alter column public_token set default upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));
alter table public.mosques alter column public_token set not null;
create unique index if not exists mosques_public_token_idx on public.mosques (public_token);

-- رابط داخل المنصة لبعض الإشعارات (مثل فتح الشكوى مباشرة)
alter table public.notifications add column if not exists link text;

-- بصمة مختصرة لعنوان الزائر (للحد من الإرسال المتكرر دون حفظ العنوان نفسه)
create or replace function public.client_fingerprint() returns text
language sql stable security definer set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), 'unknown') || ':tayyib', 'sha256'), 'hex')
$$;

-- ───── الشكاوى ─────
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  ref bigint generated always as identity,
  mosque_id uuid references public.mosques(id) on delete set null,
  kind text not null default 'complaint' check (kind in ('complaint', 'suggestion')),
  name text check (length(name) <= 80),
  phone text check (length(phone) <= 20),
  body text not null check (length(body) between 5 and 2000),
  status text not null default 'new' check (status in ('new', 'assigned', 'responded', 'closed')),
  action text check (action in ('contact', 'dismiss', 'fix', 'other')),
  association_id uuid references public.associations(id) on delete set null,
  source text not null default 'qr',
  fp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists complaints_created_idx on public.complaints (created_at desc);
create index if not exists complaints_mosque_idx on public.complaints (mosque_id);
create index if not exists complaints_assoc_idx on public.complaints (association_id);

create table if not exists public.complaint_events (
  id bigint generated always as identity primary key,
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  actor_id uuid references public.accounts(id) on delete set null,
  actor_role text,
  kind text not null check (kind in ('created', 'action', 'note', 'assigned', 'response', 'closed', 'reopened')),
  action text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists complaint_events_idx on public.complaint_events (complaint_id, created_at);

alter table public.complaints enable row level security;
alter table public.complaint_events enable row level security;
drop policy if exists complaints_read on public.complaints;
create policy complaints_read on public.complaints for select to authenticated
  using (public.my_role() = 'admin' or (public.my_role() = 'association' and association_id = public.my_assoc()));
drop policy if exists complaint_events_read on public.complaint_events;
create policy complaint_events_read on public.complaint_events for select to authenticated
  using (exists (select 1 from public.complaints c where c.id = complaint_id));

-- إشعار حسابات صلاحية معينة برابط مباشر
create or replace function public.notify_link(p_role text, p_assoc uuid, p_mosque uuid, p_title text, p_body text, p_kind text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (account_id, kind, title, body, mosque_id, link)
  select a.id, p_kind, p_title, p_body, p_mosque, p_link from public.accounts a
  where a.active and a.role = p_role and (p_role <> 'association' or a.association_id = p_assoc)
    and a.id is distinct from public.my_id()
$$;

-- بيانات المسجد العامة من رمز الباركود
create or replace function public.public_mosque(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('token', m.public_token, 'name', m.name, 'district', m.district, 'region', m.region)
  from public.mosques m where m.public_token = upper(trim(p_token))
$$;

-- إرسال شكوى أو اقتراح من الجمهور
create or replace function public.submit_complaint(p_token text, p_kind text, p_name text, p_phone text, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare m public.mosques; c public.complaints; v_fp text := public.client_fingerprint(); ph text;
begin
  select * into m from public.mosques where public_token = upper(trim(coalesce(p_token, '')));
  if not found then raise exception 'رمز المسجد غير صحيح'; end if;
  if length(trim(coalesce(p_body, ''))) < 5 then raise exception 'اكتب وصف المشكلة أو الاقتراح'; end if;
  if (select count(*) from public.complaints x where x.fp = v_fp and x.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'تم استلام عدة رسائل منك خلال وقت قصير، حاول لاحقًا';
  end if;
  ph := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  insert into public.complaints (mosque_id, kind, name, phone, body, fp, association_id)
  values (m.id, case when p_kind = 'suggestion' then 'suggestion' else 'complaint' end, nullif(left(trim(coalesce(p_name, '')), 80), ''), left(ph, 20), left(trim(p_body), 2000), v_fp, null)
  returning * into c;
  insert into public.complaint_events (complaint_id, kind, note) values (c.id, 'created', null);
  perform public.notify_link('admin', null, m.id, (case when c.kind = 'suggestion' then 'اقتراح جديد' else 'شكوى جديدة' end) || ' — ' || m.name, left(c.body, 140), 'alert', '/complaints/' || c.id);
  return c.ref;
end $$;

-- إجراء مدير النظام: تواصل / صرف نظر / تعديل / أخرى، مع ملاحظة، وتوجيه للجمعية أو إغلاق
create or replace function public.complaint_act(p_id uuid, p_action text, p_note text, p_assoc uuid default null, p_close boolean default false, p_reopen boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare c public.complaints; m public.mosques;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'صلاحية المدير فقط'; end if;
  select * into c from public.complaints where id = p_id for update;
  if not found then raise exception 'الشكوى غير موجودة'; end if;
  select * into m from public.mosques where id = c.mosque_id;
  if p_action is not null and p_action not in ('contact', 'dismiss', 'fix', 'other') then raise exception 'إجراء غير معروف'; end if;
  if p_reopen then
    update public.complaints set status = case when association_id is not null then 'assigned' else 'new' end, closed_at = null, updated_at = now() where id = p_id;
    insert into public.complaint_events (complaint_id, actor_id, actor_role, kind, note) values (p_id, public.my_id(), 'admin', 'reopened', nullif(trim(p_note), ''));
    return;
  end if;
  if p_action is not null or nullif(trim(p_note), '') is not null then
    update public.complaints set action = coalesce(p_action, action), updated_at = now() where id = p_id;
    insert into public.complaint_events (complaint_id, actor_id, actor_role, kind, action, note)
    values (p_id, public.my_id(), 'admin', case when p_action is null then 'note' else 'action' end, p_action, nullif(trim(p_note), ''));
  end if;
  if p_assoc is not null then
    update public.complaints set association_id = p_assoc, status = 'assigned', updated_at = now() where id = p_id;
    insert into public.complaint_events (complaint_id, actor_id, actor_role, kind, note)
    values (p_id, public.my_id(), 'admin', 'assigned', (select name from public.associations where id = p_assoc));
    perform public.notify_link('association', p_assoc, c.mosque_id, 'شكوى موجّهة لجمعيتكم — ' || coalesce(m.name, ''), coalesce(nullif(trim(p_note), ''), left(c.body, 140)), 'alert', '/complaints/' || c.id);
  end if;
  if p_close then
    update public.complaints set status = 'closed', closed_at = now(), updated_at = now() where id = p_id;
    insert into public.complaint_events (complaint_id, actor_id, actor_role, kind) values (p_id, public.my_id(), 'admin', 'closed');
  end if;
end $$;

-- رد الجمعية على الشكوى الموجهة لها
create or replace function public.complaint_respond(p_id uuid, p_note text, p_done boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare c public.complaints; m public.mosques;
begin
  select * into c from public.complaints where id = p_id for update;
  if not found or public.my_role() is distinct from 'association' or c.association_id is distinct from public.my_assoc() then raise exception 'غير مصرح'; end if;
  if c.status = 'closed' then raise exception 'الشكوى مغلقة'; end if;
  if length(trim(coalesce(p_note, ''))) < 2 then raise exception 'اكتب ردّ الجمعية'; end if;
  select * into m from public.mosques where id = c.mosque_id;
  insert into public.complaint_events (complaint_id, actor_id, actor_role, kind, note) values (p_id, public.my_id(), 'association', 'response', trim(p_note));
  update public.complaints set status = case when p_done then 'responded' else status end, updated_at = now() where id = p_id;
  perform public.notify_link('admin', null, c.mosque_id, (case when p_done then 'أنهت الجمعية التعامل مع شكوى — ' else 'ردّ الجمعية على شكوى — ' end) || coalesce(m.name, ''), left(trim(p_note), 140), 'report', '/complaints/' || c.id);
end $$;

-- ───── استبيان رضا المصلين ─────
create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  intro text,
  thanks text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  ord int not null default 0,
  text text not null,
  kind text not null default 'rating' check (kind in ('rating', 'choice', 'yesno', 'text')),
  weight numeric not null default 1 check (weight >= 0 and weight <= 100),
  required boolean not null default true,
  options jsonb not null default '[]' -- [{label, score}] للاختيار ونعم/لا
);
create index if not exists survey_questions_idx on public.survey_questions (survey_id, ord);
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  mosque_id uuid references public.mosques(id) on delete set null,
  answers jsonb not null,
  pct numeric,
  fp text,
  created_at timestamptz not null default now()
);
create index if not exists survey_responses_idx on public.survey_responses (survey_id, created_at desc);
create index if not exists survey_responses_mosque_idx on public.survey_responses (mosque_id);

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
drop policy if exists surveys_read on public.surveys;
create policy surveys_read on public.surveys for select to authenticated using (public.my_role() is not null);
drop policy if exists surveys_write on public.surveys;
create policy surveys_write on public.surveys for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
drop policy if exists survey_q_read on public.survey_questions;
create policy survey_q_read on public.survey_questions for select to authenticated using (public.my_role() is not null);
drop policy if exists survey_q_write on public.survey_questions;
create policy survey_q_write on public.survey_questions for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
drop policy if exists survey_r_read on public.survey_responses;
create policy survey_r_read on public.survey_responses for select to authenticated
  using (public.my_role() in ('admin', 'viewer') or (public.my_role() = 'association' and exists (select 1 from public.mosques m where m.id = mosque_id and m.association_id = public.my_assoc())));

-- الاستبيان للجمهور: الأسئلة والخيارات دون الدرجات
create or replace function public.public_survey(p_id uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'title', s.title, 'intro', s.intro, 'thanks', s.thanks,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'kind', q.kind, 'required', q.required,
        'options', (select coalesce(jsonb_agg(o ->> 'label' order by i), '[]') from jsonb_array_elements(q.options) with ordinality t(o, i)))
      order by q.ord, q.text) from public.survey_questions q where q.survey_id = s.id), '[]'))
  from public.surveys s where s.active and (p_id is null or s.id = p_id)
  order by s.created_at desc limit 1
$$;

-- قائمة المساجد المشمولة (المركّبة) لتضييق الاختيار: الجهة ← الحي ← المسجد
create or replace function public.public_places() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('t', public_token, 'n', name, 'd', coalesce(nullif(district, ''), 'غير محدد'), 'r', region) order by name), '[]')
  from public.mosques where stage = 'active'
$$;

-- حساب نسبة الرضا لإجابة: مجموع (الوزن × الدرجة ÷ أعلى درجة) ÷ مجموع أوزان الأسئلة المُجابة × 100
create or replace function public.submit_survey(p_survey uuid, p_token text, p_answers jsonb) returns numeric
language plpgsql security definer set search_path = public as $$
declare s public.surveys; m public.mosques; q record; a jsonb; v jsonb; sc numeric; mx numeric; num numeric := 0; den numeric := 0;
  v_out jsonb := '[]'; v_fp text := public.client_fingerprint(); v_pct numeric;
begin
  select * into s from public.surveys where id = p_survey and active;
  if not found then raise exception 'الاستبيان غير متاح'; end if;
  select * into m from public.mosques where public_token = upper(trim(coalesce(p_token, '')));
  if not found then raise exception 'اختر المسجد'; end if;
  if (select count(*) from public.survey_responses x where x.fp = v_fp and x.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'تم استلام عدة إجابات منك خلال وقت قصير، شكرًا لك';
  end if;
  for q in select * from public.survey_questions where survey_id = s.id order by ord loop
    a := null;
    select e.value into a from jsonb_array_elements(coalesce(p_answers, '[]')) e where e.value ->> 'q' = q.id::text limit 1;
    v := a -> 'v';
    if v is null or v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '') then
      if q.required then raise exception 'أجب عن السؤال: %', q.text; end if;
      continue;
    end if;
    sc := null; mx := null;
    if q.kind = 'rating' then
      sc := least(5, greatest(1, (v #>> '{}')::numeric)); mx := 5;
      v_out := v_out || jsonb_build_object('q', q.id, 'v', sc, 'score', sc, 'max', mx);
    elsif q.kind in ('choice', 'yesno') then
      if (v #>> '{}')::int < 0 or (v #>> '{}')::int >= jsonb_array_length(q.options) then raise exception 'إجابة غير صحيحة'; end if;
      sc := coalesce((q.options -> (v #>> '{}')::int ->> 'score')::numeric, 0);
      select max((o ->> 'score')::numeric) into mx from jsonb_array_elements(q.options) o;
      v_out := v_out || jsonb_build_object('q', q.id, 'v', (v #>> '{}')::int, 'label', q.options -> (v #>> '{}')::int ->> 'label', 'score', sc, 'max', mx);
    else
      v_out := v_out || jsonb_build_object('q', q.id, 'v', left(v #>> '{}', 1000));
    end if;
    if sc is not null and coalesce(mx, 0) > 0 and q.weight > 0 then num := num + q.weight * sc / mx; den := den + q.weight; end if;
  end loop;
  v_pct := case when den > 0 then round(num / den * 100, 1) end;
  insert into public.survey_responses (survey_id, mosque_id, answers, pct, fp) values (s.id, m.id, v_out, v_pct, v_fp);
  return v_pct;
end $$;

-- نتائج الاستبيان حسب صلاحية المستخدم
create or replace function public.survey_results(p_survey uuid, p_days int default 90) returns jsonb
language sql stable security definer set search_path = public as $$
  with rs as (
    select r.* from public.survey_responses r join public.mosques m on m.id = r.mosque_id
    where r.survey_id = p_survey and r.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 3650)))
      and (public.my_role() in ('admin', 'viewer') or (public.my_role() = 'association' and m.association_id = public.my_assoc()))
  ), ans as (select rs.mosque_id, e.value x from rs, jsonb_array_elements(rs.answers) e)
  select jsonb_build_object(
    'n', (select count(*) from rs),
    'pct', (select round(avg(pct), 1) from rs),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('w', to_char(w, 'YYYY-MM-DD'), 'n', n, 'pct', p) order by w), '[]') from (
        select date_trunc('week', created_at) w, count(*) n, round(avg(pct), 1) p from rs group by 1) z),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'kind', q.kind, 'weight', q.weight, 'options', q.options,
        'n', (select count(*) from ans where ans.x ->> 'q' = q.id::text),
        'pct', (select round(avg((ans.x ->> 'score')::numeric / nullif((ans.x ->> 'max')::numeric, 0)) * 100, 1) from ans where ans.x ->> 'q' = q.id::text and ans.x ? 'score'),
        'dist', (select coalesce(jsonb_object_agg(k, c), '{}') from (select ans.x ->> 'v' k, count(*) c from ans where ans.x ->> 'q' = q.id::text and q.kind <> 'text' group by 1) d),
        'texts', (select coalesce(jsonb_agg(t.x ->> 'v'), '[]') from (select ans.x from ans where ans.x ->> 'q' = q.id::text and q.kind = 'text' limit 30) t)
      ) order by q.ord), '[]') from public.survey_questions q where q.survey_id = p_survey),
    'mosques', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'district', m.district, 'region', m.region, 'n', z.n, 'pct', z.p) order by z.p desc nulls last), '[]')
      from (select mosque_id, count(*) n, round(avg(pct), 1) p from rs group by 1) z join public.mosques m on m.id = z.mosque_id)
  )
$$;

revoke execute on function public.client_fingerprint(), public.notify_link(text, uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.public_mosque(text), public.submit_complaint(text, text, text, text, text), public.public_survey(uuid), public.public_places(), public.submit_survey(uuid, text, jsonb) to anon, authenticated;
revoke execute on function public.complaint_act(uuid, text, text, uuid, boolean, boolean), public.complaint_respond(uuid, text, boolean), public.survey_results(uuid, int) from public, anon;
grant execute on function public.complaint_act(uuid, text, text, uuid, boolean, boolean), public.complaint_respond(uuid, text, boolean), public.survey_results(uuid, int) to authenticated;
select set_config('tayyib.bypass', 'off', true);
