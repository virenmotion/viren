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
 *   · 공용함 하나(viren@viren.kr)만 본다. 직원 개인 메일함은 각자 카카오워크에서.
 *   · 1분마다 두드리므로 **새 게 없을 때가 싸야 한다** — STATUS 한 번으로 끝낸다.
 *
 * 환경변수 — /api/mail 과 같은 것을 쓴다 (Cloudflare Pages → Variables and Secrets)
 *   MAIL_IMAP_HOST · MAIL_IMAP_PORT(기본 993) · MAIL_USER · MAIL_PASS
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
  const missing = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PUSH_SECRET',
    'MAIL_IMAP_HOST', 'MAIL_USER', 'MAIL_PASS']
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
    const raw = await im.cmd(
      `UID FETCH ${since + 1}:* (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)])`)
    await im.bye()

    const items = parseFetch(raw).filter((x) => x.uid > since)
    const top = items.length ? Math.max(...items.map((x) => x.uid)) : since

    const mails = items
      .filter((x) => !x.seen)              // 벌써 읽은 건 알리지 않는다
      .map((x) => ({
        from: fromName(headerValue(x.header, 'From')),
        subject: decodeWords(headerValue(x.header, 'Subject')).trim(),
      }))

    if (!mails.length) {
      await mark({ last_uid: Math.max(top, since) })
      return json({ ok: true, new: items.length, posted: 0 })
    }

    /* 메신저 '메일' 방에 올린다. 전 직원이 그 방에 들어 있고(post_mail 이 챙긴다),
       글이 들어가면 on_message 방아쇠가 휴대폰 알림까지 보낸다.
       ⚠️ 여기서 알림을 따로 보내지 않는다 — 보내면 두 번 울린다. */
    const posted = await d.rpc('post_mail', { p_items: mails })

    /* ⚠️ **올린 뒤에** 본 번호를 적는다. 올리다 실패하면 번호를 안 올려서
       다음 1분에 다시 시도한다. 먼저 적으면 그 메일은 영영 안 뜬다. */
    await mark({ last_uid: Math.max(top, since) })
    return json({ ok: true, new: items.length, posted })
  } catch (e) {
    try { await im?.bye() } catch { /* 그만 */ }
    // 실패해도 '언제 확인했는지' 와 까닭은 남긴다 — 안 오는 이유를 알아야 한다
    try { await d.patch('mail_state?id=eq.1',
      { checked_at: new Date().toISOString(), last_error: String(e.message || e).slice(0, 300) }) } catch { /* 그만 */ }
    return json({ ok: false, error: String(e.message || e) }, 502)
  }
}
