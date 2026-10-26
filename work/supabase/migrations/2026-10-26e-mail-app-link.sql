-- =====================================================================
-- VIREN WORK — 메일 카드 '자세히 읽기' 를 카카오워크 **앱**으로.  2026-10-26
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
-- ⚠️ 2026-10-26d 를 먼저 Run 한 뒤에 하세요.
--
-- 왜 사람마다 따로 두나 (2026-10-26 알아낸 것)
--   카카오워크 앱으로 들어가는 주소는 `https://kakaowork.com/archives/<코드>` 이고,
--   이건 **그 사람의 '카카오워크 메일' 대화방**을 가리킨다. 대화방 번호가 사람마다
--   달라서 한 주소를 모두가 쓸 수 없다. 그래서 각자 자기 것을 한 번 넣는다.
--   안 넣은 사람은 settings.mail_web_url(웹 메일함)로 간다 — 그래도 열리긴 한다.
-- =====================================================================

create table if not exists public.user_prefs (
  user_id      uuid primary key references public.employees(id) on delete cascade,
  -- 내 카카오워크 메일 대화방 주소. 비우면 웹 메일함으로 간다.
  mail_app_url text not null default '',
  updated_at   timestamptz not null default now()
);

alter table public.user_prefs enable row level security;
revoke all on public.user_prefs from anon;

-- ⚠️ **내 줄만** 보고 고친다. 남의 것은 읽지도 못한다.
drop policy if exists "내 것만 본다" on public.user_prefs;
create policy "내 것만 본다" on public.user_prefs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "내 것만 넣는다" on public.user_prefs;
create policy "내 것만 넣는다" on public.user_prefs
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_employee());

drop policy if exists "내 것만 고친다" on public.user_prefs;
create policy "내 것만 고친다" on public.user_prefs
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 확인
select count(*) as 줄수 from public.user_prefs;
