-- =====================================================================
-- VIREN WORK — 메일 알림방을 일반 대화와 구분.  2026-10-26 (시안 확인 후)
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-26f 까지 먼저 Run 한 뒤에 하세요.
--
-- 바뀌는 것
--   ① rooms 에 칸 하나(feed). 그 방이 메일 알림방인지·공용인지 개인인지·
--      어느 주소에 걸려 있는지를 **방 자체가** 들고 있게 한다.
--      ⚠️ 이름이 '메일' 인지로 가리지 않는다. 누가 방 이름을 그렇게 지어도
--         메일방 행세를 못 하게 하려는 것이다.
--   ② 목록 미리보기를 '보낸사람 · 제목' 으로.
--   ③ 방 이름을 '대표메일 알림' · '내 메일 알림' 으로.
--
-- 권한(정책)은 **하나도 바꾸지 않는다.**
-- =====================================================================

alter table public.rooms add column if not exists feed jsonb;

comment on column public.rooms.feed is
  '메일 알림방 표시. {"kind":"mail","scope":"group|own","addr":"..."} · 보통 방은 비어 있다.';

-- ⚠️ 주소를 받으려고 **함수 모양이 바뀐다.** 같은 이름으로 매개변수만 늘리면
--    예전 것과 둘 다 남아서 "어느 것을 부를지 모르겠다" 오류가 난다. 먼저 지운다.
drop function if exists public.mail_room();
drop function if exists public.post_mail(jsonb);
drop function if exists public.mail_room_own(uuid);
drop function if exists public.post_own_mail(text, jsonb);

