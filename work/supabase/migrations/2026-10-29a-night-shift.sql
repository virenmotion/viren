-- 자정을 넘겨 퇴근하면 **전날 근무로 합친다** (지은님 2026-10-29)
--
-- 그전에는 퇴근이 '오늘' 줄만 찾았다. 밤 10시에 출근해 새벽 1시에 퇴근을 누르면
-- 날짜가 이미 바뀌어 '오늘 출근 기록이 없습니다' 로 막히고, 근무가 다음날로 넘어갔다.
--
-- 기준: 아침 9시 전에 찍은 퇴근은, 오늘 출근 기록이 없고 어제 출근이 열려 있으면
--       **어제 날짜**에 적는다. 9시를 넘기면 그냥 '어제 퇴근을 안 찍었다' 로 둔다
--       (관리자가 근태 화면에서 고친다).

-- 합치는 기준 시각. 회사 기준이 바뀌면 **이 한 줄만** 고친다.
-- ⚠️ 화면 쪽에도 같은 값이 있다 — src/lib/worktime.js 의 NIGHT_END_H.
create or replace function public.night_end() returns time
language sql immutable set search_path = public as $$ select time '09:00' $$;

create or replace function public.check_out() returns attendance
language plpgsql security definer set search_path = public as $$
declare
  v_now   timestamptz := now();
  v_seoul timestamp   := v_now at time zone 'Asia/Seoul';
  v_today date        := v_seoul::date;
  v_date  date        := v_today;
  v_row   attendance;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;

  -- 밤을 넘긴 퇴근인가? 세 가지가 모두 맞을 때만 어제로 보낸다.
  if v_seoul::time < public.night_end()
     and not exists (select 1 from attendance
                      where user_id = auth.uid() and work_date = v_today
                        and check_in is not null)
     and exists (select 1 from attendance
                  where user_id = auth.uid() and work_date = v_today - 1
                    and check_in is not null and check_out is null)
  then
    v_date := v_today - 1;
  end if;

  update attendance
     set check_out = v_now, out_ip = host(public.request_ip())
   where user_id = auth.uid() and work_date = v_date and check_in is not null
  returning * into v_row;

  if not found then raise exception '오늘 출근 기록이 없습니다. 먼저 출근을 찍어 주세요.'; end if;
  return v_row;
end $$;
