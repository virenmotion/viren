-- =====================================================================
-- VIREN WORK — 인사기록 · 경력관리.  2026-10-22
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 왜
--   노션의 '직원현황관리' · '직원경력관리' 를 바이렌워크로 옮긴다.
--   지금은 같은 내용을 노션과 바이렌워크 두 군데에 적고 있다.
--
-- ⚠️ 왜 employees 에 칸을 더하지 않고 **표를 따로** 만드나
--   employees 는 "직원 목록은 재직자 누구나 본다" 정책이다. 거기에 생년월일·
--   주소·전화번호를 넣으면 **전 직원이 서로의 개인정보를 보게 된다.**
--   그래서 민감한 것은 별도 표에 두고 **관리자와 본인만** 보게 한다.
--
-- ⚠️ 주민번호는 넣지 않는다 (지은님 2026-10-22 결정: 생년월일만).
--   주민등록번호는 법에 정해진 근거가 있을 때만 보관할 수 있고 암호화 의무가 있다.
--   나이·경력 계산에는 생년월일이면 충분하다. **나중에 누가 칸을 더하지 말 것.**
-- =====================================================================

-- ① 인사기록 (한 사람당 한 줄) -------------------------------------------
create table if not exists public.employee_hr (
  user_id      uuid primary key references public.employees(id) on delete cascade,
  name_en      text not null default '',   -- 영문명
  name_cn      text not null default '',   -- 한자명
  birth_date   date,
  phone        text not null default '',
  address      text not null default '',
  edu_level    text not null default '',   -- 학력 (고졸·전문학사·학사·석사·박사)
  school       text not null default '',   -- 졸업학교
  major        text not null default '',   -- 학과
  certs        text not null default '',   -- 보유자격증 (여러 개면 줄바꿈)
  tech_grade   text not null default '',   -- 기술자등급
  design_grade text not null default '',   -- 디자이너등급
  note         text not null default '',
  updated_at   timestamptz not null default now()
);

-- ② 경력 (한 사람당 여러 줄) ---------------------------------------------
-- 4대보험 자격취득·상실일 기준. 끝난 날이 비어 있으면 '재직 중'.
create table if not exists public.employee_careers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.employees(id) on delete cascade,
  company    text not null check (length(trim(company)) > 0),
  start_date date not null,
  end_date   date,
  note       text not null default '',
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists employee_careers_user_idx
  on public.employee_careers (user_id, start_date desc);

-- ③ 누가 볼 수 있나 — 관리자와 본인만 ------------------------------------
alter table public.employee_hr      enable row level security;
alter table public.employee_careers enable row level security;
revoke all on public.employee_hr, public.employee_careers from anon;

drop policy if exists "인사기록은 관리자와 본인만 본다" on public.employee_hr;
create policy "인사기록은 관리자와 본인만 본다" on public.employee_hr
  for select to authenticated
  using (public.is_active_employee() and (public.is_admin() or user_id = auth.uid()));

drop policy if exists "인사기록은 관리자만 고친다" on public.employee_hr;
create policy "인사기록은 관리자만 고친다" on public.employee_hr
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "경력은 관리자와 본인만 본다" on public.employee_careers;
create policy "경력은 관리자와 본인만 본다" on public.employee_careers
  for select to authenticated
  using (public.is_active_employee() and (public.is_admin() or user_id = auth.uid()));

drop policy if exists "경력은 관리자만 고친다" on public.employee_careers;
create policy "경력은 관리자만 고친다" on public.employee_careers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ④ 직원을 등록하면 인사기록 줄도 같이 만든다 ----------------------------
-- 없으면 화면에서 '없음' 과 '아직 안 적음' 을 구분하기 번거롭다.
create or replace function public.make_hr_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into employee_hr (user_id) values (new.id) on conflict do nothing;
  return null;
end $$;

drop trigger if exists make_hr_row on public.employees;
create trigger make_hr_row after insert on public.employees
  for each row execute function public.make_hr_row();

-- 이미 있는 직원들 몫
insert into public.employee_hr (user_id)
select e.id from public.employees e
where not exists (select 1 from public.employee_hr h where h.user_id = e.id);

-- 결과 확인
select
  (select count(*) from public.employees) as 직원,
  (select count(*) from public.employee_hr) as 인사기록줄,
  (select count(*) from public.employee_careers) as 경력줄;
