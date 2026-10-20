\set ON_ERROR_STOP 1
-- helper (as superuser)
create function public.t_expect_err(q text, pat text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm not like '%'||pat||'%' then raise exception 'wrong error for %: %', q, sqlerrm; end if;
    raise notice 'OK err: %', sqlerrm; return;
  end;
  raise exception 'expected error % for %', pat, q;
end $$;
grant execute on function public.t_expect_err(text,text) to authenticated, anon;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000a','jieun@viren.kr'),
 ('00000000-0000-0000-0000-00000000000b','b@viren.kr'),
 ('00000000-0000-0000-0000-00000000000c','c@viren.kr'),
 ('00000000-0000-0000-0000-00000000000d','d@viren.kr');
select email, role from employees order by email;
update employees set active=(email<>'d@viren.kr');

-- anon sees nothing
set role anon;
select t_expect_err('select * from employees','permission denied');
select t_expect_err('select check_in()','permission denied');
reset role;

-- B (member) drafts a leave doc to A, ref C
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';
update employees set role='admin' where email='b@viren.kr';
reset role; select role as b_role_after_member_update from employees where email='b@viren.kr';
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';
-- direct writes blocked
select t_expect_err($q$insert into approval_docs(doc_no,form_type,title,drafter_id) values ('x','general','t','00000000-0000-0000-0000-00000000000b')$q$,'row-level security');
-- validation
select t_expect_err($q$select submit_doc('general','t','',null,'{}')$q$,'결재자를');
select t_expect_err($q$select submit_doc('general','t','',null,'{00000000-0000-0000-0000-00000000000b}')$q$,'본인은');
select t_expect_err($q$select submit_doc('general','t','',null,'{00000000-0000-0000-0000-00000000000d}')$q$,'퇴사');
select t_expect_err($q$select submit_doc('general','t','',null,'{00000000-0000-0000-0000-00000000000a,00000000-0000-0000-0000-00000000000a}')$q$,'두 번');
select t_expect_err($q$select submit_doc('leave','휴가','','{"kind":"annual","start":"2026-10-23","end":"2026-10-26","days":3}','{00000000-0000-0000-0000-00000000000a}')$q$,'최대 2일');
select t_expect_err($q$select submit_doc('leave','휴가','','{"kind":"half_am","start":"2026-10-23","end":"2026-10-24"}','{00000000-0000-0000-0000-00000000000a}')$q$,'반차는');
select t_expect_err($q$select submit_doc('expense','지출','','{"items":[{"desc":"택시","amount":"abc"}]}','{00000000-0000-0000-0000-00000000000a}')$q$,'숫자');
-- good docs
select submit_doc('leave','연차 신청','','{"kind":"annual","start":"2026-10-23","end":"2026-10-26"}','{00000000-0000-0000-0000-00000000000a}','{00000000-0000-0000-0000-00000000000c}') \gset leave_
select submit_doc('expense','택시비','','{"items":[{"desc":"택시","amount":12000},{"desc":"식대","amount":"8000"}]}','{00000000-0000-0000-0000-00000000000c,00000000-0000-0000-0000-00000000000a}') \gset exp_
select doc_no, form_type, data from approval_docs order by doc_no;
-- B can't approve own
select t_expect_err(format($q$select act_on_doc(%L,'approved')$q$, :'leave_submit_doc'),'차례가');
-- C (ref) sees leave doc but cannot approve
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
select count(*) as c_sees from approval_docs;
select t_expect_err(format($q$select act_on_doc(%L,'approved')$q$, :'leave_submit_doc'),'차례가');
-- C approves expense step1; A then
select act_on_doc(:'exp_submit_doc','approved','확인');
select t_expect_err(format($q$select act_on_doc(%L,'approved')$q$, :'exp_submit_doc'),'차례가');
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';
select t_expect_err(format($q$select withdraw_doc(%L)$q$, :'exp_submit_doc'),'회수할 수 없');
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
select t_expect_err(format($q$select act_on_doc(%L,'rejected','')$q$, :'exp_submit_doc'),'반려 사유');
select act_on_doc(:'exp_submit_doc','approved');
select act_on_doc(:'leave_submit_doc','rejected','날짜 조정 바랍니다');
select doc_no,status,completed_at is not null done from approval_docs order by doc_no;
select doc_id is not null, step, status, comment from approval_steps order by doc_id, step;
select t_expect_err(format($q$select act_on_doc(%L,'approved')$q$, :'exp_submit_doc'),'이미 결재가');
-- admin can't update docs directly
update approval_docs set title='hack';
select count(*) filter (where title='hack') hacked from approval_docs;
-- withdraw flow
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';
select submit_doc('general','품의','본문',null,'{00000000-0000-0000-0000-00000000000a}') \gset g_
select withdraw_doc(:'g_submit_doc');
select status from approval_docs where id=:'g_submit_doc';
-- files: B uploads to own pending doc only
select submit_doc('general','첨부','',null,'{00000000-0000-0000-0000-00000000000a}') \gset f_
insert into storage.objects(bucket_id,name) values ('approval-files', :'f_submit_doc' || '/a.pdf');
insert into approval_files(doc_id,path,name,uploaded_by) values (:'f_submit_doc', :'f_submit_doc' || '/a.pdf','a.pdf','00000000-0000-0000-0000-00000000000b');
select t_expect_err(format($q$insert into storage.objects(bucket_id,name) values ('approval-files', %L)$q$, :'exp_submit_doc'||'/x.pdf'),'row-level');
select t_expect_err($q$insert into storage.objects(bucket_id,name) values ('approval-files', 'junk/x.pdf')$q$,'row-level');
-- C cannot see f doc file
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
select count(*) c_files from storage.objects;
select count(*) c_docs from approval_docs;
-- attendance
select check_in();
select t_expect_err('select check_in()','이미 출근');
select check_out() is not null;
update attendance set check_in = now() - interval '9 hours';
select count(*) c_rows, min(check_in) > now() - interval '1 hour' as not_tampered from attendance;
-- office ip enforcement (headers)
reset role; update settings set office_ips='{10.0.0.0/24}', require_office_ip=true;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';
set request.headers='{"x-forwarded-for":"1.2.3.4, 10.0.0.9"}';
select t_expect_err('select check_in()','사무실');
set request.headers='{"cf-connecting-ip":"10.0.0.7"}';
select (check_in()).in_office, my_ip();
select count(*) b_att from attendance;
-- inactive D can't do anything
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000d';
select count(*) d_emps from employees;
select t_expect_err('select check_in()','권한');
-- admin sees all attendance and can't remove last admin
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
select count(*) a_att from attendance;
select t_expect_err($q$update employees set role='member' where email='jieun@viren.kr'$q$,'최소 한 명');
update employees set role='admin' where email='b@viren.kr';
update employees set role='member' where email='jieun@viren.kr';
select email, role from employees order by email;
