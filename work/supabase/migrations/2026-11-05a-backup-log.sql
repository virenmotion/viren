-- =====================================================================
-- VIREN WORK — 자료를 언제 받았는지 남긴다.  2026-11-05
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-11-05 현재 **아직 운영에 안 돌렸습니다.**
--
-- 왜 만드나
--   지금은 내려받아도 **아무 기록이 안 남는다.** 지난달에 받았는지, 받다가
--   실패했는지 알 길이 없다. 백업에서 제일 흔한 사고가 "받고 있는 줄 알았는데
--   몇 달째 안 받고 있었다" 이다.
--
-- 🔴 **자료 내용은 한 줄도 안 넣는다.**
--   남기는 것: 받은 때 · 누가 · 어떻게 됐나 · 표별 **건수** · 못 받은 것의 **까닭**.
--   직원 이름도, 문서 제목도, 메시지도 들어가지 않는다.
--
-- ⚠️ **기록이 실패하면 실패했다고 알린다.** 처음에는 오류를 통째로 삼켰는데
--    (`exception when others then null`), 그러면 화면이 "기록했다" 고 잘못 안다.
--    백업 자체를 막지 않으려면 **부르는 쪽에서** 가려야 한다 — 여기서 숨기면 안 된다.
--    (2026-11-05 바깥 검토 지적)
-- =====================================================================

create table if not exists public.backup_log (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  by_user   uuid references public.employees(id) on delete set null,
  -- 'ok' 다 받음 · 'partial' 받았지만 빠진 게 있음 · 'fail' 못 받음
  status    text not null check (status in ('ok', 'partial', 'fail')),
  rows      int,                     -- 표별 건수를 모두 더한 값
  counts    jsonb,                   -- {표 이름: 건수}
  problems  text[]                   -- 못 받은 것의 까닭(자료 내용 아님)
);

create index if not exists backup_log_at on public.backup_log (at desc);

-- ⚠️ 정책을 하나도 두지 않는다 → 로그인한 사람도 직접 못 읽는다.
--    아래 두 함수로만 쓴다(관리자만).
alter table public.backup_log enable row level security;

-- ① 받은 사실을 남긴다 ------------------------------------------------
--    ⚠️ **오류를 삼키지 않는다.** 실패하면 그대로 올려 보내고, 화면이
--       '내보내기는 됐지만 기록은 못 남겼다' 로 갈라서 보여 준다.
create or replace function public.backup_log_add(p_status text, p_counts jsonb, p_problems text[])
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_rows int; v_at timestamptz;
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  if p_status is null or p_status not in ('ok', 'partial', 'fail') then
    raise exception '상태는 ok · partial · fail 중 하나여야 해요';
  end if;

  -- 건수는 **숫자만** 더한다. 이상한 값이 와도 터지지 않게.
  select coalesce(sum((value)::int), 0) into v_rows
    from jsonb_each_text(coalesce(p_counts, '{}'::jsonb))
   where value ~ '^[0-9]+$';

  insert into public.backup_log (by_user, status, rows, counts, problems)
  values (auth.uid(), p_status, v_rows, coalesce(p_counts, '{}'::jsonb),
          -- 까닭이 길면 자른다. 어차피 사람이 읽을 한 줄이면 된다.
          (select array_agg(left(x, 300)) from unnest(coalesce(p_problems, '{}')) as x))
  returning at into v_at;

  return v_at;
end $$;

-- ② 지난 기록을 본다 --------------------------------------------------
create or replace function public.backup_log_list()
returns table (at timestamptz, status text, rows int, problems text[])
language sql stable security definer set search_path = public as $$
  select l.at, l.status, l.rows, l.problems
    from public.backup_log l
   where public.is_admin()
   order by l.at desc
   limit 20
$$;

grant execute on function public.backup_log_add(text, jsonb, text[]) to authenticated;
grant execute on function public.backup_log_list() to authenticated;

-- 확인 — 아직 받은 적이 없으니 0 줄이 맞습니다.
select count(*) as 기록 from public.backup_log;
