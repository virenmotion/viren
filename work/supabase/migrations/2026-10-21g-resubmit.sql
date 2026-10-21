-- =====================================================================
-- VIREN WORK — 회수한 문서를 고쳐서 다시 올린다.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 왜
--   지금은 회수하면 끝이다. 오타 하나 고치려고 처음부터 다시 써야 한다
--   (지은님 2026-10-21 요청).
--
-- 어떻게
--   **문서를 새로 만들지 않는다.** 같은 문서(같은 문서번호)를 고쳐서 다시 올린다.
--   · 새 문서로 만들면 회수한 껍데기가 목록에 영영 쌓이고 문서번호도 하나씩 버려진다.
--   · 첨부파일은 문서에 붙어 있으므로 그대로 따라온다.
--   · 몇 번째 상신인지 세어 둔다(resubmit_count). 결재자가 "고쳐서 올린 문서"임을 안다.
--
--   검사식이 submit_doc 과 똑같아야 해서 두 함수가 **같은 검사 함수**를 부르게 했다.
--   복사해 두면 한쪽만 고치는 날이 온다.
-- =====================================================================

-- ① 몇 번 다시 올렸는지 ------------------------------------------------
alter table public.approval_docs
  add column if not exists resubmit_count int not null default 0;

-- ② 결재선 검사 (submit_doc 에 있던 것을 그대로 옮김) --------------------
create or replace function public.check_doc_line(p_approvers uuid[], p_refs uuid[])
returns void
language plpgsql stable set search_path = public as $$
begin
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
end $$;

-- ③ 양식별 내용 검사 ---------------------------------------------------
create or replace function public.check_doc_payload(p_form_type text, p_data jsonb, p_form_id uuid)
returns jsonb
language plpgsql stable set search_path = public as $$
declare
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_left numeric;
begin
  if p_form_type = 'leave' then
    v_data := public.check_leave_data(v_data);
    -- 대휴는 쌓아 둔 만큼만 쓸 수 있다.
    if v_data->>'kind' = 'comp' then
      v_left := public.comp_balance(auth.uid());
      if (v_data->>'days')::numeric > v_left then
        raise exception '남은 대체휴무가 %일입니다. 그보다 많이 신청할 수 없습니다.', v_left;
      end if;
    end if;
  elsif p_form_type = 'expense' then
    v_data := public.check_expense_data(v_data);
  elsif p_form_type = 'custom' then
    if p_form_id is null then raise exception '양식을 골라 주세요.'; end if;
    if not exists (select 1 from doc_forms f where f.id = p_form_id and f.active) then
      raise exception '지금은 쓸 수 없는 양식입니다.';
    end if;
    if jsonb_typeof(v_data) <> 'object' then raise exception '양식 내용이 올바르지 않습니다.'; end if;
  elsif p_form_type <> 'general' then
    raise exception '알 수 없는 양식입니다.';
  end if;
  return v_data;
end $$;

revoke execute on function public.check_doc_line(uuid[], uuid[]) from anon, public;
revoke execute on function public.check_doc_payload(text, jsonb, uuid) from anon, public;
grant execute on function public.check_doc_line(uuid[], uuid[]) to authenticated;
grant execute on function public.check_doc_payload(text, jsonb, uuid) to authenticated;

-- ④ 기안 — 검사만 위 두 함수로 넘겼다. 나머지는 그대로 -------------------
drop function if exists public.submit_doc(text, text, text, jsonb, uuid[], uuid[], uuid);

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
  v_data jsonb;
  i      int;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception '제목을 넣어 주세요.'; end if;
  perform public.check_doc_line(p_approvers, p_refs);
  v_data := public.check_doc_payload(p_form_type, p_data, p_form_id);

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

-- ⑤ 회수한 문서를 고쳐서 다시 올린다 ------------------------------------
create or replace function public.resubmit_doc(
  p_doc       uuid,
  p_title     text,
  p_content   text,
  p_data      jsonb,
  p_approvers uuid[],
  p_refs      uuid[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_doc  approval_docs;
  v_data jsonb;
  i      int;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;

  select * into v_doc from approval_docs where id = p_doc for update;
  if not found or v_doc.drafter_id <> auth.uid() then
    raise exception '권한이 없습니다.';
  end if;
  if v_doc.status <> 'withdrawn' then
    raise exception '회수한 문서만 다시 올릴 수 있습니다.';
  end if;

  if coalesce(trim(p_title), '') = '' then raise exception '제목을 넣어 주세요.'; end if;
  perform public.check_doc_line(p_approvers, p_refs);
  -- 양식은 처음 올릴 때 정해진 것을 그대로 쓴다(바꾸려면 새 문서를 쓴다).
  v_data := public.check_doc_payload(v_doc.form_type, p_data, v_doc.form_id);

  -- 결재선은 통째로 다시 짠다. 예전 결재 기록(반려 사유 등)은 남길 수 없다 —
  -- 같은 (문서, 단계) 자리에 두 벌을 둘 수 없기 때문. 다시 올린 횟수만 남긴다.
  delete from approval_steps where doc_id = p_doc;
  delete from approval_refs  where doc_id = p_doc;

  update approval_docs
     set title = trim(p_title),
         content = coalesce(p_content, ''),
         data = v_data,
         status = 'pending',
         completed_at = null,
         resubmit_count = v_doc.resubmit_count + 1
   where id = p_doc;

  for i in 1 .. array_length(p_approvers, 1) loop
    insert into approval_steps (doc_id, step, approver_id, status)
    values (p_doc, i, p_approvers[i], case when i = 1 then 'pending' else 'waiting' end);
  end loop;

  insert into approval_refs (doc_id, user_id)
  select distinct p_doc, r from unnest(coalesce(p_refs, '{}')) r
  where r <> auth.uid() and r <> all(p_approvers);

  return p_doc;
end $$;

revoke execute on function public.resubmit_doc(uuid, text, text, jsonb, uuid[], uuid[]) from anon, public;
grant execute on function public.resubmit_doc(uuid, text, text, jsonb, uuid[], uuid[]) to authenticated;

-- 결과 확인
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('check_doc_line', 'check_doc_payload', 'submit_doc', 'resubmit_doc')
order by routine_name;
