import { addMonths, addYears, today } from './dates'

/* 연차 계산 — 입사일 기준.
   근로기준법 제60조 방식을 따른다.
     · 1년 미만: 한 달 개근마다 1일 (최대 11일)
     · 1년 이상: 15일, 3년차부터 2년마다 1일 추가 (최대 25일)
   ⚠️ 상시 5인 미만 사업장은 법 적용 대상이 아니다. 회사 규정이 따로 있으면
   관리자 화면에서 직원별 '연차 직접 지정'에 일수를 넣으면 그 값이 우선한다. */

/* 연차에서 깎이는 종류. **공가·대휴는 깎이지 않는다**(공가는 예비군·건강검진 같은 것,
   대휴는 초과근무 보상이라 연차와 별개다). 회사 규정이 다르면 여기만 고치면 된다. */
export const COUNTED_KINDS = ['annual', 'monthly', 'half_am', 'half_pm']

export function leavePeriod(hireDate, on = today()) {
  if (!hireDate || hireDate > on) return null
  let years = 0
  while (addYears(hireDate, years + 1) <= on) years++

  if (years === 0) {
    let months = 0
    while (months < 11 && addMonths(hireDate, months + 1) <= on) months++
    return { start: hireDate, end: addYears(hireDate, 1), legal: months, years }
  }
  const start = addYears(hireDate, years)
  return { start, end: addYears(hireDate, years + 1), legal: Math.min(25, 15 + Math.floor((years - 1) / 2)), years }
}

/* docs: 본인의 휴가 문서들 (approval_docs 행) */
export function leaveSummary(employee, docs, on = today()) {
  const period = leavePeriod(employee?.hire_date, on)
  if (!period) return null
  const override = employee.leave_override
  const entitled = override != null ? Number(override) : period.legal
  const inPeriod = (d) =>
    d.form_type === 'leave' && COUNTED_KINDS.includes(d.data?.kind) &&
    d.data.start >= period.start && d.data.start < period.end
  const sum = (status) =>
    docs.filter((d) => d.status === status && inPeriod(d)).reduce((a, d) => a + Number(d.data.days || 0), 0)
  /* 이전 시스템(카카오워크)에서 쓴 연차. 우리 시스템에는 문서가 없으니 숫자로만 뺀다.
     ⚠️ 연차 기간이 바뀌면(입사 1년마다) 이 값도 0 으로 되돌려야 한다 — 지난 기간에
        쓴 걸 새 기간에서 계속 빼면 안 된다. 지금은 사람이 직접 고친다. */
  const usedBefore = Number(employee.leave_used_before || 0)
  const used = sum('approved') + usedBefore
  const pending = sum('pending')
  return { ...period, entitled, overridden: override != null, used, usedBefore, pending, remaining: entitled - used }
}
