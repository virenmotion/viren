import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { errText, FILE_BUCKET, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dateTime, dot } from '../lib/dates'
import { FORMS, LEAVE_KINDS, STEP_STATUS, won } from '../lib/labels'
import { ErrorBox, StatusPill } from '../components/ui'

export default function ApprovalView() {
  const { id } = useParams()
  const { state } = useLocation()
  const { userId, nameOf, empOf } = useSession()
  const [doc, setDoc] = useState(undefined)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('approval_docs')
      .select('*, approval_steps(*), approval_refs(user_id), approval_files(*)').eq('id', id).maybeSingle()
    if (error) setErr(errText(error))
    setDoc(data)
  }, [id])

  useEffect(() => { load() }, [load])

  if (doc === undefined) return <p className="muted">불러오는 중…</p>
  if (!doc) return <div className="stack"><p>문서가 없거나 볼 수 있는 권한이 없습니다.</p><Link to="/approval">목록으로</Link></div>

  const steps = [...doc.approval_steps].sort((a, b) => a.step - b.step)
  const myTurn = doc.status === 'pending' && steps.some((s) => s.status === 'pending' && s.approver_id === userId)
  const canWithdraw = doc.status === 'pending' && doc.drafter_id === userId && !steps.some((s) => s.status === 'approved')
  const drafter = empOf(doc.drafter_id)

  async function act(decision) {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('act_on_doc', { p_doc: doc.id, p_decision: decision, p_comment: comment })
    setBusy(false)
    if (error) return setErr(errText(error))
    setComment('')
    load()
  }

  async function withdraw() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('withdraw_doc', { p_doc: doc.id })
    setBusy(false); setConfirmWithdraw(false)
    if (error) return setErr(errText(error))
    load()
  }

  async function openFile(f) {
    const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(f.path, 60, { download: f.name })
    if (error) return setErr(errText(error))
    window.location.href = data.signedUrl
  }

  return (
    <div className="stack">
      <div className="row-between no-print">
        <Link to="/approval" className="small">← 목록</Link>
        <button className="btn small-btn" onClick={() => window.print()}>인쇄</button>
      </div>

      {state?.uploadFailed && (
        <p className="error">결재는 올라갔지만 첨부파일 {state.uploadFailed.join(', ')} 을(를) 올리지 못했습니다. 회수 후 다시 올려 주세요.</p>
      )}

      <article className="card doc">
        <header className="doc-head">
          <div>
            <p className="muted small tnum">{FORMS[doc.form_type]} · {doc.doc_no}</p>
            <h1>{doc.title}</h1>
            <p className="muted small">기안 {nameOf(doc.drafter_id)}{drafter?.dept && ` · ${drafter.dept}`} · {dateTime(doc.created_at)}</p>
          </div>
          <StatusPill status={doc.status} />
        </header>

        <div className="signbox-wrap">
          <table className="signbox">
            <tbody>
              <tr>
                <th>기안</th>
                {steps.map((s) => <th key={s.step}>{empOf(s.approver_id)?.position || `${s.step}차`}</th>)}
              </tr>
              <tr>
                <td><div className="sign">{nameOf(doc.drafter_id)}</div></td>
                {steps.map((s) => (
                  <td key={s.step} className={`ss-${s.status}`}>
                    <div className="sign">{nameOf(s.approver_id)}</div>
                    <div className="sign-st">{STEP_STATUS[s.status]}</div>
                  </td>
                ))}
              </tr>
              <tr className="sign-date">
                <td className="tnum">{dateTime(doc.created_at).slice(2, 10)}</td>
                {steps.map((s) => <td key={s.step} className="tnum">{s.acted_at ? dateTime(s.acted_at).slice(2, 10) : ''}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        {doc.approval_refs.length > 0 && (
          <p className="small muted">참조: {doc.approval_refs.map((r) => nameOf(r.user_id)).join(', ')}</p>
        )}

        {doc.form_type === 'leave' && (
          <dl className="kv doc-data">
            <dt>종류</dt><dd>{LEAVE_KINDS[doc.data.kind]}</dd>
            <dt>기간</dt><dd className="tnum">{doc.data.start === doc.data.end ? dot(doc.data.start) : `${dot(doc.data.start)} ~ ${dot(doc.data.end)}`}</dd>
            <dt>일수</dt><dd className="tnum">{doc.data.days}일</dd>
          </dl>
        )}

        {doc.form_type === 'expense' && (
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>날짜</th><th>내용</th><th className="r">금액</th></tr></thead>
              <tbody>
                {doc.data.items.map((it, i) => (
                  <tr key={i}><td className="tnum">{dot(it.date)}</td><td>{it.desc}</td><td className="r tnum">{won(it.amount)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td></td><td className="r">합계</td><td className="r tnum"><strong>{won(doc.data.total)}</strong></td></tr></tfoot>
            </table>
          </div>
        )}

        {doc.content && <div className="doc-body">{doc.content}</div>}

        {doc.approval_files.length > 0 && (
          <div className="files">
            <h2>첨부파일</h2>
            <ul>
              {doc.approval_files.map((f) => (
                <li key={f.id}><button className="linkbtn" onClick={() => openFile(f)}>{f.name}</button> <span className="muted small">{(f.size / 1024 / 1024).toFixed(1)}MB</span></li>
              ))}
            </ul>
          </div>
        )}

        {steps.some((s) => s.comment) && (
          <div className="comments">
            <h2>결재 의견</h2>
            <ul>
              {steps.filter((s) => s.comment).map((s) => (
                <li key={s.step}><strong>{nameOf(s.approver_id)}</strong> <span className="muted small">{STEP_STATUS[s.status]} · {dateTime(s.acted_at)}</span><p>{s.comment}</p></li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <ErrorBox>{err}</ErrorBox>

      {myTurn && (
        <section className="card stack-sm no-print">
          <h2>결재하기</h2>
          <label className="field"><span>의견 (반려할 때는 꼭 적어 주세요)</span>
            <textarea id="act-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
          <div className="actions">
            <button className="btn danger" disabled={busy} onClick={() => act('rejected')}>반려</button>
            <button className="btn primary" disabled={busy} onClick={() => act('approved')}>승인</button>
          </div>
        </section>
      )}

      {canWithdraw && (
        <div className="actions no-print">
          {confirmWithdraw ? (
            <>
              <span className="small">이 문서를 회수할까요? 회수한 문서는 되돌릴 수 없습니다.</span>
              <button className="btn" onClick={() => setConfirmWithdraw(false)}>취소</button>
              <button className="btn danger" disabled={busy} onClick={withdraw}>회수하기</button>
            </>
          ) : (
            <button className="btn" onClick={() => setConfirmWithdraw(true)}>문서 회수</button>
          )}
        </div>
      )}
    </div>
  )
}
