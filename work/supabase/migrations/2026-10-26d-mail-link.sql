-- =====================================================================
-- VIREN WORK — 메일 알림을 카카오워크 봇처럼 '카드'로.  2026-10-26
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-26c 를 먼저 Run 한 뒤에 하세요.
--
-- 바뀌는 것 (지은님)
--   · 맨 위 '새 메일이 도착했습니다.' → 제목 → 보낸사람 → 내용 미리보기 → [자세히 읽기]
--   · '자세히 읽기' 가 여는 주소는 settings.mail_web_url (관리 → 회사 정보에서 넣는다)
-- =====================================================================

-- ① 카드에 쓸 값 -------------------------------------------------------
-- 글(text)은 그대로 둔다 — 휴대폰 알림과 대화 목록 미리보기가 그걸 쓴다.
-- 카드 모양으로 그리는 데 필요한 값만 meta 에 따로 담는다.
-- ⚠️ 사람이 자기 글에 meta 를 넣어도 카드로 그려지지 않는다.
--    화면은 **보낸 사람이 없는 글**일 때만 카드로 그린다. sender_id 는 쓰기 정책이
--    auth.uid() 로 묶어 두어서 사람은 비울 수 없다.
alter table public.messages add column if not exists meta jsonb;

-- ② '자세히 읽기' 가 여는 주소 ------------------------------------------
-- ⚠️ settings 는 '재직자 누구나 보는' 표다. 공유키·토큰이 붙은 주소는 넣지 말 것.
--    메일함 주소는 로그인해야 열리는 평범한 주소라 괜찮다.
alter table public.settings
  add column if not exists mail_web_url text not null default '';

comment on column public.settings.mail_web_url is
  '메신저 메일 알림의 ''자세히 읽기'' 가 여는 주소. 비우면 단추가 안 보인다.';

-- ③ 메일 알림 올리기 — 카드 값까지 -------------------------------------
-- p_items 는 [{"from":"OpenAI","subject":"...","preview":"..."}, ...]
create or replace function public.post_mail(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_n int := 0; it jsonb; v_from text; v_subj text; v_prev text;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return 0;
  end if;
  v_room := public.mail_room();

  for it in select value from jsonb_array_elements(p_items) loop
    v_from := coalesce(nullif(btrim(it->>'from'), ''), '보낸사람 모름');
    v_subj := coalesce(nullif(btrim(it->>'subject'), ''), '(제목 없음)');
    v_prev := nullif(btrim(coalesce(it->>'preview', '')), '');

    insert into messages (room_id, sender_id, text, meta)
    values (
      v_room, null,
      -- 글은 휴대폰 알림·대화 목록이 쓴다. 사람이 읽을 수 있는 두 줄.
      '새 메일 · ' || v_from || E'\n' || v_subj,
      jsonb_build_object('kind', 'mail', 'from', v_from, 'subject', v_subj, 'preview', v_prev)
    );
    v_n := v_n + 1;
  end loop;

  -- 알림 기록이지 보관함이 아니다. 90일 지난 것은 치운다.
  delete from messages
   where room_id = v_room and sender_id is null
     and created_at < now() - interval '90 days';

  return v_n;
end $$;

revoke execute on function public.post_mail(jsonb) from anon, public, authenticated;
grant execute on function public.post_mail(jsonb) to service_role;

select mail_web_url as 메일함주소 from public.settings where id = 1;
