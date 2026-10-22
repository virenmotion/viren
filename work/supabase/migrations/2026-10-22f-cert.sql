-- =====================================================================
-- VIREN WORK — 재직증명서 · 경력증명서.  2026-10-22
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 두 가지를 만든다.
--   ① settings 에 회사 정보 — 증명서에 들어가는 회사명·대표자·사업자번호·소재지.
--      배포 없이 관리 화면에서 고칠 수 있어야 해서 코드가 아니라 DB 에 둔다.
--   ② company 버킷 — 법인 직인(도장) 그림.
--
-- ⚠️ **직인 그림을 public/ 에 두지 않는다.**
--    work/public/ 에 넣으면 work.viren.kr/직인.png 로 **누구나 내려받는다.**
--    도장 그림만 있으면 아무 문서나 바이렌이 찍은 것처럼 만들 수 있다.
--    그래서 **로그인한 재직자만** 읽는 비공개 버킷에 둔다.
--    올리고 지우는 건 관리자만.
-- =====================================================================

-- ① 회사 정보 -----------------------------------------------------------
-- settings 는 '재직자 누구나 본다' 표다. 여기 넣는 값은 사업자등록증·홈페이지에
-- 이미 적혀 있는 것뿐이다. 민감한 것을 넣지 말 것.
alter table public.settings
  add column if not exists company_name    text not null default '주식회사 바이렌',
  add column if not exists company_short   text not null default '㈜바이렌',
  add column if not exists company_ceo     text not null default '김기선, 백승민',
  add column if not exists ceo_title       text not null default '대표이사',
  add column if not exists company_biz_no  text not null default '566-87-03717',
  add column if not exists company_phone   text not null default '02-3144-1222',
  add column if not exists company_fax     text not null default '-',
  add column if not exists company_address text not null default '서울특별시 마포구 양화로8길 32-17, 3층';

-- ② 직인·그림 저장소 -----------------------------------------------------
insert into storage.buckets (id, name, public)
values ('company', 'company', false)
on conflict (id) do nothing;

drop policy if exists "회사 그림 보기" on storage.objects;
create policy "회사 그림 보기" on storage.objects
  for select to authenticated
  using (bucket_id = 'company' and public.is_active_employee());

drop policy if exists "회사 그림 올리기" on storage.objects;
create policy "회사 그림 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'company' and public.is_admin());

drop policy if exists "회사 그림 바꾸기" on storage.objects;
create policy "회사 그림 바꾸기" on storage.objects
  for update to authenticated
  using (bucket_id = 'company' and public.is_admin())
  with check (bucket_id = 'company' and public.is_admin());

drop policy if exists "회사 그림 지우기" on storage.objects;
create policy "회사 그림 지우기" on storage.objects
  for delete to authenticated
  using (bucket_id = 'company' and public.is_admin());

-- 결과 확인
select company_name, company_ceo, company_biz_no, company_address from public.settings where id = 1;
select id, public from storage.buckets where id = 'company';
