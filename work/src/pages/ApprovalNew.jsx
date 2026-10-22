import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { errText, FILE_BUCKET, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dot, today } from '../lib/dates'
import { leaveSummary } from '../lib/leave'
import { FORMS, HALF_PICK, LEAVE_KINDS, LEAVE_PICK, leaveName, won } from '../lib/labels'
import { DateInput, ErrorBox } from '../components/ui'
import { FormInputs } from '../components/FormFields'
import DatePick from '../components/DatePick'
import { emptyValue, firstMissing } from '../lib/formFields'

const MAX_FILE_MB = 20
const LINE_KEY = 'viren-work:last-line'

function loadLastLine() {
  try { return JSON.parse(localStorage.getItem(LINE_KEY)) || { approvers: [], refs: [] } }
  catch { return { approvers: [], refs: [] } }
}

export default function ApprovalNew() {
  const { me, userId, activeEmployees, nameOf } = useSession()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()

  /* 직접 만든 양식(관리 → 양식). 탭은 기본 3종 다음에 붙는다. */
  const [customForms, setCustomForms] = useState([])
  useEffect(() => {
    supabase.from('doc_forms').select('*').eq('active', true).order('sort').order('name')
      .then(({ data, error }) => { if (!error) setCustomForms(data || []) })
  }, [])

  const picked = params.get('form') || 'general'
  const customForm = customForms.find((x) => x.id === picked) || null
  const form = customForm ? 'custom' : (FORMS[picked] ? picked : 'general')
  const [fieldValues, setFieldValues] = useState({})

  /* 회수한 문서를 고쳐서 다시 올리기 (지은님 2026-10-21).
     **새 문서를 만드는 게 아니다.** 같은 문서(같은 문서번호·첨부)를 고쳐서 다시 올린다.
     그래서 양식은 바꿀 수 없다 — 바꾸려면 새로 쓰는 게 맞다. */
  const againId = params.get('from')
  const [again, setAgain] = useState(null)
  const [againErr, setAgainErr] = useState('')

  const others = activeEmployees.filter((e) => e.id !== userId)
  const valid = (ids) => ids.filter((id) => others.some((e) => e.id === id))
  const [approvers, setApprovers] = useState(() => valid(loadLastLine().approvers))
  const [refs, setRefs] = useState(() => valid(loadLastLine().refs))
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState([])
  /* 휴가는 '기간' 이 아니라 **고른 날짜들**이다. 띄엄띄엄 쉬는 연차를 한 장으로 낸다. */
  /* 홈의 '남은 대체휴무' 처럼 종류를 정해 두고 들어오는 길이 있다 */
  const [leave, setLeave] = useState(() => ({
    kind: LEAVE_PICK[params.get('kind')] ? params.get('kind') : 'annual',
    half: '', dates: [today()],
  }))
  const [items, setItems] = useState([{ date: today(), desc: '', amount: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [leaveDocs, setLeaveDocs] = useState([])

  /* 대체휴무: 남은 일수와, 연결할 수 있는 휴일근무 문서들.
     남은 일수는 서버(comp_balance)가 센다 — 화면과 서버가 같은 값을 쓰도록. */
  const [comp, setComp] = useState({ left: null, docs: [] })
  useEffect(() => {
    if (form !== 'leave') return
    supabase.from('approval_docs').select('form_type,status,data').eq('drafter_id', userId).eq('form_type', 'leave')
      .in('status', ['approved', 'pending']).then(({ data }) => setLeaveDocs(data || []))

    Promise.all([
      supabase.rpc('comp_balance', { p_user: userId }),
      supabase.from('approval_docs')
        .select('id, doc_no, title, created_at, doc_forms!inner(name, grants_comp)')
        .eq('drafter_id', userId).eq('status', 'approved').eq('form_type', 'custom')
        .eq('doc_forms.grants_comp', true).order('created_at', { ascending: false }),
    ]).then(([bal, docs]) => setComp({
      left: bal.error ? null : Number(bal.data ?? 0),
      docs: docs.error ? [] : (docs.data || []),
    }))
  }, [form, userId])

  /* 회수한 문서 불러오기 — 제목·본문·결재선·내용을 그대로 채운다. */
  useEffect(() => {
    if (!againId) return
    let gone = false
    ;(async () => {
      const { data: doc } = await supabase.from('approval_docs').select('*').eq('id', againId).maybeSingle()
      if (gone) return
      if (!doc) return setAgainErr('문서를 불러오지 못했습니다.')
      if (doc.drafter_id !== userId) return setAgainErr('내가 올린 문서만 다시 올릴 수 있습니다.')
      if (doc.status !== 'withdrawn') return setAgainErr('회수한 문서만 다시 올릴 수 있습니다.')

      const [{ data: steps }, { data: rf }] = await Promise.all([
        supabase.from('approval_steps').select('approver_id, step').eq('doc_id', againId).order('step'),
        supabase.from('approval_refs').select('user_id').eq('doc_id', againId),
      ])
      if (gone) return

      setTitle(doc.title)
      setContent(doc.content || '')
      setApprovers((steps || []).map((s) => s.approver_id))
      setRefs((rf || []).map((r) => r.user_id))
      const d = doc.data || {}
      if (doc.form_type === 'leave') setLeave({ kind: d.kind || 'annual', half: d.half || '', dates: d.dates || [d.start || today()], ref: d.ref_doc?.id || '' })
      if (doc.form_type === 'expense') setItems(d.items?.length ? d.items.map((it) => ({ ...it, amount: String(it.amount ?? '') })) : [{ date: today(), desc: '', amount: '' }])
      if (doc.form_type === 'custom') setFieldValues(d.fields || {})
      setAgain(doc)
      /* 양식 탭을 문서의 양식에 맞춘다(뒤로 가기 기록은 남기지 않는다) */
      setParams({ form: doc.form_type === 'custom' ? doc.form_id : doc.form_type, from: againId }, { replace: true })
    })()
    return () => { gone = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [againId, userId])

  /* 양식을 바꾸면 그 양식의 기본값과 기본 결재선을 채워 준다.
     결재선은 **비어 있을 때만** 덮는다 — 사용자가 이미 고른 걸 지우면 곤란하다.
     ⚠️ 다시 올리는 중이면 건드리지 않는다. 불러온 내용을 지워 버린다. */
  useEffect(() => {
    if (!customForm || againId) return
    setFieldValues(Object.fromEntries((customForm.fields || []).map((x) => [x.key, emptyValue(x)])))
    const pre = valid(customForm.default_approvers || [])
    if (pre.length) setApprovers(pre)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customForm?.id])

  const half = !!leave.half
  const days = half ? 0.5 : leave.dates.length
  const total = useMemo(() => items.reduce((a, it) => a + (Number(it.amount) || 0), 0), [items])
  const summary = leaveSummary(me, leaveDocs)

  function autoTitle() {
    if (form === 'leave') {
      const d = leave.dates
      const name = leaveName(leave.kind, leave.half)
      if (!d.length) return `${name} 신청`
      const range = d.length === 1 ? dot(d[0]) : `${dot(d[0])} 외 ${d.length - 1}일`
      return `${name} 신청 (${range})`
    }
    if (form === 'expense') return `지출결의 (${won(total)})`
    if (form === 'custom') return customForm?.name || ''
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
    if (form === 'leave') {
      if (!leave.dates.length) { setBusy(false); return setErr('휴가 날짜를 골라 주세요.') }
      if (leave.kind === 'comp' && comp.left != null && days > comp.left) {
        setBusy(false)
        return setErr(`남은 대체휴무가 ${comp.left}일입니다. 그보다 많이 신청할 수 없습니다.`)
      }
      /* dates 가 진짜다. start·end·days 도 같이 보내는 이유:
         서버 쪽 SQL(2026-10-20f)이 아직 안 올라간 동안에도 옛 검사식이 통과하도록.
         올라간 뒤에는 서버가 dates 로 다시 계산하므로 이 값들은 덮어쓰인다. */
      data = { kind: leave.kind, half: leave.half || null, dates: leave.dates, start: leave.dates[0], end: leave.dates[leave.dates.length - 1], days }
      /* 대휴면 어느 휴일근무로 생긴 건지 같이 남긴다. 나중에 문서만 봐도 알 수 있게
         제목·문서번호를 함께 적어 둔다(그 문서를 못 보는 사람도 뭔지 알 수 있다). */
      if (leave.kind === 'comp' && leave.ref) {
        const d = comp.docs.find((x) => x.id === leave.ref)
        if (d) data.ref_doc = { id: d.id, doc_no: d.doc_no, title: d.title }
      }
    }
    if (form === 'expense') data = { items: items.filter((it) => it.desc.trim() || it.amount).map((it) => ({ ...it, amount: Number(it.amount) })) }
    if (form === 'custom') {
      const miss = firstMissing(customForm?.fields, fieldValues)
      if (miss) { setBusy(false); return setErr(`'${miss.label}' 칸을 채워 주세요.`) }
      data = { fields: fieldValues }
    }

    setBusy(true)
    /* 다시 올리는 문서는 같은 문서를 고치는 것이라 함수가 다르다. 문서번호도 그대로. */
    const { data: id, error } = again
      ? await supabase.rpc('resubmit_doc', {
        p_doc: again.id, p_title: t, p_content: content, p_data: data, p_approvers: approvers, p_refs: refs,
      })
      : await supabase.rpc('submit_doc', {
        p_form_type: form, p_title: t, p_content: content, p_data: data, p_approvers: approvers, p_refs: refs,
        p_form_id: customForm?.id || null,
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

  /* 다시 올릴 문서를 불러오는 중 · 못 불러왔을 때 */
  if (againId && againErr) {
    return <div className="stack"><h1>다시 올리기</h1><ErrorBox>{againErr}</ErrorBox></div>
  }
  if (againId && !again) {
    return <div className="stack"><h1>다시 올리기</h1><p className="hint">문서를 불러오는 중…</p></div>
  }

  /* 양식을 아직 안 골랐으면 고르는 화면부터 */
  if (!params.get('form')) {
    return (
      <div className="stack">
        <h1>새 문서 작성</h1>
        <p className="hint">쓸 양식을 고르세요.</p>
        <section className="card">
          <h2>기본 양식</h2>
          <div className="pick-grid">
            {Object.entries(FORMS).map(([k, label]) => (
              <button type="button" key={k} className="pick" onClick={() => setParams({ form: k })}>
                <strong>{label}</strong>
              </button>
            ))}
          </div>
        </section>
        {customForms.length > 0 && (
          <section className="card">
            <h2>회사 양식</h2>
            <div className="pick-grid">
              {customForms.map((cf) => (
                <button type="button" key={cf.id} className="pick" onClick={() => setParams({ form: cf.id })}>
                  <strong>{cf.name}</strong>
                  {cf.guide && <span className="small muted">{cf.guide}</span>}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="row-between">
        <h1>{customForm ? customForm.name : FORMS[form]}</h1>
        {again
          ? <span className="tag">{again.doc_no} · 다시 올리기</span>
          : <button type="button" className="btn small-btn" onClick={() => setParams({})}>← 양식 다시 고르기</button>}
      </div>
      {again && (
        <p className="hint">회수한 문서를 고쳐서 다시 올립니다. <strong>문서번호와 이미 올린 첨부파일은 그대로</strong>이고,
          결재는 처음부터 다시 시작합니다. 양식은 바꿀 수 없어요 — 바꾸려면 새 문서를 쓰세요.</p>
      )}

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
              <select id="leave-kind" value={leave.kind}
                onChange={(e) => setLeave({ ...leave, kind: e.target.value })}>
                {Object.entries(LEAVE_PICK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="field"><span>얼마나</span>
              <select id="leave-half" value={leave.half}
                onChange={(e) => {
                  const h = e.target.value
                  /* 반차로 바꾸면 하루만 남긴다 */
                  setLeave({ ...leave, half: h, dates: h ? leave.dates.slice(0, 1) : leave.dates })
                }}>
                {Object.entries(HALF_PICK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
          </div>

          <div className="field">
            <span className="field-label">쉬는 날 {half ? '(반차는 하루만)' : ''}</span>
            <DatePick
              value={leave.dates} single={half}
              onChange={(dates) => setLeave({ ...leave, dates })}
              hint={`쉬는 날을 눌러 고르세요. 다시 누르면 빠집니다.${half ? '' : ' 붙어 있지 않아도 되고, 빨간 날(주말·공휴일)은 보통 고르지 않습니다.'}`}
            />
          </div>
          {leave.kind === 'comp' && (
            <>
              <p className="hint">남은 대체휴무 <strong className="tnum">{comp.left == null ? '…' : `${comp.left}일`}</strong>
                {comp.left === 0 && ' — 휴일근무신청서가 승인되면 생깁니다.'}</p>
              <label className="field"><span>어느 휴일근무인가요 (선택)</span>
                <select value={leave.ref || ''} onChange={(e) => setLeave({ ...leave, ref: e.target.value })}>
                  <option value="">고르지 않음</option>
                  {comp.docs.map((d) => <option key={d.id} value={d.id}>{d.doc_no} · {d.title}</option>)}
                </select>
                {!comp.docs.length && <span className="hint">승인된 휴일근무신청서가 아직 없습니다.</span>}
              </label>
            </>
          )}
          <p className="hint">신청 일수 <strong className="tnum">{days}일</strong>
            {!half && leave.dates.length > 1 && ' — 고른 날만 셉니다. 사이에 낀 날은 들어가지 않습니다.'}</p>
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
                    <td><DateInput id={`exp-date-${i}`} value={it.date} onChange={(e) => setItems(edit(items, i, { date: e.target.value }))} /></td>
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

      {form === 'custom' && customForm && (
        <section className="card stack-sm">
          <h2>{customForm.name}</h2>
          {customForm.guide && <p className="guide">{customForm.guide}</p>}
          <FormInputs fields={customForm.fields} values={fieldValues} onChange={setFieldValues} />
        </section>
      )}

      <section className="card stack-sm">
        <label className="field"><span>제목</span>
          <input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle() || '제목'} /></label>
        <label className="field"><span>{form === 'general' ? '내용' : '사유 · 메모'}</span>
          <textarea id="doc-content" rows={form === 'general' ? 12 : 4} value={content} onChange={(e) => setContent(e.target.value)} />
          {form === 'custom' && <span className="hint">양식 안의 칸에 다 적었으면 비워 두셔도 됩니다.</span>}</label>
        <label className="field"><span>첨부파일 (파일당 {MAX_FILE_MB}MB까지)</span>
          <input id="doc-files" type="file" multiple onChange={(e) => setFiles([...e.target.files])} /></label>
      </section>

      <ErrorBox>{err}</ErrorBox>
      <div className="actions">
        <button className="btn primary big" disabled={busy}>
          {busy ? '올리는 중…' : again ? '고쳐서 다시 올리기' : '결재 올리기'}</button>
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
