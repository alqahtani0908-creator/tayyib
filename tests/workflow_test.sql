-- اختبار المسار كاملًا بانتحال كل دور — يُنفّذ داخل معاملة ويُتراجع عنه
begin;
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','t-admin@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b1','assoc@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c1','co@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d1','view@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e1','other@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f1','stranger@test.local','authenticated','authenticated');
insert into public.associations (id, name) values ('00000000-0000-0000-0000-00000000aaaa','جمعية اختبار'),('00000000-0000-0000-0000-00000000bbbb','جمعية أخرى');
insert into public.accounts (name,email,role,association_id,invite_code) values
 ('مدير','t-admin@test.local','admin',null,'AAAA1111'),
 ('ج','assoc@test.local','association','00000000-0000-0000-0000-00000000aaaa','BBBB1111'),
 ('ش','co@test.local','company',null,'CCCC1111'),('ع','view@test.local','viewer',null,'DDDD1111'),
 ('أخرى','other@test.local','association','00000000-0000-0000-0000-00000000bbbb','EEEE1111');

create function pg_temp.t(who text, q text) returns text language plpgsql as $f$
declare uid text; em text; res text;
begin
  select u.id::text, u.email into uid, em from auth.users u where u.email = who;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', em, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q into res;
    res := 'OK ' || coalesce(res, '');
  exception when others then res := 'ERR ' || sqlerrm;
  end;
  execute 'reset role';
  return res;
end $f$;

create temp table out (n serial, step text, result text);
insert into out (step, result) values
 ('claim wrong code', pg_temp.t('assoc@test.local', $$select (public.claim_account('XXXX')).role$$)),
 ('claim admin', pg_temp.t('t-admin@test.local', $$select (public.claim_account('aaaa1111')).role$$)),
 ('claim assoc', pg_temp.t('assoc@test.local', $$select (public.claim_account('BBBB1111')).role$$)),
 ('claim co', pg_temp.t('co@test.local', $$select (public.claim_account('CCCC1111')).role$$)),
 ('claim viewer', pg_temp.t('view@test.local', $$select (public.claim_account('DDDD1111')).role$$)),
 ('claim other', pg_temp.t('other@test.local', $$select (public.claim_account('EEEE1111')).role$$)),
 ('stranger claim', pg_temp.t('stranger@test.local', $$select (public.claim_account('AAAA1111')).role$$)),
 ('stranger sees mosques', pg_temp.t('stranger@test.local', $$select count(*)::text from public.mosques$$)),
 ('assoc self-link hack', pg_temp.t('assoc@test.local', $$update public.accounts set role='admin' where email='assoc@test.local' returning role$$)),
 ('admin adds mosque', pg_temp.t('t-admin@test.local', $$insert into public.mosques (id,name,district) values ('00000000-0000-0000-0000-00000000c001'::uuid,'جامع الاختبار','العليا') returning code$$)),
 ('assoc insert mosque', pg_temp.t('assoc@test.local', $$insert into public.mosques (name) values ('x') returning code$$));
