import { useCallback, useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { ErrorBox } from './ui'

/* 메일 알림을 **카카오워크 앱**으로 열기. (지은님 2026-10-26)

   메신저 '메일' 방 카드의 '자세히 읽기' 는 기본으로 웹 메일함을 연다.
   휴대폰에서는 브라우저가 떠서 불편하다. 카카오워크 **앱**으로 바로 들어가려면
   `https://kakaowork.com/archives/<코드>` 주소가 필요한데, 이 코드는
   **그 사람의 '카카오워크 메일' 대화방**을 가리킨다 — 사람마다 다르다.
   그래서 공용 설정이 아니라 각자 한 번 넣는다.

   ⚠️ 안 넣어도 된다. 그러면 전처럼 웹 메일함으로 간다. */

const OK_PREFIX = 'https://kakaowork.com/archives/'

/* 메시지까지 가리키는 긴 주소(…/코드/메시지번호)를 받아도 대화방까지만 남긴다.
   메시지 번호가 붙어 있으면 **그때 그 메일**로만 가서, 다음 메일에는 안 맞는다. */
export function tidyMailLink(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (!s.startsWith(OK_PREFIX)) return null          // null = 잘못된 주소
  const rest = s.slice(OK_PREFIX.length).split(/[?#]/)[0]
  const code = rest.split('/').filter(Boolean)[0]
  return code ? OK_PREFIX + code : null
}

export default function MailLinkCard() {
  const { userId } = useSession()
  const [url, setUrl] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_prefs').select('mail_app_url').eq('user_id', userId).maybeSingle()
    if (error) return   // 아직 SQL 전 — 카드만 비어 있게 둔다
    setUrl(data?.mail_app_url || '')
    setSaved(data?.mail_app_url || '')
  }, [userId])

  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    setMsg(''); setErr('')
    const clean = url.trim() === '' ? '' : tidyMailLink(url)
    if (clean === null) {
      return setErr(`${OK_PREFIX} 로 시작하는 주소여야 해요. 아래 방법대로 복사해 주세요.`)
    }
    setBusy(true)
    const { error } = await supabase.from('user_prefs')
      .upsert({ user_id: userId, mail_app_url: clean, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) return setErr(errText(error))
    setUrl(clean); setSaved(clean)
    setMsg(clean ? '저장했습니다. 이제 ‘자세히 읽기’ 가 카카오워크 앱으로 열려요.' : '지웠습니다. 웹 메일함으로 열려요.')
  }

  return (
    <form className="card stack-sm" onSubmit={save}>
      <h2>메일 알림을 앱으로 열기</h2>
      <p className="hint">
        메신저 <strong>메일</strong> 방의 ‘자세히 읽기’ 를 눌렀을 때
        카카오워크 <strong>앱</strong>으로 바로 들어가게 합니다. 안 넣으면 웹 메일함으로 열려요.
      </p>

      <label className="field"><span>내 카카오워크 메일 대화방 주소</span>
        <input
          type="url" inputMode="url" placeholder={`${OK_PREFIX}…`}
          value={url} onChange={(e) => setUrl(e.target.value)}
        />
      </label>

      <ol className="hint howto">
        <li>휴대폰 <strong>카카오워크</strong> 앱 → <strong>카카오워크 메일</strong> 대화방을 엽니다.</li>
        <li>메일 카드를 <strong>길게 눌러</strong> <strong>링크 복사</strong>(또는 공유)를 고릅니다.</li>
        <li>복사한 주소를 위 칸에 붙여 넣고 저장합니다.</li>
      </ol>

      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}

      <div className="actions start">
        <button className="btn primary" disabled={busy || url.trim() === saved}>
          {busy ? '저장 중…' : '저장'}
        </button>
        {saved && (
          <button type="button" className="btn" disabled={busy}
            onClick={() => { setUrl(''); setMsg(''); setErr('') }}>지우기</button>
        )}
      </div>
    </form>
  )
}
