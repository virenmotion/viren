import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dot, hm, hoursText, minutesBetween, today, weekday } from '../lib/dates'
import { leaveSummary } from '../lib/leave'
import { FORMS } from '../lib/labels'
import { Empty, ErrorBox, StatusPill } from '../components/ui'

export default function Home() {
  const { me, userId } = useSession()
  const [att, setAtt] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [todo, setTodo] = useState([])
  const [mine, setMine] = useState([])
  const [leaveDocs, setLeaveDocs] = useState([])
  const d = today()

  useEffect(() => {
    supabase.from('attendance').select('*').eq('user_id', userId).eq('work_date', d).maybeSingle()
      .then(({ data }) => setAtt(data))
    supabase.from('approval_steps').select('doc_id').eq('approver_id', userId).eq('status', 'pending')
      .then(async ({ data }) => {
        const ids = (data || []).map((r) => r.doc_id)
        if (!ids.length) return setTodo([])
        const { data: docs } = await supabase.from('approval_docs').select('*').in('id', ids).order('created_at')
        setTodo(docs || [])
      })
    supabase.from('approval_docs').select('*').eq('drafter_id', userId).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setMine(data || []))
    supabase.from('approval_docs').select('form_type,status,data').eq('drafter_id', userId).eq('form_type', 'leave')
      .in('status', ['approved', 'pending'])
      .then(({ data }) => setLeaveDocs(data || []))
  }, [userId, d])

  async function punch(kind) {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc(kind)
    setBusy(false)
    if (error) setErr(errText(error))
    else setAtt(data)
  }

  const leave = leaveSummary(me, leaveDocs)
  const worked = att?.check_in && att?.check_out ? minutesBetween(att.check_in, att.check_out) : 0

  return (
    <div className="stack">
      <h1>{me.name}님, 안녕하세요</h1>
      <div className="grid-home">
        <section className="card punch">
          <h2>오늘 근무 <span className="muted small">{dot(d)} ({weekday(d)})</span></h2>
          <div className="punch-times">
            <div><span className="label">출근</span><strong className="tnum">{att?.check_in ? hm(att.check_in) : '--:--'}</strong></div>
            <div><span className="label">퇴근</span><strong className="tnum">{att?.check_out ? hm(att.check_out) : '--:--'}</strong></div>
          </div>
          {att?.in_office === false && <p className="hint">사무실 밖에서 출근을 찍었습니다.</p>}
          {worked > 0 && <p className="hint">근무 {hoursText(worked)}</p>}
          <ErrorBox>{err}</ErrorBox>
          {att === undefined ? null : !att?.check_in ? (
            <button className="btn primary big" disabled={busy} onClick={() => punch('check_in')}>출근하기</button>
          ) : (
            <button className="btn big" disabled={busy} onClick={() => punch('check_out')}>
              {att.check_out ? '퇴근 시각 다시 찍기' : '퇴근하기'}
            </button>
          )}
        </section>

        <section className="card">
          <h2>내 연차</h2>
          {!leave ? (
            <p className="muted">입사일이 등록되지 않아 연차를 계산할 수 없습니다. 관리자에게 입사일 등록을 요청해 주세요.</p>
          ) : (
            <>
              <div className="leave-big"><strong className="tnum">{leave.remaining}</strong><span>일 남음</span></div>
              <dl className="kv small">
                <dt>올해 연차</dt><dd className="tnum">{leave.entitled}일{leave.overridden && ' (회사 지정)'}</dd>
                <dt>사용</dt><dd className="tnum">{leave.used}일</dd>
                {leave.pending > 0 && <><dt>결재 중</dt><dd className="tnum">{leave.pending}일</dd></>}
                <dt>기간</dt><dd className="tnum">{dot(leave.start)} ~ {dot(leave.end)} 전날</dd>
              </dl>
            </>
          )}
          <Link className="btn" to="/approval/new?form=leave">휴가 신청</Link>
        </section>
      </div>

      <section className="card">
        <div className="row-between"><h2>내가 결재할 문서</h2><Link to="/approval?box=todo" className="small">전체 보기</Link></div>
        {todo.length === 0 ? <Empty>지금 결재할 문서가 없습니다.</Empty> : <DocList docs={todo} />}
      </section>

      <section className="card">
        <div className="row-between"><h2>내가 올린 문서</h2><Link to="/approval/new" className="btn primary small-btn">새 문서 작성</Link></div>
        {mine.length === 0 ? <Empty>아직 올린 문서가 없습니다.</Empty> : <DocList docs={mine} />}
      </section>
    </div>
  )
}

function DocList({ docs }) {
  const { nameOf } = useSession()
  return (
    <ul className="doclist">
      {docs.map((d) => (
        <li key={d.id}>
          <Link to={`/approval/${d.id}`}>
            <span className="muted small tnum">{d.doc_no}</span>
            <span className="tag">{FORMS[d.form_type]}</span>
            <span className="title">{d.title}</span>
            <span className="muted small">{nameOf(d.drafter_id)}</span>
            <StatusPill status={d.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
