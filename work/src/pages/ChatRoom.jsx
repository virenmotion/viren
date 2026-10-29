import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { FEED_TAG, MAX_CHAT_FILES, MAX_CHAT_MB, avatarTone, clock, dayLabel, fileSize, fileUrl, isImage, linkParts, mailFeed, markRead, roomTitle, sameDay, sendFile, sendText } from '../lib/chat'
import { mascotText, readMascot } from '../lib/mascot'
import MascotPicker, { MascotImage } from '../components/MascotPicker'
import { ErrorBox, MailIcon } from '../components/ui'

/* 대화 한 방. 들어오면 읽음 처리하고, 새 글은 Realtime 으로 바로 붙인다. */

/* 말풍선 글. 주소는 눌러서 열 수 있게 바꾼다 (지은님 2026-10-29).
   ⚠️ 남이 보낸 주소다. target="_blank" 에는 **rel 을 꼭 같이 둔다** —
      noopener 가 없으면 열린 쪽에서 이 창을 다른 데로 돌릴 수 있다. */
function Says({ text }) {
  return (
    <>
      {linkParts(text).map((p, i) => (p.kind === 'link'
        ? <a key={i} className="bubble-link" href={p.href}
          target="_blank" rel="noopener noreferrer nofollow">{p.s}</a>
        : <span key={i}>{p.s}</span>))}
    </>
  )
}

/* 상대가 읽었는지는 room_members.last_read_at 으로 안다.
   ⚠️ 이 칸은 Realtime 이 켜져 있지 않다(messages 만 켜 두었다).
      그래서 방을 보고 있는 동안 **15초마다 한 번씩** 다시 읽어 온다.
      가벼운 조회라 괜찮다. 실시간으로 바꾸려면 DB 설정을 건드려야 한다. */
const READ_POLL_MS = 15000

/* 손가락으로 쓰는 기기인가 (마우스 '올리기' 가 없는 기기).
   ⚠️ 화면 **너비로 재지 않는다.** 좁은 창을 띄운 노트북도 있고, 큰 태블릿도 있다. */
