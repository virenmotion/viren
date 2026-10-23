import { useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { COLUMN_TYPES, FIELD_TYPES, INPUT_TYPES, newField } from '../lib/formFields'
import { ErrorBox } from '../components/ui'
import RichText from '../components/RichText'

/* 관리 → 양식.  지은님이 결재 양식을 직접 만든다.
   · 칸을 넣고, 이름 붙이고, 종류 고르고, 순서 바꾸고, 필수 여부를 정한다.
   · 저장하면 '새 문서' 화면의 **'회사 양식' 목록**에 바로 나타난다(탭이 아니라 카드다).
   ⚠️ 이미 문서가 올라간 양식의 **칸을 지우면** 그 문서에서 그 칸이 안 보인다
      (값은 DB 에 남아 있다). 그래서 지우기 전에 한 번 물어본다. */

const move = (arr, i, d) => {
  const j = i + d
  if (j < 0 || j >= arr.length) return arr
  const out = [...arr]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export default function AdminForms() {
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null) // 양식 한 개 (새로 만들면 id 없음)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const { data, error } = await supabase.from('doc_forms').select('*').order('sort').order('name')
    if (error) {
      return setErr(/doc_forms|schema cache/i.test(error.message)
        ? '아직 데이터베이스 설정 전입니다. work/supabase/migrations 의 양식 추가 SQL 을 한 번 실행해 주세요.'
        : errText(error))
    }
    setErr(''); setRows(data)
  }
  useEffect(() => { load() }, [])

  async function remove(r) {
    if (!window.confirm(`'${r.name}' 양식을 지울까요?\n이미 올라간 문서는 남지만, 그 문서에서 칸 내용이 안 보이게 됩니다.\n안 쓰실 거면 지우지 말고 '사용 안 함'으로 두시는 편이 낫습니다.`)) return
    const { error } = await supabase.from('doc_forms').delete().eq('id', r.id)
    if (error) return setErr(errText(error))
    setMsg('양식을 지웠습니다.'); load()
  }

  if (!rows) return <section className="card"><ErrorBox>{err}</ErrorBox>{!err && <p className="muted">불러오는 중…</p>}</section>

  if (editing) {
    return <FormEditor form={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMsg('양식을 저장했습니다.'); load() }} />
  }

  return (
    <section className="card stack-sm">
      <div className="row-between">
        <h2>양식</h2>
        <button className="btn primary" onClick={() => setEditing({ name: '', guide: '', fields: [], default_approvers: [], active: true, sort: rows.length + 1 })}>+ 새 양식</button>
      </div>
      <p className="hint">여기서 만든 양식은 <strong>새 문서 → 회사 양식</strong> 목록에 나타납니다.
        품의서 · 휴가신청서 · 지출결의서는 기본으로 들어 있는 양식이라 이 목록에 없습니다.</p>

      {!rows.length && <p className="muted">아직 만든 양식이 없습니다.</p>}
      <ul className="form-list">
        {rows.map((r) => (
          <li key={r.id} className="form-row">
            <span className="form-name">{r.name}</span>
            <span className={`tag ${r.active ? 'ok' : ''}`}>{r.active ? '사용' : '사용 안 함'}</span>
            <span className="muted small">칸 {(r.fields || []).length}개</span>
            <button className="btn small-btn" onClick={() => setEditing(r)}>고치기</button>
            <button className="btn small-btn danger" onClick={() => remove(r)}>삭제</button>
          </li>
        ))}
      </ul>
      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}
    </section>
  )
}

