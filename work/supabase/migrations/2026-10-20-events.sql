-- =====================================================================
-- VIREN WORK — 캘린더(일정) 추가.  2026-10-20
--
-- 운영 DB 에는 **이 파일만** Supabase 대시보드 → SQL Editor 에 붙여넣고 한 번 실행한다.
-- (schema.sql 은 처음 설치할 때만 쓰는 파일이다. 같은 내용이 거기에도 들어가 있다.)
--
-- 무엇이 생기나
--   · events 테이블 — 회사 공용 일정. 재직자 누구나 올리고, 올린 사람과 관리자가 고친다.
--   · leave_days() 함수 — 달력에 '누가 언제 쉬는지'를 띄우기 위한 것.
--     결재 문서 자체는 기안자·결재선·참조자·관리자만 볼 수 있어서, 그대로 두면
--     남의 휴가를 달력에 띄울 수 없다. 그래서 **이름·날짜·반차 여부만** 따로 내준다.
--     ⚠️ 휴가 종류(병가·경조사)는 **일부러 내주지 않는다.** 건강·가정사가 전 직원에게
--        퍼지지 않도록. 달력에는 '박지은 휴가' / '박지은 반차' 로만 뜬다.
-- =====================================================================

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) > 0),
  start_date date not null,
  end_date   date not null,
  -- all_day 면 시간 없음. 아니면 start_time 필수.
  all_day    boolean not null default true,
  start_time time,
  end_time   time,
  place      text not null default '',
  memo       text not null default '',
  created_by uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_period check (end_date >= start_date),
  constraint events_time check (
    case when all_day then start_time is null and end_time is null
         else start_time is not null end
  ),
  constraint events_time_order check (
    all_day or start_date <> end_date or end_time is null or end_time >= start_time
  )
);

create index on public.events (start_date, end_date);

alter table public.events enable row level security;

create policy "일정은 재직자 누구나 본다" on public.events
  for select to authenticated using (public.is_active_employee());

create policy "일정은 재직자가 올린다" on public.events
  for insert to authenticated
  with check (public.is_active_employee() and created_by = auth.uid());

create policy "일정은 올린 사람이나 관리자가 고친다" on public.events
  for update to authenticated
  using (public.is_active_employee() and (created_by = auth.uid() or public.is_admin()))
  with check (public.is_active_employee() and (created_by = auth.uid() or public.is_admin()));

create policy "일정은 올린 사람이나 관리자가 지운다" on public.events
  for delete to authenticated
  using (public.is_active_employee() and (created_by = auth.uid() or public.is_admin()));

-- 달력에 띄울 '승인된 휴가'. 이름·기간·반차 여부만 내준다(휴가 종류는 내주지 않는다).
create function public.leave_days(p_from date, p_to date)
returns table (user_id uuid, name text, start_date date, end_date date, half boolean)
language sql stable security definer set search_path = public as $$
  select d.drafter_id,
         e.name,
         (d.data->>'start')::date,
         (d.data->>'end')::date,
         (d.data->>'kind') in ('half_am', 'half_pm')
  from approval_docs d
  join employees e on e.id = d.drafter_id
  where public.is_active_employee()
    and d.form_type = 'leave'
    and d.status = 'approved'
    and (d.data->>'start')::date <= p_to
    and (d.data->>'end')::date >= p_from
$$;

revoke all on public.events from anon;  -- 새 테이블은 schema.sql 끝의 일괄 revoke 에 안 걸린다
revoke execute on function public.leave_days(date, date) from anon, public;
grant execute on function public.leave_days(date, date) to authenticated;
