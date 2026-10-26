import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { ErrorBox } from './ui'

/* 내 개인 메일 알림 (2026-10-26, 대표님 승인).

   내 카카오워크 메일함에 새 메일이 오면 메신저 **'내 메일 알림'** 방으로 알려 준다.
   그 방에는 **나 혼자** 들어 있다.

   ⚠️ 비밀번호는 이 화면에서 서버로 한 번 갈 뿐, **되읽어 오지 않는다.**
      넣었는지 여부만 돌려받는다. 화면은 user_mail 표를 직접 보지 못한다. */

const api = async (body) => {
  const { data } = await supabase.auth.getSession()
  const r = await fetch('/api/mymail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data?.session?.access_token || ''}`,
    },
    body: JSON.stringify(body),
  })
  const out = await r.json().catch(() => ({}))
  // 까닭을 못 받으면 **적어도 번호라도** 보여 준다. 그래야 어디가 막혔는지 가린다.
  if (!r.ok) throw new Error(out.error || `잠시 뒤 다시 해 주세요. (오류 ${r.status})`)
  return out
}

/* 메일 서버가 보내오는 말은 영어라 알아보기 어렵다. 자주 나오는 것만 사람 말로.
   ⚠️ 원문도 작게 같이 남긴다 — 처음 보는 오류일 때 그게 있어야 고친다. */
function plainError(raw) {
  const s = String(raw || '')
  if (!s) return ''
  if (/LOGIN/i.test(s)) {
    return '비밀번호가 맞지 않거나, 카카오워크에서 IMAP 이 꺼져 있어요.\n'
      + '카카오워크 → 환경설정 → POP3/IMAP 설정에서 ‘사용’ 인지 보시고, '
      + 'POP3/IMAP 비밀번호를 새로 만들어 다시 넣어 주세요.'
  }
  if (/시간 초과|연결이 끊|답하지 않/.test(s)) return '메일 서버에 닿지 못했어요. 잠시 뒤 다시 확인합니다.'
  if (/MAIL_KEY|설정/.test(s)) return '서버 설정 문제예요. 관리자에게 알려 주세요.'
  return ''
}

const when = (iso) => {
  if (!iso) return '아직 없음'
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 2) return '방금'
  if (m < 60) return `${m}분 전`
  return new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function MyMailCard() {
  const { me } = useSession()
  const [s, setS] = useState(null)        // null = 불러오는 중, false = 설정 전
  const [pass, setPass] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const out = await api({ action: 'get' })
      setS(out)
    } catch { setS(false) }   // 아직 설정 전이면 카드만 조용히 접는다
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (body, done) => {
    setBusy(true); setMsg(''); setErr('')
    try {
      const out = await api(body)
      setS(out); setPass(''); setOpen(false); setMsg(done)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  if (s === null || s === false) return null

  return (
    <section className="card stack-sm">
      <h2>내 메일 알림</h2>
      <p className="hint">
        내 카카오워크 메일함에 새 메일이 오면 메신저 <strong>‘내 메일 알림’</strong> 방으로 알려 드려요.
        <strong> 그 방은 저만 봅니다.</strong> 보낸사람과 제목만 보이고, 본문은 가져오지 않습니다.
      </p>

      {s.has ? (
        <>
          <dl className="kv">
            <dt>메일 주소</dt><dd>{s.imap_user}</dd>
            <dt>상태</dt><dd>{s.on ? '켜짐' : '꺼둠'}</dd>
            <dt>마지막 확인</dt><dd>{when(s.checked_at)}</dd>
          </dl>
          {s.last_error && (
            <ErrorBox>
              {plainError(s.last_error) || s.last_error}
              {!!plainError(s.last_error) && <span className="raw-err">{s.last_error}</span>}
            </ErrorBox>
          )}
          <div className="actions start">
            {s.on
              ? <button className="btn" disabled={busy} onClick={() => run({ action: 'off' }, '껐습니다.')}>끄기</button>
              : <button className="btn primary" disabled={busy} onClick={() => run({ action: 'on' }, '켰습니다.')}>켜기</button>}
            <button className="btn" disabled={busy} onClick={() => { setOpen(true); setMsg(''); setErr('') }}>
              비밀번호 다시 넣기
            </button>
            <button className="btn" disabled={busy}
              onClick={() => {
                if (!window.confirm('알림을 끄고 저장된 비밀번호를 지울까요?\n지난 알림과 방은 그대로 남습니다.')) return
                run({ action: 'remove' }, '지웠습니다.')
              }}>지우기</button>
          </div>
        </>
      ) : (
        <div className="actions start">
          <button className="btn primary" disabled={busy} onClick={() => { setOpen(true); setMsg(''); setErr('') }}>
            켜기
          </button>
        </div>
      )}

      {open && (
        <form className="stack-sm" onSubmit={(e) => {
          e.preventDefault()
          run({ action: 'save', pass }, '켰습니다. 1분 안에 처음 확인합니다.')
        }}>
          {/* ⚠️ 주소는 **내 것으로 고정**이다. 고를 수 있게 두면 남의 메일함을
              내 방으로 끌어올 수 있다(서버에서도 한 번 더 막는다). */}
          <div className="field"><span>내 메일 주소</span>
            <p className="sd-val">{me.email}</p>
          </div>
          <label className="field"><span>카카오워크 POP3/IMAP 비밀번호</span>
            <input type="password" autoComplete="off" value={pass}
              onChange={(e) => setPass(e.target.value)} placeholder="카카오워크에서 따로 만든 비밀번호" />
          </label>

          <ol className="hint howto">
            <li>카카오워크 → <strong>환경설정</strong> → <strong>POP3/IMAP 설정</strong> 에서 IMAP 을 켭니다.</li>
            <li><strong>POP3/IMAP 비밀번호 변경</strong> 에서 비밀번호를 만듭니다.</li>
            <li>그 비밀번호를 위에 넣고 저장합니다.</li>
          </ol>

          <p className="hint warn">
            ⚠️ 카카오워크 <strong>로그인 비밀번호가 아니라</strong> 연동 전용 비밀번호입니다.
            이 비밀번호는 암호로 바꿔 보관하고, 푸는 열쇠는 따로 둡니다.
            카카오워크에서 언제든 끊을 수 있습니다.
          </p>

          <div className="actions start">
            <button className="btn primary" disabled={busy || !pass}>{busy ? '저장 중…' : '저장'}</button>
            <button type="button" className="btn" disabled={busy}
              onClick={() => { setOpen(false); setPass(''); setErr('') }}>취소</button>
          </div>
        </form>
      )}

      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}
    </section>
  )
}
