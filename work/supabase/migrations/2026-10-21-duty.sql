-- =====================================================================
-- VIREN WORK — 직원에 '직책' 추가.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 지은님 정리
--   · **직급** = 대표 · 실장 · 팀장 · 과장 · 대리 · 주임 · 사원  (기존 position 칸)
--     화면에서 '직위' 라고 쓰던 말을 **직급**으로 바꿨다. **DB 칸 이름은 position 그대로**다
--     — 달력의 '[연차] 박지은팀장' 등 여러 곳이 이 칸을 쓰고 있어서, 이름만 바꾸면
--     전부 같이 고쳐야 하고 얻는 게 없다.
--   · **직책** = CEO · Director · leader · PM  → 새 칸 duty
--
-- 고를 수 있는 값은 화면 쪽 \`src/lib/labels.js\` 의 RANKS · DUTIES 에 있다.
-- 값을 늘리거나 바꾸려면 거기를 고친다(DB 는 글자만 담고 제한하지 않는다 —
-- 제한을 걸면 값 하나 바꿀 때마다 SQL 을 또 돌려야 한다).
-- =====================================================================

alter table public.employees
  add column if not exists duty text not null default '';

-- 결과 확인
select name, dept, position as 직급, duty as 직책, role, active
from public.employees order by dept, name;
