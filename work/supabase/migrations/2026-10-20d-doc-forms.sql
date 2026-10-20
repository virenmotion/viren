-- =====================================================================
-- VIREN WORK — 결재 양식을 직접 만들어 쓰기.  2026-10-20
--
-- 운영 DB 에는 **이 파일만** Supabase → SQL Editor 에 붙여넣고 한 번 실행한다.
--
-- 무엇이 생기나
--   ① doc_forms 테이블 — 관리자가 만드는 양식. 칸 구성은 fields(jsonb)에 들어간다.
--   ② approval_docs.form_id — 그 문서가 어느 양식으로 쓰였는지.
--   ③ form_type 에 'custom' 추가 — 직접 만든 양식으로 올린 문서.
--   ④ submit_doc 이 'custom' 을 받도록 확장.
--
-- fields 모양 (Admin → 양식에서 만들며, 코드는 src/lib/formFields.js 와 짝)
--   [{ "key":"f1", "label":"사업명", "type":"text", "required":true, "half":true,
--      "unit":"일", "options":["A","B"], "rows":4, "html":"<p>기본 문구</p>",
--      "columns":[{"key":"c1","label":"금액","type":"money"}], "total":"c1" }]
--   type: text | textarea | rich | date | datetime | number | money | select
--         | member | dept | table | divider
--
-- ⚠️ 필수 칸 검사는 **화면에서** 한다. 서버는 "그 양식이 있고 사용 중인가"만 본다.
--    휴가 일수·지출 합계처럼 **권리나 돈이 걸린 계산은 서버에서 한다**는 원칙은
--    기존 세 양식(leave·expense)에 그대로 남아 있다. 직접 만든 양식에는 그런 계산이
--    없으므로(합계는 보여주기용) 여기까지만 한다. 계산이 필요한 양식이 생기면
--    check_leave_data 처럼 서버 검사를 따로 붙일 것.
-- =====================================================================

-- ① 양식 ---------------------------------------------------------------
create table public.doc_forms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  guide      text not null default '',          -- 화면 맨 위 안내문
  fields     jsonb not null default '[]'::jsonb,
  -- 이 양식을 고르면 결재선에 미리 채워 둘 사람들(순서대로)
  default_approvers uuid[] not null default '{}',
  sort       int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doc_forms_fields_is_array check (jsonb_typeof(fields) = 'array')
);

alter table public.doc_forms enable row level security;

create policy "양식은 재직자 누구나 본다" on public.doc_forms
  for select to authenticated using (public.is_active_employee());
create policy "양식은 관리자만 만든다" on public.doc_forms
  for insert to authenticated with check (public.is_admin());
create policy "양식은 관리자만 고친다" on public.doc_forms
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "양식은 관리자만 지운다" on public.doc_forms
  for delete to authenticated using (public.is_admin());

-- 새 테이블은 schema.sql 끝의 일괄 revoke 에 안 걸린다. 꼭 같이 적을 것.
revoke all on public.doc_forms from anon;

-- ② 문서가 어느 양식으로 쓰였는지 ---------------------------------------
-- 양식을 지워도 올라간 문서는 남아야 한다(결재 기록은 못 지우는 게 원칙).
alter table public.approval_docs
  add column form_id uuid references public.doc_forms(id) on delete set null;

-- ③ form_type 에 'custom' 추가 ------------------------------------------
alter table public.approval_docs drop constraint approval_docs_form_type_check;
alter table public.approval_docs add constraint approval_docs_form_type_check
  check (form_type in ('general', 'leave', 'expense', 'custom'));

-- ④ submit_doc 이 'custom' 을 받도록 -------------------------------------
-- 반환 모양은 그대로(uuid). 인자만 p_form_id 가 늘어난다.
drop function if exists public.submit_doc(text, text, text, jsonb, uuid[], uuid[]);

create function public.submit_doc(
  p_form_type text,
  p_title     text,
  p_content   text,
  p_data      jsonb,
  p_approvers uuid[],
  p_refs      uuid[] default '{}',
  p_form_id   uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_no   text;
  v_year text := to_char(now() at time zone 'Asia/Seoul', 'YYYY');
  v_seq  int;
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  i      int;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception '제목을 넣어 주세요.'; end if;
  if coalesce(array_length(p_approvers, 1), 0) = 0 then
    raise exception '결재자를 한 명 이상 지정해 주세요.';
  end if;
  if array_length(p_approvers, 1) <> (select count(distinct a) from unnest(p_approvers) a) then
    raise exception '같은 사람을 결재선에 두 번 넣을 수 없습니다.';
  end if;
  if auth.uid() = any(p_approvers) then
    raise exception '본인은 결재자로 지정할 수 없습니다.';
  end if;
  if exists (
    select 1 from unnest(p_approvers || coalesce(p_refs, '{}')) u
    where not exists (select 1 from employees e where e.id = u and e.active)
  ) then
    raise exception '퇴사했거나 없는 직원이 결재선·참조에 있습니다.';
  end if;

  if p_form_type = 'leave' then
    v_data := public.check_leave_data(v_data);
  elsif p_form_type = 'expense' then
    v_data := public.check_expense_data(v_data);
  elsif p_form_type = 'custom' then
    -- 직접 만든 양식. 그 양식이 실제로 있고 쓰는 중인지만 본다.
    -- (필수 칸 검사는 화면에서 한다 — 맨 위 주석 참고)
    if p_form_id is null then raise exception '양식을 골라 주세요.'; end if;
    if not exists (select 1 from doc_forms f where f.id = p_form_id and f.active) then
      raise exception '지금은 쓸 수 없는 양식입니다.';
    end if;
    if jsonb_typeof(v_data) <> 'object' then raise exception '양식 내용이 올바르지 않습니다.'; end if;
  elsif p_form_type <> 'general' then
    raise exception '알 수 없는 양식입니다.';
  end if;

  -- 문서번호: 연도별 일련번호. 동시에 두 건이 올라와도 번호가 겹치지 않게 잠근다.
  perform pg_advisory_xact_lock(hashtext('approval_doc_no'));
  select coalesce(max(split_part(doc_no, '-', 2)::int), 0) + 1 into v_seq
  from approval_docs where doc_no like v_year || '-%';
  v_no := v_year || '-' || lpad(v_seq::text, 4, '0');

  insert into approval_docs (doc_no, form_type, title, content, data, drafter_id, form_id)
  values (v_no, p_form_type, trim(p_title), coalesce(p_content, ''), v_data, auth.uid(),
          case when p_form_type = 'custom' then p_form_id else null end)
  returning id into v_id;

  for i in 1 .. array_length(p_approvers, 1) loop
    insert into approval_steps (doc_id, step, approver_id, status)
    values (v_id, i, p_approvers[i], case when i = 1 then 'pending' else 'waiting' end);
  end loop;

  insert into approval_refs (doc_id, user_id)
  select distinct v_id, r from unnest(coalesce(p_refs, '{}')) r
  where r <> auth.uid() and r <> all(p_approvers);

  return v_id;
end $$;

revoke execute on function public.submit_doc(text, text, text, jsonb, uuid[], uuid[], uuid) from anon, public;
grant execute on function public.submit_doc(text, text, text, jsonb, uuid[], uuid[], uuid) to authenticated;
