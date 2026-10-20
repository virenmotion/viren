/* 날짜는 모두 한국 시간 기준 'YYYY-MM-DD' 문자열로 다룬다. */
const TZ = 'Asia/Seoul'

export function ymd(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}`
}

export const today = () => ymd(new Date())

export function hm(ts) {
  if (!ts) return ''
  return new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts))
}

export function dateTime(ts) {
  if (!ts) return ''
  return `${ymd(new Date(ts)).replaceAll('-', '.')} ${hm(ts)}`
}

export const dot = (s) => (s ? s.replaceAll('-', '.') : '')

/* 'YYYY-MM-DD' ↔ UTC 자정 Date. 날짜 계산에서 시간대가 끼어들지 않게 한다. */
export const parse = (s) => new Date(`${s}T00:00:00Z`)
export const fmt = (d) => d.toISOString().slice(0, 10)

export function addDays(s, n) {
  const d = parse(s)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}

export function addYears(s, n) {
  const d = parse(s)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCFullYear(d.getUTCFullYear() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return fmt(d)
}

export function addMonths(s, n) {
  const d = parse(s)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return fmt(d)
}

/* 주말을 뺀 날수 (DB 의 check_leave_data 와 같은 규칙) */
export function weekdays(start, end) {
  if (!start || !end || end < start) return 0
  let n = 0
  for (let s = start; s <= end; s = addDays(s, 1)) {
    const w = parse(s).getUTCDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}

export function monthDays(ym) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
}

export const WEEK = ['일', '월', '화', '수', '목', '금', '토']
export const weekday = (s) => WEEK[parse(s).getUTCDay()]
export const isWeekend = (s) => [0, 6].includes(parse(s).getUTCDay())

export function minutesBetween(a, b) {
  if (!a || !b) return 0
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000))
}

export const hoursText = (min) => (min ? `${Math.floor(min / 60)}시간 ${String(min % 60).padStart(2, '0')}분` : '')
