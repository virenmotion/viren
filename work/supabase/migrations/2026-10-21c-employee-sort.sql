-- =====================================================================
-- VIREN WORK — 직원 순서를 직접 끌어서 정하기.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 왜
--   부서 순서를 따로 두는 대신, **직원 탭에서 줄을 끌어** 순서를 정하기로 했다(지은님).
--   그러면 부서 묶음도 자연히 원하는 대로 놓인다.
--
-- 어떻게
--   employees.sort 를 새로 두고, 지금 보이는 순서(부서 순서 → 직급 → 이름)로 채운다.
--   이후로는 관리 → 직원에서 끌어 옮길 때마다 이 값이 바뀐다.
--
--   settings.dept_order 는 **더 이상 쓰지 않는다.** 칸은 남겨 둔다(지우는 건 되돌릴 수
--   없고, 남아 있어도 해가 없다). 다음에 설정 표를 손볼 일이 있으면 그때 같이 정리.
-- =====================================================================

alter table public.employees
  add column if not exists sort int not null default 0;

-- 지금 화면에 보이던 순서 그대로 번호를 매긴다.
with ranked as (
  select e.id,
         row_number() over (
           order by
             /* 부서: settings.dept_order 에 적힌 순서 → 없으면 뒤로 → 같으면 가나다 */
             coalesce(array_position(s.dept_order, nullif(trim(e.dept), '')), 9999),
             nullif(trim(e.dept), ''),
             /* 직급: 대표 → 사원 */
             coalesce(array_position(
               array['대표','실장','팀장','과장','대리','주임','사원'],
               nullif(trim(e.position), '')), 9999),
             e.name
         ) as n
  from public.employees e
  cross join (select dept_order from public.settings where id = 1) s
)
update public.employees e
   set sort = r.n
  from ranked r
 where e.id = r.id
   and (select coalesce(max(sort), 0) from public.employees) = 0;

-- 결과 확인
select sort, dept, position as 직급, duty as 직책, name from public.employees order by sort;
