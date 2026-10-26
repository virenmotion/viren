/* work.viren.kr/api/mail-check — 대표메일에 새 메일이 오면 전 직원에게 알린다. (2026-10-26)
 *
 * 카카오워크를 그대로 쓰되 "메일 왔다" 는 알림만 바이렌워크에서도 뜨게 한다(지은님).
 *
 * 카카오워크 메일 봇처럼 **메신저의 '메일' 방으로** 글이 올라온다(지은님 2026-10-26).
 * 기록이 남고, 휴대폰 알림은 메신저가 이미 보내고 있으니 길을 하나 더 만들지 않는다.
 *
 * 흐름
 *   pg_cron(1분) → run_mail_check() → pg_net 이 여기를 부른다(x-push-secret)
 *     → IMAP 으로 STATUS 한 번(가볍다). 새 게 없으면 여기서 끝.
 *     → 새 게 있으면 **EXAMINE**(읽기 전용)하고 머리글(보낸사람·제목)만 꺼낸다
 *     → post_mail() 로 '메일' 방에 글을 올린다 → 방아쇠가 알림까지 보낸다
 *     → 본 번호를 mail_state 에 적어 둔다
 *
 * 생각의 뼈대
 *   · **메일 본문은 가져오지도 않는다.** 보낸사람·제목 두 줄이 전부다.
 *   · **읽음 표시를 건드리지 않는다.** SELECT 가 아니라 EXAMINE 을 쓰고,
 *     BODY[] 가 아니라 BODY.PEEK[] 로 꺼낸다. 안 그러면 카카오워크에서
 *     안 읽은 메일이 저절로 읽음으로 바뀐다 — 절대 그러면 안 된다.
 *   · 이미 읽은 메일(\Seen)은 알리지 않는다. 1분 사이에 누가 먼저 봤으면 조용히 넘어간다.
 *   · 1분마다 두드리므로 **새 게 없을 때가 싸야 한다** — STATUS 한 번으로 끝낸다.
 *
 * ⚠️ **어느 메일함을 보는가 (2026-10-26 지은님 확인)**
 *   viren@viren.kr 은 **그룹메일**이다 — 들여다볼 메일함이 따로 없고, 받는 사람들의
 *   개인 메일함으로 들어간다. 그래서 받는 사람 한 명의 메일함(MAIL_USER)에 붙어
 *   **받는사람으로 나눈다.**
 *     · MAIL_GROUP 으로 온 것 → 모두가 보는 '메일' 방 (내용 미리보기까지)
 *     · 그 밖의 개인 메일     → **주인만 보는 '내 메일' 방** (보낸사람·제목까지만)
 *   ⚠️ MAIL_GROUP 을 비우면 **그 사람의 모든 메일**이 전 직원에게 나간다. 비워 두지 말 것.
 *   ⚠️ 개인 메일 알림이 싫으면 MAIL_OWN 을 `off` 로 두면 된다(그러면 그냥 버린다).
 *
 * 환경변수 (Cloudflare Pages → Variables and Secrets)
 *   MAIL_IMAP_HOST  imap.kakaowork.com
 *   MAIL_IMAP_PORT  993 (기본값이라 안 넣어도 된다)
 *   MAIL_USER       붙을 사람의 계정 (예: jieunp711@viren.kr)
 *   MAIL_PASS       카카오워크 'POP3/IMAP 비밀번호' — **Secret 으로**
 *   MAIL_GROUP      알릴 공용 주소. 쉼표로 여러 개 (예: viren@viren.kr)
 *   MAIL_OWN        개인 메일 알림. 안 넣으면 켜짐. `off` 로 두면 끔.
 *   VITE_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY · PUSH_SECRET
 */

import { connect } from 'cloudflare:sockets'
import { Imap, q } from './mail.js'

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

/* 길이가 달라도 걸리는 시간이 같게 — 암호 비교 (notify.js 와 같은 규칙) */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* ── 메일 머리글 읽기 (여기부터는 순수 계산 — 시험이 붙어 있다) ──────── */

