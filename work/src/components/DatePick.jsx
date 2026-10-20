import { useMemo, useState } from 'react'
import { WEEK, addDays, addMonths, dot, parse, today } from '../lib/dates'
import { holidayName } from '../lib/holidays'

/* 달력에서 날짜를 여러 개 고른다. 붙어 있지 않아도 된다.
   (지은님 요청 2026-10-20: 연차를 띄엄띄엄 쓰는 경우가 있다.)
   · value: ['2026-10-22', ...]  — 늘 오름차순으로 돌려준다
   · single: 반차처럼 하루만 고를 때 */

const ym = (d) => d.slice(0, 7)
const firstOf = (m) => `${m}-01`
const lastOf = (m) => {
  const [y, mm] = m.split('-').map(Number)
  return `${m}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, '0')}`
}
const gridStart = (m) => addDays(firstOf(m), -parse(firstOf(m)).getUTCDay())
const gridEnd = (m) => addDays(lastOf(m), 6 - parse(lastOf(m)).getUTCDay())

export default function DatePick({ value = [], onChange, single = false }) {
  const [month, setMonth] = useState(() => ym(value[0] || today()))
  const picked = useMemo(() => new Set(value), [value])

  const days = useMemo(() => {
    const out = []
    for (let d = gridStart(month); d <= gridEnd(month); d = addDays(d, 1)) out.push(d)
    return out
  }, [month])

  function toggle(d) {
    if (single) return onChange(picked.has(d) ? [] : [d])
    const next = picked.has(d) ? value.filter((x) => x !== d) : [...value, d]
    onChange(next.sort())
  }

  return (
    <div className="dp">
      <div className="dp-head">
        <button type="button" className="icon" aria-label="지난달" onClick={() => setMonth(ym(addMonths(firstOf(month), -1)))}>‹</button>
        <strong className="tnum">{month.replace('-', '년 ')}월</strong>
        <button type="button" className="icon" aria-label="다음달" onClick={() => setMonth(ym(addMonths(firstOf(month), 1)))}>›</button>
        <button type="button" className="btn small-btn" onClick={() => setMonth(ym(today()))}>이번 달</button>
      </div>

      <div className="dp-week">
        {WEEK.map((w, i) => <div key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</div>)}
      </div>
      <div className="dp-grid">
        {days.map((d) => {
          const dow = parse(d).getUTCDay()
          const hol = holidayName(d)
          const out = ym(d) !== month
          const on = picked.has(d)
          return (
            <button
              type="button" key={d}
              className={`dp-day${out ? ' out' : ''}${on ? ' on' : ''}${d === today() ? ' now' : ''}${hol || dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}`}
              title={hol || undefined}
              aria-pressed={on}
              aria-label={`${dot(d)}${hol ? ` ${hol}` : ''}`}
              onClick={() => toggle(d)}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>

      <p className="hint">쉬는 날을 눌러 고르세요. 붙어 있지 않아도 됩니다. 다시 누르면 빠집니다.
        {!single && ' 빨간 날(주말·공휴일)은 보통 고르지 않습니다.'}</p>

      {value.length > 0 && (
        <div className="dp-picked">
          {value.map((d) => (
            <span key={d} className="chip tnum">{dot(d)}
              <button type="button" aria-label={`${dot(d)} 빼기`} onClick={() => toggle(d)}>✕</button>
            </span>
          ))}
          {!single && <button type="button" className="linkbtn" onClick={() => onChange([])}>모두 지우기</button>}
        </div>
      )}
    </div>
  )
}
