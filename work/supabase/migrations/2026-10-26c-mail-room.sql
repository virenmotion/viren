-- =====================================================================
-- VIREN WORK — 메일 알림을 메신저 '메일' 방으로.  2026-10-26
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-26a 를 먼저 Run 한 뒤에 하세요.
--
-- 왜 이렇게 하나 (지은님: "카카오워크 메일 봇처럼 메신저 창으로 왔으면")
--   · 기록이 남는다 — 지나간 메일을 거슬러 볼 수 있다. 알림만 쏘면 사라진다.
--   · 휴대폰 알림은 **메신저가 이미 보낸다.** 알림 길을 하나 더 만들지 않는다.
--   · 여러 통이 와도 같은 방 알림이라 휴대폰에서 덮어쓴다(줄줄이 울리지 않는다).
-- =====================================================================

-- ① 보낸 사람이 없는 글(시스템이 쓴 글) ---------------------------------
-- ⚠️ 사람은 여전히 이런 글을 못 쓴다. 쓰기 정책이 sender_id = auth.uid() 라서
--    null 로는 통과하지 못한다. 서비스 열쇠를 쓰는 서버만 넣을 수 있다.
-- ⚠️ 지우기 정책도 sender_id = auth.uid() 라 **아무도 못 지운다**(관리자도).
--    그래서 아래 post_mail 이 90일 지난 것을 스스로 치운다.
alter table public.messages alter column sender_id drop not null;

-- ② '메일' 방을 어디에 적어 둘지 ----------------------------------------
-- 이름으로 찾으면 누가 다른 방을 '메일' 이라 지었을 때 섞인다. id 로 붙든다.
alter table public.mail_state
  add column if not exists room_id uuid references public.rooms(id) on delete set null;

-- ③ '메일' 방 만들기 · 재직자 넣기 --------------------------------------
create or replace function public.mail_room() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner uuid;
begin
  select room_id into v_id from mail_state where id = 1;
  -- 방이 지워졌으면 다시 만든다
  if v_id is not null and not exists (select 1 from rooms where id = v_id) then
    v_id := null;
  end if;

  if v_id is null then
    select id into v_owner from employees
     where active and role = 'admin' order by created_at limit 1;
    if v_owner is null then
      select id into v_owner from employees where active order by created_at limit 1;
    end if;
    if v_owner is null then raise exception '재직 중인 직원이 없습니다.'; end if;

    insert into rooms (kind, name, created_by) values ('group', '메일', v_owner)
    returning id into v_id;
    update mail_state set room_id = v_id where id = 1;
  end if;

  -- 재직자 전원. 새로 들어온 직원도 다음 메일 때 저절로 들어온다.
  -- ⚠️ 전 직원이 받는다는 결정(지은님 2026-10-26)이라, 방을 나가도 다시 들어온다.
  insert into room_members (room_id, user_id)
  select v_id, e.id from employees e
   where e.active
     and not exists (select 1 from room_members m where m.room_id = v_id and m.user_id = e.id);

  return v_id;
end $$;

-- ④ 메일 알림 올리기 ----------------------------------------------------
-- p_items 는 [{"from":"OpenAI","subject":"..."}, ...]
-- 글이 들어가면 on_message 방아쇠가 알아서 목록을 갱신하고 휴대폰 알림을 보낸다.
create or replace function public.post_mail(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_n int := 0; it jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return 0;
  end if;
  v_room := public.mail_room();

  for it in select value from jsonb_array_elements(p_items) loop
    insert into messages (room_id, sender_id, text)
    values (v_room, null,
      '새 메일 · ' || coalesce(nullif(btrim(it->>'from'), ''), '보낸사람 모름')
      || E'\n' || coalesce(nullif(btrim(it->>'subject'), ''), '(제목 없음)'));
    v_n := v_n + 1;
  end loop;

  -- 알림 기록이지 보관함이 아니다. 90일 지난 것은 치운다.
  delete from messages
   where room_id = v_room and sender_id is null
     and created_at < now() - interval '90 days';

  return v_n;
end $$;

revoke execute on function public.mail_room() from anon, public, authenticated;
revoke execute on function public.post_mail(jsonb) from anon, public, authenticated;
-- 서버(/api/mail-check)가 서비스 열쇠로 부른다
grant execute on function public.post_mail(jsonb) to service_role;

-- ⑤ 안 읽은 수 세기 고치기 ----------------------------------------------
-- ⚠️ 원래 `m.sender_id <> auth.uid()` 였다. 보낸 사람이 없는 글은
--    `NULL <> 나` 가 참이 아니라서(SQL 3값 논리) **메일 알림이 영원히
--    안 읽은 수에 안 잡힌다.** 배지가 안 뜬다. `is distinct from` 으로 바꾼다.
create or replace function public.unread_counts()
returns table (room_id uuid, n bigint)
language sql stable security definer set search_path = public as $$
  select m.room_id, count(*)
  from messages m
  join room_members rm on rm.room_id = m.room_id and rm.user_id = auth.uid()
  where public.is_active_employee()
    and m.created_at > rm.last_read_at
    and m.sender_id is distinct from auth.uid()
  group by m.room_id
$$;

-- ⑥ 지금 바로 방을 만들어 둔다(첫 메일을 기다리지 않게) -------------------
select public.mail_room() as 메일방;