/* FETCH 답은 이렇게 생겼다:
     * 12 FETCH (UID 456 FLAGS (\Seen) BODY[HEADER.FIELDS (FROM SUBJECT)] {98}
     From: OpenAI <noreply@tm.openai.com>
     Subject: =?UTF-8?B?...?=
     )
   {98} 은 **이어지는 98글자가 머리글** 이라는 뜻이다. 그 토막을 떠내고,
   바로 앞에서 UID 와 FLAGS 를 줍는다.
   ⚠️ {98} 은 본래 '바이트' 수인데 우리는 글자로 센다. 머리글의 한글은 거의 언제나
      =?UTF-8?B?...?= 로 감싸져 영문자로 오기 때문에 실제로는 같다. */
export function parseFetch(raw) {
  const out = []
  const re = /\{(\d+)\}\r?\n/g
  let m, from = 0
  while ((m = re.exec(raw))) {
    const head = raw.slice(from, m.index)
    const start = m.index + m[0].length
    const block = raw.slice(start, start + Number(m[1]))
    const uid = Number((head.match(/UID (\d+)/) || [])[1])
    const flags = (head.match(/FLAGS \(([^)]*)\)/) || [])[1] || ''
    if (uid) out.push({ uid, seen: /\\Seen/i.test(flags), header: block })
    re.lastIndex = start + Number(m[1])
    from = re.lastIndex
  }
  return out
}

/* 머리글 한 줄 꺼내기. 긴 줄은 다음 줄로 넘어가며 앞에 빈칸이 붙는다(접힌 줄). */
export function headerValue(block, name) {
  const lines = String(block).split(/\r?\n/)
  const want = name.toLowerCase() + ':'
  let val = null
  for (const line of lines) {
    if (val !== null) {
      if (/^[ \t]/.test(line)) { val += ' ' + line.trim(); continue }
      break
    }
    if (line.toLowerCase().startsWith(want)) val = line.slice(want.length)
  }
  return val === null ? '' : val.trim()
}

/* ⚠️ utf-8 로 읽기는 **틀려도 예외가 안 난다** — 깨진 글자(�)로 바뀔 뿐이다.
   그래서 모르는 글자표(euc-kr 등)를 utf-8 로 억지로 읽지 않는다. 못 읽으면
   빈 글자를 돌려주고, 부르는 쪽이 원문(=?EUC-KR?B?...?=)을 그대로 둔다.
   깨진 글자보다는 원문이 낫다 — 적어도 무슨 일이 났는지 보인다. */
const dec = (bytes, charset) => {
  try { return new TextDecoder(charset).decode(bytes) } catch { /* 아래로 */ }
  return ''
}

/* =?UTF-8?B?...?= / =?EUC-KR?Q?...?= 를 사람 글자로.
   한글 제목은 거의 다 이 꼴로 온다. 풀지 못하면 원문을 그대로 둔다. */
export function decodeWords(s) {
  if (!s) return ''
  // 붙어 있는 조각 사이의 빈칸은 원래 글자가 아니다(RFC 2047) — 먼저 없앤다
  let t = String(s).replace(/\?=[ \t]+(?==\?)/g, '?=')
  return t.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (all, cs, enc, txt) => {
    try {
      let bytes
      if (enc.toUpperCase() === 'B') {
        const bin = atob(txt.replace(/\s/g, ''))
        bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      } else {
        const fixed = txt.replace(/_/g, ' ')
        const nums = []
        for (let i = 0; i < fixed.length; i++) {
          if (fixed[i] === '=' && /^[0-9a-f]{2}$/i.test(fixed.slice(i + 1, i + 3))) {
            nums.push(parseInt(fixed.slice(i + 1, i + 3), 16)); i += 2
          } else nums.push(fixed.charCodeAt(i))
        }
        bytes = Uint8Array.from(nums)
      }
      return dec(bytes, cs.toLowerCase().split('*')[0]) || all
    } catch { return all }
  })
}

/* 'OpenAI <noreply@tm.openai.com>' → 'OpenAI'.  이름이 없으면 메일 주소. */
export function fromName(s) {
  const t = decodeWords(s).trim()
  if (!t) return '보낸사람 모름'
  const m = t.match(/^"?(.*?)"?\s*<([^>]+)>$/)
  if (m && m[1].trim()) return m[1].trim()
  return (m ? m[2] : t).trim()
}

