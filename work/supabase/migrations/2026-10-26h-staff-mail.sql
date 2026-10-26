-- =====================================================================
-- VIREN WORK — 직원 각자의 개인 메일 알림 (2단계).  2026-10-26
--                                            (대표님 승인, 지은님 전달)
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-26g 까지 먼저 Run 한 뒤에 하세요.
--
-- 무엇을 하나
--   원하는 직원이 자기 카카오워크 IMAP 비밀번호를 넣으면, 서버가 1분마다 그 메일함을
--   보고 **본인만 들어가는 방**으로 알림을 보낸다.
--
-- 🔴 비밀번호를 어떻게 지키나 — **열쇠를 둘로 쪼갠다**
--   · 비밀번호는 AES-GCM 으로 **암호화해서** 이 표에 넣는다(secret).
--   · 푸는 열쇠(MAIL_KEY)는 **Cloudflare 환경변수에만** 둔다. 이 DB 에는 없다.
--   → Supabase 를 통째로 들여다봐도 **암호문만 보이고 못 푼다.** 두 군데를 다 가져야 열린다.
--
-- 🔴 이 표에는 **정책을 하나도 두지 않는다** → 로그인한 사람도 직접 못 읽는다.
--   화면은 /api/mymail 을 거쳐서만 **자기 줄의 안전한 값**(켜짐·마지막 확인·오류)만 본다.
--   비밀번호는 넣을 수만 있고 **아무도 다시 꺼내 볼 수 없다.**
-- =====================================================================

create table if not exists public.user_mail (
  user_id     uuid primary key references public.employees(id) on delete cascade,
  imap_user   text not null default '',   -- 그 사람 메일 주소(로그인 아이디)
  secret      text,                       -- 암호화된 비밀번호. 비면 아직 안 넣은 것
  room_id     uuid references public.rooms(id) on delete set null,
  on_off      boolean not null default true,
  -- 어디까지 봤는지 (mail_state 와 같은 뜻)
  uidvalidity bigint,
  last_uid    bigint,
  checked_at  timestamptz,
  last_error  text,
  last_note   text,                       -- 숫자만. 메일 내용·주소는 적지 않는다
  updated_at  timestamptz not null default now()
);

alter table public.user_mail enable row level security;
revoke all on public.user_mail from anon, authenticated;

-- ① 그 사람만 들어가는 '내 메일 알림' 방 --------------------------------
-- ⚠️ kind = 'direct'. 단체방이면 화면에 '+ 초대' 가 떠서, 누가 남을 넣으면
--    그 뒤로 오는 개인 메일이 그 사람에게도 간다.
create or replace function public.mail_room_user(p_user uuid, p_addr text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_user is null then return null; end if;
  select room_id into v_id from user_mail where user_id = p_user;

  if v_id is not null and not exists (
    select 1 from rooms r join room_members m on m.room_id = r.id
     where r.id = v_id and m.user_id = p_user) then
    v_id := null;   -- 방이 없어졌거나 주인이 바뀌었다
  end if;

  if v_id is null then
    insert into rooms (kind, name, created_by) values ('direct', '내 메일 알림', p_user)
    returning id into v_id;
    insert into room_members (room_id, user_id) values (v_id, p_user);
    update user_mail set room_id = v_id where user_id = p_user;
  end if;

  update rooms
     set name = '내 메일 알림',
         feed = jsonb_build_object('kind', 'mail', 'scope', 'own',
                                   'addr', nullif(btrim(coalesce(p_addr, '')), ''))
   where id = v_id;

  return v_id;
end $$;

-- ② 그 사람 방에 글 올리기 ----------------------------------------------
-- ⚠️ 개인 메일은 **내용 미리보기를 넣지 않는다.** 보낸사람·제목까지만.
create or replace function public.post_user_mail(p_user uuid, p_addr text, p_items jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_n int := 0; it jsonb; v_from text; v_subj text;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return 0;
  end if;
  if not exists (select 1 from employees where id = p_user and active) then return 0; end if;
  v_room := public.mail_room_user(p_user, p_addr);

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

revoke execute on function public.mail_room_user(uuid, text) from anon, public, authenticated;
revoke execute on function public.post_user_mail(uuid, text, jsonb) from anon, public, authenticated;
grant execute on function public.post_user_mail(uuid, text, jsonb) to service_role;

-- 확인 (아직 아무도 안 넣었으면 0줄)
select user_id, imap_user, on_off, secret is not null as 비밀번호있음 from public.user_mail;
