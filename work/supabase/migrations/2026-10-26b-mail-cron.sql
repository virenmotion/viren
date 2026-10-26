-- =====================================================================
-- VIREN WORK — 메일 확인을 1분마다 자동 실행.  2026-10-26
--
-- ⚠️ 2026-10-26a 를 먼저 Run 한 뒤에 하세요.
--
-- 이게 실패하면
--   왼쪽 메뉴 Database → Extensions 에서 **pg_cron** 을 켠 뒤 다시 Run.
--   (대화 파일 정리가 이미 pg_cron 으로 돌고 있으니 켜져 있을 겁니다.)
-- =====================================================================

create extension if not exists pg_cron;

-- 같은 이름으로 다시 걸면 먼저 걷어낸다(두 번 돌지 않게).
do $$
begin
  perform cron.unschedule('viren-mail-check');
exception when others then null;
end $$;

-- 1분마다. 새 게 없으면 STATUS 한 번만 묻고 끝나서 가볍다.
select cron.schedule('viren-mail-check', '* * * * *', $$select public.run_mail_check()$$);

-- 결과 확인
select jobname as 이름, schedule as 시각, active as 켜짐
from cron.job where jobname = 'viren-mail-check';
