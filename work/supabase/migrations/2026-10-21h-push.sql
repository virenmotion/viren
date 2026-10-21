-- =====================================================================
-- VIREN WORK — 결재 차례가 오면 휴대폰으로 알린다.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-21g 를 먼저 실행한 뒤에 이것을 실행하세요.
--
-- 얼개
--   DB 가 "이 문서에 알릴 일이 생겼다" 고 알려 주기만 한다.
--   누구에게 무슨 말을 보낼지는 **받는 쪽(work.viren.kr/api/notify)이 정한다.**
--   그래야 문구를 바꾸려고 DB 함수를 건드리지 않아도 된다.
--
--   결재선에 'pending' 이 생기면      → 그 사람에게
--   문서가 승인·반려로 끝나면          → 기안자에게
--
--   보내는 길은 pg_net 이다. **결재가 끝난 뒤 따로 날아간다** — 알림 서버가
--   죽어 있어도 결재는 정상으로 처리된다. 알림 때문에 업무가 막히면 안 된다.
-- =====================================================================

create extension if not exists pg_net;

-- ① 기기 등록 ----------------------------------------------------------
-- 한 사람이 여러 기기(휴대폰·PC)를 쓸 수 있다. endpoint 가 기기 하나.
create table if not exists public.push_subs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.employees(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  label      text,                       -- '아이폰' 처럼 사람이 알아볼 이름
  created_at timestamptz not null default now(),
  failed_at  timestamptz                 -- 보내다 410/404 가 나면 찍는다
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);

alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon;  -- 새 표는 schema.sql 끝의 일괄 revoke 에 안 걸린다

drop policy if exists "내 기기만 본다" on public.push_subs;
create policy "내 기기만 본다" on public.push_subs
  for select to authenticated using (user_id = auth.uid() and public.is_active_employee());

drop policy if exists "내 기기만 등록한다" on public.push_subs;
create policy "내 기기만 등록한다" on public.push_subs
  for insert to authenticated with check (user_id = auth.uid() and public.is_active_employee());

drop policy if exists "내 기기만 고친다" on public.push_subs;
create policy "내 기기만 고친다" on public.push_subs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "내 기기만 지운다" on public.push_subs;
create policy "내 기기만 지운다" on public.push_subs
  for delete to authenticated using (user_id = auth.uid());

-- ② 알림 서버 주소와 암호 ----------------------------------------------
-- ⚠️ settings 표에 두지 않는다. 그 표는 재직자 누구나 읽을 수 있다.
--    이 표는 **정책을 하나도 두지 않는다** → 아무도 직접 못 읽는다.
--    security definer 함수만 들여다본다.
create table if not exists public.push_config (
  id     int primary key default 1 check (id = 1),
  url    text,
  secret text
);
insert into public.push_config (id) values (1) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- ③ 알림 보내기(한 줄 던지고 잊는다) -----------------------------------
create or replace function public.notify_push(p_doc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.push_config;
begin
  select * into c from public.push_config where id = 1;
  if c.url is null or c.url = '' then return; end if;
  perform net.http_post(
    url     := c.url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-secret', coalesce(c.secret, '')),
    body    := jsonb_build_object('doc', p_doc),
    timeout_milliseconds := 5000
  );
exception when others then
  null;  -- 알림이 안 가도 결재는 되어야 한다
end $$;

revoke execute on function public.notify_push(uuid) from anon, public, authenticated;

-- ④ 언제 알릴지 --------------------------------------------------------
-- 함수(submit_doc·act_on_doc…)를 고치지 않고 **표의 변화**를 본다.
-- 기안·재기안·승인·반려 어느 길로 와도 빠짐없이 걸린다.
create or replace function public.push_on_step() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform public.notify_push(new.doc_id);
  end if;
  return null;
end $$;

drop trigger if exists push_step on public.approval_steps;
create trigger push_step after insert or update on public.approval_steps
  for each row execute function public.push_on_step();

create or replace function public.push_on_doc() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('approved', 'rejected') and old.status is distinct from new.status then
    perform public.notify_push(new.id);
  end if;
  return null;
end $$;

drop trigger if exists push_doc on public.approval_docs;
create trigger push_doc after update on public.approval_docs
  for each row execute function public.push_on_doc();

-- ⑤ 주소와 암호 넣기 ---------------------------------------------------
-- 아래 두 줄의 '여기에...' 자리를 Cloudflare 에 넣은 값과 **똑같이** 채운다.
update public.push_config
   set url    = 'https://work.viren.kr/api/notify',
       secret = '여기에_PUSH_SECRET_값'
 where id = 1;

-- 결과 확인
select url, case when secret is null or secret = '' then '비어 있음'
                 when secret like '여기에%' then '⚠️ 아직 안 채움'
                 else '채워짐' end as 암호
from public.push_config;
