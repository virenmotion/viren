-- =====================================================================
-- VIREN WORK — 대화 파일 정리 ② 매일 새벽 자동 실행.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-21k 를 먼저 실행한 뒤에 하세요.
--
-- ⚠️ 이 파일만 따로 떼어 둔 이유
--   예약 기능(pg_cron)은 Supabase 쪽 설정에 따라 실패할 수 있다. SQL Editor 는
--   스크립트를 **한 덩어리로** 돌려서, 뒤에서 하나 걸리면 앞의 것까지 전부
--   되돌아간다. 준비 단계가 그것 때문에 날아가지 않도록 갈랐다.
--
-- 이게 실패하면
--   왼쪽 메뉴 Database → Extensions 에서 **pg_cron** 을 찾아 켠 뒤 다시 돌린다.
--   그래도 안 되면 자동 실행만 못 하는 것이고, 관리 → 저장소의 '지금 정리' 버튼은
--   그대로 쓸 수 있다. 급한 기능이 아니다.
-- =====================================================================

create extension if not exists pg_cron;

-- 같은 이름으로 다시 걸면 먼저 걷어낸다(두 번 돌지 않게).
do $$
begin
  perform cron.unschedule('viren-chat-cleanup');
exception when others then null;
end $$;

-- 18:00 UTC = 03:00 한국. 아무도 안 쓰는 시간에.
select cron.schedule('viren-chat-cleanup', '0 18 * * *', $$select public.run_chat_cleanup()$$);

-- 결과 확인
select jobname as 이름, schedule as 시각, active as 켜짐
from cron.job where jobname = 'viren-chat-cleanup';
