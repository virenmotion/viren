-- =====================================================================
-- VIREN WORK — 반차를 '종류' 에서 떼어낸다.  2026-10-21
--
-- Supabase → SQL Editor 에 붙여넣고 Run 한 번.
--
-- 왜
--   지금까지 반차는 그 자체가 휴가 '종류'(half_am / half_pm)였다. 그래서
--   **대휴를 반나절만 쓰는 것을 적을 수 없었다**(지은님 2026-10-21: "반차로 쓰면
--   0.5일로 빼야지"). 연차 반차만 되고 대휴·공가 반차는 안 되는 건 종류 칸 하나에
--   서로 다른 두 가지(무엇을 쓰는가 / 얼마나 쓰는가)를 욱여넣었기 때문이다.
--
-- 바뀌는 모양
--   전:  kind = annual | monthly | half_am | half_pm | public | comp
--   후:  kind = annual | monthly | public | comp        (무엇을 쓰는가)
--        half = null | 'am' | 'pm'                      (하루인가 반나절인가)
--   → 대휴 반차 = kind 'comp' + half 'am', 0.5일. 남은 대체휴무도 0.5 만 빠진다
--     (comp_balance 는 days 를 더하므로 손댈 것이 없다).
--
-- 옛 문서
--   ① 아래에서 half_am/half_pm 문서를 kind 'annual' + half 로 한 번에 바꾼다.
--   ② 그래도 검사식·달력은 옛 값을 계속 알아듣게 뒀다. 못 바꾼 줄이 남아 있거나
--      오래 열어 둔 화면이 옛 값을 보내도 터지지 않게.
-- =====================================================================

-- ① 옛 문서 정리 -------------------------------------------------------
update public.approval_docs
   set data = (data - 'kind') || jsonb_build_object(
         'kind', 'annual',
         'half', case when data->>'kind' = 'half_am' then 'am' else 'pm' end)
 where form_type = 'leave'
   and data->>'kind' in ('half_am', 'half_pm');

-- ② 휴가 내용 검사 -----------------------------------------------------
create or replace function public.check_leave_data(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  k     text := p->>'kind';
  h     text := nullif(p->>'half', '');
  arr   jsonb := p->'dates';
  s     date;
  e     date;
  d     numeric;
  wd    int;
  n     int;
  uniq  date[];
begin
  -- 옛 화면이 보낸 값도 받아 준다 (half_am → 연차 + 오전 반차)
  if k in ('half_am', 'half_pm') then
    h := right(k, 2);
    k := 'annual';
  end if;

  -- 연차 · 월차 · 공가 · 대휴
  if k is null or k not in ('annual', 'monthly', 'public', 'comp') then
    raise exception '휴가 종류를 골라 주세요.';
  end if;
  if h is not null and h not in ('am', 'pm') then
    raise exception '반차는 오전·오후 중에서 고르세요.';
  end if;

  if arr is not null and jsonb_typeof(arr) = 'array' and jsonb_array_length(arr) > 0 then
    -- ── 고른 날짜들 ──────────────────────────────────────────────
    begin
      select array_agg(distinct x::date order by x::date) into uniq
      from jsonb_array_elements_text(arr) x;
    exception when others then
      raise exception '휴가 날짜를 확인해 주세요.';
    end;

    n := coalesce(array_length(uniq, 1), 0);
    if n = 0 then raise exception '휴가 날짜를 골라 주세요.'; end if;
    if n > 60 then raise exception '한 번에 60일까지만 신청할 수 있습니다.'; end if;

    if h is not null then
      if n <> 1 then raise exception '반차는 하루만 고를 수 있습니다.'; end if;
      d := 0.5;
    else
      d := n;
    end if;

    s := uniq[1];
    e := uniq[n];
    return p || jsonb_build_object(
      'kind', k, 'half', h,
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

  if h is not null then
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

  return p || jsonb_build_object('kind', k, 'half', h, 'start', s, 'end', e, 'days', d);
end $$;

-- ③ 달력에 반차 여부까지 내준다 ----------------------------------------
drop function if exists public.leave_days(date, date);

create function public.leave_days(p_from date, p_to date)
returns table (user_id uuid, name text, job_title text, kind text, half text,
               start_date date, end_date date, dates jsonb)
language sql stable security definer set search_path = public as $$
  select d.drafter_id,
         e.name,
         e.position,  -- 바깥 이름은 job_title (position 은 SQL 예약어라 피했다)
         -- 옛 문서(병가·경조사·기타)는 종류를 밝히지 않고 '휴가'로 뭉뚱그린다.
         case when d.data->>'kind' in ('annual','monthly','public','comp')
                then d.data->>'kind'
              when d.data->>'kind' in ('half_am','half_pm')
                then 'annual'
              else 'other' end,
         case when d.data->>'kind' = 'half_am' then 'am'
              when d.data->>'kind' = 'half_pm' then 'pm'
              else nullif(d.data->>'half', '') end,
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

-- 결과 확인: 휴가 문서의 종류·반차·일수
select data->>'kind' as 종류, data->>'half' as 반차, data->>'days' as 일수, count(*)
from public.approval_docs where form_type = 'leave'
group by 1, 2, 3 order by 1, 2;
