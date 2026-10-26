import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { avatarTone, clock, dayLabel, fileUrl, isImage, markRead, roomTitle, sameDay, sendFile, sendText } from '../lib/chat'
import { mascotText, readMascot } from '../lib/mascot'
import MascotPicker, { MascotImage } from '../components/MascotPicker'
import { ErrorBox } from '../components/ui'

/* 대화 한 방. 들어오면 읽음 처리하고, 새 글은 Realtime 으로 바로 붙인다. */

/* 상대가 읽었는지는 room_members.last_read_at 으로 안다.
   ⚠️ 이 칸은 Realtime 이 켜져 있지 않다(messages 만 켜 두었다).
      그래서 방을 보고 있는 동안 **15초마다 한 번씩** 다시 읽어 온다.
      가벼운 조회라 괜찮다. 실시간으로 바꾸려면 DB 설정을 건드려야 한다. */
const READ_POLL_MS = 15000

export default function ChatRoom() {
  const { id } = useParams()
  const { userId, empOf, activeEmployees } = useSession()
  const nav = useNavigate()
  const [room, setRoom] = useState(undefined)
  const [members, setMembers] = useState([])
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  const fileRef = useRef(null)
  /* ⚠️ 방을 빠르게 옮기면 **먼저 보낸 조회가 나중에 돌아올 수 있다.**
     그러면 지금 방에 옛 방의 글이 붙는다. 돌아온 답이 지금 방 것인지 확인한다. */
  const nowRoom = useRef(id)
  useEffect(() => { nowRoom.current = id }, [id])

  const load = useCallback(async () => {
    const [{ data: r }, { data: m }, { data: list }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', id).maybeSingle(),
      supabase.from('room_members').select('user_id, last_read_at').eq('room_id', id),
      supabase.from('messages').select('*').eq('room_id', id).order('created_at').limit(500),
    ])
    if (nowRoom.current !== id) return
    setRoom(r || null)
    setMembers(m || [])
    setMsgs(list || [])
  }, [id])

  /* 누가 어디까지 읽었는지만 다시 읽어 온다 */
  const loadRead = useCallback(async () => {
    const { data } = await supabase.from('room_members').select('user_id, last_read_at').eq('room_id', id)
    if (data && nowRoom.current === id) setMembers(data)
  }, [id])

  useEffect(() => { setRoom(undefined); setMsgs(null); load() }, [load])

  useEffect(() => {
    const t = setInterval(loadRead, READ_POLL_MS)
    return () => clearInterval(t)
  }, [loadRead])

  /* 새 글·지운 글을 바로 반영한다. 같은 글이 두 번 들어오지 않게 id 로 거른다. */
  useEffect(() => {
    const ch = supabase.channel(`room-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}` },
        ({ new: row }) => {
          setMsgs((prev) => (prev?.some((x) => x.id === row.id) ? prev : [...(prev || []), row]))
          loadRead()
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
        ({ old }) => setMsgs((prev) => (prev || []).filter((x) => x.id !== old.id)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, loadRead])

  /* 보고 있는 동안은 읽은 것으로. 화면을 떠날 때 한 번 더(마지막 글까지 포함되게). */
  useEffect(() => {
    if (!msgs) return
    markRead(id)
  }, [id, msgs?.length])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs?.length])

  async function go(e) {
    e?.preventDefault()
    if (!text.trim() || busy) return
    const keep = text
    setText(''); setBusy(true); setErr('')
    try { await sendText(id, userId, keep) } catch (x) { setErr(x.message); setText(keep) }
    setBusy(false)
  }

  /* 스티커. 보냈으면 true — 고르는 판이 그때 닫힌다. */
  async function sendMascot(assetId) {
    if (busy) return false
    setBusy(true); setErr('')
    let ok = false
    try { await sendText(id, userId, mascotText(assetId)); ok = true } catch (x) { setErr(x.message) }
    setBusy(false)
    return ok
  }

  async function putFile(f) {
    if (!f) return
    setBusy(true); setErr('')
    try { await sendFile(id, userId, f) } catch (x) { setErr(x.message) }
    setBusy(false)
  }

  async function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    await putFile(f)
  }

  /* Ctrl+V 로 캡처한 그림 붙여넣기.
     글을 붙여넣을 때는 clipboardData.files 가 비어 있어서 그대로 글이 들어간다. */
  function paste(e) {
    const f = e.clipboardData?.files?.[0]
    if (!f) return
    e.preventDefault()
    putFile(f)
  }

  async function out() {
    if (!window.confirm('이 대화방에서 나갈까요? 다시 들어오려면 누군가 초대해야 해요.')) return
    const { error } = await supabase.rpc('leave_room', { p_room: id })
    if (error) return setErr(error.message)
    nav('/chat', { replace: true })
  }

  if (room === undefined) return <div className="stack"><p className="hint">불러오는 중…</p></div>
  if (room === null) {
    return (
      <div className="stack">
        <h2 className="chat-title">대화</h2>
        <ErrorBox>없는 대화방이거나 들어갈 수 없는 방이에요.</ErrorBox>
        <Link className="btn" to="/chat">← 대화 목록</Link>
      </div>
    )
  }

  const title = roomTitle(room, members, userId, empOf)
  const notIn = activeEmployees.filter((e) => !members.some((m) => m.user_id === e.id))
  const others = members.filter((m) => m.user_id !== userId)
  /* 내 글을 아직 안 읽은 사람 수 */
  const unreadBy = (iso) =>
    others.filter((o) => !o.last_read_at || new Date(o.last_read_at) < new Date(iso)).length

  return (
    <div className="stack chat-page">
      <div className="row-between chat-top">
        <div className="chat-who">
          {/* 좁은 화면에서만. 넓은 화면은 왼쪽에 목록이 그대로 보인다. */}
          <Link to="/chat" className="linkbtn back-list">←</Link>
          <span className={`avatar ava-${avatarTone(room.kind === 'group' ? room.id : title)}`} aria-hidden="true">
            {room.kind === 'group' ? '#' : title.slice(0, 1)}
          </span>
          <div className="grow">
            <h2 className="chat-title">{title}</h2>
            <p className="chat-sub">
              참여자 {members.length}명
              {room.kind === 'group' && ` · ${members.map((m) => empOf(m.user_id)?.name).filter(Boolean).join(', ')}`}
            </p>
          </div>
        </div>
        {room.kind === 'group' && (
          <div className="actions">
            {notIn.length > 0 && (
              <select className="small-sel" value="" aria-label="사람 초대"
                onChange={async (e) => {
                  if (!e.target.value) return
                  await supabase.rpc('add_to_room', { p_room: id, p_user: e.target.value })
                  load()
                }}>
                <option value="">+ 초대</option>
                {notIn.map((p) => <option key={p.id} value={p.id}>{p.name}{p.position ? ` ${p.position}` : ''}</option>)}
              </select>
            )}
            <button className="btn small-btn" onClick={out}>나가기</button>
          </div>
        )}
      </div>

      <div className="chat-log">
        {msgs === null ? <p className="hint">불러오는 중…</p>
          : msgs.length === 0 ? <p className="hint center">첫 글을 남겨 보세요.</p>
            : msgs.map((m, i) => {
              const prev = msgs[i - 1]
              const mine = m.sender_id === userId
              const sticker = m.file ? null : readMascot(m.text)
              /* 같은 사람이 1분 안에 이어 쓰면 이름을 또 적지 않는다 */
              const run = prev && prev.sender_id === m.sender_id &&
                sameDay(prev.created_at, m.created_at) &&
                new Date(m.created_at) - new Date(prev.created_at) < 60000
              return (
                <div key={m.id}>
                  {!sameDay(prev?.created_at, m.created_at) && (
                    <p className="chat-day">{dayLabel(m.created_at)}</p>
                  )}
                  <div className={`bubble-row${mine ? ' mine' : ''}${run ? ' run' : ''}`}>
                    {!mine && !run && (
                      <span className={`avatar sm ava-${avatarTone(empOf(m.sender_id)?.name)}`} aria-hidden="true">
                        {(empOf(m.sender_id)?.name || '?').slice(0, 1)}
                      </span>
                    )}
                    <div className="bubble-wrap">
                      {!mine && !run && <span className="bubble-who">{empOf(m.sender_id)?.name || '퇴사자'}</span>}
                      <div className="bubble-line">
                        <div className={`bubble${sticker ? ' mascot-bubble' : ''}`}>
                          {m.file ? <Attach file={m.file} />
                            : sticker ? <MascotImage asset={sticker} />
                              : m.text}
                        </div>
                        {mine && <ReadMark left={unreadBy(m.created_at)} total={others.length} />}
                        <span className="bubble-time">{clock(m.created_at)}</span>
                        {mine && (
                          <button className="bubble-del" aria-label="지우기" title="지우기"
                            onClick={() => supabase.from('messages').delete().eq('id', m.id).then(load)}>✕</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        <div ref={endRef} />
      </div>

      <div className="chat-foot">
      <ErrorBox>{err}</ErrorBox>

      <form className="chat-send" onSubmit={go}>
        <input type="file" ref={fileRef} hidden onChange={pick} />
        <button type="button" className="btn icon-btn" aria-label="파일 보내기" disabled={busy}
          onClick={() => fileRef.current?.click()}>＋</button>
        <MascotPicker busy={busy} onSend={sendMascot} />
        <textarea
          rows={1} value={text} placeholder="메시지를 쓰세요"
          onChange={(e) => setText(e.target.value)}
          onPaste={paste}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) go(e) }}
        />
        <button className="btn primary" disabled={busy || !text.trim()}>보내기</button>
      </form>
      <p className="hint">Enter 로 보내고, Shift+Enter 로 줄을 바꿔요. 캡처한 그림은 Ctrl+V 로 바로 붙여 넣을 수 있어요.</p>
      </div>
    </div>
  )
}

/* 내 글을 상대가 읽었는지. 혼자 있는 방에서는 아무것도 보이지 않는다. */
function ReadMark({ left, total }) {
  if (total === 0) return null
  if (left === 0) return <span className="read-mark done">읽음</span>
  return <span className="read-mark">{total > 1 ? `${left}명 안읽음` : '안읽음'}</span>
}

/* 붙인 파일. 사진이면 바로 보여 주고, 아니면 받는 고리만. */
function Attach({ file }) {
  const [url, setUrl] = useState(null)
  // 보관 기간이 지나 서버가 치운 파일. 누가 무엇을 보냈는지는 남겨 둔다.
  useEffect(() => { if (!file.gone) fileUrl(file.path).then(setUrl) }, [file.path, file.gone])
  if (file.gone) return <span className="gone">📎 {file.name} · 기간이 지나 사라졌어요</span>
  if (!url) return <span className="hint">{file.name} 여는 중…</span>
  if (isImage(file)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img className="chat-img" src={url} alt={file.name} loading="lazy" />
      </a>
    )
  }
  return <a href={url} target="_blank" rel="noopener noreferrer" className="chat-file">📎 {file.name}</a>
}