function FormEditor({ form, onClose, onSaved }) {
  const { activeEmployees, userId } = useSession()
  const [f, setF] = useState({ ...form, fields: form.fields || [], default_approvers: form.default_approvers || [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (p) => setF({ ...f, ...p })
  const setField = (i, p) => set({ fields: f.fields.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const others = activeEmployees.filter((e) => e.id !== userId)

  async function save() {
    setErr('')
    if (!f.name.trim()) return setErr('양식 이름을 넣어 주세요.')
    if (f.fields.some((x) => !String(x.label || '').trim())) return setErr('이름이 비어 있는 칸이 있습니다.')
    if (f.grants_comp && !f.comp_field) return setErr('대체휴무 일수를 셀 칸을 골라 주세요.')
    const row = {
      name: f.name.trim(), guide: f.guide || '', fields: f.fields,
      default_approvers: f.default_approvers, active: f.active, sort: Number(f.sort) || 0,
      grants_comp: !!f.grants_comp, comp_field: f.grants_comp ? f.comp_field : null,
    }
    setBusy(true)
    const { error } = f.id
      ? await supabase.from('doc_forms').update({ ...row, updated_at: new Date().toISOString() }).eq('id', f.id)
      : await supabase.from('doc_forms').insert(row)
    setBusy(false)
    if (error) return setErr(errText(error))
    onSaved()
  }

  function addField(type) {
    set({ fields: [...f.fields, newField(type, f.fields.length)] })
  }

  function delField(i) {
    if (!window.confirm('이 칸을 지울까요?\n이미 올라간 문서에서는 이 칸 내용이 안 보이게 됩니다.')) return
    set({ fields: f.fields.filter((_, j) => j !== i) })
  }

  return (
    <section className="card stack-sm">
      <div className="row-between">
        <h2>{f.id ? '양식 고치기' : '새 양식'}</h2>
        <button className="btn small-btn" onClick={onClose}>← 목록</button>
      </div>

      <div className="form-row-2">
        <label className="field"><span>양식 이름</span>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="예: 출장계획서" /></label>
        <label className="field"><span>순서</span>
          <input className="tnum" type="number" value={f.sort} onChange={(e) => set({ sort: e.target.value })} /></label>
      </div>
      <label className="field"><span>안내문 (화면 맨 위에 뜹니다)</span>
        <textarea rows={2} value={f.guide} onChange={(e) => set({ guide: e.target.value })} placeholder="예: 계약서 스캔본을 첨부해 주세요" /></label>
      <label className="check">
        <input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
        사용 (끄면 새 문서 화면에서 안 보입니다. 이미 올라간 문서는 그대로 남습니다)
      </label>

      {/* 휴일근무신청서처럼 '승인되면 대체휴무가 생기는' 양식 표시 */}
      <label className="check">
        <input type="checkbox" checked={!!f.grants_comp} onChange={(e) => set({ grants_comp: e.target.checked })} />
        이 양식이 <strong>최종 승인되면 대체휴무가 생깁니다</strong> (휴일근무신청서 등)
      </label>
      {f.grants_comp && (
        <label className="field"><span>며칠인지가 들어 있는 칸</span>
          <select value={f.comp_field || ''} onChange={(e) => set({ comp_field: e.target.value })}>
            <option value="">고르세요</option>
            {f.fields.filter((x) => x.type === 'dates').map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          {!f.fields.some((x) => x.type === 'dates') && (
            <span className="hint">먼저 아래에서 <strong>‘날짜 여러 개’</strong> 칸을 하나 넣어 주세요. 고른 날 수가 곧 대체휴무 일수가 됩니다.</span>
          )}
        </label>
      )}

      <h3>기본 결재선</h3>
      <p className="hint">이 양식을 고르면 결재선에 미리 채워 둘 사람입니다. 쓰는 사람이 바꿀 수 있습니다.</p>
      <ol className="line-list">
        {f.default_approvers.map((id, i) => (
          <li key={id}>
            <span>{activeEmployees.find((e) => e.id === id)?.name || '없는 직원'}</span>
            <button className="icon" aria-label="위로" disabled={i === 0} onClick={() => set({ default_approvers: move(f.default_approvers, i, -1) })}>↑</button>
            <button className="icon" aria-label="아래로" disabled={i === f.default_approvers.length - 1} onClick={() => set({ default_approvers: move(f.default_approvers, i, 1) })}>↓</button>
            <button className="icon" aria-label="빼기" onClick={() => set({ default_approvers: f.default_approvers.filter((x) => x !== id) })}>✕</button>
          </li>
        ))}
      </ol>
      <label className="field inline"><span>결재자 추가</span>
        <select value="" onChange={(e) => e.target.value && set({ default_approvers: [...f.default_approvers, e.target.value] })}>
          <option value="">고르세요</option>
          {others.filter((e) => !f.default_approvers.includes(e.id)).map((e) => (
            <option key={e.id} value={e.id}>{e.name}{e.position ? ` ${e.position}` : ''}</option>
          ))}
        </select>
      </label>

      <h3>칸</h3>
      {!f.fields.length && <p className="muted">아래에서 칸을 넣어 주세요.</p>}
      <ul className="fld-list">
        {f.fields.map((x, i) => (
          <li key={x.key} className="fld">
            <div className="fld-head">
              <span className="tag">{FIELD_TYPES[x.type]?.label || x.type}</span>
              <input className="fld-label" value={x.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="칸 이름" />
              {x.type !== 'divider' && (
                <label className="check small"><input type="checkbox" checked={!!x.required} onChange={(e) => setField(i, { required: e.target.checked })} />필수</label>
              )}
              {['text', 'date', 'datetime', 'number', 'money', 'select', 'member', 'dept'].includes(x.type) && (
                <label className="check small"><input type="checkbox" checked={!!x.half} onChange={(e) => setField(i, { half: e.target.checked })} />가로 2칸</label>
              )}
              <button className="icon" aria-label="위로" disabled={i === 0} onClick={() => set({ fields: move(f.fields, i, -1) })}>↑</button>
              <button className="icon" aria-label="아래로" disabled={i === f.fields.length - 1} onClick={() => set({ fields: move(f.fields, i, 1) })}>↓</button>
              <button className="icon" aria-label="칸 삭제" onClick={() => delField(i)}>✕</button>
            </div>

            {x.type === 'number' && (
              <label className="field inline"><span>단위</span>
                <input value={x.unit || ''} onChange={(e) => setField(i, { unit: e.target.value })} placeholder="예: 일" /></label>
            )}
            {x.type === 'textarea' && (
              <label className="field inline"><span>줄 수</span>
                <input className="tnum" type="number" min="2" max="20" value={x.rows || 4} onChange={(e) => setField(i, { rows: Number(e.target.value) })} /></label>
            )}
            {x.type === 'select' && <Options value={x.options || ['']} onChange={(options) => setField(i, { options })} />}
            {x.type === 'rich' && (
              <div className="field">
                <span className="field-label">기본 문구 (쓰는 사람이 고쳐 씁니다)</span>
                <RichText value={x.html || ''} onChange={(html) => setField(i, { html })} />
              </div>
            )}
            {x.type === 'table' && <Columns field={x} onChange={(p) => setField(i, p)} />}
          </li>
        ))}
      </ul>

      <div className="fld-add">
        <span className="small muted">칸 넣기:</span>
        {INPUT_TYPES.map((t) => (
          <button key={t} className="btn small-btn" title={FIELD_TYPES[t].hint} onClick={() => addField(t)}>{FIELD_TYPES[t].label}</button>
        ))}
        <button className="btn small-btn" onClick={() => addField('divider')}>구분선</button>
      </div>

      <ErrorBox>{err}</ErrorBox>
      <div className="actions">
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? '저장 중…' : '저장'}</button>
      </div>
    </section>
  )
}

function Options({ value, onChange }) {
  return (
    <div className="field">
      <span className="field-label">고를 수 있는 것</span>
      {value.map((o, i) => (
        <div key={i} className="opt-row">
          <input value={o} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`${i + 1}번째`} />
          <button className="icon" aria-label="빼기" disabled={value.length === 1} onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small-btn" onClick={() => onChange([...value, ''])}>+ 추가</button>
    </div>
  )
}

function Columns({ field, onChange }) {
  const cols = field.columns || []
  const setCol = (i, p) => onChange({ columns: cols.map((c, j) => (j === i ? { ...c, ...p } : c)) })
  return (
    <div className="field">
      <span className="field-label">표의 칸</span>
      {cols.map((c, i) => (
        <div key={c.key} className="opt-row">
          <input value={c.label} onChange={(e) => setCol(i, { label: e.target.value })} placeholder="칸 이름" />
          <select value={c.type} onChange={(e) => setCol(i, { type: e.target.value })}>
            {Object.entries(COLUMN_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="icon" aria-label="왼쪽으로" disabled={i === 0} onClick={() => onChange({ columns: move(cols, i, -1) })}>←</button>
          <button className="icon" aria-label="오른쪽으로" disabled={i === cols.length - 1} onClick={() => onChange({ columns: move(cols, i, 1) })}>→</button>
          <button className="icon" aria-label="빼기" disabled={cols.length === 1}
            onClick={() => onChange({ columns: cols.filter((_, j) => j !== i), total: field.total === c.key ? '' : field.total })}>✕</button>
        </div>
      ))}
      {cols.some((c) => c.type === 'select') && (
        <div className="stack-sm">
          {cols.filter((c) => c.type === 'select').map((c) => (
            <Options key={c.key} value={c.options || ['']}
              onChange={(options) => setCol(cols.indexOf(c), { options })} />
          ))}
        </div>
      )}
      <div className="opt-row">
        <button className="btn small-btn" onClick={() => onChange({ columns: [...cols, { key: `c${Date.now().toString(36)}`, label: '새 칸', type: 'text' }] })}>+ 칸 추가</button>
        <label className="field inline"><span>합계를 낼 칸</span>
          <select value={field.total || ''} onChange={(e) => onChange({ total: e.target.value })}>
            <option value="">합계 없음</option>
            {cols.filter((c) => c.type === 'money' || c.type === 'number').map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}
