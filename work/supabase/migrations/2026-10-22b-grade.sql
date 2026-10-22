-- =====================================================================
-- VIREN WORK — 등급 자동 제시에 필요한 칸.  2026-10-22
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-22-hr.sql 을 먼저 실행한 뒤에 하세요.
--
-- 왜 네 칸이 더 필요한가 (지은님이 준 기준표를 그대로 쓰려면)
--   · qual_kind  자격 종류 — 기준표가 '기사·산업기사·기술사…' 로 갈린다.
--                지금 '보유자격증' 은 자유 글이라 기계가 종류를 알 수 없다.
--   · qual_date  자격취득일 ─┐ 시행령 [별표2] 비고 5:
--   · edu_date   졸업일     ─┘ **자격·학력을 갖추기 전 경력은 60% 만** 반영한다.
--                            이 날짜가 없으면 60% 규칙을 못 써서 등급이 높게 나온다.
--   · major_type 전공 구분 — 디자이너 기준표가 '디자인 전공 / 준 전공 / 비전공' 으로 갈리고,
--                디자인 석사·박사는 경력 1년·2년으로 쳐 준다.
-- =====================================================================

alter table public.employee_hr add column if not exists qual_kind  text not null default '';
alter table public.employee_hr add column if not exists qual_date  date;
alter table public.employee_hr add column if not exists edu_date   date;
alter table public.employee_hr add column if not exists major_type text not null default '';

-- 결과 확인
select column_name as 칸
from information_schema.columns
where table_schema = 'public' and table_name = 'employee_hr'
order by ordinal_position;
