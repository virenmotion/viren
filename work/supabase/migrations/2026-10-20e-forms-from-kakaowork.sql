-- =====================================================================
-- VIREN WORK — 카카오워크에서 쓰던 양식 10개를 한 번에 넣기.  2026-10-20
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- · 칸 구성은 카카오워크 관리자의 '기안양식 미리보기'를 직접 보고 옮긴 것이다.
-- · **같은 이름의 양식이 이미 있으면 건너뛴다.** 그래서 여러 번 실행해도 안전하고,
--   지은님이 직접 만드신 '출장계획서' 도 덮어쓰지 않는다.
-- · 기본 결재선은 **백승민 → 김기선** 순서로 넣는다. VIREN WORK 에 아직 등록되지
--   않은 사람은 자동으로 빠진다. 나중에 등록하면 양식을 열어 추가하면 된다.
--
-- 손봐야 할 것 (내가 원문을 다 못 읽은 부분)
--   · 경조금 신청서의 **규정표**, 사직원의 **사직 서약 문구** — 본문이 비어 있다.
--     카카오워크 미리보기에서 복사해 붙여넣어 주세요. (지어내지 않았습니다.)
--   · 고르기 목록(항목·대금지급구성·발령구분·인감종류·휴직 종류)은 **제가 임의로
--     채운 것**입니다. 실제로 쓰시는 것과 다르면 관리 → 양식에서 고쳐 주세요.
--   · '연차휴가원' 은 **사용 안 함으로 넣습니다.** 기본 휴가신청서에만 연차 자동
--     차감이 붙어 있어서, 이걸로 받으면 연차가 안 깎입니다. 그래도 쓰시려면
--     관리 → 양식에서 '사용' 을 켜 주세요.
-- =====================================================================

-- 1. 프로젝트 지출결의서
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '프로젝트 지출결의서', '거래처 지급 정보를 빠짐없이 적어 주세요.', '[{"key":"f1","type":"table","label":"지급정보","columns":[{"key":"c1","label":"거래처명","type":"text"},{"key":"c2","label":"지급금액","type":"money"},{"key":"c3","label":"지급요청일","type":"date"},{"key":"c4","label":"거래은행","type":"text"},{"key":"c5","label":"계좌번호","type":"text"},{"key":"c6","label":"사업자등록번호","type":"text"}],"total":"c2","required":true},{"key":"f2","type":"table","label":"상세 내용","columns":[{"key":"d1","label":"계정과목","type":"text"},{"key":"d2","label":"내용","type":"text"},{"key":"d3","label":"금액","type":"money"},{"key":"d4","label":"비고","type":"text"}],"total":"d3"},{"key":"f3","type":"textarea","label":"지급 내용","rows":4}]'::jsonb, v_line, 1, true
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '프로젝트 지출결의서');

-- 2. 개인경비 지출결의서
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '개인경비 지출결의서', '개인경비 사용 영수증 수령은 사용 카드번호 및 카드사 기입 필수입니다.', '[{"key":"f1","type":"table","label":"개인경비 신청정보","columns":[{"key":"c1","label":"사용 카드사","type":"text"},{"key":"c2","label":"사용 카드번호","type":"text"}],"total":"","required":true},{"key":"f2","type":"table","label":"상세내용","columns":[{"key":"d1","label":"사용일자","type":"date"},{"key":"d2","label":"항목","type":"select","options":["식대","교통비","숙박비","소모품","접대비","기타"]},{"key":"d3","label":"사용금액","type":"money"},{"key":"d4","label":"사용내역","type":"text"}],"total":"d3"}]'::jsonb, v_line, 2, true
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '개인경비 지출결의서');

-- 3. 계약품의서
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '계약품의서', '계약서 스캔본을 첨부하여 품의 등록 바랍니다.', '[{"key":"f1","type":"text","label":"사업명","half":true},{"key":"f2","type":"text","label":"계약명","half":true,"required":true},{"key":"f3","type":"date","label":"계약 시작일","half":true},{"key":"f4","type":"date","label":"계약 종료일","half":true},{"key":"f5","type":"text","label":"계약상대명","half":true},{"key":"f6","type":"money","label":"총 계약금액","half":true,"required":true},{"key":"f7","type":"table","label":"계약내용","columns":[{"key":"c1","label":"대금지급구성","type":"select","options":["계약금","중도금","잔금","기타"]},{"key":"c2","label":"금액","type":"money"},{"key":"c3","label":"비고","type":"text"}],"total":"c2"}]'::jsonb, v_line, 3, true
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '계약품의서');

