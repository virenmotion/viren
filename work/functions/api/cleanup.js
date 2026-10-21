/* work.viren.kr/api/cleanup — 오래된 대화 파일을 지운다. (2026-10-21)
 *
 * Cloudflare Pages Functions. 따로 배포할 것이 없다.
 *
 * 두 가지 길로 들어온다.
 *   ① 매일 새벽 3시, DB(pg_cron → pg_net)가 x-push-secret 을 달고 부른다
 *   ② 관리자가 '지금 정리' 를 누르면 자기 토큰을 달고 { now: true } 를 보낸다
 *
 * ⚠️ 저장소 파일은 SQL 로 못 지운다(42501). 반드시 Storage API 를 거쳐야 한다.
 *    그래서 지우는 일이 여기 있다.
 *
 * 글은 지우지 않는다. messages.file 에 { name, size, type, gone: true } 만 남겨
 * 화면에 '기간이 지나 사라진 파일' 로 뜨게 한다. 누가 무엇을 보냈는지는 남는다.
 */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const CHUNK = 100          // 한 번에 지우는 파일 수
const MAX_PER_RUN = 1000   // 한 번 돌 때 최대 — 오래 걸려 끊기지 않게

export async function onRequestPost({ request, env }) {
  const missing = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PUSH_SECRET'].filter((k) => !env[k])
  if (missing.length) return json({ error: '설정이 아직 없습니다.', missing }, 503)

  let input = {}
  try { input = await request.json() } catch { /* 빈 몸통 */ }

  const base = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

  /* 누가 불렀나 */
  if (input.now) {
    // 관리자가 직접 눌렀다. 본인 토큰으로 확인하고, 관리자인지까지 본다.
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '')
    if (!token) return json({ error: '로그인이 필요합니다.' }, 401)
    const who = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } })
    if (!who.ok) return json({ error: '로그인이 만료됐습니다.' }, 401)
    const user = await who.json()
    const r = await fetch(`${base}/rest/v1/employees?id=eq.${user.id}&select=role,active`, { headers: H })
    const [me] = r.ok ? await r.json() : []
    if (me?.role !== 'admin' || !me?.active) return json({ error: '관리자만 할 수 있습니다.' }, 403)
  } else if (!sameSecret(request.headers.get('x-push-secret') || '', env.PUSH_SECRET)) {
    return json({ error: 'no' }, 401)
  }

  /* 며칠 지난 것을 지울지 — 관리 화면에서 바꾼 값을 그대로 따른다 */
  const sr = await fetch(`${base}/rest/v1/settings?id=eq.1&select=chat_file_days`, { headers: H })
  const [st] = sr.ok ? await sr.json() : []
  const days = Number(st?.chat_file_days ?? 60)
  if (!(days > 0)) return json({ skip: '보관 기간이 0 이하라 아무것도 지우지 않았습니다.' })

  const cutoff = new Date(Date.now() - days * 86400000).toISOString()

  /* 지울 것 찾기 — 아직 알맹이가 남아 있는(path 가 있는) 것만 */
  const q = `${base}/rest/v1/messages`
    + `?created_at=lt.${encodeURIComponent(cutoff)}`
    + `&file=not.is.null&select=id,file&order=created_at&limit=${MAX_PER_RUN}`
  const mr = await fetch(q, { headers: H })
  if (!mr.ok) return json({ error: '목록을 읽지 못했습니다.' }, 500)
  const rows = (await mr.json()).filter((m) => m.file?.path && !m.file.gone)
  if (!rows.length) return json({ days, deleted: 0, bytes: 0 })

  /* ① 파일 알맹이 — Storage API 로만 지울 수 있다 */
  let deleted = 0
  let bytes = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK)
    const res = await fetch(`${base}/storage/v1/object/chat-files`, {
      method: 'DELETE',
      headers: H,
      body: JSON.stringify({ prefixes: part.map((m) => m.file.path) }),
    })
    // 이미 없는 파일이어도 글 쪽은 정리해 준다 — 안 그러면 매일 같은 줄을 다시 집는다
    if (res.ok) {
      deleted += part.length
      bytes += part.reduce((a, m) => a + Number(m.file.size || 0), 0)
    }
  }

  /* ② 글에는 '사라졌다' 고 남긴다. 누가 무엇을 보냈는지는 지우지 않는다. */
  let marked = 0
  for (const m of rows) {
    const r = await fetch(`${base}/rest/v1/messages?id=eq.${m.id}`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({
        file: { name: m.file.name, size: m.file.size, type: m.file.type, gone: true },
      }),
    })
    if (r.ok) marked++
  }

  return json({ days, deleted, marked, bytes })
}
