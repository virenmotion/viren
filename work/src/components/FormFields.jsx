import { useSession } from '../lib/session'
import { won } from '../lib/labels'
import { dot } from '../lib/dates'
import { emptyRow, emptyValue, tableTotal } from '../lib/formFields'
import RichText, { RichTextView } from './RichText'
import DatePick from './DatePick'

/* 직접 만든 양식의 칸을 그려 준다.
   · FormInputs — 문서를 쓸 때
   · FormView   — 올라간 문서를 볼 때 · 인쇄할 때
   둘이 같은 fields 를 읽으므로 칸을 바꾸면 양쪽이 같이 바뀐다. */

const onlyNum = (s) => String(s ?? '').replace(/[^0-9]/g, '')

function Cell({ col, value, onChange, people, depts }) {
  if (col.type === 'money' || col.type === 'number') {
    return <input className="r tnum" inputMode="numeric" value={value ?? ''} placeholder="0"
      onChange={(e) => onChange(onlyNum(e.target.value))} />
  }
  if (col.type === 'date') return <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  if (col.type === 'select') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">선택</option>
        {(col.options || []).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (col.type === 'member') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">선택</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.position ? ` ${p.position}` : ''}</option>)}
      </select>
    )
  }
  return <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

function FieldInput({ f, value, onChange }) {
  const { activeEmployees } = useSession()
  const depts = [...new Set(activeEmployees.map((e) => e.dept).filter(Boolean))]

  if (f.type === 'divider') return <hr className="field-divider" aria-hidden="true" />

  const label = <span>{f.label}{f.required && <b className="req" aria-hidden="true"> *</b>}</span>

  if (f.type === 'table') {
    const rows = Array.isArray(value) && value.length ? value : [emptyRow(f)]
    const setRow = (i, key, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
    const total = tableTotal(f, rows)
    return (
      <div className="field">
        <div className="row-between"><span className="field-label">{label}</span>
          <button type="button" className="btn small-btn" onClick={() => onChange([...rows, emptyRow(f)])}>줄 추가</button></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{(f.columns || []).map((c) => <th key={c.key}>{c.label}</th>)}<th aria-label="삭제" /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {(f.columns || []).map((c) => (
                    <td key={c.key}><Cell col={c} value={r?.[c.key]} people={activeEmployees} depts={depts}
                      onChange={(v) => setRow(i, c.key, v)} /></td>
                  ))}
                  <td><button type="button" className="icon" aria-label="줄 삭제" disabled={rows.length === 1}
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              ))}
              {total != null && (
                <tr className="sum"><td colSpan={(f.columns || []).findIndex((c) => c.key === f.total)}>합계</td>
                  <td className="r tnum">{won(total)}</td>
                  <td colSpan={(f.columns || []).length - (f.columns || []).findIndex((c) => c.key === f.total)} /></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="hint">최대 30줄까지 쓸 수 있습니다.</p>
      </div>
    )
  }

  if (f.type === 'rich') {
    return (
      <div className="field">
        <span className="field-label">{label}</span>
        <RichText value={value ?? ''} onChange={onChange} />
      </div>
    )
  }

  if (f.type === 'dates') {
    const picked = Array.isArray(value) ? value : []
    return (
      <div className="field">
        <span className="field-label">{label}</span>
        <DatePick value={picked} onChange={onChange} />
        <p className="hint">고른 날 <strong className="tnum">{picked.length}일</strong></p>
      </div>
    )
  }

  return (
    <label className={`field${f.half ? ' half' : ''}`}>
      {label}
      {f.type === 'textarea' && <textarea rows={f.rows || 4} maxLength={f.max || undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
      {f.type === 'text' && <input maxLength={f.max || undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
      {f.type === 'date' && <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
      {f.type === 'datetime' && <input type="datetime-local" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
      {f.type === 'number' && (
        <span className="with-unit">
          <input className="tnum" inputMode="numeric" value={value ?? ''} onChange={(e) => onChange(onlyNum(e.target.value))} />
          {f.unit && <i>{f.unit}</i>}
        </span>
      )}
      {f.type === 'money' && (
        <span className="with-unit">
          <input className="tnum r" inputMode="numeric" placeholder="0" value={value ?? ''} onChange={(e) => onChange(onlyNum(e.target.value))} />
          <i>원</i>
        </span>
      )}
      {f.type === 'select' && (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">선택하세요</option>
          {(f.options || []).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {f.type === 'member' && (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">선택하세요</option>
          {activeEmployees.map((p) => <option key={p.id} value={p.id}>{p.name}{p.position ? ` ${p.position}` : ''}</option>)}
        </select>
      )}
      {f.type === 'dept' && (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">선택하세요</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
    </label>
  )
}

export function FormInputs({ fields, values, onChange }) {
  const list = fields || []
  return (
    <div className="form-fields">
      {list.map((f) => (
        <FieldInput key={f.key} f={f} value={values?.[f.key] ?? emptyValue(f)}
          onChange={(v) => onChange({ ...values, [f.key]: v })} />
      ))}
    </div>
  )
}

/* ── 보여주기 ───────────────────────────────────────────────── */

function show(f, v, nameOf) {
  if (f.type === 'money') return v === '' || v == null ? '' : won(v)
  if (f.type === 'number') return v === '' || v == null ? '' : `${Number(v).toLocaleString('ko-KR')}${f.unit ? ` ${f.unit}` : ''}`
  if (f.type === 'date') return dot(v)
  if (f.type === 'datetime') return v ? `${dot(v.slice(0, 10))} ${v.slice(11, 16)}` : ''
  if (f.type === 'member') return v ? nameOf(v) : ''
  return v ?? ''
}

export function FormView({ fields, values }) {
  const { nameOf } = useSession()
  const list = (fields || []).filter((f) => f.type !== 'divider')
  if (!list.length) return null

  return (
    <div className="form-view">
      {list.map((f) => {
        const v = values?.[f.key]

        if (f.type === 'table') {
          const rows = (Array.isArray(v) ? v : []).filter((r) => (f.columns || []).some((c) => String(r?.[c.key] ?? '').trim() !== ''))
          if (!rows.length) return null
          const total = tableTotal(f, rows)
          const cell = (c, r) => {
            const x = r?.[c.key]
            if (c.type === 'money') return x === '' || x == null ? '' : won(x)
            if (c.type === 'date') return dot(x)
            if (c.type === 'member') return x ? nameOf(x) : ''
            if (c.type === 'number') return x === '' || x == null ? '' : Number(x).toLocaleString('ko-KR')
            return x ?? ''
          }
          return (
            <section key={f.key} className="fv-block">
              <h3>{f.label}</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>{(f.columns || []).map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>{(f.columns || []).map((c) => (
                        <td key={c.key} className={c.type === 'money' || c.type === 'number' ? 'r tnum' : ''}>{cell(c, r)}</td>
                      ))}</tr>
                    ))}
                    {total != null && (
                      <tr className="sum">
                        <td colSpan={(f.columns || []).findIndex((c) => c.key === f.total)}>합계</td>
                        <td className="r tnum">{won(total)}</td>
                        <td colSpan={(f.columns || []).length - 1 - (f.columns || []).findIndex((c) => c.key === f.total)} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )
        }

        if (f.type === 'dates') {
          const ds = Array.isArray(v) ? v : []
          if (!ds.length) return null
          return (
            <div key={f.key} className="fv-row">
              <span className="fv-label">{f.label}</span>
              <span className="fv-value tnum">{ds.map(dot).join(', ')} <b>({ds.length}일)</b></span>
            </div>
          )
        }

        if (f.type === 'rich') {
          if (!v) return null
          return <section key={f.key} className="fv-block"><h3>{f.label}</h3><RichTextView html={v} /></section>
        }

        const text = show(f, v, nameOf)
        if (text === '' || text == null) return null
        return (
          <div key={f.key} className="fv-row">
            <span className="fv-label">{f.label}</span>
            <span className={`fv-value${f.type === 'textarea' ? ' pre' : ''}`}>{text}</span>
          </div>
        )
      })}
    </div>
  )
}