/* 받는사람 쪽 머리글을 **모두** 모은다.
   ⚠️ headerValue 는 첫 하나만 가져온다. 여기서는 Delivered-To 처럼
      여러 번 오는 것까지 다 봐야 해서 따로 모은다. */
const TO_FIELDS = ['to:', 'cc:', 'delivered-to:', 'x-original-to:', 'x-forwarded-to:']
export function recipientText(block) {
  const out = []
  let keep = false
  for (const line of String(block).split(/\r?\n/)) {
    if (/^[ \t]/.test(line)) { if (keep) out.push(line.trim()); continue }   // 접힌 줄
    const low = line.toLowerCase()
    keep = TO_FIELDS.some((w) => low.startsWith(w))
    if (keep) out.push(line.slice(line.indexOf(':') + 1).trim())
  }
  return out.join(' ').toLowerCase()
}

/* 공용함(그룹메일) 주소로 온 메일인가?
   viren@viren.kr 은 **그룹메일**이라 들여다볼 메일함이 따로 없다. 그래서 받는
   사람의 개인 메일함을 보되, **그 주소로 온 것만** 골라 낸다(지은님 2026-10-26).
   그러지 않으면 개인 메일의 보낸사람·제목이 전 직원에게 뿌려진다.
   ⚠️ MAIL_GROUP 을 비워 두면 **메일함의 모든 메일**이 알림으로 나간다. */
export function forGroup(block, list) {
  const addrs = String(list || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (!addrs.length) return true
  const hay = recipientText(block)
  return addrs.some((a) => hay.includes(a))
}

/* ── 본문 미리보기 ──────────────────────────────────────────────────
   ⚠️ **여기서만 본문을 본다.** 앞부분 몇 KB 만 가져와 한 줄로 줄인다.
      그 한 줄은 메신저 '메일' 방에 남는다 — 공용함(MAIL_GROUP)으로 온
      메일에만 해당한다(지은님 2026-10-26, 카카오워크 봇과 같은 모양).
   ⚠️ 자신이 없으면 **빈 글자**를 돌려준다. 깨진 글자를 보여 주느니 안 보이는 게 낫다. */

/* 머리글과 본문을 가른다(빈 줄 하나가 경계다) */
export function splitMime(raw) {
  const m = String(raw).match(/\r?\n\r?\n/)
  if (!m) return { head: String(raw), body: '' }
  return { head: String(raw).slice(0, m.index), body: String(raw).slice(m.index + m[0].length) }
}

const ctParam = (head, name) => {
  const m = headerValue(head, 'Content-Type').match(new RegExp(`${name}\\s*=\\s*"?([^";\\s]+)"?`, 'i'))
  return m ? m[1] : ''
}
const ctype = (head) => (headerValue(head, 'Content-Type') || 'text/plain').toLowerCase()
const cte = (head) => (headerValue(head, 'Content-Transfer-Encoding') || '').trim().toLowerCase()

/* base64 / quoted-printable 을 푼다. 못 풀면 null. */
export function decodeBody(text, enc, charset) {
  const cs = (charset || 'utf-8').toLowerCase()
  try {
    if (enc === 'base64') {
      const clean = String(text).replace(/[^A-Za-z0-9+/=]/g, '')
      /* ⚠️ 뒤에 다른 글자가 섞여 있을 수 있다(끝 경계 등). 채움표(=) 까지만 쓴다 —
         채움표 뒤에 뭐가 붙으면 atob 이 통째로 실패해서 미리보기가 사라진다. */
      const core = (clean.match(/^[A-Za-z0-9+/]*={0,2}/) || [''])[0]
      // 앞부분만 받아와서 끝이 잘려 있다 — 4의 배수로 맞춘다
      const cut = core.slice(0, core.length - (core.length % 4))
      if (!cut) return ''
      const bin = atob(cut)
      return dec(Uint8Array.from(bin, (c) => c.charCodeAt(0)), cs)
    }
    if (enc === 'quoted-printable') {
      const j = String(text).replace(/=\r?\n/g, '')
      const nums = []
      for (let i = 0; i < j.length; i++) {
        if (j[i] === '=' && /^[0-9a-f]{2}$/i.test(j.slice(i + 1, i + 3))) {
          nums.push(parseInt(j.slice(i + 1, i + 3), 16)); i += 2
        } else nums.push(j.charCodeAt(i) & 0xff)
      }
      return dec(Uint8Array.from(nums), cs)
    }
  } catch { return null }
  /* 7bit·8bit — 소켓에서 이미 utf-8 로 읽었다.
     ⚠️ 글자표가 utf-8 계열이 아니면 **이미 깨져 있다.** 그때는 포기한다. */
  if (!['utf-8', 'utf8', 'us-ascii', 'ascii', 'iso-8859-1', ''].includes(cs)) return null
  return String(text)
}

const stripHtml = (s) => String(s)
  .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<\/?(br|p|div|tr|li|h[1-6]|table)[^>]*>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&amp;/gi, '&')

