import { useEffect } from 'react'

/* 홈 전용 풀페이지 스크롤 — 휠/키 한 번에 한 구역(.fp-panel)씩 이동.
   모바일(≤760px)은 비활성(자유 스크롤). active=true일 때만 동작(프리로더 종료 후). */
export default function useFullpage(active) {
  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(max-width:760px)').matches) return

    let panels = []
    let animating = false
    let raf = 0
    let cooldown = 0

    const collect = () => { panels = Array.from(document.querySelectorAll('.fp-panel')) }
    collect()

    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight
    const topOf = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY)
    const currentIndex = () => {
      const y = window.scrollY
      let best = 0, bd = Infinity
      panels.forEach((p, i) => { const d = Math.abs(topOf(p) - y); if (d < bd) { bd = d; best = i } })
      return best
    }

    const animateTo = (targetY) => {
      cancelAnimationFrame(raf)
      const startY = window.scrollY
      const diff = Math.min(Math.max(targetY, 0), maxScroll()) - startY
      if (Math.abs(diff) < 2) return
      animating = true
      const duration = 720
      let startTs = 0
      const step = (ts) => {
        if (!startTs) startTs = ts
        const t = Math.min(1, (ts - startTs) / duration)
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 // easeInOutCubic
        window.scrollTo({ top: startY + diff * e, behavior: 'auto' })
        if (t < 1) raf = requestAnimationFrame(step)
        else { animating = false; cooldown = performance.now() }
      }
      raf = requestAnimationFrame(step)
    }

    const go = (i) => {
      i = Math.max(0, Math.min(panels.length - 1, i))
      animateTo(topOf(panels[i]))
    }

    const onWheel = (e) => {
      e.preventDefault()
      if (animating || performance.now() - cooldown < 90) return
      if (Math.abs(e.deltaY) < 4) return
      go(currentIndex() + (e.deltaY > 0 ? 1 : -1))
    }
    const onKey = (e) => {
      if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); if (!animating) go(currentIndex() + 1) }
      else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!animating) go(currentIndex() - 1) }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', collect)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', collect)
    }
  }, [active])
}
