import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { errText, FILE_BUCKET, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dot, today, weekdays } from '../lib/dates'
import { leaveSummary } from '../lib/leave'
import { FORMS, LEAVE_KINDS, LEAVE_PICK, won } from '../lib/labels'
import { ErrorBox } from '../components/ui'

const MAX_FILE_MB = 20
const LINE_KEY = 'viren-work:last-line'

function loadLastLine() {
  try { return JSON.parse(localStorage.getItem(LINE_KEY)) || { approvers: [], refs: [] } }
  catch { return { approvers: [], refs: [] } }
}

export default function ApprovalNew() {
  const { me, userId, activeEmployees, nameOf } = useSession()
  const [params, setParams] = useSearchParams()
  const form = FORMS[params.get('form')] ? params.get('form') : 'general'
  const nav = useNavigate()

  const others = activeEmployees.filter((e) => e.id !== userId)
  const valid = (ids) => ids.filter((id) => others.some((e) => e.id === id))
  const [approvers, setApprovers] = useState(() => valid(loadLastLine().approvers))
  const [refs, setRefs] = useState(() => valid(loadLastLine().refs))
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState([])
  const [leave, setLeave] = useState({ kind: 'annual', start: today(), end: today(), days: '' })
  const [items, setItems] = useState([{ date: today(), desc: '', amount: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [leaveDocs, setLeaveDocs] = useState([])

  useEffect(() => {
    if (form !== 'leave') return
    supabase.from('approval_docs').select('form_type,status,data').eq('drafter_id', userId).eq('form_type', 'leave')
      .in('status', ['approved', 'pending']).then(({ data }) => setLeaveDocs(data || []))
  }, [form, userId])

  const half = leave.kind === 'half_am' || leave.kind === 'half_pm'
  const maxDays = half ? 0.5 : weekdays(leave.start, leave.end)
  const days = half ? 0.5 : (leave.days === '' ? maxDays : Number(leave.days))
  const total = useMemo(() => items.reduce((a, it) => a + (Number(it.amount) || 0), 0), [items])
  const summary = leaveSummary(me, leaveDocs)

  function autoTitle() {
    if (form === 'leave') {
      const range = half || leave.start === leave.end ? dot(leave.start) : `${dot(leave.start)}~${dot(leave.end)}`
      return `${LEAVE_KINDS[leave.kind]} 신청 (${range})`
    }
    if (form === 'expense') return `지출결의 (${won(total)})`
    return ''
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    const big = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024)
    if (big) return setErr(`${big.name} 파일이 ${MAX_FILE_MB}MB보다 큽니다.`)
    const t = title.trim() || autoTitle()
    if (!t) return setErr('제목을 넣어 주세요.')

    let data = {}
    if (form === 'leave') data = { kind: leave.kind, start: leave.start, end: half ? leave.start : leave.end, days }
    if (form === 'expense') data = { items: items.filter((it) => it.desc.trim() || it.amount).map((it) => ({ ...it, amount: Number(it.amount) })) }

    setBusy(true)
    const { data: id, error } = await supabase.rpc('submit_doc', {
      p_form_type: form, p_title: t, p_content: content, p_data: data, p_approvers: approvers, p_refs: refs,
    })
    if (error) { setBusy(false); return setErr(errText(error)) }

    try { localStorage.setItem(LINE_KEY, JSON.stringify({ approvers, refs })) } catch { /* 저장 안 돼도 그만 */ }

    const failed = []
    for (const f of files) {
      const ext = (f.name.match(/\.[A-Za-z0-9]{1,8}$/) || [''])[0].toLowerCase()
      const path = `${id}/${crypto.randomUUID()}${ext}`
      const up = await supabase.storage.from(FILE_BUCKET).upload(path, f, { contentType: f.type || undefined })
      const row = up.error ? up : await supabase.from('approval_files').insert({ doc_id: id, path, name: f.name, size: f.size, uploaded_by: userId })
      if (row.error) failed.push(f.name)
    }
    setBusy(false)
    nav(`/approval/${id}`, { replace: true, state: failed.length ? { uploadFailed: failed } : null })
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h1>새 문서 작성</h1>
      <div className="tabs" role="tablist">
        {Object.entries(FORMS).map(([k, label]) => (
          <button type="button" key={k} role="tab" aria-selected={form === k} className={form === k ? 'on' : ''} onClick={() => setParams({ form: k })}>{label}</button>
        ))}
      </div>

      <section className="card stack-sm">
        <h2>결재선</h2>
        <p className="hint">위에서부터 차례대로 결재합니다. 참조자는 문서를 볼 수만 있습니다.</p>
        <ol className="line-edit">
          {approvers.map((id, i) => {
            const e = others.find((x) => x.id === id)
            return (
              <li key={id}>
                <span className="step-no tnum">{i + 1}</span>
                <span className="grow">{nameOf(id)} <span className="muted small">{e?.position}</span></span>
                <button type="button" className="icon" aria-label="위로" disabled={i === 0} onClick={() => setApprovers(move(approvers, i, -1))}>↑</button>
                <button type="button" className="icon" aria-label="아래로" disabled={i === approvers.length - 1} onClick={() => setApprovers(move(approvers, i, 1))}>↓</button>
                <button type="button" className="icon" aria-label="빼기" onClick={() => setApprovers(approvers.filter((x) => x !== id))}>✕</button>
              </li>
            )
          })}
        </ol>
        <PersonPicker id="pick-approver" label="결재자 추가" people={others.filter((e) => !approvers.includes(e.id))}
          onPick={(id) => { setApprovers([...approvers, id]); setRefs(refs.filter((r) => r !== id)) }} />
        <div className="chips">
          {refs.map((id) => (
            <span className="chip" key={id}>{nameOf(id)}<button type="button" aria-label={`${nameOf(id)} 참조 빼기`} onClick={() => setRefs(refs.filter((r) => r !== id))}>✕</button></span>
          ))}
        </div>
        <PersonPicker id="pick-ref" label="참조자 추가" people={others.filter((e) => !approvers.includes(e.id) && !refs.includes(e.id))}
          onPick={(id) => setRefs([...refs, id])} />
      </section>

      {form === 'leave' && (
        <section className="card stack-sm">
          <h2>휴가 내용</h2>
          {summary && <p className="hint">남은 연차 <strong className="tnum">{summary.remaining}일</strong>{summary.pending > 0 && ` (결재 중 ${summary.pending}일 별도)`}</p>}
          <div className="form-row">
            <label className="field"><span>종류</span>
              <select id="leave-kind" value={half ? 'half' : leave.kind}
                onChange={(e) => setLeave({ ...leave, kind: e.target.value === 'half' ? 'half_am' : e.target.value, days: '' })}>
                {Object.entries(LEAVE_PICK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            {half && (
              <label className="field"><span>오전 · 오후</span>
                <select id="leave-half" value={leave.kind} onChange={(e) => setLeave({ ...leave, kind: e.target.value })}>
                  <option value="half_am">오전</option><option value="half_pm">오후</option>
                </select></label>
            )}
            <label className="field"><span>{half ? '날짜' : '시작일'}</span>
              <input id="leave-start" type="date" required value={leave.start} onChange={(e) => setLeave({ ...leave, start: e.target.value, end: e.target.value > leave.end ? e.target.value : leave.end, days: '' })} /></label>
            {!half && (
              <label className="field"><span>종료일</span>
                <input id="leave-end" type="date" required min={leave.start} value={leave.end} onChange={(e) => setLeave({ ...leave, end: e.target.value, days: '' })} /></label>
            )}
            {!half && (
              <label className="field"><span>일수</span>
                <input id="leave-days" type="number" step="0.5" min="0.5" max={maxDays} value={leave.days === '' ? maxDays : leave.days} onChange={(e) => setLeave({ ...leave, days: e.target.value })} /></label>
            )}
          </div>
          {!half && <p className="hint">주말을 뺀 {maxDays}일로 계산했습니다. 기간에 공휴일이 있으면 일수를 줄여 주세요.</p>}
          {['public', 'comp'].includes(leave.kind) && <p className="hint">{LEAVE_KINDS[leave.kind]}는 연차에서 빠지지 않습니다.</p>}
        </section>
      )}

      {form === 'expense' && (
        <section className="card stack-sm">
          <h2>지출 내역</h2>
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>날짜</th><th>내용</th><th className="r">금액(원)</th><th></th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td><input id={`exp-date-${i}`} type="date" value={it.date} onChange={(e) => setItems(edit(items, i, { date: e.target.value }))} /></td>
                    <td><input id={`exp-desc-${i}`} value={it.desc} placeholder="예: 촬영 소품 구입" onChange={(e) => setItems(edit(items, i, { desc: e.target.value }))} /></td>
                    <td><input id={`exp-amt-${i}`} className="r tnum" inputMode="numeric" value={it.amount} placeholder="0" onChange={(e) => setItems(edit(items, i, { amount: e.target.value.replace(/[^0-9]/g, '') }))} /></td>
                    <td><button type="button" className="icon" aria-label="줄 삭제" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td></td><td className="r">합계</td><td className="r tnum"><strong>{won(total)}</strong></td><td></td></tr></tfoot>
            </table>
          </div>
          <button type="button" className="btn small-btn" onClick={() => setItems([...items, { date: today(), desc: '', amount: '' }])}>줄 추가</button>
          <p className="hint">영수증은 아래 첨부파일로 올려 주세요.</p>
        </section>
      )}

      <section className="card stack-sm">
        <label className="field"><span>제목</span>
          <input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle() || '제목'} /></label>
        <label className="field"><span>{form === 'general' ? '내용' : '사유 · 메모'}</span>
          <textarea id="doc-content" rows={form === 'general' ? 12 : 4} value={content} onChange={(e) => setContent(e.target.value)} /></label>
        <label className="field"><span>첨부파일 (파일당 {MAX_FILE_MB}MB까지)</span>
          <input id="doc-files" type="file" multiple onChange={(e) => setFiles([...e.target.files])} /></label>
      </section>

      <ErrorBox>{err}</ErrorBox>
      <div className="actions">
        <button className="btn primary big" disabled={busy}>{busy ? '올리는 중…' : '결재 올리기'}</button>
      </div>
    </form>
  )
}

function PersonPicker({ id, label, people, onPick }) {
  if (!people.length) return null
  return (
    <label className="field inline">
      <span>{label}</span>
      <select id={id} value="" onChange={(e) => e.target.value && onPick(e.target.value)}>
        <option value="">선택…</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.position ? ` · ${p.position}` : ''}</option>)}
      </select>
    </label>
  )
}

const move = (arr, i, d) => { const a = [...arr]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a }
const edit = (arr, i, patch) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x))
