/* 문의·지원 폼 전송 — 회사 메일함(카카오워크 SMTP)으로 직접 보낸다.
   서버 쪽은 api/send.js. 외부 폼 서비스를 쓰지 않으므로 월 건수 제한이 없다.

   ⚠️ Vercel 서버리스 함수는 요청 본문이 4.5MB를 넘으면 거부한다.
   첨부가 그보다 크면 보내봐야 실패하므로, 그때는 메일 앱으로 넘긴다.
   ⚠️ 어떤 이유로든 실패하면 반드시 메일 앱으로 넘긴다 — 문의가 조용히 사라지는 길을
   만들지 않는다. 이 사이트는 문의 하나가 곧 일감이다. */

export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024   // base64로 약 1.37배 커지는 것까지 감안

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = reject
    r.readAsDataURL(file)
  })

/** 첨부 합계가 서버로 보낼 수 있는 크기인지 */
export function fitsUpload(files) {
  const list = [].concat(files || []).filter(Boolean)
  return list.reduce((n, f) => n + (f.size || 0), 0) <= MAX_UPLOAD_BYTES
}

/**
 * 메일 발송 시도. 성공하면 true, 실패하면 false(= 호출한 쪽에서 메일 앱으로 넘길 것).
 * @param {{subject:string, title:string, fields:object, replyTo?:string, files?:File[]}} p
 */
export async function sendMail({ subject, title, fields, replyTo, files = [] }) {
  const list = [].concat(files).filter(Boolean)
  if (!fitsUpload(list)) return false
  try {
    const attachments = await Promise.all(
      list.map(async (f) => ({ name: f.name, content: await toBase64(f) })),
    )
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, title, fields, replyTo, attachments, _hp: '' }),
    })
    return res.ok
  } catch {
    return false
  }
}