-- ① 공용 '대표메일 알림' 방 ---------------------------------------------
create or replace function public.mail_room(p_addr text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner uuid;
begin
  select room_id into v_id from mail_state where id = 1;
  if v_id is not null and not exists (select 1 from rooms where id = v_id) then
    v_id := null;   -- 방이 지워졌으면 다시 만든다
  end if;

  if v_id is null then
    select id into v_owner from employees
     where active and role = 'admin' order by created_at limit 1;
    if v_owner is null then
      select id into v_owner from employees where active order by created_at limit 1;
    end if;
    if v_owner is null then raise exception '재직 중인 직원이 없습니다.'; end if;

    insert into rooms (kind, name, created_by) values ('group', '대표메일 알림', v_owner)
    returning id into v_id;
    update mail_state set room_id = v_id where id = 1;
  end if;

  -- 이름·표시는 늘 맞춰 둔다(주소가 바뀌어도 따라간다)
  update rooms
     set name = '대표메일 알림',
         feed = jsonb_build_object('kind', 'mail', 'scope', 'group',
                                   'addr', nullif(btrim(coalesce(p_addr, '')), ''))
   where id = v_id;

  -- 재직자 전원. 새로 들어온 직원도 다음 메일 때 저절로 들어온다.
  insert into room_members (room_id, user_id)
  select v_id, e.id from employees e
   where e.active
     and not exists (select 1 from room_members m where m.room_id = v_id and m.user_id = e.id);

  return v_id;
end $$;

-- ② 개인 '내 메일 알림' 방 ----------------------------------------------
-- ⚠️ kind = 'direct'. 단체방이면 화면에 '+ 초대' 가 떠서, 누가 남을 넣으면
--    그 뒤로 오는 개인 메일이 그 사람에게도 간다.
create or replace function public.mail_room_own(p_user uuid, p_addr text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_user is null then return null; end if;
  select own_room_id into v_id from mail_state where id = 1;
  if v_id is not null and not exists (
    select 1 from rooms r join room_members m on m.room_id = r.id
     where r.id = v_id and m.user_id = p_user) then
    v_id := null;   -- 방이 없어졌거나 주인이 바뀌었다
  end if;

  if v_id is null then
    insert into rooms (kind, name, created_by) values ('direct', '내 메일 알림', p_user)
    returning id into v_id;
    insert into room_members (room_id, user_id) values (v_id, p_user);
    update mail_state set own_room_id = v_id where id = 1;
  end if;

  update rooms
     set name = '내 메일 알림',
         feed = jsonb_build_object('kind', 'mail', 'scope', 'own',
                                   'addr', nullif(btrim(coalesce(p_addr, '')), ''))
   where id = v_id;

  return v_id;
end $$;

-- ③ 글 올리기 — 목록 미리보기를 '보낸사람 · 제목' 으로 --------------------
-- ⚠️ on_message 방아쇠가 rooms.last_text 를 글 앞 80자로 적는다. 그대로 두면
--    '새 메일 · 보낸사람' 까지만 보인다. 다 올린 뒤에 한 번 고쳐 적는다.
create or replace function public.post_mail(p_items jsonb, p_addr text default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_n int := 0; it jsonb; v_from text; v_subj text; v_prev text;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return 0;
  end if;
  v_room := public.mail_room(p_addr);

  for it in select value from jsonb_array_elements(p_items) loop
    v_from := coalesce(nullif(btrim(it->>'from'), ''), '보낸사람 모름');
    v_subj := coalesce(nullif(btrim(it->>'subject'), ''), '(제목 없음)');
    v_prev := nullif(btrim(coalesce(it->>'preview', '')), '');

    insert into messages (room_id, sender_id, text, meta)
    values (v_room, null,
      '새 메일 · ' || v_from || E'\n' || v_subj,
      jsonb_build_object('kind', 'mail', 'from', v_from, 'subject', v_subj, 'preview', v_prev));
    v_n := v_n + 1;
  end loop;

  update rooms set last_text = left(v_from || ' · ' || v_subj, 80) where id = v_room;

  delete from messages
   where room_id = v_room and sender_id is null
     and created_at < now() - interval '90 days';

  return v_n;
end $$;

-- ⚠️ 개인 메일은 **내용 미리보기를 넣지 않는다.** 보낸사람·제목까지만.
create or replace function public.post_own_mail(p_email text, p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_room uuid; v_n int := 0; it jsonb; v_from text; v_subj text;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return 0;
  end if;
  select id into v_user from employees
   where lower(email) = lower(btrim(coalesce(p_email, ''))) and active limit 1;
  if v_user is null then return 0; end if;
  v_room := public.mail_room_own(v_user, p_email);

  for it in select value from jsonb_array_elements(p_items) loop
    v_from := coalesce(nullif(btrim(it->>'from'), ''), '보낸사람 모름');
    v_subj := coalesce(nullif(btrim(it->>'subject'), ''), '(제목 없음)');
    insert into messages (room_id, sender_id, text, meta)
    values (v_room, null,
      '새 메일 · ' || v_from || E'\n' || v_subj,
      jsonb_build_object('kind', 'mail', 'from', v_from, 'subject', v_subj, 'preview', null));
    v_n := v_n + 1;
  end loop;

  update rooms set last_text = left(v_from || ' · ' || v_subj, 80) where id = v_room;

  delete from messages
   where room_id = v_room and sender_id is null
     and created_at < now() - interval '90 days';

  return v_n;
end $$;

revoke execute on function public.mail_room(text) from anon, public, authenticated;
revoke execute on function public.mail_room_own(uuid, text) from anon, public, authenticated;
revoke execute on function public.post_mail(jsonb, text) from anon, public, authenticated;
revoke execute on function public.post_own_mail(text, jsonb) from anon, public, authenticated;
grant execute on function public.post_mail(jsonb, text) to service_role;
grant execute on function public.post_own_mail(text, jsonb) to service_role;

-- ④ 이미 있는 방에도 바로 반영 ------------------------------------------
-- (주소는 다음 메일이 올 때 Cloudflare 설정값으로 채워진다. 지금은 이름·표시만.)
update public.rooms r
   set name = '대표메일 알림',
       feed = coalesce(r.feed, '{}'::jsonb) || jsonb_build_object('kind', 'mail', 'scope', 'group')
  from public.mail_state s
 where s.id = 1 and r.id = s.room_id;

update public.rooms r
   set name = '내 메일 알림',
       feed = coalesce(r.feed, '{}'::jsonb) || jsonb_build_object('kind', 'mail', 'scope', 'own')
  from public.mail_state s
 where s.id = 1 and r.id = s.own_room_id;

-- 확인
select name as 방이름, kind as 종류, feed as 표시 from public.rooms where feed is not null;
