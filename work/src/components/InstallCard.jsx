import { useEffect, useState } from 'react'
import { canInstall, install, isInstalled, isMac, isWindows, macNeedsSafari, onInstallChange, platform } from '../lib/install'

/* '내 정보' 안의 앱 설치 칸.
   크롬·엣지는 단추 하나로 끝나고, 나머지는 어디를 누르는지 글로 안내한다.

   ⚠️ **맥은 다르다.** 크롬·엣지로 설치하면 그 브라우저에 묶여서, 크롬을 Cmd+Q 로
      끄면 설치한 앱도 같이 꺼진다(지은님 2026-11-03 확인). 사파리로 설치해야
      사파리와 별개 프로그램으로 떠서 사파리를 꺼도 안 꺼진다.
      그래서 맥 + 크롬/엣지에서는 **설치 단추를 안 띄우고** 사파리로 보낸다 —
      눌러 봐야 방금 겪은 그 앱이 또 만들어질 뿐이다.

   ⚠️ 설치만으로는 '컴퓨터 켜면 저절로 뜨기' 가 안 된다. 그건 브라우저·운영체제
      설정이라 우리가 못 켜 준다 — 어디를 누르는지 글로 적어 준다. */

const HOWTO = {
  ios: '사파리 아래쪽 공유 버튼 → 「홈 화면에 추가」',
  android: '크롬 오른쪽 위 ⋮ → 「앱 설치」 또는 「홈 화면에 추가」',
  safari: 'Safari 메뉴 막대의 파일(File) → 「Dock에 추가」',
  chrome: '주소창 오른쪽 끝의 설치 아이콘(⊕) → 「설치」',
  edge: '주소창 오른쪽 끝의 설치 아이콘(⊕) → 「설치」',
  other: '브라우저 메뉴에서 「앱 설치」 또는 「홈 화면에 추가」',
}

/* 설치한 뒤, 컴퓨터를 켤 때 저절로 뜨게 하는 법 */
function AutoStart() {
  if (isMac()) {
    return (
      <p className="hint">
        <strong>켤 때마다 저절로 뜨게 하려면</strong> — Dock 의 바이렌워크 아이콘을
        마우스 오른쪽으로 누르고 <strong>옵션 → 「로그인 시 열기」</strong> 를 켜 주세요.
      </p>
    )
  }
  if (isWindows()) {
    const where = platform() === 'edge' ? 'edge://apps' : 'chrome://apps'
    return (
      <p className="hint">
        <strong>켤 때마다 저절로 뜨게 하려면</strong> — 브라우저 주소창에{' '}
        <code>{where}</code> 를 치고, <strong>VIREN WORK</strong> 를 마우스 오른쪽으로 누른 뒤
        「시스템 시작 시 열기」(엣지는 「장치 시작 시 시작」)를 켜 주세요.
      </p>
    )
  }
  return null
}

export default function InstallCard() {
  const [ready, setReady] = useState(canInstall())
  const [done, setDone] = useState(isInstalled())
  const [msg, setMsg] = useState('')

  useEffect(() => onInstallChange(() => { setReady(canInstall()); setDone(isInstalled()) }), [])

  if (done) {
    return (
      <section className="card stack-sm">
        <h2>앱으로 쓰기</h2>
        <p className="hint">지금 <strong>앱 창으로 열려 있어요.</strong> 작업표시줄·독에 고정해 두면 바로 열립니다.</p>
        <AutoStart />
      </section>
    )
  }

  /* 맥인데 사파리가 아닐 때 — 설치 단추 대신 사파리로 보낸다 */
  if (macNeedsSafari()) {
    return (
      <section className="card stack-sm">
        <h2>앱으로 쓰기</h2>
        <p className="hint warn">
          <strong>맥에서는 Safari 로 설치해 주세요.</strong> 크롬·엣지로 설치하면 그 브라우저에
          묶여서, 브라우저를 종료할 때 바이렌워크도 <strong>같이 꺼집니다.</strong>
        </p>
        <p className="hint">
          이 주소를 <strong>Safari 로 연 다음</strong>, 메뉴 막대의 파일(File) → <strong>「Dock에 추가」</strong>.
          그러면 사파리와 별개 창으로 떠서, 사파리를 꺼도 바이렌워크는 그대로 있습니다.
        </p>
        <p className="hint">
          ⚠️ 「Dock에 추가」 는 <strong>macOS 소노마(14) 이상</strong>에만 있어요. 그 아래 버전이면
          크롬을 <strong>Cmd+Q 대신 Cmd+W</strong>(창만 닫기)로 닫아 주세요.
        </p>
      </section>
    )
  }

  return (
    <section className="card stack-sm">
      <h2>앱으로 쓰기</h2>
      <p className="hint">
        카카오워크처럼 <strong>주소창 없는 창</strong>으로 띄울 수 있어요. 브라우저를 닫아도
        <strong> 바이렌워크는 안 꺼집니다.</strong> 바탕화면·작업표시줄에 아이콘이 생기고,
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
      {msg && <><p className="ok">{msg}</p><AutoStart /></>}
    </section>
  )
}
