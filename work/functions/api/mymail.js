/* work.viren.kr/api/mymail — 직원이 자기 개인 메일 알림을 켜고 끈다. (2026-10-26)
 *                                            (대표님 승인, 지은님 전달)
 *
 * 🔴 **비밀번호는 여기서만 지나간다.** 화면(브라우저)은 user_mail 표를 직접 못 본다 —
 *    그 표에는 정책이 하나도 없어서 로그인한 사람도 읽지 못한다. 이 창구를 거쳐
 *    **자기 줄의 안전한 값**(켜짐·마지막 확인·오류)만 본다.
 *    비밀번호는 **넣을 수만 있고 아무도 다시 꺼내 볼 수 없다.**
 *
 * 🔴 열쇠를 둘로 쪼갠다
 *    비밀번호는 MAIL_KEY 로 암호화해서 DB 에 넣는다. MAIL_KEY 는 **Cloudflare 에만** 있다.
 *    Supabase 를 통째로 봐도 암호문만 보이고 못 푼다.
 *
 * 하는 일 (몸통의 action)
 *   'get'    내 상태 보기
 *   'save'   메일 주소 + 비밀번호 넣기(또는 바꾸기) → 켜짐
 *   'off'    잠시 끄기 (비밀번호는 남겨 둔다)
 *   'on'     다시 켜기
 *   'remove' 지우기 (비밀번호도 지운다)
 *
 * 환경변수
 *   VITE_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
 *   MAIL_KEY   32바이트를 base64 로 적은 열쇠 — **Secret 으로.** 이것만 따로 만든다.
 *   MAIL_USER  (있으면) 이미 서버가 보고 있는 메일함. 같은 주소는 두 번 보지 않는다.
 */

const te = new TextEncoder()
const td = new TextDecoder()

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

const b64 = (buf) => {
  const b = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}
const unb64 = (s) => Uint8Array.from(atob(String(s)), (c) => c.charCodeAt(0))

async function keyOf(env) {
  let raw
  try { raw = unb64(env.MAIL_KEY) } catch {
    throw new Error('MAIL_KEY 가 base64 가 아닙니다. Cloudflare 설정을 다시 넣어 주세요.')
  }
  if (raw.length !== 32) {
    throw new Error(`MAIL_KEY 가 32바이트가 아닙니다(지금 ${raw.length}바이트).`)
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/* 'v1.<소금>.<암호문>' — 나중에 방식을 바꿔도 알아볼 수 있게 앞에 판을 적는다. */
export async function seal(env, text) {
  const key = await keyOf(env)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(String(text)))
  return `v1.${b64(iv)}.${b64(ct)}`
}

export async function unseal(env, packed) {
  const [v, ivB, ctB] = String(packed || '').split('.')
  if (v !== 'v1' || !ivB || !ctB) throw new Error('저장된 비밀번호를 읽을 수 없습니다.')
  const key = await keyOf(env)
  const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB) }, key, unb64(ctB))
  return td.decode(out)
}

