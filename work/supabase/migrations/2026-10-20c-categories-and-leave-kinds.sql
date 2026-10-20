-- =====================================================================
-- VIREN WORK — 일정 분류(색 구분) + 휴가 종류 바꾸기.  2026-10-20
--
-- 운영 DB 에는 **이 파일만** Supabase → SQL Editor 에 붙여넣고 한 번 실행한다.
--
-- 무엇이 바뀌나
--   ① event_categories 테이블 — 일정 분류(이름 + 색). 관리자가 관리 화면에서 만든다.
--   ② events.category_id — 일정이 어느 분류인지. 분류를 지워도 일정은 남는다(색만 빠짐).
--   ③ 휴가 종류를 **연차 · 월차 · 반차(오전/오후) · 공가 · 대휴** 로 바꾼다.
--      병가 · 경조사 · 기타는 더 못 고른다(이미 올라간 문서는 그대로 남는다).
--   ④ leave_days() 가 **휴가 종류와 직위**까지 내준다. 달력에 '[연차] 박지은팀장' 으로 뜬다.
--
-- ⚠️ 연차에서 깎이는 종류: 연차 · 월차 · 반차. **공가와 대휴는 깎이지 않는다.**
--    (공가는 예비군·건강검진 같은 것, 대휴는 초과근무 보상이라 연차와 별개다.)
--    회사 규정이 다르면 src/lib/leave.js 의 COUNTED_KINDS 를 고친다.
-- =====================================================================

-- ① 일정 분류 -------------------------------------------------------
create table public.event_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  -- '#rrggbb' 형식만 받는다
  color      text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

alter table public.event_categories enable row level security;

create policy "분류는 재직자 누구나 본다" on public.event_categories
  for select to authenticated using (public.is_active_employee());

create policy "분류는 관리자만 만든다" on public.event_categories
  for insert to authenticated with check (public.is_admin());

create policy "분류는 관리자만 고친다" on public.event_categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "분류는 관리자만 지운다" on public.event_categories
  for delete to authenticated using (public.is_admin());

-- 새 테이블은 schema.sql 끝의 일괄 revoke 에 안 걸린다. 꼭 같이 적을 것.
revoke all on public.event_categories from anon;

-- ② 일정에 분류 붙이기 ----------------------------------------------
-- 분류를 지워도 일정은 남기고 색만 빠지게 한다(set null).
alter table public.events
  add column category_id uuid references public.event_categories(id) on delete set null;

-- ③ 휴가 종류 바꾸기 -------------------------------------------------
create or replace function public.check_leave_data(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  k   text := p->>'kind';
  s   date;
  e   date;
  d   numeric;
  wd  int;
begin
  -- 연차 · 월차 · 반차(오전/오후) · 공가 · 대휴
  if k is null or k not in ('annual', 'monthly', 'half_am', 'half_pm', 'public', 'comp') then
    raise exception '휴가 종류를 골라 주세요.';
  end if;
  begin
    s := (p->>'start')::date;
    e := coalesce(nullif(p->>'end', ''), p->>'start')::date;
  exception when others then
    raise exception '휴가 날짜를 확인해 주세요.';
  end;
  if s is null then raise exception '휴가 시작일을 넣어 주세요.'; end if;
  if e < s then raise exception '휴가 종료일이 시작일보다 빠릅니다.'; end if;

  if k in ('half_am', 'half_pm') then
    if e <> s then raise exception '반차는 하루만 고를 수 있습니다.'; end if;
    d := 0.5;
  else
    select count(*) into wd
    from generate_series(s, e, interval '1 day') g
    where extract(isodow from g) < 6;
    d := coalesce(nullif(p->>'days', '')::numeric, wd);
    if d <= 0 or d > wd or d * 2 <> floor(d * 2) then
      raise exception '휴가 일수를 확인해 주세요. (주말 제외 최대 %일)', wd;
    end if;
  end if;

  return p || jsonb_build_object('kind', k, 'start', s, 'end', e, 'days', d);
end $$;

-- ④ 달력에 띄울 승인된 휴가 — 종류와 직위까지 ------------------------
-- 반환 모양이 바뀌므로 먼저 지우고 다시 만든다.
drop function if exists public.leave_days(date, date);

create function public.leave_days(p_from date, p_to date)
returns table (user_id uuid, name text, job_title text, kind text, start_date date, end_date date)
language sql stable security definer set search_path = public as $$
  select d.drafter_id,
         e.name,
         e.position,  -- 바깥 이름은 job_title (position 은 SQL 예약어라 피했다)
         -- 옛 문서(병가·경조사·기타)는 종류를 밝히지 않고 '휴가'로 뭉뚱그린다.
         -- 건강·가정사가 전 직원 달력에 드러나지 않게.
         case when d.data->>'kind' in ('annual','monthly','half_am','half_pm','public','comp')
              then d.data->>'kind' else 'other' end,
         (d.data->>'start')::date,
         coalesce(nullif(d.data->>'end', ''), d.data->>'start')::date
  from approval_docs d
  join employees e on e.id = d.drafter_id
  where public.is_active_employee()
    and d.form_type = 'leave'
    and d.status = 'approved'
    and (d.data->>'start')::date <= p_to
    and coalesce(nullif(d.data->>'end', ''), d.data->>'start')::date >= p_from
$$;

revoke execute on function public.leave_days(date, date) from anon, public;
grant execute on function public.leave_days(date, date) to authenticated;
