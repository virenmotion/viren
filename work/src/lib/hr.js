import { parse, today } from './dates'

/* 인사기록 계산. (지은님 2026-10-22, 노션 '직원현황관리·직원경력관리' 를 옮김)
   노션은 수식으로 했는데, 수식은 칸 하나만 건드려도 조용히 깨진다. 여기서 센다. */

const DAY = 86400000

export const EDU_LEVELS = ['고졸', '전문학사', '학사', '석사', '박사']

/* 엔지니어링 기술자 등급 (용역 입찰에 내는 그 등급) */
export const TECH_GRADES = ['초급기술자', '중급기술자', '고급기술자', '특급기술자']

/* 디자이너 등급 (디자인 대가기준) */
export const DESIGN_GRADES = [
  '보조 디자이너', '초급 디자이너', '중급 디자이너',
  '고급 디자이너', '특급 디자이너', '총괄 디자이너',
]

/* 만 나이 */
export function age(birth, on = today()) {
  if (!birth) return null
  const b = parse(birth)
  const n = parse(on)
  let a = n.getUTCFullYear() - b.getUTCFullYear()
  const before = n.getUTCMonth() < b.getUTCMonth()
    || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())
  if (before) a -= 1
  return a < 0 ? null : a
}

/* 며칠을 'N년 N개월' 로. 1년 미만이면 'N개월', 1개월 미만이면 'N일'. */
export function duration(days) {
  if (!days || days <= 0) return '—'
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  if (y > 0) return m > 0 ? `${y}년 ${m}개월` : `${y}년`
  if (m > 0) return `${m}개월`
  return `${days}일`
}

const dayNum = (s) => Math.floor(parse(s).getTime() / DAY)

/* 겹치는 기간을 하나로 합친다.
   ⚠️ 두 회사를 같은 시기에 다녔다면 그 기간을 두 번 세면 안 된다.
   노션 수식으로는 이게 안 돼서 총경력이 부풀 수 있었다. */
export function mergeRanges(ranges) {
  const list = ranges
    .filter((r) => r.start)
    .map((r) => [dayNum(r.start), r.end ? dayNum(r.end) : dayNum(today())])
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0])

  const out = []
  for (const [a, b] of list) {
    const last = out[out.length - 1]
    // 하루 차이로 이어지는 것도 붙인다 (상실일 다음 날 취득)
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  // 시작일과 끝일을 모두 센다(자격취득일·상실일 양쪽 포함)
  return { ranges: out, days: out.reduce((n, [a, b]) => n + (b - a + 1), 0) }
}

/* 경력 요약 — 전 직장 / 바이렌 / 합계.
   합계는 겹침을 뺀 값이라 '전 직장 + 바이렌' 과 다를 수 있다(그게 맞다). */
export function careerSummary(careers, hireDate, on = today()) {
  const past = (careers || []).map((c) => ({ start: c.start_date, end: c.end_date }))
  const here = hireDate ? [{ start: hireDate, end: null }] : []
  return {
    past: mergeRanges(past).days,
    here: mergeRanges(here).days,
    total: mergeRanges([...past, ...here]).days,
    on,
  }
}

/* 한 줄 기간 표시 */
export const rangeDays = (c) =>
  mergeRanges([{ start: c.start_date, end: c.end_date }]).days
