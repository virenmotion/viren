-- =====================================================================
-- VIREN WORK — 자격증을 여러 줄로.  2026-10-22
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-22b-grade.sql 을 먼저 실행한 뒤에 하세요.
--
-- 왜
--   자격증은 여러 개일 수 있다(지은님 2026-10-22). 한 칸에 몰아 적으면
--   번호·취득일을 따로 쓸 수 없고 등급 판정에도 못 쓴다.
--   적는 차례: 자격증 번호 · 종목명 · 구분(국가기술자격/민간자격) · 자격취득일
--
-- 등급 판정과의 관계
--   시행령 [별표2] 비고 1: 등급에 쓰는 자격은 **국가기술자격만** 이다.
--   그래서 '구분' 이 필요하다. 민간자격은 기록만 하고 등급에는 안 쓴다.
--   자격의 급(기술사·기능장·기사·산업기사·기능사·기능사보)은 **종목명 끝글자**로 읽는다
--   ('실내건축산업기사' → 산업기사). 국가기술자격 종목명은 늘 그렇게 끝난다.
--
-- ⚠️ employee_hr 의 qual_kind · qual_date 는 이제 쓰지 않는다(이 표로 대체).
--    칸은 남겨 둔다 — 지우는 건 되돌릴 수 없고, 남아도 해가 없다.
-- =====================================================================

create table if not exists public.employee_certs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.employees(id) on delete cascade,
  cert_no    text not null default '',                       -- 자격증 번호
  name       text not null check (length(trim(name)) > 0),    -- 종목명
  kind       text not null default '국가기술자격'
             check (kind in ('국가기술자격', '민간자격')),
  got_date   date,                                            -- 자격취득일
  created_at timestamptz not null default now()
);
create index if not exists employee_certs_user_idx
  on public.employee_certs (user_id, got_date desc);

alter table public.employee_certs enable row level security;
revoke all on public.employee_certs from anon;

drop policy if exists "자격증은 관리자와 본인만 본다" on public.employee_certs;
create policy "자격증은 관리자와 본인만 본다" on public.employee_certs
  for select to authenticated
  using (public.is_active_employee() and (public.is_admin() or user_id = auth.uid()));

drop policy if exists "자격증은 관리자만 고친다" on public.employee_certs;
create policy "자격증은 관리자만 고친다" on public.employee_certs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 결과 확인
select
  (select count(*) from public.employee_certs) as 자격증줄,
  (select count(*) from public.employee_hr where certs <> '') as 옛자유글_남은수;
