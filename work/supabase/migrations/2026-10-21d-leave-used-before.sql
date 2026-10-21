-- =====================================================================
-- VIREN WORK — 이전 시스템(카카오워크)에서 쓴 연차 반영.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 왜
--   남은 연차 = 부여일수 − 우리 시스템에서 승인된 휴가. 그래서 카카오워크에서 쓴
--   연차를 모르면 **남은 연차가 실제보다 많게** 나온다.
--
-- 어떻게
--   employees.leave_used_before 에 '이전 시스템에서 쓴 일수' 를 적어 둔다.
--   계산은 부여일수 − (이전 사용 + 우리 시스템 사용).
--
--   ⚠️ '연차 직접 지정'(leave_override)에 남은 일수를 적는 방법도 있었지만 쓰지 않았다.
--      그 칸의 뜻은 **부여 일수**라서, 거기에 남은 일수를 넣으면 나중에 보는 사람이
--      반드시 헷갈린다. 숫자마다 뜻이 하나씩만 있도록 칸을 나눴다.
--
-- 2026-10-21 현재
--   · 연차 전환 기준일 = 오늘. 오늘부터 연차는 VIREN WORK 에서만 신청한다.
--   · 김기선·백승민 대표 — 연차 없음(부여 0일로 이미 지정돼 있음).
--   · 박지은 — 카카오워크에서 2일 사용.
-- =====================================================================

alter table public.employees
  add column if not exists leave_used_before numeric(4,1) not null default 0
    check (leave_used_before >= 0);

-- 박지은 님 2일
update public.employees
   set leave_used_before = 2
 where email = 'jieunp711@viren.kr';

-- 결과 확인
select name, position as 직급, hire_date as 입사일,
       leave_override as 연차직접지정, leave_used_before as 이전사용연차
from public.employees order by sort;
