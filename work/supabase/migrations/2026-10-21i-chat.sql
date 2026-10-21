-- =====================================================================
-- VIREN WORK — 사내 메신저.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-21h(알림) 를 먼저 실행한 뒤에 하세요. 알림 틀을 그대로 씁니다.
--
-- 생각의 뼈대
--   · 방(rooms) · 참가자(room_members) · 글(messages) 셋뿐이다.
--   · **읽음은 '읽은 시각' 하나로 센다**(last_read_at). 메시지마다 읽음 표시를
--     남기면 사람 수 × 글 수 만큼 줄이 쌓인다. 6명 회사에 그건 과하다.
--   · 1:1 방은 이름을 두지 않는다 — 보는 사람에 따라 이름이 다르기 때문에
--     (지은님에게는 '백승민 대표' 방, 백대표님에게는 '박지은 팀장' 방) 화면에서 만든다.
--   · 들어온 글은 Realtime 으로 바로 뜨고, 안 보고 있으면 휴대폰 알림이 간다.
-- =====================================================================

-- ① 방 ---------------------------------------------------------------
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'group' check (kind in ('direct', 'group')),
  name       text,                                   -- 단체방 이름. 1:1 은 비운다
  created_by uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now(),     -- 목록 정렬용
  last_text  text                                    -- 목록 미리보기
);
create index if not exists rooms_last_idx on public.rooms (last_at desc);

