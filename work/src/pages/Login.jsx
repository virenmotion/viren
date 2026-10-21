import { useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { ErrorBox } from '../components/ui'

/* 회사 메일이 전부 @viren.kr 이라 **앞부분만** 치면 되게 했다(지은님 2026-10-21).
   @ 를 넣어 통째로 적어도 그대로 쓴다 — 나중에 다른 도메인 계정이 생겨도 막히지 않게. */
const DOMAIN = '@viren.kr'
const toEmail = (v) => {
  const id = String(v || '').trim()
  return id.includes('@') ? id : (id ? id + DOMAIN : '')
}

export default function Login() {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    const email = toEmail(userId)
    if (!email) return setErr('아이디를 넣어 주세요.')
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(errText(error))
  }

  return (
    <div className="center-screen login-bg">
      <form className="card narrow login" onSubmit={submit}>
        <h1 className="brand-title">VIREN <span>WORK</span></h1>
        <p className="muted">바이렌 사내 전자결재 · 근태관리</p>
        <label className="field">
          <span>아이디</span>
          <span className="id-input">
            <input
              id="login-email" autoComplete="username" required
              value={userId} onChange={(e) => setUserId(e.target.value)}
              placeholder="name" aria-describedby="login-domain"
            />
            <i id="login-domain">{DOMAIN}</i>
          </span>
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn primary block" disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
        <p className="hint">회사 메일 앞부분만 넣으면 됩니다. 계정이 없거나 비밀번호를 잊었다면 관리자에게 요청해 주세요.</p>
      </form>
    </div>
  )
}
