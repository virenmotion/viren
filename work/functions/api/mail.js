/* work.viren.kr/api/mail — 대표메일(공용함)을 IMAP 으로 읽는다. (2026-10-22)
 *
 * ⚠️ 아직 1단계: **연결이 되는지만** 확인한다(action: "test").
 *    메일 목록·본문은 연결이 확인된 뒤에 붙인다. 되는지도 모르는 채로
 *    화면부터 만들면, 안 될 때 어디가 문제인지 알 수 없다.
 *
 * 생각의 뼈대
 *   · **메일을 우리 DB 에 복사하지 않는다.** 볼 때마다 IMAP 에서 바로 읽는다.
 *     복사해 두면 ① 저장소가 차고 ② 회사 메일 사본을 한 군데 더 떠안는다.
 *   · 비밀번호는 **Cloudflare 환경변수에만** 둔다. Supabase 에도, 저장소에도 넣지 않는다.
 *   · 공용함 하나(viren@viren.kr)만 본다. 개인 메일함은 각자 카카오워크에서.
 *     직원마다 비밀번호를 받으면 우리 DB 가 전 직원 메일함 열쇠를 들게 된다.
 *   · 보내기는 여기서 하지 않는다. Cloudflare 는 메일 보내는 포트를 막아 둔다.
 *     홈페이지(Vercel)가 이미 SMTP 로 보내고 있으니 그 길을 쓴다.
 *
 * 환경변수 (Cloudflare Pages → Settings → Variables and Secrets)
 *   MAIL_IMAP_HOST  카카오워크 환경설정 > POP3/IMAP 에 적힌 주소
 *   MAIL_IMAP_PORT  보통 993
 *   MAIL_USER       viren@viren.kr
 *   MAIL_PASS       카카오워크에서 만든 **연동 전용 비밀번호** (Secret 으로)
 */

import { connect } from 'cloudflare:sockets'

const te = new TextEncoder()
const td = new TextDecoder()

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

/* IMAP 은 줄 단위 대화다. 보낸 꼬리표(a1, a2…)가 붙은 줄이 올 때까지 읽는다. */
export class Imap {
  constructor(socket) {
    this.sock = socket
    this.w = socket.writable.getWriter()
    this.r = socket.readable.getReader()
    this.buf = ''
    this.n = 0
  }

  async readUntil(re, ms = 15000) {
    const until = Date.now() + ms
    while (!re.test(this.buf)) {
      if (Date.now() > until) throw new Error('서버가 답하지 않습니다(시간 초과).')
      const { value, done } = await this.r.read()
      if (done) throw new Error('연결이 끊겼습니다.')
      this.buf += td.decode(value, { stream: true })
    }
    const out = this.buf
    this.buf = ''
    return out
  }

  async hello() { return this.readUntil(/^\* (OK|PREAUTH|BYE)/m) }

  async cmd(line, safeLine) {
    const tag = 'a' + (++this.n)
    await this.w.write(te.encode(`${tag} ${line}\r\n`))
    const re = new RegExp(`^${tag} (OK|NO|BAD)(.*)$`, 'm')
    const out = await this.readUntil(re)
    const m = out.match(re)
    if (m[1] !== 'OK') {
      // 비밀번호가 섞인 줄은 그대로 내보내지 않는다
      throw new Error(`${safeLine || line.split(' ')[0]} 실패: ${m[1]}${m[2]}`)
    }
    return out
  }

  async bye() {
    try { await this.cmd('LOGOUT') } catch { /* 끊는 중이면 그만 */ }
    try { await this.w.close() } catch { /* 이미 닫혔으면 그만 */ }
    try { await this.sock.close() } catch { /* 같음 */ }
  }
}

/* IMAP 문자열 따옴표 — 비밀번호에 " 나 \ 가 들어 있어도 깨지지 않게 */
export const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

export async function onRequestPost({ request, env }) {
  const missing = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'MAIL_IMAP_HOST', 'MAIL_USER', 'MAIL_PASS'].filter((k) => !env[k])
  if (missing.length) return json({ error: '메일 설정이 아직 없습니다.', missing }, 503)

  /* 재직 중인 직원만 */
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '')
  if (!token) return json({ error: '로그인이 필요합니다.' }, 401)
  const base = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const who = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } })
  if (!who.ok) return json({ error: '로그인이 만료됐습니다.' }, 401)
  const user = await who.json()
  const er = await fetch(`${base}/rest/v1/employees?id=eq.${user.id}&select=active`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const [me] = er.ok ? await er.json() : []
  if (!me?.active) return json({ error: '권한이 없습니다.' }, 403)

  let input = {}
  try { input = await request.json() } catch { /* 빈 몸통 */ }

  let im
  try {
    const socket = connect(
      { hostname: env.MAIL_IMAP_HOST, port: Number(env.MAIL_IMAP_PORT || 993) },
      { secureTransport: 'on', allowHalfOpen: false },
    )
    im = new Imap(socket)
    const greeting = (await im.hello()).trim().split('\r\n')[0]
    await im.cmd(`LOGIN ${q(env.MAIL_USER)} ${q(env.MAIL_PASS)}`, 'LOGIN')

    if (input.action === 'test' || !input.action) {
      const out = await im.cmd('STATUS "INBOX" (MESSAGES UNSEEN)')
      const m = out.match(/MESSAGES (\d+).*?UNSEEN (\d+)/s)
      await im.bye()
      return json({
        ok: true,
        greeting,
        mailbox: 'INBOX',
        total: m ? Number(m[1]) : null,
        unseen: m ? Number(m[2]) : null,
      })
    }

    await im.bye()
    return json({ error: '아직 만들지 않은 기능입니다.' }, 400)
  } catch (e) {
    try { await im?.bye() } catch { /* 그만 */ }
    return json({ ok: false, error: String(e.message || e) }, 502)
  }
}
