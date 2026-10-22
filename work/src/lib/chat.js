import { supabase } from './supabase'

/* 메신저 공용 함수들. (지은님 2026-10-21)
   화면 두 곳(목록·대화)과 탭 배지가 같은 규칙을 써야 해서 여기로 모았다. */

/* 안 읽은 수가 바뀌었다고 알리는 신호. 배지는 화면을 옮길 때만 다시 세는데,
   방을 읽는 건 화면을 옮기는 일이 아니라서 따로 알려 줘야 한다. */
export const UNREAD_EVENT = 'viren-unread'

export const CHAT_BUCKET = 'chat-files'
export const MAX_CHAT_MB = 20

/* 방 이름 — 1:1 은 상대 이름을 그때그때 만든다.
   DB 에 이름을 적어 두면 보는 사람마다 달라야 하는 걸 한 줄에 못 담는다. */
export function roomTitle(room, members, userId, empOf) {
  if (room.kind === 'group') return room.name || '단체 대화'
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
