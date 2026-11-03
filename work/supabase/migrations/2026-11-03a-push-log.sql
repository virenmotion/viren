-- =====================================================================
-- VIREN WORK — 알림 점검.  2026-11-03
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- 끝나면 **2026-11-03b 도** 이어서 Run 하세요(5분마다 결과 받아오기).
--
-- 왜 만드나
--   알림 보내기가 실패해도 **아무 데도 안 남았다.** `notify_push` 가 오류를
--   통째로 삼키고 있어서(그래야 알림이 안 가도 메시지는 올라간다), 지금까지는
--   `net._http_response` 를 직접 들여다보는 수밖에 없었다 — 거기 기록도
--   6시간이면 지워지고, 1분마다 도는 메일 점검에 묻혀서 잘 보이지도 않는다.
--   (2026-11-03 "6시 지나면 알림이 안 뜬다" 를 찾느라 이걸 겪었다)
--
-- 무엇이 생기나
--   push_log          보낸 기록 30일치
--   sync_push_log()   보낸 뒤에야 오는 응답을 기록에 채워 넣는다
--   push_health()     관리 화면이 읽는 목록
--   push_health_sum() 요약 한 줄
-- =====================================================================

-- ① 기록 테이블 ------------------------------------------------------
create table if not exists public.push_log (
  id         bigserial primary key,
  req_id     bigint,          -- net.http_post 가 준 번호. 응답을 이걸로 찾는다
  kind       text,            -- 'chat'(메신저·메일) | 'doc'(전자결재)
  src_id     uuid,            -- 그 메시지·문서
  created_at timestamptz not null default now(),
  status     int,             -- 응답 코드. null = 아직 응답을 못 받음
  sent       int,             -- 보낸 기기 수
  gone       int,             -- 등록이 끊겨 지운 기기 수
  note       text             -- 못 보낸 까닭
);

create index if not exists push_log_at on public.push_log (created_at desc);
-- 아직 응답을 못 받은 것만 빨리 찾는다(5분마다 도는 일이 쓴다).
create index if not exists push_log_wait on public.push_log (req_id) where status is null;

-- ⚠️ 정책을 하나도 두지 않는다 → 로그인한 사람도 직접 못 읽는다.
--    아래 push_health() 로만 본다(관리자만).
alter table public.push_log enable row level security;

-- ② 글을 JSON 으로 읽어 본다. 아니면 null — 터지지 않는다 ------------
--    응답이 늘 JSON 이라는 보장이 없다(관문이 HTML 오류 쪽을 돌려줄 때가 있다).
create or replace function public.try_jsonb(t text) returns jsonb
language plpgsql immutable set search_path = public as $$
begin
  return t::jsonb;
exception when others then
  return null;
end $$;

-- ③ 알림을 보낼 때 기록을 남긴다 -------------------------------------
--    ⚠️ 이 함수는 메시지가 올라갈 때 같이 돈다. **여기서 터지면 메시지가
--       안 올라간다.** 그래서 기록 남기는 것까지 한 번 더 감싼다.
create or replace function public.notify_push(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.push_config; v_req bigint;
begin
  select * into c from public.push_config where id = 1;
  if c.url is null or c.url = '' then
    insert into public.push_log(kind, src_id, note) values (p_kind, p_id, '보낼 주소가 비어 있어요');
    return;
  end if;
  v_req := net.http_post(
    url     := c.url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-secret', coalesce(c.secret, '')),
    body    := jsonb_build_object('kind', p_kind, 'id', p_id),
    timeout_milliseconds := 5000
  );
  insert into public.push_log(req_id, kind, src_id) values (v_req, p_kind, p_id);
exception when others then
  begin
    insert into public.push_log(kind, src_id, note) values (p_kind, p_id, '보내지 못했어요: ' || sqlerrm);
  exception when others then null;   -- 알림이 안 가도 일은 되어야 한다
  end;
end $$;

revoke execute on function public.notify_push(text, uuid) from anon, public, authenticated;

-- ④ 뒤늦게 오는 응답을 기록에 채운다 ---------------------------------
--    net.http_post 는 **보내 놓고 바로 끝난다.** 응답은 몇 초 뒤에야
--    net._http_response 에 들어오고, 거기서도 6시간이면 지워진다.
create or replace function public.sync_push_log() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  update public.push_log l
     set status = r.status_code,
         sent   = case when jsonb_typeof(public.try_jsonb(r.content) -> 'sent') = 'number'
                       then (public.try_jsonb(r.content) ->> 'sent')::int end,
         gone   = case when jsonb_typeof(public.try_jsonb(r.content) -> 'gone') = 'number'
                       then (public.try_jsonb(r.content) ->> 'gone')::int end,
         note   = case when r.status_code between 200 and 299 then l.note
                       else left(coalesce(r.error_msg, r.content, '응답이 비었어요'), 200) end
    from net._http_response r
   where r.id = l.req_id
     and l.status is null;
  get diagnostics n = row_count;

  -- 응답이 영영 안 온 것(관문이 죽었거나 시간이 넘었다). 6시간이면 판가름 난다.
  update public.push_log
     set status = 0, note = coalesce(note, '응답이 오지 않았어요')
   where status is null and created_at < now() - interval '6 hours';

  delete from public.push_log where created_at < now() - interval '30 days';
  return n;
exception when others then
  return -1;   -- 점검하다 터져서 다른 일을 막으면 안 된다
end $$;

-- ⑤ 관리 화면이 읽는 것 ----------------------------------------------
create or replace function public.push_health(p_days int default 3)
returns table (ts timestamptz, kind text, status int, sent int, gone int, note text)
language sql stable security definer set search_path = public as $$
  select l.created_at, l.kind, l.status, l.sent, l.gone, l.note
    from public.push_log l
   where public.is_admin()
     and l.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 3), 30)))
   order by l.created_at desc
   limit 200
$$;

create or replace function public.push_health_sum(p_days int default 3)
returns table (tries bigint, ok bigint, fail bigint, waiting bigint, devices bigint, last_ok timestamptz)
language sql stable security definer set search_path = public as $$
  select count(*),
         count(*) filter (where l.status between 200 and 299),
         count(*) filter (where l.status is not null and (l.status < 200 or l.status > 299)),
         count(*) filter (where l.status is null),
         (select count(*) from public.push_subs),
         max(l.created_at) filter (where l.status between 200 and 299)
    from public.push_log l
   where public.is_admin()
     and l.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 3), 30)))
$$;

grant execute on function public.push_health(int) to authenticated;
grant execute on function public.push_health_sum(int) to authenticated;

-- '지금 확인' 단추가 부른다. 관리자만.
create or replace function public.sync_push_log_now() returns int
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  return public.sync_push_log();
end $$;

grant execute on function public.sync_push_log_now() to authenticated;

-- 확인 — 지금까지 쌓인 게 없으니 0 줄이 맞습니다.
select count(*) as 기록 from public.push_log;
