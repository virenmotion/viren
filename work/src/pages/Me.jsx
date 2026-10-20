import { useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dot } from '../lib/dates'
import { ErrorBox } from '../components/ui'

export default function Me() {
  const { me } = useSession()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function change(e) {
    e.preventDefault()
    setMsg(''); setErr('')
    if (pw.length < 8) return setErr('비밀번호는 8자 이상으로 정해 주세요.')
    if (pw !== pw2) return setErr('두 비밀번호가 다릅니다.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return setErr(errText(error))
    setPw(''); setPw2(''); setMsg('비밀번호를 바꿨습니다.')
  }

  return (
    <div className="stack">
      <h1>내 정보</h1>
      <section className="card">
        <dl className="kv">
          <dt>이름</dt><dd>{me.name}</dd>
          <dt>이메일</dt><dd>{me.email}</dd>
          <dt>부서</dt><dd>{me.dept || '—'}</dd>
          <dt>직위</dt><dd>{me.position || '—'}</dd>
          <dt>입사일</dt><dd>{me.hire_date ? dot(me.hire_date) : '미등록'}</dd>
        </dl>
        <p className="hint">정보가 틀렸다면 관리자에게 수정을 요청해 주세요.</p>
      </section>
      <form className="card narrow-form" onSubmit={change}>
        <h2>비밀번호 변경</h2>
        <label className="field"><span>새 비밀번호 (8자 이상)</span>
          <input id="pw-new" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label className="field"><span>새 비밀번호 확인</span>
          <input id="pw-new2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <ErrorBox>{err}</ErrorBox>
        {msg && <p className="ok">{msg}</p>}
        <button className="btn primary">비밀번호 바꾸기</button>
      </form>
    </div>
  )
}