/* 글자가 든 조각을 고른다. text/plain 을 먼저, 없으면 text/html. */
function pickText(head, body, depth = 0) {
  const ct = ctype(head)
  if (ct.startsWith('multipart/')) {
    const b = ctParam(head, 'boundary')
    if (!b || depth > 2) return null
    const esc = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    /* ⚠️ 끝 경계(--경계--)에 줄바꿈이 없을 수 있다. 앞부분만 받아와서 잘렸거나
       그게 맨 끝이거나. `$` 를 같이 받지 않으면 끝 경계가 본문에 섞여 들어간다. */
    const parts = String(body).split(new RegExp(`--${esc}(?:--)?[ \\t]*(?:\\r?\\n|$)`))
    let html = null
    for (const p of parts) {
      if (!/^content-/im.test(p)) continue        // 머리글 없는 조각(앞머리말)은 건너뛴다
      const sp = splitMime(p)
      const got = pickText(sp.head, sp.body, depth + 1)
      if (!got) continue
      if (!got.html) return got                   // text/plain 우선
      if (!html) html = got
    }
    return html
  }
  if (ct.startsWith('text/plain')) return { text: body, enc: cte(head), charset: ctParam(head, 'charset'), html: false }
  if (ct.startsWith('text/html')) return { text: body, enc: cte(head), charset: ctParam(head, 'charset'), html: true }
  return null
}

/* 여러 줄을 한 줄로 줄인다 */
export function tidy(s, max = 140) {
  const t = String(s || '').replace(/[ ​]/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}

/* 메일 한 통(머리글+본문 앞부분)에서 미리보기 한 줄 */
export function previewOf(raw) {
  try {
    const { head, body } = splitMime(raw)
    const part = pickText(head, body)
    if (!part) return ''
    const s = decodeBody(part.text, part.enc, part.charset)
    if (s === null) return ''
    return tidy(part.html ? stripHtml(s) : s)
  } catch { return '' }
}

/* BODY.PEEK[]<0.N> 답에서 알맹이만. 꼬리의 ')' 와 태그 줄은 떼어 낸다. */
export function literalOf(raw) {
  const m = String(raw).match(/\{(\d+)\}\r?\n/)
  if (!m) return ''
  return String(raw).slice(m.index + m[0].length)
    .replace(/\r?\n\)\r?\n[A-Za-z]\d+ (OK|NO|BAD)[^\r\n]*\r?\n?$/i, '')
    .replace(/\r?\n\)\r?\n?$/, '')
}

/* ── Supabase (서비스 키로) ─────────────────────────────────────────── */
function db(env) {
  const base = `${env.VITE_SUPABASE_URL}/rest/v1`
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  return {
    async get(path) {
      const r = await fetch(`${base}/${path}`, { headers })
      return r.ok ? r.json() : []
    },
    async patch(path, body) {
      await fetch(`${base}/${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
    },
    async rpc(name, body) {
      const r = await fetch(`${base}/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) })
      if (!r.ok) throw new Error(`${name}: ${await r.text()}`)
      return r.json()
    },
  }
}

