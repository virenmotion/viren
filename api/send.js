import nodemailer from 'nodemailer'

/* 문의·지원 폼 → 회사 메일함으로 직접 발송 (Vercel 서버리스 함수)

   외부 폼 서비스(Formspree 등) 없이, 회사 메일 계정(카카오워크)의 SMTP로 직접 보낸다.
   새로 가입할 서비스가 없고 월 건수 제한도 없다.

   필요한 환경변수 (Vercel → Settings → Environment Variables):
     SMTP_HOST  카카오워크 메일의 SMTP 서버 주소
     SMTP_PORT  465(SSL) 또는 587(STARTTLS)
     SMTP_USER  virenmotion@viren.kr (인증·발신 계정. 그룹메일 viren@ 로는 SMTP 인증 불가)
     SMTP_PASS  메일 계정 비밀번호(또는 앱 비밀번호)
     MAIL_TO    받는 주소. 없으면 SMTP_USER 로 보낸다.

   ⚠️ SMTP_PASS 는 절대 코드나 저장소에 넣지 말 것. Vercel 설정에만 둔다. */

const {
  SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS, MAIL_TO,
} = process.env

/* 우리 사이트에서 온 요청만 받는다 — 열린 발송 endpoint 로 악용되는 것을 막는다 */
const ALLOWED = ['https://www.viren.kr', 'https://viren.kr']
const isAllowed = (origin) =>
  !origin || ALLOWED.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* 본문 조립 — 받은 항목을 그대로 표로. 빈 값은 건너뛴다. */
function buildHtml(title, fields) {
  const rows = Object.entries(fields)
    .filter(([, v]) => v != null && String(v).trim() !== '')
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
  if (!isAllowed(req.headers.origin)) return res.status(403).json({ error: 'forbidden' })
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    /* 아직 설정 전 — 화면은 메일 앱으로 넘어가도록 실패를 알린다 */
    return res.status(503).json({ error: 'mail not configured' })
  }

  try {
    const { subject, title, fields = {}, replyTo, attachments = [], _hp } = req.body || {}

    /* 허니팟 — 사람은 비워 두는 칸. 채워져 있으면 봇이므로 조용히 성공 처리. */
    if (_hp) return res.status(200).json({ ok: true })

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
      replyTo: replyTo || undefined,             // 답장하면 문의자에게 바로 가도록
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
