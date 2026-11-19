import nodemailer from 'nodemailer'

/* 문의·지원 폼 → 회사 메일함으로 직접 발송 (Vercel 서버리스 함수)

   외부 폼 서비스(Formspree 등) 없이, 회사 메일 계정(카카오워크)의 SMTP로 직접 보낸다.
   새로 가입할 서비스가 없고 월 건수 제한도 없다.

   필요한 환경변수 (Vercel → Settings → Environment Variables):
     SMTP_HOST  카카오워크 메일의 SMTP 서버 주소
     SMTP_PORT  465(SSL) 또는 587(STARTTLS)
     SMTP_USER  인증·발신에 쓰는 **개인** 메일 계정
                ⚠️ 그룹메일 viren@viren.kr 로는 SMTP 인증이 안 된다(시도해서 확인함).
                ⚠️ 실제로 어느 계정인지는 **여기 적지 않는다.** Vercel 설정에만 둔다.
     SMTP_PASS  그 계정의 비밀번호(또는 앱 비밀번호)
     MAIL_TO    받는 주소. 없으면 SMTP_USER 로 보낸다. (지금은 그룹메일)

   ⚠️ SMTP_PASS 는 절대 코드나 저장소에 넣지 말 것. Vercel 설정에만 둔다.

   🔴 2026-11-17 사고 — 이 함수가 한 번도 메일을 보낸 적이 없었다.
      SMTP_PASS 가 맞지 않아 `535 5.7.1 Authentication failed` 로 계속 실패했고,
      화면에는 "메일 앱이 열립니다" 한 줄만 떠서 지원자가 거기서 멈췄다.
      실패해도 아무도 모른다 — 폼을 고칠 때마다 **실제로 한 통 보내서 받아보고** 끝낸다.

   🔴 사람 계정에 매여 있다 — SMTP_USER 가 **개인 계정**이라,
      그 사람이 비밀번호를 바꾸거나 퇴사하면 문의·지원 메일이 조용히 끊긴다.
      발송 전용 계정으로 옮기는 것이 맞다. (2026-11-18 기준 아직 안 옮김) */

const {
  SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS, MAIL_TO,
} = process.env

/* 우리 사이트에서 온 요청만 받는다 — 열린 발송 endpoint 로 악용되는 것을 막는다.

   ⚠️ 2026-10-08 점검에서 구멍을 찾았다. 예전에는 `!origin` 이면 통과시켰는데,
   Origin 헤더는 **브라우저만 자동으로 붙인다.** curl·스크립트는 그냥 안 붙이면 되므로
   사실상 아무나 회사 메일함으로 메일을 보낼 수 있었다(점검 중 빈 메일 1통이 실제 발송됨).
   이제 Origin 이 없으면 Referer 로 한 번 더 본다. 둘 다 우리 주소가 아니면 거부한다.
   브라우저는 POST 에 Origin 을 항상 붙이므로 정상 문의는 영향받지 않는다.
   Referer 확인은 혹시 모를 경우를 위한 2중 안전장치다. */
const ALLOWED = ['https://www.viren.kr', 'https://viren.kr']

/* 🔴 2026-11-18 — localhost 예외를 운영에서 뺀다.
   localhost 는 누구나 자기 컴퓨터에 띄울 수 있다. 개발용으로 넣은 예외가
   운영에도 살아 있어서, 그 사실을 아는 사람은 회사 메일함으로 아무거나
   보낼 수 있었다(10/08 에 막은 Origin 구멍과 같은 종류다).
   이제 운영(VERCEL_ENV=production)에서는 우리 주소만 받는다.

   🔴 2026-11-19 — 한 번 더 좁힌다. 어제 쓴 "운영이 아니면 허용" 은 미리보기
      배포(VERCEL_ENV=preview)까지 열어 둔다. 미리보기 주소는 기본이 공개라,
      그 주소를 아는 사람이 Origin 을 localhost 로 적으면 같은 구멍이 그대로
      남는다(환경변수가 All Environments 로 걸려 있으면 실제로 발송된다).
      이제 **내 컴퓨터에서 돌릴 때만** 허용한다 — VERCEL_ENV 가 아예 없거나
      development 일 때. 배포된 주소는 운영·미리보기 모두 우리 주소만 받는다. */
