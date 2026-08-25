import { useEffect, useRef, useState } from 'react'

/* 모바일(≤760px)은 세로 화면이라 16:9 원본을 그대로 깔면 가로가 74% 잘려 구도가 사라진다.
   가운데를 9:16으로 잘라낸 별도 인코딩을 쓴다(용량도 11MB → 4.9MB로 내려간다).
   ⚠️ 재생 중에 소스를 바꾸면 영상이 처음부터 다시 시작하므로 마운트 시점에 한 번만 정한다.
   (브라우저가 <source media="…">를 신뢰성 있게 처리하지 않아 JS로 고른다) */
const pickSrc = () =>
  matchMedia('(max-width:760px)').matches ? '/assets/hero-bg-mobile.mp4' : '/assets/hero-bg.mp4'

/* 홈 고정 배경 레이어.
   ABOUT 섹션이 화면 60% 지점까지 올라오면 1 → 0.2로 어두워진다.

   ⚠️ 원래 내용물은 three.js 3D 로고(Scene3D)였다. 2026-08-18 APEC 레퍼런스 영상으로 교체.
   되돌리려면 아래 <video>를 지우고 `import Scene3D from './Scene3D'` + <Scene3D />로 바꾸면 된다.
   Scene3D.jsx는 지우지 않았고, 사본이 클로드/VIREN_3D로고_백업/ 에도 있다. */
export default function Backdrop() {
  const ref = useRef(null)
  const vidRef = useRef(null)
  const [src] = useState(pickSrc)

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
       2) 막히면 음소거로 재생해두고, 방문자가 화면과 처음 상호작용하는 순간
          (클릭·키 입력·스크롤·터치) 음소거를 푼다. 버튼 없이 켜지게 하는 방법이다. */
  useEffect(() => {
    const v = vidRef.current
    if (!v) return
    const EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll']
    let off = () => {}

    const unmute = () => {
      v.muted = false
      v.play().catch(() => {})
      off()
    }

    v.muted = false
    v.play().then(off /* 1)이 통과하면 대기할 필요가 없다 */).catch(() => {
      v.muted = true
      v.play().catch(() => {}) // 음소거 상태로는 재생돼야 한다
      EVENTS.forEach((e) => addEventListener(e, unmute, { once: true, passive: true }))
      off = () => EVENTS.forEach((e) => removeEventListener(e, unmute))
    })

    return () => off()
  }, [])

  return (
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
  )
}
