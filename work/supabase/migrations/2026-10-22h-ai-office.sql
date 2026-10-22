-- =====================================================================
-- VIREN WORK — 홈 바로가기의 'AI 사무실' 주소.  2026-10-22
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-22f-cert.sql 을 먼저 실행한 뒤에 하세요.
--
-- 왜 코드에 안 적고 DB 에 두나
--   주소에 **공유키(?sk=...)** 가 붙어 있다. 그 키를 가진 사람은 로그인 없이
--   현황판을 볼 수 있다.
--   그런데 바이렌워크의 자바스크립트 묶음(work.viren.kr/assets/*.js)은
--   **로그인 없이 누구나 내려받을 수 있다.** 화면이 열리기 전에 받아야 하니 당연하다.
--   게다가 저장소(github.com/virenmotion/viren)가 **공개**라 코드에 적으면
--   커밋 기록에도 영원히 남는다.
--   → 그래서 주소는 settings 에 두고, **로그인한 재직자만** 읽게 한다.
--
--   settings 는 '재직자 누구나 본다' 표다. 세 분만 볼 수 있으면 되므로 이걸로 충분하다.
-- =====================================================================

alter table public.settings
  add column if not exists ai_office_url text not null default '';

comment on column public.settings.ai_office_url is
  'AI 사무실 현황판 주소(공유키 포함). ⚠️ 코드에 적지 말 것 — 자바스크립트 묶음은 공개된다.';

update public.settings
   set ai_office_url = 'https://claude.ai/artifact/EcjQQ2kDWbP949jkPuXUDZ?sk=X4z2cirhh1o-UzymALk1aw',
       updated_at    = now()
 where id = 1;

-- 결과 확인
select ai_office_url from public.settings where id = 1;