/* ── 본체 ───────────────────────────────────────────────────────────── */
export async function onRequestPost({ request, env }) {
  /* ⚠️ MAIL_GROUP 도 **반드시** 있어야 한다. 없으면 그 사람의 개인 메일까지
     전 직원에게 알림으로 나간다. 빠뜨렸으면 차라리 아무것도 안 하는 게 낫다. */
  const missing = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PUSH_SECRET',
    'MAIL_IMAP_HOST', 'MAIL_USER', 'MAIL_PASS', 'MAIL_GROUP']
    .filter((k) => !env[k])
  if (missing.length) return json({ error: '메일 알림 설정이 아직 없습니다.', missing }, 503)

  // 부르는 쪽은 DB(pg_cron) 뿐이다. 사람이 직접 부를 일은 없다.
  if (!sameSecret(request.headers.get('x-push-secret') || '', env.PUSH_SECRET || '\0')) {
    return json({ error: 'no' }, 401)
  }

  const d = db(env)
  const [state] = await d.get('mail_state?id=eq.1&select=uidvalidity,last_uid')
  // 잘 돌았으면 지난 실패 기록은 지운다
  const mark = (more) => d.patch('mail_state?id=eq.1',
    { checked_at: new Date().toISOString(), last_error: null, ...more })

  let im
  try {
    const socket = connect(
      { hostname: env.MAIL_IMAP_HOST, port: Number(env.MAIL_IMAP_PORT || 993) },
      { secureTransport: 'on', allowHalfOpen: false },
    )
    im = new Imap(socket)
    await im.hello()
    await im.cmd(`LOGIN ${q(env.MAIL_USER)} ${q(env.MAIL_PASS)}`, 'LOGIN')

    /* ① 먼저 **가볍게** 묻는다 — STATUS 는 메일함을 열지도 않는다.
       1분마다 두드리는데 새 메일은 하루에 몇 통뿐이다. 거의 언제나 여기서 끝나야
       메일 서버에 부담이 가지 않는다. */
    const box = await im.cmd('STATUS "INBOX" (UIDVALIDITY UIDNEXT)')
    const validity = Number((box.match(/UIDVALIDITY (\d+)/) || [])[1] || 0)
    const next = Number((box.match(/UIDNEXT (\d+)/) || [])[1] || 0)

    /* 처음 돌 때, 또는 메일함 번호가 통째로 바뀌었을 때(UIDVALIDITY 변경):
       **아무것도 알리지 않고** 지금 자리만 적어 둔다. 안 그러면 묵은 메일이 한꺼번에 울린다. */
    const fresh = !state || !state.uidvalidity || state.uidvalidity !== validity
    if (fresh) {
      await im.bye()
      await mark({ uidvalidity: validity, last_uid: Math.max(0, next - 1) })
      return json({ ok: true, first: true, uidvalidity: validity, last_uid: Math.max(0, next - 1) })
    }

    const since = Number(state.last_uid || 0)
    if (next && next - 1 <= since) {       // 새 것이 없다
      await im.bye()
      await mark()
      return json({ ok: true, new: 0 })
    }

    /* ② 새 게 있을 때만 메일함을 연다.
       ⚠️ SELECT 가 아니라 **EXAMINE** — 읽기 전용이다. 메일함을 건드리지 않는다. */
    await im.cmd('EXAMINE "INBOX"')

    /* ⚠️ BODY.PEEK — 읽음 표시를 건드리지 않고 머리글만 본다.
       ⚠️ 'UID FETCH n:*' 는 해당하는 게 없어도 **마지막 한 통을 돌려준다.**
          그래서 받은 뒤에 uid > since 로 한 번 더 거른다. */
    const raw = await im.cmd(`UID FETCH ${since + 1}:* (UID FLAGS BODY.PEEK[HEADER.FIELDS `
      + `(FROM SUBJECT TO CC DELIVERED-TO X-ORIGINAL-TO X-FORWARDED-TO)])`)

    const items = parseFetch(raw).filter((x) => x.uid > since)
    const top = items.length ? Math.max(...items.map((x) => x.uid)) : since

    const unread = items.filter((x) => !x.seen)        // 벌써 읽은 건 알리지 않는다
    const ours = unread.filter((x) => forGroup(x.header, env.MAIL_GROUP))
    /* 공용함으로 온 게 아닌 것 = 메일함 주인의 **개인 메일**.
       MAIL_OWN 이 'off' 면 예전처럼 그냥 버린다. */
    const ownOn = String(env.MAIL_OWN || '').toLowerCase() !== 'off'
    const mineRaw = ownOn ? unread.filter((x) => !ours.includes(x)) : []
    const dropped = unread.length - ours.length - mineRaw.length

    /* 미리보기는 **공용 메일만** 한 통씩 더 받아 온다.
       ⚠️ 개인 메일은 미리보기를 만들지 않는다 — 본문을 들여다보지 않는다.
       ⚠️ 머리글 받아오기와 섞지 않는다. 머리글은 영문자뿐이라 길이가 정확한데,
          본문에는 한글이 섞여 글자 수와 바이트 수가 어긋난다. 한 통씩 따로 받으면
          그 어긋남이 그 통 꼬리에만 생겨서 아무 탈이 없다. */
    const head = (x) => ({
      from: fromName(headerValue(x.header, 'From')),
      subject: decodeWords(headerValue(x.header, 'Subject')).trim(),
    })
    const mails = []
    for (const x of ours) {
      let preview = ''
      try {
        preview = previewOf(literalOf(await im.cmd(`UID FETCH ${x.uid} (BODY.PEEK[]<0.16384>)`)))
      } catch { /* 미리보기가 없어도 알림은 보낸다 */ }
      mails.push({ ...head(x), preview })
    }
    const mine = mineRaw.map(head)
    await im.bye()   // 미리보기까지 다 받은 뒤에 끊는다

    /* 숫자만 적는다. 왜 안 뜨는지 알아보려면 이게 있어야 한다
       (새 메일은 있는데 올린 게 0 이면 공용함 거르기가 안 맞는 것). */
    const note = `새 ${items.length} · 공용 ${mails.length} · 개인 ${mine.length}`
      + `${dropped ? ` · 버림 ${dropped}` : ''} · 읽음 ${items.length - unread.length}`

    if (!mails.length && !mine.length) {
      await mark({ last_uid: Math.max(top, since), last_note: note })
      return json({ ok: true, new: items.length, posted: 0, own: 0 })
    }

    /* 메신저 '메일' 방에 올린다. 전 직원이 그 방에 들어 있고(post_mail 이 챙긴다),
       글이 들어가면 on_message 방아쇠가 휴대폰 알림까지 보낸다.
       ⚠️ 여기서 알림을 따로 보내지 않는다 — 보내면 두 번 울린다. */
    /* p_addr 은 화면에 "어느 주소에 걸려 있는지" 를 보여 주려고 같이 넘긴다 */
    const posted = mails.length
      ? await d.rpc('post_mail', { p_items: mails, p_addr: env.MAIL_GROUP })
      : 0

    /* 개인 메일은 **메일함 주인만 들어 있는 '내 메일' 방**으로. 남은 못 본다.
       주인이 재직 중인 직원이 아니면 post_own_mail 이 0 을 돌려주고 끝난다. */
    const own = mine.length
      ? await d.rpc('post_own_mail', { p_email: env.MAIL_USER, p_items: mine })
      : 0

    /* ⚠️ **둘 다 올린 뒤에** 본 번호를 적는다. 올리다 실패하면 번호를 안 올려서
       다음 1분에 다시 시도한다. 먼저 적으면 그 메일은 영영 안 뜬다. */
    await mark({ last_uid: Math.max(top, since), last_note: note })
    return json({ ok: true, new: items.length, posted, own })
  } catch (e) {
    try { await im?.bye() } catch { /* 그만 */ }
    // 실패해도 '언제 확인했는지' 와 까닭은 남긴다 — 안 오는 이유를 알아야 한다
    try { await d.patch('mail_state?id=eq.1',
      { checked_at: new Date().toISOString(), last_error: String(e.message || e).slice(0, 300) }) } catch { /* 그만 */ }
    return json({ ok: false, error: String(e.message || e) }, 502)
  }
}
