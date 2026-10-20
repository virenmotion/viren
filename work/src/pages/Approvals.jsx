import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dot, ymd } from '../lib/dates'
import { FORMS } from '../lib/labels'
import { Empty, ErrorBox, StatusPill } from '../components/ui'

const BOXES = [
  ['todo', '결재할 문서'],
  ['mine', '내가 올린 문서'],
  ['done', '내가 결재한 문서'],
  ['ref', '참조 문서'],
]

async function idsFrom(table, col, filters) {
  let q = supabase.from(table).select('doc_id')
  for (const [k, v] of Object.entries(filters)) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v)
  const { data, error } = await q
  if (error) throw error
  return [...new Set(data.map((r) => r[col]))]
}

export default function Approvals() {
  const { userId, isAdmin, nameOf } = useSession()
  const [params, setParams] = useSearchParams()
  const box = params.get('box') || 'todo'
  const [docs, setDocs] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setDocs(null); setErr('')
    ;(async () => {
      let q = supabase.from('approval_docs').select('*, approval_steps(step, approver_id, status)')
      if (box === 'mine') q = q.eq('drafter_id', userId)
      else if (box === 'todo') q = q.in('id', await idsFrom('approval_steps', 'doc_id', { approver_id: userId, status: 'pending' }))
      else if (box === 'done') q = q.in('id', await idsFrom('approval_steps', 'doc_id', { approver_id: userId, status: ['approved', 'rejected'] }))
      else if (box === 'ref') q = q.in('id', await idsFrom('approval_refs', 'doc_id', { user_id: userId }))
      const { data, error } = await q.order('created_at', { ascending: false }).limit(300)
      if (error) throw error
      if (alive) setDocs(data)
    })().catch((e) => alive && setErr(errText(e)))
    return () => { alive = false }
  }, [box, userId])

  const boxes = isAdmin ? [...BOXES, ['all', '전체 문서']] : BOXES

  return (
    <div className="stack">
      <div className="row-between">
        <h1>전자결재</h1>
        <Link to="/approval/new" className="btn primary">+ 새 문서</Link>
      </div>
      <div className="tabs" role="tablist">
        {boxes.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={box === k} className={box === k ? 'on' : ''} onClick={() => setParams({ box: k })}>{label}</button>
        ))}
      </div>
      <ErrorBox>{err}</ErrorBox>
      {docs === null ? <p className="muted">불러오는 중…</p> : docs.length === 0 ? <div className="card"><Empty>문서가 없어요.</Empty></div> : (
        <>
          <div className="table-wrap card flush only-wide">
            <table className="table">
              <thead>
                <tr><th>문서번호</th><th>양식</th><th>제목</th><th>기안자</th><th>기안일</th><th>현재 결재자</th><th>상태</th></tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const cur = d.approval_steps?.find((s) => s.status === 'pending')
                  return (
                    <tr key={d.id}>
                      <td className="tnum muted">{d.doc_no}</td>
                      <td><span className="tag">{FORMS[d.form_type]}</span></td>
                      <td className="title-cell"><Link to={`/approval/${d.id}`}>{d.title}</Link></td>
                      <td>{nameOf(d.drafter_id)}</td>
                      <td className="tnum">{dot(ymd(new Date(d.created_at)))}</td>
                      <td>{cur ? nameOf(cur.approver_id) : '—'}</td>
                      <td><StatusPill status={d.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <ul className="doc-cards only-narrow">
            {docs.map((d) => {
              const cur = d.approval_steps?.find((s) => s.status === 'pending')
              return (
                <li key={d.id}>
                  <Link to={`/approval/${d.id}`}>
                    <div className="row-between"><span className="tag">{FORMS[d.form_type]}</span><StatusPill status={d.status} /></div>
                    <strong>{d.title}</strong>
                    <span className="muted small tnum">
                      {nameOf(d.drafter_id)} · {dot(ymd(new Date(d.created_at)))}{cur && ` · 지금 ${nameOf(cur.approver_id)} 차례`}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
