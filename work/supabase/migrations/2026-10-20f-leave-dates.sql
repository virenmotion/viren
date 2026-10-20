-- =====================================================================
-- VIREN WORK — 휴가를 '기간'이 아니라 '고른 날짜들'로.  2026-10-20
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 왜
--   지금까지는 시작일~종료일 한 덩어리만 받아서, **띄엄띄엄 쉬는 연차**를 한 장으로
--   낼 수 없었다(10/22, 10/27, 10/30 처럼). 이제 달력에서 날짜를 여러 개 고른다.
--
-- 저장 모양
--   data = { kind, dates: ["2026-10-22","2026-10-27"], start, end, days }
--   · dates 가 진짜다. start·end 는 그중 처음과 마지막이며 **옛 화면·통계가 쓰던 값**이라
--     계속 같이 채워 둔다(근태표·달력이 둘 다 볼 수 있게).
--   · days 는 서버가 센다. 반차면 0.5, 아니면 고른 날 수.
--   · 옛 문서(dates 없음)는 그대로 둔다. dates 가 없으면 예전 방식대로 검사한다.
-- =====================================================================

create or replace function public.check_leave_data(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  k     text := p->>'kind';
  arr   jsonb := p->'dates';
  s     date;
  e     date;
  d     numeric;
  wd    int;
  n     int;
  uniq  date[];
begin
  -- 연차 · 월차 · 반차(오전/오후) · 공가 · 대휴
  if k is null or k not in ('annual', 'monthly', 'half_am', 'half_pm', 'public', 'comp') then
    raise exception '휴가 종류를 골라 주세요.';
  end if;

  if arr is not null and jsonb_typeof(arr) = 'array' and jsonb_array_length(arr) > 0 then
    -- ── 새 방식: 고른 날짜들 ──────────────────────────────────────
    begin
      select array_agg(distinct x::date order by x::date) into uniq
      from jsonb_array_elements_text(arr) x;
    exception when others then
      raise exception '휴가 날짜를 확인해 주세요.';
    end;

    n := coalesce(array_length(uniq, 1), 0);
    if n = 0 then raise exception '휴가 날짜를 골라 주세요.'; end if;
    if n > 60 then raise exception '한 번에 60일까지만 신청할 수 있습니다.'; end if;

    if k in ('half_am', 'half_pm') then
      if n <> 1 then raise exception '반차는 하루만 고를 수 있습니다.'; end if;
      d := 0.5;
    else
      d := n;
    end if;

    s := uniq[1];
    e := uniq[n];
    return p || jsonb_build_object(
      'kind', k,
      'dates', to_jsonb(uniq),
      'start', s, 'end', e, 'days', d
    );
  end if;

  -- ── 옛 방식: 시작일~종료일 (옛 화면이 보낸 것) ────────────────────
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

-- 달력이 '고른 날'만 정확히 칠할 수 있도록 dates 를 같이 내준다.
drop function if exists public.leave_days(date, date);

create function public.leave_days(p_from date, p_to date)
returns table (user_id uuid, name text, job_title text, kind text,
               start_date date, end_date date, dates jsonb)
language sql stable security definer set search_path = public as $$
  select d.drafter_id,
         e.name,
         e.position,  -- 바깥 이름은 job_title (position 은 SQL 예약어라 피했다)
         -- 옛 문서(병가·경조사·기타)는 종류를 밝히지 않고 '휴가'로 뭉뚱그린다.
         case when d.data->>'kind' in ('annual','monthly','half_am','half_pm','public','comp')
              then d.data->>'kind' else 'other' end,
         (d.data->>'start')::date,
         coalesce(nullif(d.data->>'end', ''), d.data->>'start')::date,
         -- 없으면 null. 화면이 null 이면 옛 방식(기간)으로 칠한다.
         case when jsonb_typeof(d.data->'dates') = 'array' then d.data->'dates' else null end
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
