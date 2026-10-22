import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { UNREAD_EVENT, loadRooms, roomTitle, shortTime } from '../lib/chat'
import { Empty, ErrorBox } from '../components/ui'

/* 대화 목록. 새 글이 오면 바로 위로 올라오도록 Realtime 을 듣는다. */

export default function Chat() {
  const { userId, empOf, activeEmployees } = useSession()
  const [rooms, setRooms] = useState(null)
  const [err, setErr] = useState('')
  const [making, setMaking] = useState(false)

  const refresh = () => loadRooms().then(setRooms).catch(() => setErr('대화를 불러오지 못했어요.'))

  useEffect(() => {
    refresh()
    /* 어느 방에든 새 글이 오면 목록을 다시 센다. 6명 규모라 통째로 다시 읽어도 가볍다. */
    const ch = supabase.channel('chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .subscribe()
    window.addEventListener(UNREAD_EVENT, refresh)
    return () => {
      supabase.removeChannel(ch)
      window.removeEventListener(UNREAD_EVENT, refresh)
    }
  }, [])

  return (
    <div className="stack">
      <div className="row-between">
        <h1>메신저</h1>
        <button className="btn primary small-btn" onClick={() => setMaking(true)}>+ 새 대화</button>
      </div>
      <ErrorBox>{err}</ErrorBox>

      {making && <NewChat onClose={() => setMaking(false)} />}

      {rooms === null ? null : rooms.length === 0 ? (
        <Empty>아직 대화가 없어요. ‘새 대화’ 로 시작해 보세요.</Empty>
      ) : (
        <ul className="roomlist">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link to={`/chat/${r.id}`}>
                <span className="room-ava" aria-hidden="true">
                  {r.kind === 'group' ? '👥' : roomTitle(r, r.members, userId, empOf).slice(0, 1)}
                </span>
                <span className="room-main">
                  <strong>{roomTitle(r, r.members, userId, empOf)}
                    {r.kind === 'group' && <em className="room-n">{r.members.length}</em>}</strong>
                  <span className="room-last">{r.last_text || '새 대화'}</span>
                </span>
                <span className="room-side">
                  <span className="room-time">{shortTime(r.last_at)}</span>
                  {r.unread > 0 && <span className="badge">{r.unread}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="hint">
        대화 내용은 바이렌워크 안에만 남습니다. 알림은 내 정보 → 휴대폰 알림에서 켤 수 있어요.
      </p>
      <PeopleShortcut people={activeEmployees.filter((e) => e.id !== userId)} />
    </div>
  )
}

/* 바로 1:1 걸기 — 직원이 몇 명 안 되니 목록을 그냥 펼쳐 둔다 */
function PeopleShortcut({ people }) {
  const nav = useNavigate()
  const [busy, setBusy] = useState('')
  async function open(id) {
    setBusy(id)
    const { data, error } = await supabase.rpc('open_direct', { p_other: id })
    setBusy('')
    if (!error && data) nav(`/chat/${data}`)
  }
  if (!people.length) return null
  return (
    <section className="card stack-sm">
      <h2>바로 대화 걸기</h2>
      <div className="people-row">
        {people.map((p) => (
          <button key={p.id} type="button" className="person-chip" disabled={busy === p.id} onClick={() => open(p.id)}>
            <span className="avatar" aria-hidden="true">{(p.name || '?').slice(0, 1)}</span>
            {p.name}{p.position ? ` ${p.position}` : ''}
          </button>
        ))}
      </div>
    </section>
  )
}

function NewChat({ onClose }) {
  const { userId, activeEmployees } = useSession()
  const nav = useNavigate()
  const others = useMemo(() => activeEmployees.filter((e) => e.id !== userId), [activeEmployees, userId])
  const [picked, setPicked] = useState([])
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function make() {
    setErr(''); setBusy(true)
    /* 한 명이면 1:1 — 같은 사람과 방이 여러 개 생기지 않게 서버가 찾아 준다 */
    const call = picked.length === 1
      ? supabase.rpc('open_direct', { p_other: picked[0] })
      : supabase.rpc('create_group', { p_name: name, p_members: picked })
    const { data, error } = await call
    setBusy(false)
    if (error) return setErr(error.message)
    onClose()
    nav(`/chat/${data}`)
  }

  return (
    <section className="card stack-sm">
      <div className="row-between"><h2>새 대화</h2>
        <button type="button" className="linkbtn" onClick={onClose}>닫기</button></div>
      <p className="hint">한 명만 고르면 1:1, 두 명 이상이면 단체방이 돼요.</p>
      <div className="people-row">
        {others.map((p) => (
          <button key={p.id} type="button"
            className={`person-chip${picked.includes(p.id) ? ' on' : ''}`} onClick={() => toggle(p.id)}>
            <span className="avatar" aria-hidden="true">{(p.name || '?').slice(0, 1)}</span>
            {p.name}{p.position ? ` ${p.position}` : ''}
          </button>
        ))}
      </div>
      {picked.length > 1 && (
        <label className="field"><span>대화방 이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 안동 프로젝트" /></label>
      )}
      <ErrorBox>{err}</ErrorBox>
      <div className="actions start">
        <button className="btn primary" disabled={busy || !picked.length} onClick={make}>
          {picked.length > 1 ? '단체방 만들기' : '대화 시작'}
        </button>
      </div>
    </section>
  )
}
