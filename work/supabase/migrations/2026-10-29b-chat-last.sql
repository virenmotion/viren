-- 글을 지우면 **대화 목록 미리보기도 따라 바뀐다** (지은님 2026-10-29)
--
-- on_message 방아쇠는 insert 에만 달려 있었다. 그래서 마지막 글을 지워도
-- rooms.last_text 에 지운 글이 그대로 남아, 왼쪽 목록에서는 안 사라졌다.
--
-- ⚠️ 줄마다(for each row) 말고 **구문마다(for each statement)** 돈다.
--    메일 알림방은 90일 지난 글을 한 번에 지우는데, 줄마다 돌면 그때 수백 번 다시 센다.
--    바뀐 방만 한 번씩 다시 세면 된다.

create or replace function public.on_message_del() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update rooms r
     set last_at   = coalesce(m.created_at, r.created_at),
         last_text = case
           -- 메일 알림방은 '보낸사람 · 제목' 으로 적는다(글 본문이 아니라).
           when m.meta->>'kind' = 'mail'
             then left(coalesce(m.meta->>'from', '보낸사람 모름') || ' · '
                    || coalesce(m.meta->>'subject', '(제목 없음)'), 80)
           when m.file is not null and coalesce(m.text, '') = '' then '사진·파일'
           else left(m.text, 80)   -- 남은 글이 없으면 m 이 통째로 null → 미리보기도 빈다
         end
    from (select distinct old_rows.room_id from old_rows) g
    left join lateral (
      select * from messages where room_id = g.room_id
       order by created_at desc, id desc limit 1
    ) m on true
   where r.id = g.room_id;
  return null;
end $$;

drop trigger if exists on_message_del on public.messages;
create trigger on_message_del after delete on public.messages
  referencing old table as old_rows
  for each statement execute function public.on_message_del();
