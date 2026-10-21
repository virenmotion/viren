-- =====================================================================
-- VIREN WORK — 부서 순서를 직접 정하기.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 왜
--   직원 목록을 부서 → 직급 순으로 정렬하는데, 부서가 **가나다순**이라
--   '디자인팀' 이 '바이렌' 보다 위로 갔다. 지은님이 순서를 직접 정할 수 있게 한다.
--
-- 어떻게
--   새 테이블을 만들지 않고 **settings(한 줄짜리 설정 표)** 에 칸 하나를 더한다.
--   dept_order = ['바이렌', '디자인팀', ...] 처럼 적힌 순서대로 위에서 아래로.
--   여기 없는 부서는 맨 뒤에 가나다순으로 붙는다. 그래서 부서가 새로 생겨도
--   목록에서 사라지지 않는다.
--
--   화면: 관리 → 직원 맨 위 '부서 순서'. 관리자만 고칠 수 있다(settings 정책 그대로).
-- =====================================================================

alter table public.settings
  add column if not exists dept_order text[] not null default '{}';

-- 지금 쓰고 있는 부서를 일단 채워 둔다(바이렌이 있으면 맨 앞으로).
update public.settings
   set dept_order = coalesce((
         select array_agg(d order by (d <> '바이렌'), d)
         from (select distinct nullif(trim(dept), '') as d from public.employees) t
         where d is not null
       ), '{}')
 where id = 1 and coalesce(array_length(dept_order, 1), 0) = 0;

-- 결과 확인
select dept_order from public.settings where id = 1;
