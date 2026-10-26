/* work.viren.kr/api/notify — 결재 알림을 휴대폰으로 보낸다. (2026-10-21)
 *
 * Cloudflare Pages Functions. work/functions/api/notify.js → /api/notify.
 * 따로 배포할 것이 없다. main 에 올리면 Pages 가 같이 올린다.
 *
 * 두 가지 길로 들어온다.
 *   ① DB(pg_net) 가 x-push-secret 을 달고 { doc } 를 보낸다 → 그 문서의 차례인 사람에게
 *   ② 로그인한 사람이 자기 토큰을 달고 { test: true } 를 보낸다 → 자기 기기로 시험 알림
 *
 * 필요한 환경변수 (Cloudflare Pages → Settings → Environment variables)
 *   VITE_SUPABASE_URL           이미 있음
 *   SUPABASE_SERVICE_ROLE_KEY   새로 (남의 기기 등록을 읽어야 해서 필요)
 *   VITE_VAPID_PUBLIC           새로 (화면 쪽도 같은 값을 쓴다)
 *   VAPID_PRIVATE               새로 — 저장소에 절대 넣지 않는다
 *   PUSH_SECRET                 새로 (DB 의 push_config.secret 과 같아야 한다)
 *
 * 알림 규격은 RFC 8291(aes128gcm) · RFC 8292(VAPID). 라이브러리 없이
 * Web Crypto 로 직접 했다 — Workers 에는 Node 의 crypto 가 없다.
 */

const te = new TextEncoder()

const b64uDec = (s) => {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const b64uEnc = (buf) => {
  const b = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const cat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((a, x) => a + x.length, 0))
  let i = 0
  for (const a of arrs) { out.set(a, i); i += a.length }
  return out
}

async function hmac(keyBytes, data) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

/* HKDF — 여기서는 뽑아내는 길이가 늘 32바이트 이하라 한 번만 돌린다. */
async function hkdf(salt, ikm, info, len) {
  const prk = await hmac(salt, ikm)
  const okm = await hmac(prk, cat(info, new Uint8Array([1])))
  return okm.slice(0, len)
}

