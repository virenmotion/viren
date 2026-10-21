-- =====================================================================
-- VIREN WORK — 휴일근무 → 대체휴무 자동 적립.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 생각의 뼈대
--   대체휴무를 **숫자로 따로 관리하지 않는다.** 결재 기록에서 늘 다시 센다.
--     남은 대체휴무 = (승인된 휴일근무 일수) − (승인·결재중인 대휴 휴가 일수)
--   그래야 누가 더하고 빼는 걸 잊어도 숫자가 틀어지지 않는다. 연차와 같은 생각.
--
-- 무엇이 생기나
--   ① doc_forms.grants_comp  — 이 양식이 승인되면 대체휴무가 생긴다
--      doc_forms.comp_field  — 며칠인지가 들어 있는 칸(날짜 여러 개 고르기)의 key
--   ② comp_balance(uuid)     — 남은 대체휴무. 화면과 서버 검사가 같이 쓴다
--   ③ submit_doc 이 대휴 신청을 받을 때 **남은 일수를 넘으면 막는다**(지은님 결정)
--
--   ⚠️ 결재 중인 대휴도 '쓴 것' 으로 친다. 안 그러면 2일 남았는데 2일짜리를
--      두 장 올릴 수 있다.
-- =====================================================================

-- ① 양식 설정 ---------------------------------------------------------
alter table public.doc_forms
  add column if not exists grants_comp boolean not null default false;
alter table public.doc_forms
  add column if not exists comp_field text;

-- ② 남은 대체휴무 ------------------------------------------------------
create or replace function public.comp_balance(p_user uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select
    coalesce((
      -- 적립: 승인된 '대체휴무를 만드는 양식' 문서에서 고른 날 수
      select sum(jsonb_array_length(d.data->'fields'->f.comp_field))
      from approval_docs d
      join doc_forms f on f.id = d.form_id
      where d.drafter_id = p_user
        and d.status = 'approved'
        and d.form_type = 'custom'
        and f.grants_comp
        and f.comp_field is not null
        and jsonb_typeof(d.data->'fields'->f.comp_field) = 'array'
    ), 0)
    -
    coalesce((
      -- 사용: 대휴 휴가. **결재 중인 것도 뺀다**(이중 신청 막기)
      select sum(coalesce((d.data->>'days')::numeric, 0))
      from approval_docs d
      where d.drafter_id = p_user
        and d.form_type = 'leave'
        and d.data->>'kind' = 'comp'
        and d.status in ('approved', 'pending')
    ), 0)
$$;

revoke execute on function public.comp_balance(uuid) from anon, public;
grant execute on function public.comp_balance(uuid) to authenticated;

-- ③ 대휴는 남은 일수까지만 ---------------------------------------------
-- 운영 중인 submit_doc 을 그대로 두고 대휴 검사만 더한다.
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
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_left numeric;
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

-- ④ 휴일근무신청서를 '날짜 여러 개' 구조로 -----------------------------
-- 지은님이 만든 양식의 '휴일근무일 및 근무시간'(날짜+시각 한 칸)으로는 **며칠인지 셀 수
-- 없다.** 날짜 여러 개로 바꾸고, 시각은 글 칸으로 따로 뺀다.
-- 이 양식으로 올라간 문서가 아직 0건이라 칸 key 를 그대로 써도 안전하다.
update public.doc_forms
   set fields = '[{"key":"fmvhi7gb91","type":"dates","label":"휴일근무일","required":true},{"key":"fmvhi7time","type":"text","label":"근무 시간","half":true},{"key":"fmvhi84631","type":"text","label":"근무 프로젝트명","half":true},{"key":"fmvhi8s3x2","type":"textarea","label":"근무 내용","rows":4,"required":true}]'::jsonb,
       grants_comp = true,
       comp_field = 'fmvhi7gb91',
       guide = coalesce(nullif(guide, ''), '근무한 날을 달력에서 모두 골라 주세요. 고른 날 수만큼 대체휴무가 생깁니다.'),
       updated_at = now()
 where name = '휴일근무신청서';

-- 결과 확인
select name, grants_comp as 대체휴무생성, comp_field as 일수칸 from public.doc_forms order by sort;
