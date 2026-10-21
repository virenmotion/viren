-- =====================================================================
-- VIREN WORK — 대화 파일 정리 ① 준비.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-21i(메신저) 를 먼저 실행한 뒤에 하세요.
-- ⚠️ 매일 새벽 자동 실행은 **다음 파일(2026-10-21l-cron.sql)** 에 따로 뒀습니다.
--    예약(pg_cron)은 Supabase 쪽 사정으로 실패할 수 있어서, 그것 때문에 이 준비까지
--    같이 되돌아가지 않도록 갈라 놓았습니다.
--
-- 왜
--   무료 저장소가 1GB 다. 휴대폰 사진 한 장이 10MB 쯤 되니 90장이면 찬다.
--   차면 **업로드가 조용히 멈춘다**(지은님 2026-10-21 결정: 60일).
--
-- 글은 남는다
--   사진만 사라지고 그 자리에 '기간이 지나 사라진 파일' 이라고 뜬다.
--   messages.file 에 { name, size, type, gone: true } 만 남긴다.
-- =====================================================================

-- 0) 먼저 있어야 할 표가 있는지 (없으면 앞 단계를 안 돌린 것)
select to_regclass('public.settings')    as settings표,
       to_regclass('public.push_config') as push_config표,
       to_regclass('public.messages')    as messages표;

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

-- 결과 확인
select
  (select chat_file_days from public.settings where id = 1) as 보관일수,
  (select cleanup_url is not null from public.push_config where id = 1) as 주소있음;
