-- =====================================================================
-- VIREN WORK — 시험용 결재 문서 지우기 (한 번만 쓰는 스크립트).  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- ⚠️ 이건 **설치 스크립트가 아니다.** 2026-10-21 에 시험하면서 올린 문서 네 개를
--    치우려고 한 번 쓴 것이다. 나중에 다시 돌릴 일이 없다.
--
-- 왜 '숫자만' 못 깎나
--   대체휴무는 어디에도 숫자로 쌓여 있지 않다. **승인된 휴일근무신청서에서 매번 다시
--   센다**(comp_balance). 그래서 1일을 없애려면 그 문서를 없애는 수밖에 없다.
--   이 설계 덕분에 평소에는 숫자가 틀어지지 않는다.
--
-- 지우는 것 (전부 제목이 test 인 시험 문서)
--   2026-0001 품의서           회수   · 첨부 사진 1개
--   2026-0002 출장계획서        회수
--   2026-0003 휴일근무신청서    승인   ← 대체휴무 1일의 출처
--   2026-0004 휴가신청서        회수
--
-- 지우고 나면
--   · 남은 대체휴무 0일
--   · 다음에 올리는 문서가 **2026-0001** 번부터 시작 (번호는 연도별 최대값+1 이라서)
--   · 결재선·참조·첨부 목록은 문서에 딸려 같이 사라진다
--
-- 건드리지 않는 것: 양식(휴일근무신청서 등), 출퇴근 기록, 연차 설정, 메신저 대화
-- =====================================================================

-- ① 첨부파일 실물부터. 문서를 먼저 지우면 어느 파일이었는지 알 수 없게 된다.
delete from storage.objects
 where bucket_id = 'approval-files'
   and public.doc_id_from_path(name) in (
     select id from public.approval_docs
      where doc_no in ('2026-0001', '2026-0002', '2026-0003', '2026-0004'));

-- ② 문서
delete from public.approval_docs
 where doc_no in ('2026-0001', '2026-0002', '2026-0003', '2026-0004');

-- 결과 확인
select
  (select count(*) from public.approval_docs) as 남은문서,
  (select count(*) from storage.objects where bucket_id = 'approval-files') as 남은첨부,
  public.comp_balance((select id from public.employees where email = 'jieunp711@viren.kr')) as 박지은_남은대체휴무;