const byTouch = () => window.matchMedia('(hover: none)').matches

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
  /* 붙여넣거나 끌어다 놓았지만 **아직 안 보낸** 파일들. [{ key, file, url }]
     ⚠️ 한 장만 들고 있다가 2026-10-29 에 여러 장으로 바꿨다. 보내는 규칙은 그대로 —
        **보내기를 눌러야** 올라간다(지은님 2026-10-26: 실수로 보내진다). */
  const [pends, setPends] = useState([])
  /* 파일을 끌어서 방 위에 올려 둔 상태인가 */
  const [over, setOver] = useState(false)
  /* 메일 알림 카드의 '자세히 읽기' 가 여는 주소. 비어 있으면 단추를 안 보인다.
     ⚠️ 방을 옮겨도 다시 받지 않는다 — 한 번만 받아 둔다. */
  const [mailUrl, setMailUrl] = useState('')
  useEffect(() => {
    supabase.from('settings').select('mail_web_url').eq('id', 1).maybeSingle()
      .then(({ data }) => setMailUrl(data?.mail_web_url || ''))
  }, [])
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

  /* 들고 있던 파일을 버린다.
     ⚠️ 미리보기 주소(createObjectURL)는 반드시 돌려줘야 한다 — 안 그러면 쌓인다.
        화면을 떠난 뒤에도 확실히 돌려주려고 주소를 ref 에 따로 모아 둔다. */
  const pendUrls = useRef([])
  const dropPend = useCallback(() => {
    pendUrls.current.forEach((u) => u && URL.revokeObjectURL(u))
    pendUrls.current = []
    setPends([])
  }, [])
  /* 여러 장 중 한 장만 뺀다 */
  const dropOne = useCallback((key) => {
    setPends((prev) => {
      const gone = prev.find((x) => x.key === key)
      if (gone?.url) {
        URL.revokeObjectURL(gone.url)
        pendUrls.current = pendUrls.current.filter((u) => u !== gone.url)
      }
      return prev.filter((x) => x.key !== key)
    })
  }, [])

  /* 고른 · 붙여넣은 · 끌어다 놓은 파일을 모두 같은 길로 받는다.
     ⚠️ 너무 큰 파일은 **그 파일만** 빼고 나머지는 담는다 — 한 장 때문에 다 날리지 않는다. */
  const addFiles = useCallback((list) => {
    const all = Array.from(list || [])
    if (!all.length) return
    const big = all.filter((f) => f.size > MAX_CHAT_MB * 1024 * 1024).map((f) => f.name)
    const ok = all.filter((f) => f.size <= MAX_CHAT_MB * 1024 * 1024)
    setPends((prev) => {
      const room = MAX_CHAT_FILES - prev.length
      const take = ok.slice(0, Math.max(0, room))
      const cut = ok.length - take.length
      setErr([
        big.length ? `${big.join(', ')} 은(는) ${MAX_CHAT_MB}MB 가 넘어 뺐어요.` : '',
        cut > 0 ? `한 번에 ${MAX_CHAT_FILES}개까지예요. ${cut}개는 뺐어요.` : '',
      ].filter(Boolean).join(' '))
      return [...prev, ...take.map((f) => {
        const url = isImage(f) ? URL.createObjectURL(f) : null
        if (url) pendUrls.current.push(url)
        return { key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file: f, url }
      })]
    })
  }, [])
  // 방을 옮기거나 화면을 떠나면 들고 있던 그림도 버린다
  useEffect(() => dropPend, [id, dropPend])

  async function go(e) {
    e?.preventDefault()
    if (busy) return
    /* 들고 있는 파일이 있으면 **파일 먼저 차례로**, 적어 둔 글이 있으면 이어서 보낸다.
       ⚠️ 한 장이 실패해도 **이미 올라간 것은 되돌리지 않는다.** 어디까지 갔는지 알려 주고
          남은 것만 그대로 들고 있는다 — 다시 '보내기' 를 누르면 이어서 올라간다. */
    if (pends.length) {
      setBusy(true); setErr('')
      let done = 0
      try {
        for (const it of pends) { await sendFile(id, userId, it.file); done++ }
        dropPend()
        if (text.trim()) { const keep = text; setText(''); await sendText(id, userId, keep) }
      } catch (x) {
        pends.slice(0, done).forEach((it) => dropOne(it.key))
        setErr(done > 0 ? `${done}개까지 보냈어요. 나머지는 ${x.message}` : x.message)
      }
      setBusy(false)
      return
    }
    if (!text.trim()) return
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

  function pick(e) {
    addFiles(e.target.files)
    e.target.value = ''
  }

  /* Ctrl+V 로 캡처한 그림 붙여넣기.
     ⚠️ **바로 보내지 않는다.** 붙여넣으면 입력칸 위에 미리보기가 뜨고,
        '보내기' 를 눌러야 올라간다(지은님 2026-10-26: 실수로 보내진다).
     글을 붙여넣을 때는 clipboardData.files 가 비어 있어서 그대로 글이 들어간다. */
  function paste(e) {
    const files = e.clipboardData?.files
    if (!files?.length) return
    e.preventDefault()
    addFiles(files)
  }

  /* 끌어다 놓기 (지은님 2026-10-29).
     ⚠️ dragover 에서 preventDefault 를 해야 **놓는 것이 허용된다.** 안 하면 브라우저가
        그림을 새 탭으로 열어 버린다.
     ⚠️ 안쪽 것 위를 지날 때마다 dragleave 가 와서 테두리가 깜빡인다. 깊이를 세서 막는다. */
  const depth = useRef(0)
  function dragIn(e) {
    if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return
    depth.current++
    setOver(true)
  }
  function dragOut() {
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setOver(false)
  }
  function dragOver(e) {
    if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  function drop(e) {
    if (!e.dataTransfer?.files?.length) return
    e.preventDefault()
    depth.current = 0
    setOver(false)
    addFiles(e.dataTransfer.files)
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
  const feed = mailFeed(room)
  const notIn = activeEmployees.filter((e) => !members.some((m) => m.user_id === e.id))
  const others = members.filter((m) => m.user_id !== userId)
  /* 내 글을 아직 안 읽은 사람 수 */
  const unreadBy = (iso) =>
    others.filter((o) => !o.last_read_at || new Date(o.last_read_at) < new Date(iso)).length

  return (
    <div className={`stack chat-page${over ? ' dropping' : ''}`}
      onDragEnter={dragIn} onDragOver={dragOver} onDragLeave={dragOut} onDrop={drop}>
      {/* 끌어다 놓는 중에만 뜬다. 방 전체가 받는 자리다. */}
      {over && <div className="drop-veil" aria-hidden="true"><span>여기에 놓으면 보낼 수 있어요</span></div>}
      <div className="row-between chat-top">
        <div className="chat-who">
          {/* 좁은 화면에서만. 넓은 화면은 왼쪽에 목록이 그대로 보인다. */}
          <Link to="/chat" className="linkbtn back-list">←</Link>
          {feed
            ? <span className="room-ava mail big" aria-hidden="true"><MailIcon /></span>
            : (
              <span className={`avatar ava-${avatarTone(room.kind === 'group' ? room.id : title)}`} aria-hidden="true">
                {room.kind === 'group' ? '#' : title.slice(0, 1)}
              </span>
            )}
          <div className="grow">
            <div className="chat-title-row">
              <h2 className="chat-title">{title}</h2>
              {feed && <em className="room-tag">{FEED_TAG[feed.scope]}</em>}
            </div>
            {/* 메일방은 '어느 주소에 걸려 있고 누가 보는지' 를 적는다 */}
            <p className="chat-sub">
              {feed ? (
                <>
                  {feed.addr && <><span className="mail-addr">{feed.addr}</span> · </>}
                  {feed.scope === 'own'
                    ? '나만 봅니다'
                    : `재직 중인 직원 ${members.length}명이 함께 봅니다`}
                </>
              ) : (
                <>
                  참여자 {members.length}명
                  {room.kind === 'group' && ` · ${members.map((m) => empOf(m.user_id)?.name).filter(Boolean).join(', ')}`}
                </>
              )}
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
              /* 메일 알림 카드. ⚠️ **보낸 사람이 없는 글**일 때만 카드로 그린다 —
                 사람이 자기 글에 meta 를 넣어 메일인 척할 수 없게. */
              const mail = !m.sender_id && m.meta?.kind === 'mail' ? m.meta : null
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
                      <span className={`avatar sm ava-${avatarTone(m.sender_id ? empOf(m.sender_id)?.name : 'mail')}`} aria-hidden="true">
                        {m.sender_id ? (empOf(m.sender_id)?.name || '?').slice(0, 1) : '메'}
                      </span>
                    )}
                    <div className="bubble-wrap">
                      {/* 보낸 사람이 없는 글 = 시스템이 올린 것(메일 알림) */}
                      {!mine && !run && <span className="bubble-who">{m.sender_id ? (empOf(m.sender_id)?.name || '퇴사자') : '메일'}</span>}
                      <div className="bubble-line">
                        <div className={`bubble${sticker ? ' mascot-bubble' : ''}${mail ? ' mail-card' : ''}`}>
                          {mail ? <MailCard mail={mail} url={mailUrl} />
                            : m.file ? <Attach file={m.file} />
                              : sticker ? <MascotImage asset={sticker} />
                                : <Says text={m.text} />}
                        </div>
                        {mine && <ReadMark left={unreadBy(m.created_at)} total={others.length} />}
                        <span className="bubble-time">{clock(m.created_at)}</span>
                        {mine && (
                          <button className="bubble-del" aria-label="이 글 지우기" title="지우기"
                            onClick={() => {
                              /* ⚠️ 손가락 기기에서는 ✕ 가 **늘 보인다**(올릴 마우스가 없으니).
                                 스치기만 해도 지워지면 곤란하고 지운 글은 되돌릴 수 없어서,
                                 거기서만 한 번 묻는다. 마우스 기기는 누르면 바로 지워진다. */
                              if (byTouch() && !window.confirm('이 글을 지울까요? 되돌릴 수 없어요.')) return
                              supabase.from('messages').delete().eq('id', m.id).then(load)
                            }}>✕</button>
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

      {/* 들고 있지만 아직 안 보낸 파일들 — 보내기를 눌러야 올라간다 */}
      {pends.length > 0 && (
        <div className="pend-box">
          <div className="pend-head">
            <strong>보낼 파일 {pends.length}개</strong>
            <span className="hint">보내기를 눌러야 올라가요</span>
            {pends.length > 1 && (
              <button type="button" className="linkbtn small" onClick={dropPend} disabled={busy}>모두 빼기</button>
            )}
          </div>
          <ul className="pend-list">
            {pends.map((it) => (
              <li key={it.key} className="pend">
                {it.url
                  ? <img className="pend-img" src={it.url} alt="" />
                  : <span className="pend-ico" aria-hidden="true">📎</span>}
                <div className="pend-main">
                  <strong>{it.file.name || '붙여넣은 그림'}</strong>
                  <span className="hint">{fileSize(it.file.size)}</span>
                </div>
                <button type="button" className="pend-del" disabled={busy}
                  aria-label={`${it.file.name || '이 파일'} 빼기`} title="빼기"
                  onClick={() => dropOne(it.key)}>✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="chat-send" onSubmit={go}>
        <input type="file" ref={fileRef} hidden multiple onChange={pick} />
        <button type="button" className="btn icon-btn" aria-label="파일 보내기" disabled={busy}
          onClick={() => fileRef.current?.click()}>＋</button>
        <MascotPicker busy={busy} onSend={sendMascot} />
        <textarea
          rows={1} value={text} placeholder={pends.length ? '설명을 함께 보낼 수 있어요' : '메시지를 쓰세요'}
          onChange={(e) => setText(e.target.value)}
          onPaste={paste}
          onKeyDown={(e) => {
            // 붙여넣은 그림은 Esc 로 물린다
            if (e.key === 'Escape' && pends.length) { e.preventDefault(); return dropPend() }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) go(e)
          }}
        />
        <button className="btn primary" disabled={busy || (!pends.length && !text.trim())}>보내기</button>
      </form>
      <p className="hint">Enter 로 보내고, Shift+Enter 로 줄을 바꿔요. 사진·파일은 Ctrl+V 로 붙여 넣거나 이 방으로 끌어다 놓으면 돼요 — 한 번에 {MAX_CHAT_FILES}개까지, 보내기를 눌러야 올라가요.</p>
      </div>
    </div>
  )
}

/* 메일 알림 카드 — 카카오워크 메일 봇과 같은 모양(지은님 2026-10-26).
   맨 위 머리 → 제목 → 보낸사람 → 내용 미리보기 → 자세히 읽기. */
function MailCard({ mail, url }) {
  return (
    <>
      <div className="mc-head">새 메일이 도착했습니다.</div>
      <div className="mc-body">
        <strong className="mc-title">{mail.subject || '(제목 없음)'}</strong>
        <div className="mc-row">
          <span className="mc-k">보낸사람</span>
          <span className="mc-v">{mail.from || '보낸사람 모름'}</span>
        </div>
        {mail.preview && (
          <div className="mc-row">
            <span className="mc-k">내용 미리보기</span>
            <span className="mc-v">{mail.preview}</span>
          </div>
        )}
        {/* 주소를 안 넣었으면 단추를 아예 안 보인다(관리 → 회사 정보에서 넣는다) */}
        {url && (
          <a className="mc-open" href={url} target="_blank" rel="noopener noreferrer">자세히 읽기</a>
        )}
      </div>
    </>
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
