-- =====================================================================
-- VIREN WORK — 바이렌 경력의 시작일을 따로 둔다.  2026-10-22
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 왜
--   경력은 **건강보험 자격득실확인서** 기준으로 적는다.
--   대부분은 입사일과 자격취득일이 같지만, 대표님 두 분은 날짜가 다르다.
--
--   그렇다고 employees.hire_date 를 고치면 안 된다.
--   그 날짜는 **연차 계산**(입사 1주년, 월차)에 쓰이기 때문에, 경력에 맞춰 바꾸면
--   연차 일수가 같이 틀어진다.
--
--   그래서 경력용 시작일을 따로 둔다.
--     employees.hire_date      → 연차 계산용 (입사일)
--     employee_hr.viren_start  → 경력 계산용 (4대보험 자격취득일). 비우면 입사일을 쓴다.
-- =====================================================================

alter table public.employee_hr
  add column if not exists viren_start date;

comment on column public.employee_hr.viren_start is
  '바이렌 4대보험 자격취득일. 비어 있으면 employees.hire_date 를 쓴다. 연차 계산에는 쓰지 않는다.';

-- 결과 확인
select user_id, viren_start from public.employee_hr;