function db(env) {
  const base = `${env.VITE_SUPABASE_URL}/rest/v1`
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  return {
    async get(path) {
      const r = await fetch(`${base}/${path}`, { headers })
      return r.ok ? r.json() : []
    },
    async upsert(table, body) {
      const r = await fetch(`${base}/${table}`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await r.text())
    },
    async patch(path, body) {
      const r = await fetch(`${base}/${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
      if (!r.ok) throw new Error(await r.text())
    },
  }
}

/* 화면에 돌려주는 것 — **비밀번호는 절대 넣지 않는다.** 들어 있는지 여부만. */
const safe = (row) => ({
  on: !!row?.on_off && !!row?.secret,
  has: !!row?.secret,
  imap_user: row?.imap_user || '',
  checked_at: row?.checked_at || null,
  last_error: row?.last_error || '',
  last_note: row?.last_note || '',
})

/* ⚠️ 여기서 터진 오류를 그냥 두면 Cloudflare 가 **글자(HTML)로 된 500** 을 돌려주고,
   화면은 그걸 못 읽어서 "잠시 뒤 다시 해 주세요" 만 띄운다 — 까닭을 영영 모른다.
   무슨 일이 났는지 **글로 돌려준다.** (비밀번호는 여기 섞이지 않는다) */
export async function onRequestPost(ctx) {
  try {
    return await handle(ctx)
  } catch (e) {
    return json({ error: `저장하지 못했습니다 — ${String(e.message || e).slice(0, 300)}` }, 500)
  }
}

async function handle({ request, env }) {
  const missing = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MAIL_KEY']
    .filter((k) => !env[k])
  if (missing.length) return json({ error: '개인 메일 알림 설정이 아직 없습니다.', missing }, 503)

  /* 누구인지는 **본인 토큰으로만** 정한다. 몸통에 적힌 아이디는 믿지 않는다. */
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '')
  if (!token) return json({ error: '로그인이 필요합니다.' }, 401)
  const who = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  })
  if (!who.ok) return json({ error: '로그인이 만료됐습니다.' }, 401)
  const me = (await who.json()).id

  const d = db(env)
  const [emp] = await d.get(`employees?id=eq.${me}&select=active,email`)
  if (!emp?.active) return json({ error: '권한이 없습니다.' }, 403)

  let input = {}
  try { input = await request.json() } catch { /* 빈 몸통 */ }
  const action = input.action || 'get'
  const row = (await d.get(`user_mail?user_id=eq.${me}&select=*`))[0]

  if (action === 'get') return json(safe(row))

  if (action === 'save') {
    /* ⚠️ 메일 주소는 **본인 것으로 고정한다.** 남의 주소를 넣게 두면, 그 사람 메일이
       넣은 사람 방으로 간다(대표님 메일이 경영지원 방으로 가는 식). 화면에서도
       고르지 못하게 했지만, 믿을 수 있는 건 여기뿐이다. */
    const user = String(emp.email || '').trim()
    const pass = String(input.pass || '')
    if (!user.includes('@')) return json({ error: '직원 정보에 메일 주소가 없습니다. 관리자에게 알려 주세요.' }, 400)
    if (!pass) return json({ error: 'IMAP 비밀번호를 넣어 주세요.' }, 400)
    /* 서버가 이미 보고 있는 메일함이면 두 번 보지 않는다 — 알림이 두 번 온다. */
    if (env.MAIL_USER && user.toLowerCase() === String(env.MAIL_USER).toLowerCase()) {
      return json({ error: '이 메일함은 이미 알림이 켜져 있어요. 따로 넣지 않으셔도 됩니다.' }, 400)
    }
    await d.upsert('user_mail', {
      user_id: me, imap_user: user, secret: await seal(env, pass),
      on_off: true, last_error: null, last_note: null,
      /* 처음 켤 때는 **지난 메일을 쏟지 않는다.** 첫 확인 때 지금 자리를 적고 시작한다. */
      uidvalidity: null, last_uid: null,
      updated_at: new Date().toISOString(),
    })
    return json(safe((await d.get(`user_mail?user_id=eq.${me}&select=*`))[0]))
  }

  if (action === 'on' || action === 'off') {
    if (!row?.secret) return json({ error: '먼저 비밀번호를 넣어 주세요.' }, 400)
    await d.patch(`user_mail?user_id=eq.${me}`,
      { on_off: action === 'on', updated_at: new Date().toISOString() })
    return json(safe({ ...row, on_off: action === 'on' }))
  }

  if (action === 'remove') {
    // 방과 지난 알림은 그대로 둔다(본인만 보는 것이라 지울 까닭이 없다)
    await d.patch(`user_mail?user_id=eq.${me}`,
      { secret: null, on_off: false, last_error: null, last_note: null,
        updated_at: new Date().toISOString() })
    return json(safe({ ...row, secret: null, on_off: false }))
  }

  return json({ error: '없는 요청입니다.' }, 400)
}