-- 4. 출장계획서
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '출장계획서', '출장계획서를 작성하세요.', '[{"key":"f1","type":"member","label":"동반 출장자"},{"key":"f2","type":"date","label":"출장 시작일","half":true,"required":true},{"key":"f3","type":"date","label":"출장 종료일","half":true,"required":true},{"key":"f4","type":"text","label":"출장 프로젝트명","half":true},{"key":"f5","type":"text","label":"출장 목적","half":true,"required":true},{"key":"f6","type":"table","label":"출장 경비 내역","columns":[{"key":"c1","label":"사용일자","type":"date"},{"key":"c2","label":"사용 내역","type":"text"},{"key":"c3","label":"지출 금액","type":"money"},{"key":"c4","label":"비고","type":"text"}],"total":"c3"}]'::jsonb, v_line, 4, true
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '출장계획서');

-- 5. 경조금 신청서
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '경조금 신청서', '경조금 신청서를 작성하세요. 회사 규정표는 아래 본문에 붙여넣어 주세요.', '[{"key":"f1","type":"member","label":"신청자","required":true},{"key":"f2","type":"text","label":"경조사항","required":true,"max":30},{"key":"f3","type":"date","label":"경조일자","required":true,"half":true},{"key":"f4","type":"money","label":"경조금","required":true,"half":true},{"key":"f5","type":"text","label":"입금계좌","required":true},{"key":"f6","type":"rich","label":"규정 안내","html":""}]'::jsonb, v_line, 5, true
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '경조금 신청서');

-- 6. 인사명령
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '인사명령', '인사명령을 작성하세요.', '[{"key":"f1","type":"date","label":"인사발령일","required":true},{"key":"f2","type":"table","label":"상세내용","columns":[{"key":"c1","label":"구성원명","type":"member"},{"key":"c2","label":"발령구분","type":"select","options":["승진","전보","겸직","파견","직무변경","기타"]},{"key":"c3","label":"발령부서","type":"text"},{"key":"c4","label":"발령직급","type":"text"}],"total":"","required":true},{"key":"f3","type":"rich","label":"본문","html":""}]'::jsonb, v_line, 6, true
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '인사명령');

-- 7. 인감반출 신청서
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '인감반출 신청서', '인감 반출 전에 반드시 결재를 받아 주세요.', '[{"key":"f1","type":"text","label":"프로젝트명"},{"key":"f2","type":"textarea","label":"사용목적","rows":4,"required":true},{"key":"f3","type":"table","label":"반출내용","columns":[{"key":"c1","label":"사용처","type":"text"},{"key":"c2","label":"인감종류","type":"select","options":["법인인감","사용인감","계약인감","기타"]},{"key":"c3","label":"반출일자","type":"date"},{"key":"c4","label":"반출자","type":"text"}],"total":"","required":true}]'::jsonb, v_line, 7, true
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '인감반출 신청서');

-- 8. 휴직신청서
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '휴직신청서', '휴직신청서를 작성하세요.', '[{"key":"f1","type":"member","label":"신청자","required":true,"half":true},{"key":"f2","type":"dept","label":"소속 부서","required":true,"half":true},{"key":"f3","type":"text","label":"직위","required":true,"half":true,"max":50},{"key":"f4","type":"select","label":"휴직 종류","options":["육아휴직","질병휴직","가사휴직","기타"],"required":true,"half":true},{"key":"f5","type":"textarea","label":"휴직 사유","rows":5,"required":true},{"key":"f6","type":"text","label":"비상 연락처","required":true,"half":true,"max":20},{"key":"f7","type":"number","label":"총 휴직 기간","required":true,"half":true,"unit":"일"},{"key":"f8","type":"date","label":"휴직 시작일","required":true,"half":true},{"key":"f9","type":"date","label":"휴직 종료일","required":true,"half":true}]'::jsonb, v_line, 8, true
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '휴직신청서');

-- 9. 사직원
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '사직원', '사직 서약 문구는 아래 본문에 붙여넣어 주세요.', '[{"key":"f1","type":"rich","label":"본문","html":""}]'::jsonb, v_line, 9, true
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '사직원');

-- 10. 연차휴가원
insert into public.doc_forms (name, guide, fields, default_approvers, sort, active)
select '연차휴가원', '⚠️ 이 양식에는 연차 자동 차감이 붙지 않습니다. 기본 휴가신청서를 쓰시길 권합니다.', '[{"key":"f1","type":"select","label":"휴가 종류","options":["연차","월차","반차(오전)","반차(오후)","공가","대휴"],"required":true},{"key":"f2","type":"datetime","label":"시작","required":true,"half":true},{"key":"f3","type":"datetime","label":"종료","required":true,"half":true},{"key":"f4","type":"textarea","label":"휴가 사유","rows":4,"required":true},{"key":"f5","type":"member","label":"대체 업무자","half":true},{"key":"f6","type":"text","label":"비상 연락처","half":true}]'::jsonb, v_line, 10, false
from (select array_remove(array[
        (select id from public.employees where name = '백승민' and active limit 1),
        (select id from public.employees where name = '김기선' and active limit 1)
      ], null) as v_line) t
where not exists (select 1 from public.doc_forms d where d.name = '연차휴가원');

-- 결과 확인
select name, active, sort, jsonb_array_length(fields) as 칸수 from public.doc_forms order by sort;
