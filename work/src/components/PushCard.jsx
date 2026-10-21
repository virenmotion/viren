import { useEffect, useState } from 'react'
import { useSession } from '../lib/session'
import { currentSub, disablePush, enablePush, iosNeedsInstall, pushSupported, testPush } from '../lib/push'
import { ErrorBox } from './ui'

/* '내 정보' 안의 휴대폰 알림 칸. (지은님 2026-10-21)
   기기마다 따로 켜야 한다 — 휴대폰에서 켰다고 PC 에서 오지 않는다.
   그래서 '이 기기' 라는 말을 또렷이 쓴다. */

export default function PushCard() {
  const { userId } = useSession()
  const [on, setOn] = useState(null)      // null = 확인 중
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { currentSub().then((s) => setOn(!!s)).catch(() => setOn(false)) }, [])

  async function run(fn, done) {
    setBusy(true); setErr(''); setMsg('')
    try { await fn(); setMsg(done) } catch (e) { setErr(e.message) }
    setBusy(false)
    setOn(!!(await currentSub()))
  }

  if (!pushSupported()) {
    return (
      <section className="card">
        <h2>휴대폰 알림</h2>
        <p className="hint">이 브라우저는 알림을 지원하지 않아요. 휴대폰이나 Chrome 에서 열어 주세요.</p>
      </section>
    )
  }

  return (
    <section className="card stack-sm">
      <h2>휴대폰 알림</h2>
      <p className="hint">
        결재 차례가 오거나 내 문서가 승인·반려되면 알려 드려요.
        <strong> 기기마다 따로 켜야 해요</strong> — 휴대폰에서 켜도 PC 로는 오지 않아요.
      </p>

      {iosNeedsInstall() && (
        <p className="hint warn">
          아이폰·아이패드는 먼저 사파리 아래의 <strong>공유 → 홈 화면에 추가</strong> 로 깔고,
          그 아이콘으로 열어야 알림을 받을 수 있어요. (애플 규칙이라 어쩔 수 없어요)
        </p>
      )}

      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}

      <div className="actions start">
        {on === null ? <span className="hint">확인 중…</span>
          : on ? (
            <>
              <span className="pill on">이 기기는 켜져 있어요</span>
              <button className="btn" disabled={busy} onClick={() => run(testPush, '보냈어요. 잠시 뒤 알림이 뜰 거예요.')}>
                시험 알림 보내기
              </button>
              <button className="btn" disabled={busy} onClick={() => run(disablePush, '이 기기의 알림을 껐어요.')}>
                알림 끄기
              </button>
            </>
          ) : (
            <button className="btn primary" disabled={busy}
              onClick={() => run(() => enablePush(userId), '켰어요. 시험 알림으로 확인해 보세요.')}>
              이 기기에서 알림 켜기
            </button>
          )}
      </div>
    </section>
  )
}
