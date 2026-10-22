import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dot, hm, hoursText, minutesBetween, parse, today, weekday } from '../lib/dates'
import { leaveSummary } from '../lib/leave'
import { formName } from '../lib/labels'
import { workStat } from '../lib/worktime'
import { Empty, ErrorBox, StatusPill } from '../components/ui'
import Shortcuts from '../components/Shortcuts'
import WorkBar from '../components/WorkBar'
import { pushSupported } from '../lib/push'

/* 화면에 띄워 둔 동안 시계·근무시간이 흘러가도록 20초마다 다시 그린다 */
function useNow(ms = 20000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/* 요약 칸의 작은 아이콘 타일. 뜻을 거드는 정도로만 쓴다(기능 설명은 글자가 한다). */
const TILES = {
  doc: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M14 3.5V8h4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  leave: <><path d="M3.5 12a8.5 8.5 0 0 1 17 0z" /><path d="M12 12v6.5a2 2 0 0 0 4 0" /><path d="M12 3.4V5" /></>,
  comp: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3.3V6.7M16 3.3V6.7" /></>,
}
const Tile = ({ name, tone }) => (
  <span className={`tile t-${tone}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {TILES[name]}
    </svg>
  </span>
)

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
  /* 남은 대체휴무는 서버가 센다(comp_balance) — 화면과 서버가 같은 값을 쓰도록 */
  const [comp, setComp] = useState(null)
  /* 오늘의 일정 — 캘린더가 쓰는 events 표를 그대로 읽는다(새 API 없음). */
  const [plans, setPlans] = useState([])
  const [box, setBox] = useState('todo')   // 결재함에서 보고 있는 칸
  const d = today()

  useEffect(() => {
    supabase.from('attendance').select('*').eq('user_id', userId).eq('work_date', d).maybeSingle()
      .then(({ data }) => setAtt(data))
    supabase.from('approval_steps').select('doc_id').eq('approver_id', userId).eq('status', 'pending')
      .then(async ({ data }) => {
        const ids = (data || []).map((r) => r.doc_id)
        if (!ids.length) return setTodo([])
        const { data: docs } = await supabase.from('approval_docs').select('*, doc_forms(name)').in('id', ids).order('created_at')
        setTodo(docs || [])
      })
    supabase.from('approval_docs').select('*, doc_forms(name)').eq('drafter_id', userId).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setMine(data || []))
    supabase.from('approval_docs').select('id', { count: 'exact', head: true }).eq('drafter_id', userId).eq('status', 'pending')
      .then(({ count }) => setMinePending(count || 0))
    supabase.from('approval_docs').select('form_type,status,data').eq('drafter_id', userId).eq('form_type', 'leave')
      .in('status', ['approved', 'pending'])
      .then(({ data }) => setLeaveDocs(data || []))
    supabase.rpc('comp_balance', { p_user: userId })
      .then(({ data, error }) => setComp(error ? null : Number(data ?? 0)))
    /* 일정 표가 아직 없는 DB 에서도 홈은 떠야 한다 — 실패하면 그 칸만 비운다. */
    supabase.from('events').select('*, event_categories(name, color)')
      .lte('start_date', d).gte('end_date', d)
      .order('all_day', { ascending: false }).order('start_time', { nullsFirst: true })
      .then(({ data, error }) => setPlans(error ? [] : (data || [])))
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
  const w = workStat(worked)
  const [, m, day] = d.split('-').map(Number)
  const hour = Number(hm(now).slice(0, 2))
  const greet = hour < 11 ? '좋은 아침이에요' : hour < 17 ? '오늘도 수고 많아요' : '오늘 하루 고생했어요'
  const boxDocs = box === 'todo' ? todo : mine

  return (
    <div className="stack home">
      {/* 알림을 아직 안 켠 기기에만 뜬다. 켜 두면 사라진다. */}
      {pushSupported() && Notification.permission !== 'granted' && (
        <Link to="/me" className="push-nudge">
          결재 알림이 꺼져 있어요 — 이 기기에서 켜기 →
        </Link>
      )}

      <header className="home-head">
        <p className="eyebrow">{m}월 {day}일 {weekday(d)}요일</p>
        <h1>{me.name}님, {greet}</h1>
      </header>

      <div className="home-top">
        <section className="card punch" aria-label="오늘 근무">
          <div className="row-between punch-head">
            <div className="punch-title">
              <h2>오늘의 근무</h2>
              <span className={`punch-state st-${state}`}>
                {state === 'before' && '출근 전'}
                {state === 'working' && <>근무 중{worked > 0 ? ` · ${hoursText(worked)}` : ' · 방금 출근'}</>}
                {state === 'done' && <>퇴근 완료 · {hoursText(worked)}</>}
              </span>
            </div>
            {/* 기준과 남은/초과를 늘 같이 적는다 — 막대만으로는 뜻이 안 보인다 */}
            <p className="punch-goal">
              9시간 기준
              {worked > 0 && (w.over > 0
                ? <> · <strong>{hoursText(w.over)} 초과</strong></>
                : <> · {hoursText(w.left)} 남음</>)}
            </p>
          </div>

          <span className="clock tnum">{hm(now)}</span>

          {worked > 0 && (
            <div className="punch-bar">
              <WorkBar minutes={worked} height={8} working={state === 'working'} />
              <span className="tnum punch-pct">{w.pct}%</span>
            </div>
          )}

          <div className="punch-foot">
            <dl className="punch-times">
              <div><dt>출근</dt><dd className="tnum">{att?.check_in ? hm(att.check_in) : '—'}</dd></div>
              <div><dt>퇴근</dt><dd className="tnum">{att?.check_out ? hm(att.check_out) : '—'}</dd></div>
            </dl>
            {att !== undefined && (
              state === 'before' ? (
                <button className="btn primary punch-btn" disabled={busy} onClick={() => punch('check_in')}>출근하기</button>
              ) : (
                <button className="btn primary punch-btn" disabled={busy} onClick={() => punch('check_out')}>
                  {state === 'done' ? '퇴근 시각 다시 찍기' : '퇴근하기'}
                </button>
              )
            )}
          </div>

          {att?.in_office === false && <p className="punch-note">사무실 밖에서 출근을 찍었어요.</p>}
          <ErrorBox>{err}</ErrorBox>
        </section>

        <section className="card today-plan">
          <div className="row-between">
            <h2>오늘의 일정</h2>
            <Link to="/calendar" className="more tnum">{m}.{day} ({weekday(d)})</Link>
          </div>
          {plans.length === 0
            ? <Empty>오늘 잡힌 일정이 없어요.</Empty>
            : (
              <ul className="plan-list">
                {plans.map((p) => (
                  <li key={p.id}>
                    <span className="dot" style={{ background: p.event_categories?.color || 'var(--line-2)' }} aria-hidden="true" />
                    <span className="plan-main">
                      <span className="plan-title">{p.title}</span>
                      <span className="plan-meta">
                        {p.event_categories?.name && <span className="chip-soft">{p.event_categories.name}</span>}
                        {!p.all_day && p.start_time && <span className="tnum">{p.start_time.slice(0, 5)}</span>}
                        {p.all_day && <span>종일</span>}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>

      <div className="stat-row">
        <Link to="/approval?box=todo" className={`stat ${todo?.length ? 'hot' : ''}`}>
          <Tile name="doc" tone="purple" />
          <span className="stat-body">
            <span className="stat-label">결재할 문서</span>
            <span className="stat-num tnum">{todo?.length ?? '–'}<small>건</small></span>
          </span>
        </Link>
        <Link to="/approval?box=mine" className="stat">
          <Tile name="clock" tone="blue" />
          <span className="stat-body">
            <span className="stat-label">진행 중인 내 문서</span>
            <span className="stat-num tnum">{minePending}<small>건</small></span>
          </span>
        </Link>
        <Link to="/approval/new?form=leave" className="stat">
          <Tile name="leave" tone="yellow" />
          <span className="stat-body">
            <span className="stat-label">남은 연차</span>
            {leave ? (
              <>
                <span className="stat-num tnum">{leave.remaining}<small>일</small></span>
                <span className="stat-sub tnum">{leave.entitled}일 중 {leave.used}일 사용{leave.pending > 0 && ` · 결재 중 ${leave.pending}일`}</span>
              </>
            ) : (
              <span className="stat-sub">입사일 등록 후 계산돼요</span>
            )}
          </span>
        </Link>
        <Link to="/approval/new?form=leave&kind=comp" className="stat">
          <Tile name="comp" tone="pink" />
          <span className="stat-body">
            <span className="stat-label">남은 대체휴무</span>
            <span className="stat-num tnum">{comp == null ? '–' : comp}<small>일</small></span>
            <span className="stat-sub">
              {comp ? '휴가신청서에서 대휴로 쓸 수 있어요' : '휴일근무신청서가 승인되면 생겨요'}
            </span>
          </span>
        </Link>
      </div>

      <div className="home-lists">
        <section className="card">
          <div className="row-between">
            <h2>결재함</h2>
            <div className="actions">
              <Link to={`/approval?box=${box}`} className="more">전체 보기</Link>
              <Link to="/approval/new" className="btn primary small-btn">+ 새 문서</Link>
            </div>
          </div>
          {/* 탭으로 묶어도 '결재할 문서'·'내가 올린 문서'·'전체 보기'·'새 문서' 네 길을 모두 남긴다 */}
          <div className="subtabs" role="tablist">
            <button role="tab" aria-selected={box === 'todo'} className={box === 'todo' ? 'on' : ''} onClick={() => setBox('todo')}>
              결재할 문서{todo?.length ? ` ${todo.length}` : ''}
            </button>
            <button role="tab" aria-selected={box === 'mine'} className={box === 'mine' ? 'on' : ''} onClick={() => setBox('mine')}>
              내가 올린 문서
            </button>
          </div>
          {boxDocs === null ? null : boxDocs.length === 0
            ? <Empty>{box === 'todo' ? '지금 결재할 문서가 없어요.' : '아직 올린 문서가 없어요.'}</Empty>
            : <DocList docs={boxDocs} />}
        </section>

        <section className="card">
          <h2>바로가기</h2>
          <Shortcuts />
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
            <span className="tag">{formName(d)}</span>
            <span className="title">{d.title}</span>
            <span className="meta">{nameOf(d.drafter_id)}</span>
            <StatusPill status={d.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
