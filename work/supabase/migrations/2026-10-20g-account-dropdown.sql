-- =====================================================================
-- VIREN WORK — 지출결의서 두 건의 '계정과목' 맞추기.  2026-10-20
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 지은님 요청
--   · 프로젝트 지출결의서의 **계정과목**: 글 입력 → **고르기(드롭다운)**.
--     값은 개인경비 지출결의서와 똑같이.
--   · 개인경비 지출결의서의 **'항목' → '계정과목'** 으로 이름 변경.
--
-- 계정과목 10가지
--   원재료비 · 소모품비 · 접대비 · 차량유지비 · 여비교통비 · 복리후생비 · 통신비 · 운반비 · 지급수수료 · 기타
--
-- ⚠️ 칸 열쇠(key)는 그대로 둔다(d1~d4). 이미 올라간 문서가 있어도 값이 안 사라진다.
--    ⚠️ 다만 프로젝트 지출결의서의 계정과목은 **글 → 고르기**로 바뀌므로, 전에 손으로
--       적어 둔 값이 목록에 없으면 그 칸이 빈 것처럼 보인다(값은 DB 에 남아 있다).
--       지금은 그 양식으로 올라간 문서가 없어 문제 없다.
-- =====================================================================

-- 프로젝트 지출결의서
update public.doc_forms
   set fields = '[{"key":"f1","type":"table","label":"지급정보","total":"c2","columns":[{"key":"c1","type":"text","label":"거래처명"},{"key":"c2","type":"money","label":"지급금액"},{"key":"c3","type":"date","label":"지급요청일"},{"key":"c4","type":"text","label":"거래은행"},{"key":"c5","type":"text","label":"계좌번호"},{"key":"c6","type":"text","label":"사업자등록번호"}],"required":true},{"key":"f2","type":"table","label":"상세 내용","total":"d3","columns":[{"key":"d1","type":"select","label":"계정과목","options":["원재료비","소모품비","접대비","차량유지비","여비교통비","복리후생비","통신비","운반비","지급수수료","기타"]},{"key":"d2","type":"text","label":"내용"},{"key":"d3","type":"money","label":"금액"},{"key":"d4","type":"text","label":"비고"}]},{"key":"f3","rows":4,"type":"textarea","label":"지급 내용"}]'::jsonb,
       updated_at = now()
 where id = 'd7c815ce-74b5-41ba-8217-d54218c693c4';

-- 개인경비 지출결의서
update public.doc_forms
   set fields = '[{"key":"f1","type":"table","label":"개인경비 신청정보","total":"","columns":[{"key":"c1","type":"text","label":"사용 카드사"},{"key":"c2","type":"text","label":"사용 카드번호"}],"required":true},{"key":"f2","type":"table","label":"상세내용","total":"d3","columns":[{"key":"d1","type":"date","label":"사용일자"},{"key":"d2","type":"select","label":"계정과목","options":["원재료비","소모품비","접대비","차량유지비","여비교통비","복리후생비","통신비","운반비","지급수수료","기타"]},{"key":"d3","type":"money","label":"사용금액"},{"key":"d4","type":"text","label":"사용내역"}]}]'::jsonb,
       updated_at = now()
 where id = 'de0a70b2-8c64-4f25-ad14-d6f8451fd27a';

-- 결과 확인
select f.name, c->>'label' as 칸, c->>'type' as 종류,
       coalesce(jsonb_array_length(c->'options'), 0) as 고를수
from public.doc_forms f,
     jsonb_array_elements(f.fields) fl,
     jsonb_array_elements(coalesce(fl->'columns', '[]'::jsonb)) c
where f.name in ('프로젝트 지출결의서', '개인경비 지출결의서')
  and c->>'label' = '계정과목';
