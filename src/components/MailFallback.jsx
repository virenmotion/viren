import { useState } from 'react'

/* 서버 발송이 안 돼 메일 앱으로 넘겼을 때 띄우는 안내.

   ⚠️ 2026-11-17 — 이 화면이 왜 필요한지.
   발송 계정 비밀번호가 바뀌어 /api/send 가 계속 실패하고 있었는데,
   그동안 화면에는 "메일 앱이 열립니다" 한 줄만 떴다.
   메일 앱이 설정 안 된 컴퓨터·휴대폰에서는 아무 일도 안 일어나고,
   화면에 회사 메일 주소가 한 글자도 없어서 지원자가 거기서 멈췄다.
   ("안내문구가 나오고 이후 진행이 안 된다"는 문의로 드러났다.)

   그래서 주소를 **글자로도** 보여주고 복사할 수 있게 한다.
   복사가 막힌 환경이어도 주소가 눈에 보이므로 손으로 적을 수 있다. */
export default function MailFallback({ email }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false) // 복사가 막힌 환경 — 주소는 화면에 그대로 보인다
    }
  }

  return (
    <div className="mf-msg mf-fallback">
      <p>메일 앱이 열립니다. 내용을 확인하고 보내주세요.</p>
      <p className="mf-fallback-sub">메일 앱이 열리지 않으면 아래 주소로 직접 보내주세요.</p>
      <div className="mf-fallback-row">
        <a href={`mailto:${email}`}>{email}</a>
        <button type="button" onClick={copy}>{copied ? '복사됨' : '주소 복사'}</button>
      </div>
    </div>
  )
}
