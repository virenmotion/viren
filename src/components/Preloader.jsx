import { useEffect, useRef, useState } from 'react'

/* 프리로더: 카운터 + 커튼 리빌. 완료되면 onDone()을 호출하고 자기 자신을 언마운트. */
export default function Preloader({ onDone }) {
  const [pct, setPct] = useState(0)
  const [done, setDone] = useState(false)
  const [gone, setGone] = useState(false)
  const finishedRef = useRef(false)

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    const finish = () => {
      if (finishedRef.current) return
      finishedRef.current = true
      setDone(true)
      document.body.classList.remove('is-loading')
      document.body.classList.add('loaded')
      onDone?.()
      setTimeout(() => setGone(true), 1600)
    }

    if (reduced) {
      setPct(100)
      finish()
      return
    }

    let p = 0
    const tick = setInterval(() => {
      p += Math.random() * 9 + 3
      if (p >= 100) {
        p = 100
        clearInterval(tick)
        setPct(100)
        setTimeout(finish, 620)
      } else {
        setPct(p)
      }
    }, 130)

    return () => clearInterval(tick)
  }, [onDone])

  if (gone) return null

  return (
    <div id="loader" className={done ? 'done' : ''}>
      <div className="curtains">
        <div className="curtain" /><div className="curtain" /><div className="curtain" />
        <div className="curtain" /><div className="curtain" />
      </div>
      <div className="inner">
        <div className="mark-wrap"><img className="mark" src="/assets/viren_CI.png" alt="VIREN" /></div>
        <div className="wordmark wm"><img src="/assets/viren_wordmark.png" alt="VIREN" /></div>
        <div className="bar">
          <span style={{ transform: `scaleX(${pct / 100})`, transition: 'transform .3s cubic-bezier(.16,1,.3,1)' }} />
        </div>
        <div className="count">LOADING <b>{String(Math.floor(pct)).padStart(3, '0')}</b></div>
      </div>
    </div>
  )
}