insert into out (step, result) values
 ('assoc sees before assign', pg_temp.t('assoc@test.local', $$select count(*)::text from public.mosques$$)),
 ('assoc assign attempt', pg_temp.t('assoc@test.local', $$select public.assign_mosques(array['00000000-0000-0000-0000-00000000c001'::uuid],'00000000-0000-0000-0000-00000000aaaa')::text$$)),
 ('admin assign', pg_temp.t('t-admin@test.local', $$select public.assign_mosques(array['00000000-0000-0000-0000-00000000c001'::uuid],'00000000-0000-0000-0000-00000000aaaa')::text$$)),
 ('assoc sees after', pg_temp.t('assoc@test.local', $$select stage from public.mosques$$)),
 ('other assoc sees', pg_temp.t('other@test.local', $$select count(*)::text from public.mosques$$)),
 ('company sees (assigned)', pg_temp.t('co@test.local', $$select count(*)::text from public.mosques$$)),
 ('assoc notified', pg_temp.t('assoc@test.local', $$select count(*)::text from public.notifications$$)),
 ('complete incomplete', pg_temp.t('assoc@test.local', $$select public.complete_data('00000000-0000-0000-0000-00000000c001')::text$$)),
 ('assoc stage hack', pg_temp.t('assoc@test.local', $$update public.mosques set stage='active' returning stage$$)),
 ('assoc fills data', pg_temp.t('assoc@test.local', $$update public.mosques set imam_name='أحمد',imam_phone='0500000001',muezzin_name='خالد',muezzin_phone='0500000002',servant_name='سعيد',servant_phone='0500000003' returning imam_name$$)),
 ('complete data', pg_temp.t('assoc@test.local', $$select public.complete_data('00000000-0000-0000-0000-00000000c001')::text$$)),
 ('company study too early', pg_temp.t('co@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','needs_study','{}')).type$$)),
 ('feasibility', pg_temp.t('assoc@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','feasibility','{"result":"yes"}','الإمام موافق')).type$$)),
 ('company sees now', pg_temp.t('co@test.local', $$select stage from public.mosques$$)),
 ('company phones visible', pg_temp.t('co@test.local', $$select imam_phone from public.mosques$$)),
 ('company notified', pg_temp.t('co@test.local', $$select string_agg(title, ' | ') from public.notifications$$)),
 ('company edits name', pg_temp.t('co@test.local', $$update public.mosques set name='x' returning name$$)),
 ('company plans install', pg_temp.t('co@test.local', $$update public.mosques set planned_install_at='2026-11-01' returning planned_install_at::text$$)),
 ('needs study', pg_temp.t('co@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','needs_study','{"devices":4}','٤ أجهزة')).type$$)),
 ('install before approval', pg_temp.t('co@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','installation','{}')).type$$)),
 ('company self-approve', pg_temp.t('co@test.local', $$select public.decide_study('00000000-0000-0000-0000-00000000c001',true)::text$$)),
 ('admin approves', pg_temp.t('t-admin@test.local', $$select public.decide_study('00000000-0000-0000-0000-00000000c001',true,'معتمد')::text$$)),
 ('installation', pg_temp.t('co@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','installation','{"devices":"4","fragrance":"عود","date":"2026-10-01"}')).type$$)),
 ('after install', pg_temp.t('t-admin@test.local', $$select stage||' '||devices_count||' '||fragrance||' next '||next_refill_at::date from public.mosques$$)),
 ('company visit attempt', pg_temp.t('co@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','visit','{}')).type$$)),
 ('visit', pg_temp.t('assoc@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','visit','{"status":"issue","date":"2026-10-20"}','جهاز متوقف')).type$$)),
 ('satisfaction 4', pg_temp.t('assoc@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','satisfaction','{"overall":4}')).type$$)),
 ('satisfaction 5', pg_temp.t('assoc@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','satisfaction','{"overall":5}')).type$$)),
 ('monthly', pg_temp.t('assoc@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','monthly','{"month":"2026-10"}')).type$$)),
 ('refill', pg_temp.t('co@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','refill','{"date":"2026-10-22"}')).type$$)),
 ('after ops', pg_temp.t('t-admin@test.local', $$select satisfaction_avg||' visit '||last_visit_at::date||' next '||next_refill_at::date from public.mosques$$)),
 ('viewer mosques direct', pg_temp.t('view@test.local', $$select count(*)::text from public.mosques$$)),
 ('viewer dashboard', pg_temp.t('view@test.local', $$select (public.dashboard_stats()->>'total')||' active '||(public.dashboard_stats()->>'active')||' sat '||(public.dashboard_stats()->>'satisfaction')$$)),
 ('viewer achievements', pg_temp.t('view@test.local', $$select jsonb_array_length(public.achievements())::text$$)),
 ('viewer report', pg_temp.t('view@test.local', $$select (public.submit_report('00000000-0000-0000-0000-00000000c001','note','{}')).type$$)),
 ('assoc dashboard', pg_temp.t('assoc@test.local', $$select public.dashboard_stats()->>'total'$$)),
 ('other dashboard', pg_temp.t('other@test.local', $$select public.dashboard_stats()->>'total'$$)),
 ('admin task to company', pg_temp.t('t-admin@test.local', $$insert into public.tasks (mosque_id,title,assignee,priority) values ('00000000-0000-0000-0000-00000000c001','استبدال جهاز','company','urgent') returning kind$$)),
 ('company sees task', pg_temp.t('co@test.local', $$select title from public.tasks$$)),
 ('assoc sees company task', pg_temp.t('assoc@test.local', $$select count(*)::text from public.tasks$$)),
 ('company done task', pg_temp.t('co@test.local', $$update public.tasks set status='done' returning status$$)),
 ('company retitle', pg_temp.t('co@test.local', $$update public.tasks set title='x' returning title$$)),
 ('assoc request', pg_temp.t('assoc@test.local', $$insert into public.tasks (mosque_id,title,assignee) values ('00000000-0000-0000-0000-00000000c001','طلب تغيير العطر','company') returning kind||' '||assignee$$)),
 ('comment', pg_temp.t('t-admin@test.local', $$insert into public.task_comments (task_id, body) select id, 'تم الاطلاع' from public.tasks where kind='request' returning body$$)),
 ('admin notifs', pg_temp.t('t-admin@test.local', $$select count(*)::text from public.notifications$$)),
 ('assoc attach ok', pg_temp.t('assoc@test.local', $$insert into public.attachments (mosque_id,path,name,size) values ('00000000-0000-0000-0000-00000000c001','m/00000000-0000-0000-0000-00000000c001/a.pdf','a.pdf',100) returning name$$)),
 ('other attach denied', pg_temp.t('other@test.local', $$insert into public.attachments (mosque_id,path,name,size) values ('00000000-0000-0000-0000-00000000c001','m/00000000-0000-0000-0000-00000000c001/b.pdf','b.pdf',100) returning name$$)),
 ('storage write ok', pg_temp.t('assoc@test.local', $$select public.can_write_object('m/00000000-0000-0000-0000-00000000c001/x.pdf')::text$$)),
 ('storage other denied', pg_temp.t('other@test.local', $$select public.can_read_object('m/00000000-0000-0000-0000-00000000c001/x.pdf')::text$$)),
 ('accounts visible to assoc', pg_temp.t('assoc@test.local', $$select count(*)::text from public.accounts$$)),
 ('broadcast', pg_temp.t('assoc@test.local', $$insert into public.broadcasts (body) values ('السلام عليكم') returning body$$)),
 ('company broadcast', pg_temp.t('co@test.local', $$insert into public.broadcasts (body) values ('x') returning body$$)),
 ('reset login', pg_temp.t('t-admin@test.local', $$select length(public.reset_account_login((select id from public.accounts where email='other@test.local')))::text$$)),
 ('other after reset', pg_temp.t('other@test.local', $$select count(*)::text from public.notifications$$)),
 ('admin demotes self', pg_temp.t('t-admin@test.local', $$update public.accounts set role='viewer' where email='t-admin@test.local' returning role$$));
update public.mosques set next_refill_at = now() + interval '40 hours';
select public.run_reminders();
insert into out (step, result) values
 ('reminder to company', pg_temp.t('co@test.local', $$select string_agg(title, ' | ') from public.notifications where kind='reminder'$$));
select public.run_reminders();
insert into out (step, result) values
 ('no duplicate reminder', pg_temp.t('co@test.local', $$select count(*)::text from public.notifications where kind='reminder'$$));
select n, step, result from out order by n;
rollback;
