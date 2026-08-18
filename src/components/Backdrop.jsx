import { useEffect, useRef } from 'react'

/* 홈 고정 배경 레이어.
   ABOUT 섹션이 화면 60% 지점까지 올라오면 1 → 0.2로 어두워진다.

   ⚠️ 원래 내용물은 three.js 3D 로고(Scene3D)였다. 2026-08-18 APEC 레퍼런스 영상으로 교체.
   되돌리려면 아래 <video>를 지우고 `import Scene3D from './Scene3D'` + <Scene3D />로 바꾸면 된다.
   Scene3D.jsx는 지우지 않았고, 사본이 클로드/VIREN_3D로고_백업/ 에도 있다. */
export default function Backdrop() {
  const ref = useRef(null)

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
    }
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    onScroll()
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="backdrop" ref={ref}>
      <video
        className="backdrop-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/assets/hero-bg.mp4" type="video/mp4" />
      </video>
      <div className="backdrop-veil" aria-hidden="true" />
    </div>
  )
}
