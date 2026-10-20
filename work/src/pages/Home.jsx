import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dot, hm, hoursText, minutesBetween, parse, today, weekday } from '../lib/dates'
import { leaveSummary } from '../lib/leave'
import { FORMS } from '../lib/labels'
import { Empty, ErrorBox, StatusPill } from '../components/ui'

/* 화면에 띄워 둔 동안 시계·근무시간이 흘러가도록 20초마다 다시 그린다 */
function useNow(ms = 20000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export default function Home() {
  const { me, userId } = useSession()
  const now = useNow()
  const [att, setAtt] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [todo, setTodo] = useState(null)
  const [mine, setMine] = useState(null)
  const [minePending, setMinePending] = useState(0)
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
    supabase.from('approval_docs').select('id', { count: 'exact', head: true }).eq('drafter_id', userId).eq('status', 'pending')
      .then(({ count }) => setMinePending(count || 0))
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
  const state = !att?.check_in ? 'before' : att.check_out ? 'done' : 'working'
  const worked = state === 'working' ? minutesBetween(att.check_in, now) : state === 'done' ? minutesBetween(att.check_in, att.check_out) : 0
  const [, m, day] = d.split('-').map(Number)
  const hour = Number(hm(now).slice(0, 2))
  const greet = hour < 11 ? '좋은 아침이에요' : hour < 17 ? '오늘도 수고 많아요' : '오늘 하루 고생했어요'

  return (
    <div className="stack home">
      <header className="home-head">
        <p className="eyebrow">{m}월 {day}일 {weekday(d)}요일</p>
        <h1>{me.name}님, {greet}</h1>
      </header>

      <section className={`punch punch-${state}`} aria-label="오늘 근무">
        <div className="punch-clock">
          <span className="clock tnum">{hm(now)}</span>
          <span className={`punch-state st-${state}`}>
            {state === 'before' && '출근 전'}
            {state === 'working' && <>근무 중 · {worked > 0 ? hoursText(worked) : '방금 출근'}</>}
            {state === 'done' && <>퇴근 완료 · {hoursText(worked)}</>}
          </span>
        </div>
        <dl className="punch-times">
          <div><dt>출근</dt><dd className="tnum">{att?.check_in ? hm(att.check_in) : '—'}</dd></div>
          <div><dt>퇴근</dt><dd className="tnum">{att?.check_out ? hm(att.check_out) : '—'}</dd></div>
        </dl>
        {att?.in_office === false && <p className="punch-note">사무실 밖에서 출근을 찍었어요.</p>}
        <ErrorBox>{err}</ErrorBox>
        {att !== undefined && (
          state === 'before' ? (
            <button className="btn punch-btn in" disabled={busy} onClick={() => punch('check_in')}>출근하기</button>
          ) : (
            <button className="btn punch-btn out" disabled={busy} onClick={() => punch('check_out')}>
              {state === 'done' ? '퇴근 시각 다시 찍기' : '퇴근하기'}
            </button>
          )
        )}
      </section>

      <div className="stat-row">
        <Link to="/approval?box=todo" className={`stat ${todo?.length ? 'hot' : ''}`}>
          <span className="stat-label">결재할 문서</span>
          <span className="stat-num tnum">{todo?.length ?? '–'}<small>건</small></span>
        </Link>
        <Link to="/approval?box=mine" className="stat">
          <span className="stat-label">진행 중인 내 문서</span>
          <span className="stat-num tnum">{minePending}<small>건</small></span>
        </Link>
        <Link to="/approval/new?form=leave" className="stat">
          <span className="stat-label">남은 연차</span>
          {leave ? (
            <>
              <span className="stat-num tnum">{leave.remaining}<small>일</small></span>
              <span className="stat-sub tnum">{leave.entitled}일 중 {leave.used}일 사용{leave.pending > 0 && ` · 결재 중 ${leave.pending}일`}</span>
            </>
          ) : (
            <span className="stat-sub">입사일 등록 후 계산돼요</span>
          )}
        </Link>
      </div>

      <div className="home-lists">
        <section className="card">
          <div className="row-between"><h2>결재할 문서</h2><Link to="/approval?box=todo" className="more">전체 보기</Link></div>
          {todo === null ? null : todo.length === 0 ? <Empty>지금 결재할 문서가 없어요.</Empty> : <DocList docs={todo} />}
        </section>
        <section className="card">
          <div className="row-between"><h2>내가 올린 문서</h2><Link to="/approval/new" className="btn primary small-btn">+ 새 문서</Link></div>
          {mine === null ? null : mine.length === 0 ? <Empty>아직 올린 문서가 없어요.</Empty> : <DocList docs={mine} />}
        </section>
      </div>

      {leave && (
        <p className="hint center">연차 기간 {dot(leave.start)} ~ {dot(addDayBefore(leave.end))}{leave.overridden && ' · 회사 지정 일수'}</p>
      )}
    </div>
  )
}

const addDayBefore = (s) => { const x = parse(s); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10) }

function DocList({ docs }) {
  const { nameOf } = useSession()
  return (
    <ul className="doclist">
      {docs.map((d) => (
        <li key={d.id}>
          <Link to={`/approval/${d.id}`}>
            <span className="tag">{FORMS[d.form_type]}</span>
            <span className="title">{d.title}</span>
            <span className="meta">{nameOf(d.drafter_id)}</span>
            <StatusPill status={d.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
