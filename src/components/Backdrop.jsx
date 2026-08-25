import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/* 모바일(≤760px)은 세로 화면이라 16:9 원본을 그대로 깔면 가로가 74% 잘려 구도가 사라진다.
   가운데를 9:16으로 잘라낸 별도 인코딩을 쓴다(용량도 11MB → 4.9MB로 내려간다).
   ⚠️ 재생 중에 소스를 바꾸면 영상이 처음부터 다시 시작하므로 마운트 시점에 한 번만 정한다.
   (브라우저가 <source media="…">를 신뢰성 있게 처리하지 않아 JS로 고른다) */
const pickSrc = () =>
  matchMedia('(max-width:760px)').matches ? '/assets/hero-bg-mobile.mp4' : '/assets/hero-bg.mp4'

/* 첫 상호작용으로 소리를 켤 때 감시할 이벤트 */
const GESTURES = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll']

function SpeakerIcon({ muted }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4z" />
      {muted
        ? <><path d="M16.5 9.5l4 5" /><path d="M20.5 9.5l-4 5" /></>
        : <><path d="M15.8 9.2a4 4 0 0 1 0 5.6" /><path d="M18.3 6.8a7.5 7.5 0 0 1 0 10.4" /></>}
    </svg>
  )
}

/* 홈 고정 배경 레이어.
   ABOUT 섹션이 화면 60% 지점까지 올라오면 1 → 0.2로 어두워진다.

   ⚠️ 원래 내용물은 three.js 3D 로고(Scene3D)였다. 2026-08-18 APEC 레퍼런스 영상으로 교체.
   되돌리려면 아래 <video>를 지우고 `import Scene3D from './Scene3D'` + <Scene3D />로 바꾸면 된다.
   Scene3D.jsx는 지우지 않았고, 사본이 클로드/VIREN_3D로고_백업/ 에도 있다. */
export default function Backdrop() {
  const ref = useRef(null)
  const vidRef = useRef(null)
  const btnRef = useRef(null)
  const [src] = useState(pickSrc)
  const [muted, setMuted] = useState(true)
  /* 버튼을 한 번이라도 누르면 사용자의 선택이 이긴다 —
     그 뒤로는 첫 상호작용 자동 해제가 끼어들지 않는다. */
  const userChose = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const about = document.getElementById('about')
    if (!about) return

    const onScroll = () => {
      const r = about.getBoundingClientRect()
      let d = (innerHeight * 0.6 - r.top) / (innerHeight * 0.6)
      d = Math.min(1, Math.max(0, d))
      let op = 1 - d * 0.8 // hero 1 → about/philosophy 0.2

      // WHAT WE DO부터는 홈 백드롭을 완전히 숨긴다 (0으로 페이드)
      const wwd = document.getElementById('whatwedo')
      if (wwd) {
        const wr = wwd.getBoundingClientRect()
        const fade = Math.min(1, Math.max(0, (innerHeight - wr.top) / (innerHeight * 0.5)))
        op *= (1 - fade)
      }
      el.style.opacity = op.toFixed(3)
      /* 화면에서 사라진 배경의 소리만 남아 있으면 이상하다 → 볼륨을 불투명도에 맞춘다.
         WHAT WE DO 이후에는 op가 0이므로 자연히 무음이 된다. */
      const v = vidRef.current
      if (v) v.volume = Math.min(1, Math.max(0, op))
      /* 소리가 없는 구간에서는 버튼도 숨긴다(있어도 할 일이 없다) */
      const b = btnRef.current
      if (b) {
        b.style.opacity = op < 0.05 ? '0' : '1'
        b.style.pointerEvents = op < 0.05 ? 'none' : 'auto'
      }
    }
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    onScroll()
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
    }
  }, [])

  /* 소리 — 브라우저는 소리 있는 자동재생을 차단한다(설정이 아니라 하드 제한이라
     무시하면 재생 자체가 안 된다). 그래서 두 단계로 간다.
       1) 소리를 켠 채로 재생을 시도한다. 재방문자처럼 이 사이트에 대한 미디어
          engagement가 쌓여 있으면 그대로 통과한다.
       2) 막히면 음소거로 재생해두고, 첫 상호작용에 음소거를 푼다.
     버튼을 이미 눌렀다면(userChose) 2)는 건너뛴다. */
  useEffect(() => {
    const v = vidRef.current
    if (!v) return
    let off = () => {}

    const unmute = () => {
      if (userChose.current) { off(); return }
      v.muted = false
      setMuted(false)
      v.play().catch(() => {})
      off()
    }

    v.muted = false
    v.play()
      .then(() => setMuted(false))
      .catch(() => {
        v.muted = true
        setMuted(true)
        v.play().catch(() => {}) // 음소거 상태로는 재생돼야 한다
        GESTURES.forEach((e) => addEventListener(e, unmute, { once: true, passive: true }))
        off = () => GESTURES.forEach((e) => removeEventListener(e, unmute))
      })

    return () => off()
  }, [])

  const toggle = () => {
    const v = vidRef.current
    if (!v) return
    userChose.current = true
    const next = !v.muted
    v.muted = next
    setMuted(next)
    if (!next) v.play().catch(() => {}) // 소리를 켜는 김에 멈춰 있으면 재생
  }

  return (
    <>
      <div className="backdrop" ref={ref}>
        {/* muted 속성은 유지 — 자동재생 허용 조건이다. 해제는 위 훅이 담당한다. */}
        <video
          ref={vidRef}
          className="backdrop-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src={src} type="video/mp4" />
        </video>
        <div className="backdrop-veil" aria-hidden="true" />
      </div>
      {/* ⚠️ body로 포털한다. .backdrop은 z-index:0이라 그 안에 두면 z-index:1인
          섹션에 가려 눌리지 않는다(main이 z-index:2로 자체 stacking context를 만든다). */}
      {createPortal(
        <button
          ref={btnRef}
          type="button"
          className="sound-toggle"
          onClick={toggle}
          aria-pressed={!muted}
          aria-label={muted ? '배경 영상 소리 켜기' : '배경 영상 소리 끄기'}
          title={muted ? '소리 켜기' : '소리 끄기'}
        >
          <SpeakerIcon muted={muted} />
        </button>,
        document.body,
      )}
    </>
  )
}
