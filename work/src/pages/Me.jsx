import { useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { dot } from '../lib/dates'
import { ErrorBox } from '../components/ui'
import PushCard from '../components/PushCard'
import InstallCard from '../components/InstallCard'
import MailLinkCard from '../components/MailLinkCard'

/* 내 정보 — 왼쪽 프로필·비밀번호, 오른쪽 앱 설치·알림. (시안 14)
   ⚠️ 보이는 값은 모두 관리자가 정한다. 여기서 고치지 못한다(기존 그대로). */

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
      <header className="page-head">
        <div>
          <h1>내 정보</h1>
          <p className="eyebrow">프로필과 사용 환경을 확인하세요.</p>
        </div>
      </header>

      <div className="me-2col">
        <div className="stack-md">
          <section className="card stack-sm">
            <h2>기본 정보</h2>
            <div className="me-head">
              <span className="me-ava" aria-hidden="true">{(me.name || me.email).slice(0, 1)}</span>
              <dl className="kv">
                <dt>이름</dt><dd>{me.name}</dd>
                <dt>이메일</dt><dd>{me.email}</dd>
                <dt>부서</dt><dd>{me.dept || '—'}</dd>
                <dt>직급</dt><dd>{me.position || '—'}</dd>
                <dt>직책</dt><dd>{me.duty || '—'}</dd>
                <dt>입사일</dt><dd className="tnum">{me.hire_date ? dot(me.hire_date) : '미등록'}</dd>
              </dl>
            </div>
            <p className="hint">정보가 틀렸다면 관리자에게 수정을 요청해 주세요.</p>
          </section>

          <form className="card stack-sm" onSubmit={change}>
            <h2>비밀번호 변경</h2>
            <label className="field"><span>새 비밀번호 (8자 이상)</span>
              <input id="pw-new" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            <label className="field"><span>새 비밀번호 확인</span>
              <input id="pw-new2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
            <ErrorBox>{err}</ErrorBox>
            {msg && <p className="ok">{msg}</p>}
            <div className="actions start">
              <button className="btn primary">비밀번호 바꾸기</button>
            </div>
          </form>
        </div>

        <div className="stack-md">
          <InstallCard />
          <PushCard />
          <MailLinkCard />
          <div className="actions start">
            <button className="btn" onClick={() => supabase.auth.signOut()}>로그아웃</button>
          </div>
        </div>
      </div>
    </div>
  )
}