create table if not exists public.room_members (
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid not null references public.employees(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default 'epoch',
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members (user_id);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  sender_id  uuid not null references public.employees(id),
  text       text not null default '',
  file       jsonb,                                  -- { path, name, size, type }
  created_at timestamptz not null default now()
);
create index if not exists messages_room_idx on public.messages (room_id, created_at);

-- ② 내가 그 방 사람인가 -------------------------------------------------
-- ⚠️ security definer 다. 그래야 room_members 정책 안에서 room_members 를 봐도
--    정책이 자기 자신을 다시 부르는 꼬임(무한 재귀)이 생기지 않는다.
create or replace function public.in_room(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_employee()
     and exists (select 1 from room_members m where m.room_id = p_room and m.user_id = auth.uid())
$$;

-- ③ 누가 무엇을 볼 수 있나 ---------------------------------------------
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.messages     enable row level security;
revoke all on public.rooms, public.room_members, public.messages from anon;

drop policy if exists "내 방만 본다" on public.rooms;
create policy "내 방만 본다" on public.rooms
  for select to authenticated using (public.in_room(id));

drop policy if exists "내 방 사람만 본다" on public.room_members;
create policy "내 방 사람만 본다" on public.room_members
  for select to authenticated using (public.in_room(room_id));

-- 읽은 시각은 자기 줄만 고친다
drop policy if exists "내 읽은 시각만 고친다" on public.room_members;
create policy "내 읽은 시각만 고친다" on public.room_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "내 방 글만 본다" on public.messages;
create policy "내 방 글만 본다" on public.messages
  for select to authenticated using (public.in_room(room_id));

drop policy if exists "내 방에만 쓴다" on public.messages;
create policy "내 방에만 쓴다" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.in_room(room_id));

-- 보낸 사람이 자기 글을 지운다. 남의 글은 못 지운다(관리자도).
drop policy if exists "내 글만 지운다" on public.messages;
create policy "내 글만 지운다" on public.messages
  for delete to authenticated using (sender_id = auth.uid());

-- ④ 방 만들기 ----------------------------------------------------------
-- 남을 방에 넣어야 해서 함수로만 만든다(정책으로는 남의 줄을 못 넣는다).

-- 1:1 — 이미 있으면 그 방을 돌려준다. 같은 사람과 방이 여러 개 생기면 안 된다.
create or replace function public.open_direct(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if p_other = auth.uid() then raise exception '자기 자신과는 대화할 수 없습니다.'; end if;
  if not exists (select 1 from employees where id = p_other and active) then
    raise exception '없는 직원입니다.';
  end if;

  select r.id into v_id
  from rooms r
  where r.kind = 'direct'
    and (select count(*) from room_members m where m.room_id = r.id) = 2
    and exists (select 1 from room_members m where m.room_id = r.id and m.user_id = auth.uid())
    and exists (select 1 from room_members m where m.room_id = r.id and m.user_id = p_other)
  limit 1;
  if found then return v_id; end if;

  insert into rooms (kind, created_by) values ('direct', auth.uid()) returning id into v_id;
  insert into room_members (room_id, user_id) values (v_id, auth.uid()), (v_id, p_other);
  return v_id;
end $$;

-- 단체방
create or replace function public.create_group(p_name text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception '대화방 이름을 넣어 주세요.'; end if;
  if coalesce(array_length(p_members, 1), 0) = 0 then raise exception '같이 할 사람을 고르세요.'; end if;
  if exists (select 1 from unnest(p_members) u where not exists
             (select 1 from employees e where e.id = u and e.active)) then
    raise exception '퇴사했거나 없는 직원이 있습니다.';
  end if;

  insert into rooms (kind, name, created_by) values ('group', trim(p_name), auth.uid()) returning id into v_id;
  insert into room_members (room_id, user_id)
  select v_id, u from (select distinct unnest(p_members || auth.uid()) u) x;
  return v_id;
end $$;

-- 단체방에 나중에 사람 넣기 (방 사람이면 누구나)
create or replace function public.add_to_room(p_room uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.in_room(p_room) then raise exception '그 방 사람이 아닙니다.'; end if;
  if (select kind from rooms where id = p_room) <> 'group' then
    raise exception '1:1 대화에는 사람을 더할 수 없습니다.';
  end if;
  if not exists (select 1 from employees where id = p_user and active) then
    raise exception '없는 직원입니다.';
  end if;
  insert into room_members (room_id, user_id) values (p_room, p_user) on conflict do nothing;
end $$;

-- 단체방 나가기. 아무도 안 남으면 방과 글이 같이 사라진다.
create or replace function public.leave_room(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.in_room(p_room) then raise exception '그 방 사람이 아닙니다.'; end if;
  if (select kind from rooms where id = p_room) <> 'group' then
    raise exception '1:1 대화는 나갈 수 없습니다.';
  end if;
  delete from room_members where room_id = p_room and user_id = auth.uid();
  delete from rooms r where r.id = p_room
    and not exists (select 1 from room_members m where m.room_id = r.id);
end $$;

-- ⑤ 안 읽은 글 수 ------------------------------------------------------
-- 읽은 시각 뒤에 온, 내가 쓰지 않은 글만 센다.
create or replace function public.unread_counts()
returns table (room_id uuid, n bigint)
language sql stable security definer set search_path = public as $$
  select m.room_id, count(*)
  from messages m
  join room_members rm on rm.room_id = m.room_id and rm.user_id = auth.uid()
  where public.is_active_employee()
    and m.created_at > rm.last_read_at
    and m.sender_id <> auth.uid()
  group by m.room_id
$$;

create or replace function public.mark_read(p_room uuid) returns void
language sql security definer set search_path = public as $$
  update room_members set last_read_at = now()
  where room_id = p_room and user_id = auth.uid()
$$;

-- ⑥ 글이 올라오면: 목록 갱신 + 알림 --------------------------------------
-- 알림 틀(2026-10-21h)에 '무엇에 대한 알림인지'를 더한다.
create or replace function public.notify_push(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.push_config;
begin
  select * into c from public.push_config where id = 1;
  if c.url is null or c.url = '' then return; end if;
  perform net.http_post(
    url     := c.url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-secret', coalesce(c.secret, '')),
    body    := jsonb_build_object('kind', p_kind, 'id', p_id),
    timeout_milliseconds := 5000
  );
exception when others then
  null;  -- 알림이 안 가도 일은 되어야 한다
end $$;

-- 옛 이름은 그대로 두고 새 것으로 넘긴다(결재 쪽 트리거가 쓰고 있다).
create or replace function public.notify_push(p_doc uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_push('doc', p_doc);
end $$;

revoke execute on function public.notify_push(text, uuid) from anon, public, authenticated;
revoke execute on function public.notify_push(uuid) from anon, public, authenticated;

create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update rooms
     set last_at = new.created_at,
         last_text = case when new.file is not null and coalesce(new.text, '') = ''
                          then '사진·파일' else left(new.text, 80) end
   where id = new.room_id;
  -- 보낸 사람은 읽은 것으로 친다
  update room_members set last_read_at = new.created_at
   where room_id = new.room_id and user_id = new.sender_id;
  perform public.notify_push('chat', new.id);
  return null;
end $$;

drop trigger if exists on_message on public.messages;
create trigger on_message after insert on public.messages
  for each row execute function public.on_message();

-- ⑦ 실시간으로 받기 ----------------------------------------------------
-- 이 줄이 있어야 새 글이 화면에 바로 뜬다(없으면 새로고침해야 보인다).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

-- ⑧ 대화에 붙이는 파일 --------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', false)
on conflict (id) do nothing;

-- 경로 첫 칸이 방 id. 결재 첨부와 같은 방식.
create or replace function public.room_id_from_path(p text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end $$;

drop policy if exists "대화 파일 보기" on storage.objects;
create policy "대화 파일 보기" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-files' and public.in_room(public.room_id_from_path(name)));

drop policy if exists "대화 파일 올리기" on storage.objects;
create policy "대화 파일 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-files' and public.in_room(public.room_id_from_path(name)));

-- ⑨ 권한 ---------------------------------------------------------------
grant execute on function
  public.in_room(uuid), public.open_direct(uuid), public.create_group(text, uuid[]),
  public.add_to_room(uuid, uuid), public.leave_room(uuid),
  public.unread_counts(), public.mark_read(uuid), public.room_id_from_path(text)
to authenticated;

-- 결과 확인
select
  (select count(*) from public.rooms) as 방,
  (select count(*) from public.messages) as 글,
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages') as 실시간;