/* 길이가 달라도 걸리는 시간이 같게 — 암호 비교 */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function vapidHeader(endpoint, pubB64, privB64, subject) {
  const head = b64uEnc(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64uEnc(te.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })))
  const pub = b64uDec(pubB64)
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', ext: true,
    x: b64uEnc(pub.slice(1, 33)), y: b64uEnc(pub.slice(33, 65)), d: privB64,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${head}.${body}`))
  return `vapid t=${head}.${body}.${b64uEnc(sig)}, k=${pubB64}`
}

/* fixed 는 **시험용**이다(정해진 열쇠·소금을 넣어 결과를 비교할 때).
   운영에서는 늘 비워 둔다 — 같은 소금을 두 번 쓰면 암호가 깨진다. */
export async function encryptFor(sub, text, fixed = null) {
  const uaPub = b64uDec(sub.p256dh)        // 65바이트
  const authSecret = b64uDec(sub.auth)     // 16바이트

  const kp = fixed?.keyPair
    || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, kp.privateKey, 256))

  const ikm = await hkdf(authSecret, shared, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32)
  const salt = fixed?.salt || crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12)

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 마지막 조각임을 뜻하는 0x02 를 붙인다 (RFC 8188)
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, aes, cat(te.encode(text), new Uint8Array([2]))))

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct)
}

/* ── Supabase (서비스 키로 읽는다) ─────────────────────────────────── */
function db(env) {
  const base = `${env.VITE_SUPABASE_URL}/rest/v1`
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  return {
    async get(path) {
      const r = await fetch(`${base}/${path}`, { headers })
      return r.ok ? r.json() : []
    },
    /* get 과 달리 **실패를 숨기지 않는다** — 실패하면 null. 빈 목록([])과 구분해야
       하는 곳에서 쓴다(못 읽은 것과 '한 명도 없음' 은 다르다). */
    async getOk(path) {
      const r = await fetch(`${base}/${path}`, { headers })
      return r.ok ? r.json() : null
    },
    async del(path) {
      await fetch(`${base}/${path}`, { method: 'DELETE', headers })
    },
  }
}

const FORM_NAME = { general: '품의서', leave: '휴가신청서', expense: '지출결의서' }

/* ── 누구에게 무슨 말을 보낼지 ─────────────────────────────────────── */
/* kind 'doc' = 결재, 'chat' = 메신저. 누구에게 무슨 말을 보낼지 여기서만 정한다. */
async function messageFor(env, kind, id) {
  const d = db(env)
  if (kind === 'chat') return chatMessage(d, id)
  const docId = id
  const [doc] = await d.get(`approval_docs?id=eq.${docId}&select=id,doc_no,title,status,form_type,drafter_id,doc_forms(name)`)
  if (!doc) return null

  const form = doc.form_type === 'custom' ? (doc.doc_forms?.name || '문서') : (FORM_NAME[doc.form_type] || '문서')
  const url = `/approval/${doc.id}`

  if (doc.status === 'pending') {
    const steps = await d.get(`approval_steps?doc_id=eq.${docId}&status=eq.pending&select=approver_id`)
    if (!steps.length) return null
    const [who] = await d.get(`employees?id=eq.${doc.drafter_id}&select=name,position`)
    const from = who ? `${who.name}${who.position || ''}` : '직원'
    return {
      users: steps.map((s) => s.approver_id),
      title: '결재할 문서가 있어요',
      body: `${from} · ${form} — ${doc.title}`,
      url, tag: `doc-${doc.id}`,
    }
  }

  if (doc.status === 'approved') {
    return {
      users: [doc.drafter_id],
      title: '결재가 끝났어요',
      body: `${form} — ${doc.title} 이(가) 승인되었습니다.`,
      url, tag: `doc-${doc.id}`,
    }
  }

  if (doc.status === 'rejected') {
    const [step] = await d.get(`approval_steps?doc_id=eq.${docId}&status=eq.rejected&select=comment,approver_id`)
    const [who] = step ? await d.get(`employees?id=eq.${step.approver_id}&select=name,position`) : []
    const by = who ? `${who.name}${who.position || ''}` : '결재자'
    return {
      users: [doc.drafter_id],
      title: '문서가 반려됐어요',
      body: `${by} · ${form} — ${step?.comment || doc.title}`,
      url, tag: `doc-${doc.id}`,
    }
  }
  return null
}

/* 메신저 — 보낸 사람만 빼고 그 방 사람 모두에게. */
async function chatMessage(d, id) {
  const [m] = await d.get(`messages?id=eq.${id}&select=id,room_id,sender_id,text,file`)
  if (!m) return null
  const [room] = await d.get(`rooms?id=eq.${m.room_id}&select=id,kind,name`)
  const members = await d.get(`room_members?room_id=eq.${m.room_id}&select=user_id`)
  /* 보낸 사람이 없는 글 = 시스템이 올린 것(메일 알림). 방 이름이 곧 보낸 사람이다. */
  const bot = !m.sender_id
  const [who] = bot ? [] : await d.get(`employees?id=eq.${m.sender_id}&select=name,position`)

  const from = who ? `${who.name}${who.position || ''}` : '직원'
  const body = (m.text || '').trim() || (m.file ? '사진·파일을 보냈어요' : '')
  const group = room?.kind === 'group'
  return {
    users: members.map((x) => x.user_id).filter((u) => u !== m.sender_id),
    title: bot ? (room?.name || '메일') : group ? (room.name || '단체 대화') : from,
    body: bot ? body : group ? `${from}: ${body}` : body,
    url: `/chat/${m.room_id}`,
    // 같은 방 알림은 쌓이지 않고 덮어쓴다. 대화는 금방 여러 개가 온다.
    tag: `room-${m.room_id}`,
    quiet: true,
  }
}

async function sendTo(env, msg) {
  const d = db(env)
  const ids = [...new Set(msg.users)].filter(Boolean)
  if (!ids.length) return { sent: 0, gone: 0 }

  /* ⚠️ **퇴사자는 뺀다.** 재직을 꺼도 push_subs(등록한 기기)와 room_members(방 참여)는
     그대로 남는다. 그냥 두면 퇴사한 뒤에도 그 사람 휴대폰으로 결재·메신저·메일 제목이
     계속 간다 — 앱에는 못 들어가는데 알림만 오는 상태다(2026-10-26 발견).
     들어오는 길(RLS)은 막혀 있지만 **나가는 길**은 여기서 막아야 한다. */
  /* ⚠️ 거르는 건 **받아온 값으로** 한다. 주소에 조건을 붙였다가 그 문법이 틀리면
     빈 목록이 돌아와서 **알림이 통째로 안 간다.** 조회가 실패하면(null) 거르지 않는다 —
     한 사람을 더 거르려다 모두의 알림을 막는 게 더 나쁘다. */
  const live = await d.getOk(`employees?id=in.(${ids.join(',')})&select=id,active`)
  const okIds = live === null ? ids : live.filter((e) => e.active).map((e) => e.id)
  if (!okIds.length) return { sent: 0, gone: 0 }

  const subs = await d.get(`push_subs?user_id=in.(${okIds.join(',')})&select=id,endpoint,p256dh,auth`)
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag, renotify: !msg.quiet })
  let sent = 0, gone = 0

  for (const sub of subs) {
    try {
      const body = await encryptFor(sub, payload)
      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          TTL: '86400',
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          Authorization: await vapidHeader(sub.endpoint, env.VITE_VAPID_PUBLIC, env.VAPID_PRIVATE,
            env.VAPID_SUBJECT || 'mailto:viren@viren.kr'),
        },
        body,
      })
      if (res.status === 404 || res.status === 410) {
        // 기기가 앱을 지웠거나 구독이 끊겼다. 남겨 두면 매번 실패한다.
        await d.del(`push_subs?id=eq.${sub.id}`)
        gone++
      } else if (res.ok) {
        sent++
      }
    } catch { /* 한 기기가 실패해도 나머지는 보낸다 */ }
  }
  return { sent, gone }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

export async function onRequestPost({ request, env }) {
  /* 어느 값이 비었는지 **이름만** 알려 준다. 값은 절대 내보내지 않는다.
     "설정이 없습니다" 만으로는 넷 중 무엇을 빠뜨렸는지 알 길이 없어 한참 헤맸다. */
  const missing = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_VAPID_PUBLIC', 'VAPID_PRIVATE', 'PUSH_SECRET']
    .filter((k) => !env[k])
  if (missing.length) {
    return json({ error: '알림 설정이 아직 없습니다.', missing }, 503)
  }

  let input = {}
  try { input = await request.json() } catch { /* 빈 몸통 */ }

  /* ② 시험 알림 — 로그인한 본인에게만 */
  if (input.test) {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '')
    if (!token) return json({ error: '로그인이 필요합니다.' }, 401)
    const who = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!who.ok) return json({ error: '로그인이 만료됐습니다.' }, 401)
    const user = await who.json()
    const out = await sendTo(env, {
      users: [user.id], title: '알림이 켜졌어요',
      body: '결재 차례가 오면 이렇게 알려 드릴게요.', url: '/', tag: 'test',
    })
    return json(out)
  }

  /* ① DB 가 부른 경우 */
  if (!sameSecret(request.headers.get('x-push-secret') || '', env.PUSH_SECRET || '\0')) {
    return json({ error: 'no' }, 401)
  }
  const kind = input.kind || 'doc'
  const id = input.id || input.doc
  if (!id) return json({ error: 'id 없음' }, 400)

  const msg = await messageFor(env, kind, id)
  if (!msg) return json({ sent: 0, skip: true })
  return json(await sendTo(env, msg))
}
