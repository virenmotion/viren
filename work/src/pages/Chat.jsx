import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { UNREAD_EVENT, avatarTone, loadRooms, roomTitle, shortTime } from '../lib/chat'
import { BigEmpty, ErrorBox } from '../components/ui'

/* 메신저 틀 — 왼쪽 대화 목록 + 오른쪽 대화. (지은님 2026-10-23, 시안대로)

   ⚠️ **주소는 그대로다.** /chat 과 /chat/:id 를 살려 두고 그 둘을 감싸는 틀만 씌웠다.
      그래서 읽음 처리·실시간 구독·뒤로가기·알림에서 들어오는 길이 하나도 안 바뀐다.
      (ChatRoom 은 id 가 바뀔 때마다 예전처럼 새로 붙었다 떨어진다.)
   ⚠️ 휴대폰에서는 두 칸을 같이 못 보여 준다. 예전처럼 **목록 → 대화** 로 옮겨 간다.
      어느 쪽을 보여 줄지는 주소로 정한다(in-room). */

export default function ChatShell() {
  const { userId, empOf, activeEmployees } = useSession()
  const inRoom = !!useMatch('/chat/:id')
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
      {/* 휴대폰에서 대화를 열면 방 제목과 겹쳐서 감춘다(in-room) */}
      <header className={`page-head chat-head${inRoom ? ' in-room' : ''}`}>
        <div>
          <h1>메신저</h1>
          <p className="eyebrow">대화 내용은 바이렌워크 안에만 남습니다.</p>
        </div>
        <button className="btn primary" onClick={() => setMaking(true)}>+ 새 대화</button>
      </header>

      <ErrorBox>{err}</ErrorBox>

      <div className={`chat-2col${inRoom ? ' in-room' : ''}`}>
        <aside className="chat-aside">
          {/* ⚠️ 불러오는 중(null)과 진짜 0건을 구분한다 */}
          {rooms === null ? null : rooms.length === 0 ? (
            <p className="hint">아직 대화가 없어요. ‘새 대화’ 로 시작해 보세요.</p>
          ) : (
            <ul className="roomlist">
              {rooms.map((r) => {
                const title = roomTitle(r, r.members, userId, empOf)
                return (
                  <li key={r.id}>
                    <NavLink to={`/chat/${r.id}`}>
                      <span className={`room-ava ava-${avatarTone(r.kind === 'group' ? r.id : title)}`} aria-hidden="true">
                        {r.kind === 'group' ? '#' : title.slice(0, 1)}
                      </span>
                      <span className="room-main">
                        <strong>{title}
                          {r.kind === 'group' && <em className="room-n">{r.members.length}</em>}</strong>
                        <span className="room-last">{r.last_text || '새 대화'}</span>
                      </span>
                      <span className="room-side">
                        <span className="room-time">{shortTime(r.last_at)}</span>
                        {r.unread > 0 && <span className="badge">{r.unread}</span>}
                      </span>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          )}

          <PeopleShortcut people={activeEmployees.filter((e) => e.id !== userId)} />
          <p className="hint">
            알림은 <strong>내 정보 → 휴대폰 알림</strong>에서 기기마다 켤 수 있어요.
          </p>
        </aside>

        <div className="chat-main">
          <Outlet />
        </div>
      </div>

      {making && <NewChat onClose={() => setMaking(false)} />}
    </div>
  )
}

/* 아직 아무 대화도 안 골랐을 때 (/chat) */
export function ChatEmpty() {
  return (
    <section className="card flush chat-blank">
      <BigEmpty icon="chat" title="대화를 선택해 주세요">
        왼쪽 목록에서 대화를 고르면 내용이 여기 보입니다.
      </BigEmpty>
    </section>
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
            <span className={`avatar ava-${avatarTone(p.name)}`} aria-hidden="true">{(p.name || '?').slice(0, 1)}</span>
            {p.name}{p.position ? ` ${p.position}` : ''}
          </button>
        ))}
      </div>
    </section>
  )
}

/* 새 대화 — 두 칸 틀에서는 옆에 끼워 넣을 자리가 없어 가운데 창으로 띄운다 */
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
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="card stack-sm modal-card">
        <div className="row-between"><h2>새 대화</h2>
          <button type="button" className="linkbtn" onClick={onClose}>닫기</button></div>
        <p className="hint">한 명만 고르면 1:1, 두 명 이상이면 단체방이 돼요.</p>
        <div className="people-row">
          {others.map((p) => (
            <button key={p.id} type="button"
              className={`person-chip${picked.includes(p.id) ? ' on' : ''}`} onClick={() => toggle(p.id)}>
              <span className={`avatar ava-${avatarTone(p.name)}`} aria-hidden="true">{(p.name || '?').slice(0, 1)}</span>
              {p.name}{p.position ? ` ${p.position}` : ''}
            </button>
          ))}
        </div>
        {picked.length > 1 && (
          <label className="field"><span>대화방 이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 안동 프로젝트" /></label>
        )}
        <ErrorBox>{err}</ErrorBox>
        <div className="actions">
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn primary" disabled={busy || !picked.length} onClick={make}>
            {picked.length > 1 ? '단체방 만들기' : '대화 시작'}
          </button>
        </div>
      </section>
    </div>
  )
}
