-- =====================================================================
-- VIREN WORK — 대표메일에 새 메일이 오면 전 직원에게 알림.  2026-10-26
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 예약(pg_cron)은 **맨 아래에 따로** 떼어 두었다. 2026-10-21l 과 같은 까닭 —
--    SQL Editor 는 한 덩어리로 돌려서 뒤에서 하나 걸리면 앞의 것까지 되돌아간다.
--    위쪽을 먼저 Run 하고, 아래쪽을 따로 Run 하세요.
--
-- 메일 자체는 우리 DB 에 들어오지 않는다. 여기 적히는 건 '몇 번까지 봤는지' 뿐이다.
-- =====================================================================

-- ① 어디까지 봤는지 ----------------------------------------------------
-- ⚠️ 정책을 하나도 두지 않는다 → 로그인한 사람도 직접 못 읽는다.
--    서비스 키를 쓰는 /api/mail-check 만 들여다본다.
create table if not exists public.mail_state (
  id          int primary key default 1 check (id = 1),
  uidvalidity bigint,        -- 메일함이 통째로 갈리면 이 번호가 바뀐다
  last_uid    bigint,        -- 여기까지는 이미 알렸다
  checked_at  timestamptz,   -- 마지막으로 들여다본 때
  last_error  text           -- 실패했으면 까닭(안 오는 이유를 알려면 필요하다)
);
insert into public.mail_state (id) values (1) on conflict (id) do nothing;
alter table public.mail_state enable row level security;
revoke all on public.mail_state from anon, authenticated;

-- ② 메일 확인하러 가는 주소 --------------------------------------------
-- push_config 에 칸 하나를 더한다(이 표도 아무도 직접 못 읽는다).
alter table public.push_config add column if not exists mail_url text;

-- ③ 메일 확인 깨우기 ---------------------------------------------------
create or replace function public.run_mail_check() returns void
language plpgsql security definer set search_path = public as $$
declare c public.push_config;
begin
  select * into c from public.push_config where id = 1;
  if c.mail_url is null or c.mail_url = '' then return; end if;
  perform net.http_post(
    url     := c.mail_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-secret', coalesce(c.secret, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
exception when others then
  null;  -- 메일 확인이 실패해도 나머지는 돌아야 한다
end $$;

revoke execute on function public.run_mail_check() from anon, public, authenticated;

-- ④ 주소 넣기 ----------------------------------------------------------
update public.push_config
   set mail_url = 'https://work.viren.kr/api/mail-check'
 where id = 1;

-- 확인 (secret 은 보이지 않게 있는지만)
select url is not null as 알림주소, cleanup_url is not null as 정리주소,
       mail_url as 메일주소, secret is not null as 암호있음
  from public.push_config where id = 1;
