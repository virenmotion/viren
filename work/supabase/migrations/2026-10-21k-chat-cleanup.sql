-- =====================================================================
-- VIREN WORK — 대화에 붙인 사진·파일을 60일 뒤 스스로 지운다.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-21i(메신저) 를 먼저 실행한 뒤에 하세요.
--
-- 왜
--   무료 저장소가 1GB 다. 휴대폰 사진 한 장이 10MB 쯤 되니 90장이면 찬다.
--   차면 **업로드가 조용히 멈춘다**(지은님 2026-10-21 결정: 60일).
--
-- 누가 지우나
--   **사람이 아니라 서버가 한다.** 매일 새벽 3시(한국)에 pg_cron 이 깨워서
--   work.viren.kr/api/cleanup 을 부른다. 아무도 컴퓨터를 켜 두지 않아도 돈다.
--   ⚠️ 저장소 파일은 SQL 로 못 지운다(42501). 반드시 Storage API 를 거쳐야 해서
--      알림과 같은 길(pg_net → Cloudflare 함수)을 쓴다.
--
-- 글은 남는다
--   사진만 사라지고 그 자리에 '기간이 지나 사라진 파일' 이라고 뜬다.
--   messages.file 에 { name, size, type, gone: true } 만 남긴다.
-- =====================================================================

-- ① 며칠 두고 지울지 ----------------------------------------------------
-- settings 에 둔다. 비밀이 아니고, 나중에 관리 화면에서 바꿀 값이다.
alter table public.settings
  add column if not exists chat_file_days int not null default 60;

-- ② 정리를 부르는 주소 ---------------------------------------------------
alter table public.push_config
  add column if not exists cleanup_url text;

update public.push_config
   set cleanup_url = 'https://work.viren.kr/api/cleanup'
 where id = 1;

-- ③ 정리 깨우기 ---------------------------------------------------------
create or replace function public.run_chat_cleanup() returns void
language plpgsql security definer set search_path = public as $$
declare c public.push_config;
begin
  select * into c from public.push_config where id = 1;
  if c.cleanup_url is null or c.cleanup_url = '' then return; end if;
  perform net.http_post(
    url     := c.cleanup_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-secret', coalesce(c.secret, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
exception when others then
  null;  -- 정리가 실패해도 대화는 되어야 한다
end $$;

revoke execute on function public.run_chat_cleanup() from anon, public, authenticated;

-- ④ 저장소 사용량 (관리 화면에 보여 준다) --------------------------------
-- 실제 버킷을 세는 게 아니라 **우리가 적어 둔 크기를 더한다.**
-- storage 표는 직접 못 읽어서다. 올릴 때 size 를 같이 적어 두니 값은 맞는다.
create or replace function public.storage_usage()
returns table (kind text, files bigint, bytes bigint)
language sql stable security definer set search_path = public as $$
  select '대화 파일',
         count(*),
         coalesce(sum((m.file->>'size')::bigint), 0)
  from messages m
  where public.is_admin()
    and m.file ? 'path'
  union all
  select '결재 첨부',
         count(*),
         coalesce(sum(f.size), 0)
  from approval_files f
  where public.is_admin()
$$;

grant execute on function public.storage_usage() to authenticated;

-- ⑤ 매일 새벽 3시(한국) ---------------------------------------------------
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
select
  (select chat_file_days from public.settings where id = 1) as 보관일수,
  (select cleanup_url is not null from public.push_config where id = 1) as 주소있음,
  (select count(*) from cron.job where jobname = 'viren-chat-cleanup') as 예약됨;
