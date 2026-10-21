import { useEffect, useState } from 'react'
import { canInstall, install, isInstalled, onInstallChange, platform } from '../lib/install'

/* '내 정보' 안의 앱 설치 칸.
   크롬·엣지는 단추 하나로 끝나고, 나머지는 어디를 누르는지 글로 안내한다. */

const HOWTO = {
  ios: '사파리 아래쪽 공유 버튼 → 「홈 화면에 추가」',
  android: '크롬 오른쪽 위 ⋮ → 「앱 설치」 또는 「홈 화면에 추가」',
  safari: 'Safari 메뉴 → 파일 → 「Dock에 추가」',
  chrome: '주소창 오른쪽 끝의 설치 아이콘(⊕) → 「설치」',
  edge: '주소창 오른쪽 끝의 설치 아이콘(⊕) → 「설치」',
  other: '브라우저 메뉴에서 「앱 설치」 또는 「홈 화면에 추가」',
}

export default function InstallCard() {
  const [ready, setReady] = useState(canInstall())
  const [done, setDone] = useState(isInstalled())
  const [msg, setMsg] = useState('')

  useEffect(() => onInstallChange(() => { setReady(canInstall()); setDone(isInstalled()) }), [])

  if (done) {
    return (
      <section className="card">
        <h2>앱으로 쓰기</h2>
        <p className="hint">지금 <strong>앱 창으로 열려 있어요.</strong> 작업표시줄·독에 고정해 두면 바로 열립니다.</p>
      </section>
    )
  }

  return (
    <section className="card stack-sm">
      <h2>앱으로 쓰기</h2>
      <p className="hint">
        카카오워크처럼 <strong>주소창 없는 창</strong>으로 띄울 수 있어요. 바탕화면·작업표시줄에 아이콘이 생기고,
        안 읽은 수가 아이콘에 숫자로 뜹니다. 따로 내려받을 설치 파일은 없어요 —
        <strong> 열면 늘 최신</strong>입니다.
      </p>
      {ready ? (
        <div className="actions start">
          <button className="btn primary" onClick={async () => {
            const r = await install()
            setMsg(r === 'accepted' ? '설치했어요. 바탕화면·작업표시줄을 확인해 보세요.' : '')
          }}>앱으로 설치</button>
        </div>
      ) : (
        <p className="hint warn">{HOWTO[platform()]}</p>
      )}
      {msg && <p className="ok">{msg}</p>}
    </section>
  )
}
