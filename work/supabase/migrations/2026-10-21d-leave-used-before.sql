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
--   · leave_used_before     — 이전 시스템에서 쓴 일수
--   · leave_used_before_at  — **그 숫자를 적어 넣은 날짜**
--
--   계산할 때, 적어 넣은 날짜가 **지금 연차 기간 안에 들어 있을 때만** 뺀다.
--   입사 1주년이 지나 연차 기간이 새로 시작되면 그 날짜는 지난 기간의 것이 되므로
--   **저절로 빠지지 않게 된다.** 숫자를 지우러 들어올 필요가 없다.
--
--   ⚠️ 날짜를 같이 두는 이유: 숫자만 두면 1년 뒤 누군가 0 으로 되돌려야 하는데,
--      그런 "언젠가 사람이 해야 하는 일" 은 반드시 잊힌다. 그래서 조건으로 만들었다.
--
--   ⚠️ '연차 직접 지정'(leave_override)에 남은 일수를 적는 방법은 쓰지 않았다.
--      그 칸의 뜻은 **부여 일수**라서, 거기에 남은 일수를 넣으면 나중에 보는 사람이
--      반드시 헷갈린다. 숫자마다 뜻이 하나씩만 있도록 칸을 나눴다.
--
-- 2026-10-21 현재
--   · 연차 전환 기준일 = 오늘. 오늘부터 연차는 VIREN WORK 에서만 신청한다.
--   · 김기선·백승민 대표 — 연차 없음(부여 0일로 이미 지정돼 있음).
--   · 박지은 — 카카오워크에서 2일 사용. (입사 2026-07-13 → 2027-07-13 에 저절로 풀린다)
-- =====================================================================

alter table public.employees
  add column if not exists leave_used_before numeric(4,1) not null default 0
    check (leave_used_before >= 0);

alter table public.employees
  add column if not exists leave_used_before_at date;

-- 박지은 님 2일 (오늘 적은 것으로 기록)
update public.employees
   set leave_used_before = 2,
       leave_used_before_at = (now() at time zone 'Asia/Seoul')::date
 where email = 'jieunp711@viren.kr';

-- 결과 확인
select name, position as 직급, hire_date as 입사일,
       leave_override as 연차직접지정,
       leave_used_before as 이전사용연차,
       leave_used_before_at as 적어넣은날
from public.employees order by sort;
