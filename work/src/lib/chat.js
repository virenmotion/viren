import { supabase } from './supabase'

/* 메신저 공용 함수들. (지은님 2026-10-21)
   화면 두 곳(목록·대화)과 탭 배지가 같은 규칙을 써야 해서 여기로 모았다. */

/* 안 읽은 수가 바뀌었다고 알리는 신호. 배지는 화면을 옮길 때만 다시 세는데,
   방을 읽는 건 화면을 옮기는 일이 아니라서 따로 알려 줘야 한다. */
export const UNREAD_EVENT = 'viren-unread'

/* 동그란 이니셜의 색. 같은 사람·같은 방은 **언제나 같은 색**이 나오게
   글자에서 뽑는다(무작위로 하면 새로 그릴 때마다 색이 바뀐다).
   ⚠️ 색은 꾸밈이다. 누구인지는 옆에 적힌 이름으로 알아본다. */
export function avatarTone(key) {
  const s = String(key || '')
  let n = 0
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 4
  return ['purple', 'blue', 'green', 'pink'][n]
}

export const CHAT_BUCKET = 'chat-files'
export const MAX_CHAT_MB = 20

/* 방 이름 — 1:1 은 상대 이름을 그때그때 만든다.
   DB 에 이름을 적어 두면 보는 사람마다 달라야 하는 걸 한 줄에 못 담는다. */
/* 메일 알림방인가? 맞으면 그 표시({kind,scope,addr})를, 아니면 null.
   ⚠️ **이름으로 가리지 않는다.** 누가 방 이름을 '대표메일 알림' 이라 지어도
      메일방 행세를 못 하게, 방에 달린 표시(rooms.feed)만 본다.
      그 표시는 서버 함수(mail_room·mail_room_own)만 붙인다. */
export function mailFeed(room) {
  const f = room?.feed
  if (!f || typeof f !== 'object' || f.kind !== 'mail') return null
  return { scope: f.scope === 'own' ? 'own' : 'group', addr: f.addr || '' }
}
export const FEED_TAG = { group: '공용', own: '개인' }

export function roomTitle(room, members, userId, empOf) {
  /* 이름이 적힌 방은 그 이름을 쓴다. 단체방은 늘 이름이 있고,
     '내 메일'(혼자 쓰는 direct 방, 2026-10-26)도 이 길로 온다. */
  if (room.name) return room.name
  if (room.kind === 'group') return '단체 대화'
  const other = (members || []).find((m) => m.user_id !== userId)
  const e = other && empOf(other.user_id)
  if (!e) return '대화'
  return `${e.name}${e.position ? ` ${e.position}` : ''}`
}

/* 목록에 쓰는 짧은 시각: 오늘이면 시:분, 올해면 월/일, 아니면 연도까지 */
export function shortTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

export const dayLabel = (iso) => {
  const d = new Date(iso)
  const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${w}요일`
}

export const clock = (iso) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

export const sameDay = (a, b) =>
  a && b && new Date(a).toDateString() === new Date(b).toDateString()

/* 방 목록 + 참가자 + 안 읽은 수를 한 번에 */
export async function loadRooms() {
  const [{ data: rooms }, { data: members }, { data: unread }] = await Promise.all([
    supabase.from('rooms').select('*').order('last_at', { ascending: false }),
    supabase.from('room_members').select('room_id, user_id, last_read_at'),
    supabase.rpc('unread_counts'),
  ])
  const byRoom = {}
  for (const m of members || []) (byRoom[m.room_id] ||= []).push(m)
  const n = Object.fromEntries((unread || []).map((u) => [u.room_id, Number(u.n)]))
  return (rooms || []).map((r) => ({ ...r, members: byRoom[r.id] || [], unread: n[r.id] || 0 }))
}

/* 이 방을 지금까지 읽은 것으로.
   ⚠️ supabase 호출은 **await·then 을 붙여야 실제로 나간다.** 그냥 불러 두면
   아무 일도 일어나지 않는다. 2026-10-21 에 이것 때문에 안 읽은 수 배지가
   읽어도 안 지워졌다. 눈에 안 띄는 종류의 실수다. */
export async function markRead(roomId) {
  const { error } = await supabase.rpc('mark_read', { p_room: roomId })
  if (!error) window.dispatchEvent(new Event(UNREAD_EVENT))
}

export async function sendText(roomId, userId, text) {
  const t = text.trim()
  if (!t) return
  const { error } = await supabase.from('messages').insert({ room_id: roomId, sender_id: userId, text: t })
  if (error) throw new Error('보내지 못했어요. 잠시 뒤 다시 해 주세요.')
}

export async function sendFile(roomId, userId, file) {
  if (file.size > MAX_CHAT_MB * 1024 * 1024) throw new Error(`${MAX_CHAT_MB}MB 까지 보낼 수 있어요.`)
  const ext = (file.name.match(/\.[A-Za-z0-9]{1,8}$/) || [''])[0].toLowerCase()
  const path = `${roomId}/${crypto.randomUUID()}${ext}`
  const up = await supabase.storage.from(CHAT_BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (up.error) throw new Error('파일을 올리지 못했어요.')
  const { error } = await supabase.from('messages').insert({
    room_id: roomId, sender_id: userId, text: '',
    file: { path, name: file.name, size: file.size, type: file.type || '' },
  })
  if (error) throw new Error('보내지 못했어요.')
}

/* 비공개 저장소라 주소가 잠깐만 살아 있는 열쇠를 받아야 본다 */
export async function fileUrl(path) {
  const { data } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, 60 * 60)
  return data?.signedUrl || null
}

export const isImage = (f) => !!f && /^image\//.test(f.type || '')

/* 보내기 전에 보여 주는 파일 크기 */
export function fileSize(n) {
  if (!Number.isFinite(n)) return ''
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

/* ---------------------------------------------------------------------
   글 속의 링크 찾기 (지은님 2026-10-29)
   말풍선은 글을 그대로 찍어서 주소를 붙여 넣어도 눌리지 않았다.

   ⚠️ **한글 앞에서 끊는다.** `https://viren.kr에서 봐` 처럼 조사가 바로 붙는 일이
      흔한데, 공백까지 주소로 보면 '에서' 까지 주소에 들어가 링크가 깨진다.
   ⚠️ 끝에 붙은 마침표·쉼표·닫는 괄호는 주소에서 뺀다 — `(viren.kr)` 의 `)` 같은 것.
   ⚠️ `javascript:` 같은 건 아예 안 찾는다. http/https 와 www 로 시작하는 것만 본다.
--------------------------------------------------------------------- */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`()[\]{}\u3131-\u318E\uAC00-\uD7A3]+/gi
const TAIL_RE = /[.,!?;:·…"'`]+$/

export function linkParts(text) {
  const s = String(text ?? '')
  const out = []
  let at = 0
  for (const m of s.matchAll(URL_RE)) {
    let url = m[0].replace(TAIL_RE, '')
    // 여는 괄호 없이 닫는 괄호만 남은 경우도 뺀다
    while (url.endsWith(')') && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) {
      url = url.slice(0, -1)
    }
    if (!url) continue
    if (m.index > at) out.push({ kind: 'text', s: s.slice(at, m.index) })
    out.push({ kind: 'link', s: url, href: url.startsWith('www.') ? `https://${url}` : url })
    at = m.index + url.length
  }
  if (at < s.length) out.push({ kind: 'text', s: s.slice(at) })
  return out
}

/* 한 번에 고를 수 있는 파일 수. 실수로 폴더째 끌어다 놓는 걸 막는다. */
export const MAX_CHAT_FILES = 10
