import { minutesBetween, ymd } from './dates'

/* 하루 근무 기준. 홈과 근태가 **같은 셈법**을 쓰도록 여기 한 군데에 둔다.

   **100% = 9시간(540분)** — 출근해서 퇴근할 때까지 머문 시간이고, 점심 1시간이 그 안에
   들어 있다(= 실제 근무 8시간). 지은님 2026-10-21 확정, 2026-10-22 디자인 가이드에서 재확인.
   ⚠️ **점심 60분을 다시 빼지 않는다.**
   회사 기준이 바뀌면 FULL_MIN 한 줄만 고친다.

   ⚠️ 주간·월간 의무시간 같은 건 없다. 일별 결과를 그런 걸로 환산하지 않는다. */

export const FULL_MIN = 9 * 60

/* 하루치 분 → 화면에 쓸 값들.
   ⚠️ ratio 는 1 을 넘을 수 있다. 초과근무를 100% 로 잘라내지 않는다.
   ⚠️ 충족 판정(done)은 **반올림한 퍼센트가 아니라 실제 분**으로 한다. */
export function workStat(minutes) {
  const min = Math.max(0, Number(minutes) || 0)
  return {
    min,
    ratio: min / FULL_MIN,
    pct: Math.round((min / FULL_MIN) * 100),
    left: Math.max(FULL_MIN - min, 0),
    over: Math.max(min - FULL_MIN, 0),
    done: min >= FULL_MIN,
  }
}

/* 하루 근무 분. **홈과 근태가 반드시 같은 값을 써야 한다.**

   ⚠️ 퇴근 기록이 없는 날을 어떻게 보느냐가 핵심이다.
        오늘   → 지금까지의 경과시간 (근무 중)
        지난 날 → **0** (퇴근 찍는 걸 잊은 것이다)
      지난 날을 현재 시각까지 이어서 세면 하루가 20시간처럼 불어난다.

   (2026-10-22 전에는 근태 달력이 `minutesBetween(출근, 퇴근)` 만 써서,
    근무 중인 날은 퇴근이 비어 **0% 로 보였다.** 홈과 숫자가 달랐던 원인이다.) */
export function dayMinutes(row, date, now = new Date()) {
  if (!row?.check_in) return 0
  if (row.check_out) return minutesBetween(row.check_in, row.check_out)
  return date === ymd(now) ? minutesBetween(row.check_in, now) : 0
}

/* 지금 근무 중인 날인가 (오늘 + 출근은 찍었고 퇴근은 아직) */
export const isWorkingDay = (row, date, now = new Date()) =>
  !!row?.check_in && !row.check_out && date === ymd(now)

/* 막대 색. 글자 없이 색만으로 뜻을 전하지 않는다 — 쓰는 쪽에서 글자를 꼭 같이 둔다.
     now   근무 중 (노랑)
     done  딱 채움 (초록)
     over  넘김   (파랑)
     short 모자람 (주황 — UI 확장색이지 공식 CI 색이 아니다) */
export function workTone(minutes, working = false) {
  if (working) return 'now'
  const s = workStat(minutes)
  if (s.over > 0) return 'over'
  return s.done ? 'done' : 'short'
}
