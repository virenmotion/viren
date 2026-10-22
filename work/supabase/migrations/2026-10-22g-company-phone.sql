-- =====================================================================
-- VIREN WORK — 회사 전화번호.  2026-10-22
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-22f-cert.sql 을 먼저 실행한 뒤에 하세요.
--
-- 증명서에 들어가는 회사 전화번호다. 양식(hwp)에는 '-' 로 비어 있었는데
-- 지은님이 알려 주셨다. 02-3144-1222
-- =====================================================================

update public.settings
   set company_phone = '02-3144-1222',
       updated_at    = now()
 where id = 1;

-- 결과 확인
select company_name, company_ceo, company_biz_no,
       company_phone, company_fax, company_address
  from public.settings where id = 1;
