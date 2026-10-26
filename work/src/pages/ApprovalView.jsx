import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { errText, FILE_BUCKET, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dateTime, dot } from '../lib/dates'
import { FORMS, STEP_STATUS, formName, leaveName, won } from '../lib/labels'
import { FormView } from '../components/FormFields'
import { ErrorBox, StatusPill } from '../components/ui'

/* 문서 한 장. 위에서부터 (지은님 2026-10-26 시안 확인)
     ① 제목·진행 상태 → ② 기본 정보 → ③ 결재선 → ④ 신청 내용 → ⑤ 의견·처리 이력
   ⚠️ 보이는 모양만 바꿨다. 결재·반려·회수·알림·저장은 손대지 않았다.
   ⚠️ 없는 값(보존연한·공개여부·대체 업무자·비상 연락처)은 **지어내지 않는다.** */

/* 결재선 카드 한 장의 모양.
   ⚠️ 종류 이름을 `lc--done` 처럼 길게 쓴다. `.ok` 같은 짧은 이름은 전역의
      '성공 메시지(.ok)' 규칙에 걸려 이름·배경까지 초록이 된다. */
const LC_KIND = { approved: 'lc--done', rejected: 'lc--rej', pending: 'lc--now' }

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
      .select('*, approval_steps(*), approval_refs(user_id), approval_files(*), doc_forms(id, name, guide, fields)')
      .eq('id', id).maybeSingle()
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
  const who = (uid) => {
    const e = empOf(uid)
    return [e?.dept, e?.duty || e?.position].filter(Boolean).join(' · ')
  }

  /* 맨 위 한 줄 — 지금 어떤 상태인지 말로 적는다 */
  const nowStep = steps.find((s) => s.status === 'pending')
  const rejected = steps.find((s) => s.status === 'rejected')
  const lastAt = [...steps].reverse().find((s) => s.acted_at)?.acted_at
  const nowLine =
    doc.status === 'pending' && nowStep
      ? <>지금 <strong>{nameOf(nowStep.approver_id)}{empOf(nowStep.approver_id)?.duty ? ` ${empOf(nowStep.approver_id).duty}` : ''}</strong> 님의 결재를 기다리고 있습니다.</>
      : doc.status === 'approved' ? <>결재가 모두 끝났습니다. {lastAt && `(${dateTime(lastAt)} 승인)`}</>
        : doc.status === 'rejected' ? <><strong>{rejected ? nameOf(rejected.approver_id) : '결재자'}</strong> 님이 반려했습니다.</>
          : doc.status === 'withdrawn' ? <>기안자가 회수한 문서입니다.</>
            : <>진행 상태를 확인해 주세요.</>

  /* 처리 이력 — 따로 저장하는 표는 없다. 결재선의 처리 시각·상태로 만든다(최근 순). */
  const log = [
    ...steps.filter((s) => s.acted_at).map((s) => ({
      key: `s${s.step}`, name: nameOf(s.approver_id),
      role: steps.length > 1 ? `결재 ${s.step}차` : '결재',
      state: STEP_STATUS[s.status], kind: s.status, at: s.acted_at, comment: s.comment,
    })),
    { key: 'draft', name: nameOf(doc.drafter_id), role: '기안', state: '상신', kind: 'draft', at: doc.created_at },
  ].sort((a, b) => new Date(b.at) - new Date(a.at))

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
      {/* ⚠️ 카드와 **같은 너비**로 묶는다. 안 그러면 좌우가 카드와 어긋난다. */}
      <div className="row-between no-print doc-bar">
        <Link to="/approval" className="btn small-btn">← 목록</Link>
        <button className="btn small-btn" onClick={() => window.print()}>인쇄</button>
      </div>

      {state?.uploadFailed && (
        <p className="error">결재는 올라갔지만 첨부파일 {state.uploadFailed.join(', ')} 을(를) 올리지 못했습니다. 회수 후 다시 올려 주세요.</p>
      )}

      <article className="card doc2">
        {/* ① 제목과 진행 상태 */}
        <header className="d2-head">
          <div>
            <p className="d2-form">{formName(doc)}</p>
            <h1>{doc.title}</h1>
          </div>
          <StatusPill status={doc.status} />
        </header>

        {/* ② 기본 정보 */}
        <div className="d2-meta">
          <div><span className="d2-k">문서번호</span><span className="d2-v tnum">{doc.doc_no}</span></div>
          <div><span className="d2-k">기안자</span><span className="d2-v">
            {nameOf(doc.drafter_id)}{drafter?.position ? ` ${drafter.position}` : ''}</span></div>
          <div><span className="d2-k">기안부서</span><span className="d2-v">{drafter?.dept || '—'}</span></div>
          <div><span className="d2-k">기안일</span><span className="d2-v tnum">{dateTime(doc.created_at)}</span></div>
        </div>

        {/* ③ 결재선 */}
        <section className="d2-sec">
          <h2>결재선</h2>
          <p className={`d2-now${doc.status === 'pending' ? '' : ' plain'}`}>{nowLine}</p>
          <ol className="line-cards">
            <li className="lc lc--done">
              <span className="lc-role">기안</span>
              <strong className="lc-name">{nameOf(doc.drafter_id)}</strong>
              <span className="lc-pos">{who(doc.drafter_id) || '—'}</span>
              <span className="lc-state">상신</span>
              <time className="lc-at">{dateTime(doc.created_at)}</time>
            </li>
            {steps.map((s) => (
              <li key={s.step} className={`lc ${LC_KIND[s.status] || ''}`}>
                <span className="lc-role">{steps.length > 1 ? `결재 ${s.step}차` : '결재'}</span>
                <strong className="lc-name">{nameOf(s.approver_id)}</strong>
                <span className="lc-pos">{who(s.approver_id) || '—'}</span>
                <span className="lc-state">{STEP_STATUS[s.status]}</span>
                <time className="lc-at">{s.acted_at ? dateTime(s.acted_at) : '—'}</time>
              </li>
            ))}
          </ol>
          {doc.approval_refs.length > 0 && (
            <p className="small">참조 · {doc.approval_refs.map((r) => nameOf(r.user_id)).join(', ')}</p>
          )}
        </section>

        {/* ④ 신청 내용 */}
        {doc.form_type === 'leave' && (
          <section className="d2-sec">
            <h2>신청 정보</h2>
            <div className="d2-facts">
              <div><span className="d2-k">휴가 종류</span><span className="d2-big">{leaveName(doc.data.kind, doc.data.half)}</span></div>
              <div><span className="d2-k">기간</span><span className="d2-big tnum">{Array.isArray(doc.data.dates)
                ? doc.data.dates.map(dot).join(', ')
                : (doc.data.start === doc.data.end ? dot(doc.data.start) : `${dot(doc.data.start)} ~ ${dot(doc.data.end)}`)}</span></div>
              <div><span className="d2-k">일수</span><span className="d2-big tnum">{doc.data.days}일</span></div>
            </div>
            {doc.data.ref_doc && (
              <p className="small"><span className="d2-k">관련 문서</span>
                <Link to={`/approval/${doc.data.ref_doc.id}`}>{doc.data.ref_doc.doc_no} · {doc.data.ref_doc.title}</Link></p>
            )}
          </section>
        )}

        {doc.form_type === 'expense' && (
          <section className="d2-sec">
            <h2>신청 정보</h2>
            <div className="table-wrap">
              <table className="table compact">
                <thead><tr><th>날짜</th><th>내용</th><th className="r">금액</th></tr></thead>
                <tbody>
                  {doc.data.items.map((it, i) => (
                    <tr key={i}><td className="tnum">{dot(it.date)}</td><td>{it.desc}</td><td className="r tnum">{won(it.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d2-facts">
              <div><span className="d2-k">합계</span><span className="d2-big tnum">{won(doc.data.total)}</span></div>
            </div>
          </section>
        )}

        {doc.form_type === 'custom' && (
          <section className="d2-sec">
            <h2>신청 정보</h2>
            {doc.doc_forms
              ? <FormView fields={doc.doc_forms.fields} values={doc.data?.fields} />
              : <p className="muted small">이 문서가 쓰던 양식이 지워졌습니다. 아래 내용만 남아 있습니다.</p>}
          </section>
        )}

        {doc.content && (
          <section className="d2-sec">
            <h2>{doc.form_type === 'leave' ? '신청 사유' : '내용'}</h2>
            <p className="d2-reason">{doc.content}</p>
          </section>
        )}

        {doc.approval_files.length > 0 && (
          <section className="d2-sec">
            <h2>첨부파일</h2>
            <ul className="d2-files">
              {doc.approval_files.map((f) => (
                <li key={f.id}>
                  <button className="linkbtn" onClick={() => openFile(f)}>{f.name}</button>
                  {' '}<span className="muted small">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ⑤ 결재 의견 및 처리 이력 */}
        <section className="d2-sec">
          <h2>결재 의견 및 처리 이력</h2>
          <ul className="d2-log">
            {log.map((l) => (
              <li key={l.key}>
                <span className="who">{l.name}{' '}
                  <span className={l.kind === 'approved' ? 'log-ok' : l.kind === 'rejected' ? 'log-no' : 'log-plain'}>{l.state}</span>
                </span>
                <span className="meta">{l.role} · {dateTime(l.at)}</span>
                {l.comment && <p>{l.comment}</p>}
              </li>
            ))}
          </ul>
        </section>
      </article>

      <ErrorBox>{err}</ErrorBox>

      {myTurn && (
        <section className="card stack-sm no-print doc-bar">
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
        <div className="actions no-print doc-bar">
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

      {/* 회수한 내 문서는 고쳐서 다시 올릴 수 있다 (지은님 2026-10-21).
          새 문서가 아니라 같은 문서를 다시 올리는 것이라 문서번호·첨부가 그대로다. */}
      {doc.status === 'withdrawn' && doc.drafter_id === userId && (
        <div className="actions no-print doc-bar">
          <span className="small">회수한 문서입니다. 고쳐서 다시 올릴 수 있어요.</span>
          <Link className="btn primary" to={`/approval/new?from=${doc.id}`}>고쳐서 다시 올리기</Link>
        </div>
      )}
    </div>
  )
}
