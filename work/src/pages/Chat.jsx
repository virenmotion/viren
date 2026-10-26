import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { FEED_TAG, UNREAD_EVENT, avatarTone, loadRooms, mailFeed, roomTitle, shortTime } from '../lib/chat'
import { mascotSummary } from '../lib/mascot'
import { BigEmpty, ErrorBox, MailIcon } from '../components/ui'

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
  /* 찾기·거르기는 **이미 받아 둔 목록 안에서만** 한다. 서버에 다시 묻지 않는다.
     6명 회사라 방이 몇 개 안 되므로 이걸로 충분하다. */
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')   // all | group | direct

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

  /* 찾기 글자는 방 이름과 마지막 글에서 찾는다 */
  const hit = (r) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    const title = roomTitle(r, r.members, userId, empOf).toLowerCase()
    return title.includes(s) || String(r.last_text || '').toLowerCase().includes(s)
  }

  /* 메일 알림방은 **위쪽 묶음에만** 둔다.
     ⚠️ 아래 목록에 그냥 두면 공용 메일방이 '그룹' 탭에, 개인 메일방이 '개인' 탭에
        섞여 나와서 사람과 하는 대화인 줄 안다. 그래서 아래에서는 아예 뺀다.
     검색은 두 묶음 모두에 걸린다. */
  const feeds = (rooms || []).filter((r) => mailFeed(r)).filter(hit)
  const shown = (rooms || []).filter((r) => !mailFeed(r)).filter((r) => {
    if (kind !== 'all' && r.kind !== kind) return false
    return hit(r)
  })

  return (
    <div className="stack">
      {/* 휴대폰에서 대화를 열면 방 제목과 겹쳐서 감춘다(in-room) */}
      <header className={`page-head chat-head${inRoom ? ' in-room' : ''}`}>
        <div>
          <h1>메신저</h1>
          <p className="eyebrow">대화 내용은 바이렌워크 안에만 남습니다.</p>
        </div>
      </header>

      <ErrorBox>{err}</ErrorBox>

      <div className={`chat-2col${inRoom ? ' in-room' : ''}`}>
        <aside className="chat-aside">
          <button className="btn primary chat-newbtn" onClick={() => setMaking(true)}>+ 새 대화</button>

          <label className="chat-search">
            <span className="sr-only">대화 검색</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" />
            </svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="대화 검색" />
          </label>

          {/* ① 메일 알림 — 일반 대화와 섞이지 않게 따로 묶는다 */}
          {feeds.length > 0 && (
            <div className="list-sec">
              <h3>메일 알림</h3>
              <ul className="roomlist">
                {feeds.map((r) => <RoomRow key={r.id} r={r} userId={userId} empOf={empOf} />)}
              </ul>
            </div>
          )}

          {/* ② 사람과 하는 대화 */}
          <div className="list-sec">
            {feeds.length > 0 && <h3>대화</h3>}
            <div className="subtabs" role="tablist">
              {[['all', '전체'], ['group', '그룹'], ['direct', '개인']].map(([k, label]) => (
                <button key={k} role="tab" aria-selected={kind === k}
                  className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{label}</button>
              ))}
            </div>

            {/* ⚠️ 불러오는 중(null)과 진짜 0건을 구분한다. 거른 결과가 0건인 것도 따로 적는다. */}
            {rooms === null ? null : rooms.length === 0 ? (
              <p className="hint">아직 대화가 없어요. ‘새 대화’ 로 시작해 보세요.</p>
            ) : shown.length === 0 ? (
              <p className="hint">찾는 대화가 없어요.</p>
            ) : (
              <ul className="roomlist chat-rooms">
                {shown.map((r) => <RoomRow key={r.id} r={r} userId={userId} empOf={empOf} />)}
              </ul>
            )}
          </div>

          <div className="chat-quick">
            <PeopleShortcut people={activeEmployees.filter((e) => e.id !== userId)} />
            <p className="hint">알림은 <strong>내 정보 → 기기 알림</strong>에서 켤 수 있어요.</p>
          </div>
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
/* 목록 한 줄. 메일 알림방과 보통 대화가 같은 틀을 쓰되 아이콘·표만 다르다. */
function RoomRow({ r, userId, empOf }) {
  const feed = mailFeed(r)
  const title = roomTitle(r, r.members, userId, empOf)
  return (
    <li>
      <NavLink to={`/chat/${r.id}`}>
        {feed
          ? <span className="room-ava mail" aria-hidden="true"><MailIcon /></span>
          : (
            <span className={`room-ava ava-${avatarTone(r.kind === 'group' ? r.id : title)}`} aria-hidden="true">
              {r.kind === 'group' ? '#' : title.slice(0, 1)}
            </span>
          )}
        <span className="room-main">
          <strong>{title}
            {feed
              ? <em className="room-tag">{FEED_TAG[feed.scope]}</em>
              /* ⚠️ 숫자만 적으면 안 읽은 수처럼 보인다. '명' 을 붙인다. */
              : r.kind === 'group' && <em className="room-n">{r.members.length}명</em>}</strong>
          {/* 스티커는 '바이렌 스티커 · 확인했어요' 로. 뒤에 붙은 식별자는 숨긴다. */}
          <span className="room-last">{r.last_text ? mascotSummary(r.last_text) : feed ? '아직 온 메일이 없어요' : '새 대화'}</span>
        </span>
        <span className="room-side">
          <span className="room-time">{shortTime(r.last_at)}</span>
          {r.unread > 0 && <span className="badge">{r.unread}</span>}
        </span>
      </NavLink>
    </li>
  )
}


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
    <section className="stack-sm">
      <h3 className="quick-head">바로 대화 걸기</h3>
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
