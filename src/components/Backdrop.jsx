import { useEffect, useRef } from 'react'
import Scene3D from './Scene3D'

/* 3D 오브젝트 고정 배경 레이어.
   ABOUT 섹션이 화면 60% 지점까지 올라오면 1 → 0.2로 어두워진다. */
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
      <Scene3D />
    </div>
  )
}
