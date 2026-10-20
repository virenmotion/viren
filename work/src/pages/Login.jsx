import { useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { ErrorBox } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(errText(error))
  }

  return (
    <div className="center-screen login-bg">
      <form className="card narrow login" onSubmit={submit}>
        <h1 className="brand-title">VIREN <span>WORK</span></h1>
        <p className="muted">바이렌 사내 전자결재 · 근태관리</p>
        <label className="field">
          <span>회사 이메일</span>
          <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@viren.kr" />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn primary block" disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
        <p className="hint">계정이 없거나 비밀번호를 잊었다면 관리자에게 요청해 주세요.</p>
      </form>
    </div>
  )
}
