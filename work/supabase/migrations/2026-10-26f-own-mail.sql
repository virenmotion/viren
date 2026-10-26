-- =====================================================================
-- VIREN WORK — 개인 메일은 '내 메일' 방으로, 본인만.  2026-10-26
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-26d 를 먼저 Run 한 뒤에 하세요.
--
-- 1단계 (지은님 2026-10-26)
--   지금도 보고 있는 메일함(MAIL_USER) 하나에서,
--     · MAIL_GROUP 으로 온 것  → 모두가 보는 '메일' 방   (지금까지 하던 것)
--     · 그 밖의 것(개인 메일)  → **그 사람만 보는 '내 메일' 방**  (여기서 더하는 것)
--   새로 저장하는 비밀번호는 없다. 이미 있는 그 메일함 하나를 더 쓸 뿐이다.
--
-- ⚠️ '내 메일' 방은 kind = 'direct' 로 만든다. 단체방으로 만들면 화면에
--    **'+ 초대'** 가 떠서, 누가 남을 넣으면 그 뒤로 오는 개인 메일이 그 사람에게도 간다.
--    direct 방에는 초대·나가기 단추가 아예 없다.
-- =====================================================================

alter table public.mail_state
  add column if not exists own_room_id uuid references public.rooms(id) on delete set null;

-- ① '내 메일' 방 (한 사람짜리) -----------------------------------------
create or replace function public.mail_room_own(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_user is null then return null; end if;
  select own_room_id into v_id from mail_state where id = 1;

  -- 방이 없어졌거나 주인이 바뀌었으면 새로 만든다
  if v_id is not null and not exists (
    select 1 from rooms r
      join room_members m on m.room_id = r.id
     where r.id = v_id and m.user_id = p_user) then
    v_id := null;
  end if;

  if v_id is null then
    insert into rooms (kind, name, created_by) values ('direct', '내 메일', p_user)
    returning id into v_id;
    insert into room_members (room_id, user_id) values (v_id, p_user);
    update mail_state set own_room_id = v_id where id = 1;
  end if;

  return v_id;
end $$;

-- ② 개인 메일 올리기 ----------------------------------------------------
-- p_email 은 메일함 주인(MAIL_USER). 그 사람이 재직 중인 직원이 아니면 아무것도 안 한다.
-- ⚠️ 개인 메일은 **내용 미리보기를 넣지 않는다.** 보낸사람·제목까지만.
create or replace function public.post_own_mail(p_email text, p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_room uuid; v_n int := 0; it jsonb; v_from text; v_subj text;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return 0;
  end if;

  select id into v_user from employees
   where lower(email) = lower(btrim(coalesce(p_email, ''))) and active
   limit 1;
  if v_user is null then return 0; end if;

  v_room := public.mail_room_own(v_user);

  for it in select value from jsonb_array_elements(p_items) loop
    v_from := coalesce(nullif(btrim(it->>'from'), ''), '보낸사람 모름');
    v_subj := coalesce(nullif(btrim(it->>'subject'), ''), '(제목 없음)');
    insert into messages (room_id, sender_id, text, meta)
    values (v_room, null,
      '새 메일 · ' || v_from || E'\n' || v_subj,
      jsonb_build_object('kind', 'mail', 'from', v_from, 'subject', v_subj, 'preview', null));
    v_n := v_n + 1;
  end loop;

  -- 알림 기록이지 보관함이 아니다. 90일 지난 것은 치운다.
  delete from messages
   where room_id = v_room and sender_id is null
     and created_at < now() - interval '90 days';

  return v_n;
end $$;

revoke execute on function public.mail_room_own(uuid) from anon, public, authenticated;
revoke execute on function public.post_own_mail(text, jsonb) from anon, public, authenticated;
grant execute on function public.post_own_mail(text, jsonb) to service_role;

-- 확인 (아직 방은 없다 — 첫 개인 메일이 올 때 생긴다)
select own_room_id as 내메일방 from public.mail_state where id = 1;
