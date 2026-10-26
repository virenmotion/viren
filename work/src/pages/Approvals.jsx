import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dot, ymd } from '../lib/dates'
import { formName } from '../lib/labels'
import { BigEmpty, ErrorBox, StatusPill } from '../components/ui'

/* [칸 이름, 이름표, 비었을 때 제목, 비었을 때 설명] */
const BOXES = [
  ['todo', '결재할 문서', '결재할 문서가 없어요', '새로운 결재 요청이 도착하면 이곳에 표시됩니다.'],
  ['mine', '내가 올린 문서', '올린 문서가 없어요', '오른쪽 위 ‘새 문서’ 로 기안할 수 있어요.'],
  ['done', '내가 결재한 문서', '결재한 문서가 없어요', '승인하거나 반려한 문서가 여기 쌓입니다.'],
  ['ref', '참조 문서', '참조로 받은 문서가 없어요', '다른 사람이 나를 참조로 넣으면 여기 보입니다.'],
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
      let q = supabase.from('approval_docs').select('*, approval_steps(step, approver_id, status), doc_forms(name)')
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

  const boxes = isAdmin
    ? [...BOXES, ['all', '전체 문서', '문서가 없어요', '회사에 올라온 문서가 모두 여기 보입니다.']]
    : BOXES
  const here = boxes.find(([k]) => k === box) || BOXES[0]

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>전자결재</h1>
          <p className="eyebrow">필요한 문서를 빠르게 확인하고 처리하세요.</p>
        </div>
        <Link to="/approval/new" className="btn primary">+ 새 문서</Link>
      </header>

      <ErrorBox>{err}</ErrorBox>

      <section className="card flush box-card">
        <div className="subtabs pad-x" role="tablist">
          {boxes.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={box === k} className={box === k ? 'on' : ''} onClick={() => setParams({ box: k })}>{label}</button>
          ))}
        </div>

        {/* ⚠️ 불러오는 중 · 오류 · 진짜 0건을 구분한다. 오류를 '없음' 으로 바꿔치지 않는다. */}
        {docs === null ? <p className="muted pad">불러오는 중…</p> : docs.length === 0 ? (
          <BigEmpty title={here[2]}>{here[3]}</BigEmpty>
        ) : (
        <>
          <div className="table-wrap only-wide">
            <table className="table">
              {/* 제목이 먼저 눈에 들어와야 한다. 문서번호는 제목 아래 작게
                  (지은님 2026-10-26 시안 확인). */}
              <thead>
                <tr><th>제목</th><th>양식</th><th>기안자</th><th>기안일</th><th>현재 결재자</th><th>상태</th></tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const cur = d.approval_steps?.find((s) => s.status === 'pending')
                  return (
                    <tr key={d.id}>
                      <td className="ap-cell">
                        <span className="ap-title">
                          <Link to={`/approval/${d.id}`}>{d.title}</Link>
                          <span className="ap-no">{d.doc_no}</span>
                        </span>
                      </td>
                      <td><span className="tag">{formName(d)}</span></td>
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
          <ul className="doc-cards pad only-narrow">
            {docs.map((d) => {
              const cur = d.approval_steps?.find((s) => s.status === 'pending')
              return (
                <li key={d.id}>
                  <Link to={`/approval/${d.id}`}>
                    <div className="row-between"><span className="tag">{formName(d)}</span><StatusPill status={d.status} /></div>
                    <strong>{d.title}</strong>
                    <span className="ap-no">{d.doc_no}</span>
                    <span className="small tnum">
                      {nameOf(d.drafter_id)} · {dot(ymd(new Date(d.created_at)))}{cur && ` · 지금 ${nameOf(cur.approver_id)} 차례`}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
        )}

        <p className="box-foot">다른 문서는 위 탭에서 확인하세요.</p>
      </section>
    </div>
  )
}