const LOCAL_DEV = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'development'
const isLocal = (u) => LOCAL_DEV && u.startsWith('http://localhost:')
const fromUs = (origin, referer) => {
  if (origin) return ALLOWED.includes(origin) || isLocal(origin)
  if (!referer) return false
  try {
    const o = new URL(referer).origin
    return ALLOWED.includes(o) || isLocal(o)
  } catch { return false }
}

/* 답장 주소로 쓸 수 있는 모양인지 본다.
   🔴 2026-11-18 — nodemailer 10.0.12 의 주소 해석기에 알려진 허점이 넷 있다
   (GHSA-8c8m-p3m8-cjg8 등). 따옴표·괄호·쉼표·세미콜론·꺾쇠가 섞인 주소가
   "보이는 것과 다른 주소" 로 읽혀, 답장이 엉뚱한 곳으로 갈 수 있다.
   버전을 올리더라도, 애초에 그런 글자를 replyTo 에 넣지 않는 게 안전하다.
   ⚠️ 모양이 이상하면 **발송을 막지 않고 replyTo 만 버린다.**
      지원서가 사라지는 것이 더 나쁘고, 주소는 본문에 그대로 남는다. */
const SAFE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const safeReplyTo = (v) => {
  const s = String(v ?? '').trim()
  return s.length <= 254 && SAFE_EMAIL.test(s) ? s : undefined
}

/* 한 칸이 너무 길면 자른다 — 메일함이 쓰레기로 차는 것을 막는다 */
const MAX_FIELD = 20000
const cut = (v) => {
  const s = String(v ?? '')
  return s.length > MAX_FIELD ? s.slice(0, MAX_FIELD) + '\n…(너무 길어 잘랐습니다)' : s
}

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* 본문 조립 — 받은 항목을 그대로 표로. 빈 값은 건너뛴다. */
function buildHtml(title, fields) {
  const rows = Object.entries(fields)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => [k, cut(v)])
    .map(([k, v]) =>
      `<tr><th align="left" style="padding:6px 14px 6px 0;color:#666;white-space:nowrap;vertical-align:top">${esc(k)}</th>` +
      `<td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join('')
  return `<div style="font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif;font-size:14px;line-height:1.7;color:#111">
    <h2 style="font-size:16px;margin:0 0 14px">${esc(title)}</h2>
    <table style="border-collapse:collapse">${rows}</table>
    <p style="margin-top:18px;font-size:12px;color:#999">viren.kr 문의 폼에서 자동 발송되었습니다.</p>
  </div>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!fromUs(req.headers.origin, req.headers.referer)) return res.status(403).json({ error: 'forbidden' })
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    /* 아직 설정 전 — 화면은 메일 앱으로 넘어가도록 실패를 알린다 */
    return res.status(503).json({ error: 'mail not configured' })
  }

  try {
    const { subject, title, fields = {}, replyTo, attachments = [], _hp } = req.body || {}

    /* 허니팟 — 사람은 비워 두는 칸. 채워져 있으면 봇이므로 조용히 성공 처리. */
    if (_hp) return res.status(200).json({ ok: true })

    /* 알맹이가 없으면 보내지 않는다. 빈 메일이 메일함에 쌓이는 것을 막는다.
       (점검 중 빈 본문으로 요청했더니 제목만 있는 메일이 실제로 발송됐다) */
    const hasContent = Object.values(fields || {}).some((v) => String(v ?? '').trim() !== '')
    if (!hasContent) return res.status(400).json({ error: 'empty' })

    const files = (Array.isArray(attachments) ? attachments : [])
      .filter((a) => a?.name && a?.content)
      .slice(0, 5)
      .map((a) => ({ filename: a.name, content: Buffer.from(a.content, 'base64') }))

    const port = Number(SMTP_PORT)
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,          // 465=SSL, 587=STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })

    await transporter.sendMail({
      from: `"VIREN 홈페이지" <${SMTP_USER}>`,   // 발신자는 반드시 인증된 계정이어야 한다
      to: MAIL_TO || SMTP_USER,
      replyTo: safeReplyTo(replyTo),             // 답장하면 문의자에게 바로 가도록(모양이 이상하면 뺀다)
      subject: subject || 'VIREN 홈페이지 문의',
      html: buildHtml(title || subject || '문의', fields),
      attachments: files,
    })

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[send] 실패:', e?.message)
    return res.status(500).json({ error: 'send failed' })
  }
}
