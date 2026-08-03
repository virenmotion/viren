import { useEffect, useRef, useState } from 'react'

/* 프리로더: VIREN 로고 드로잉 애니메이션(iframe) + 커튼 리빌.
   완료되면 onDone()을 호출하고 커튼이 걷히며 자기 자신을 언마운트. */
export default function Preloader({ onDone, onGone }) {
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
      // 종료 전환(줌 1.15s + 페이드) 재생 후 자기 자신을 언마운트
      setTimeout(() => { setGone(true); onGone?.() }, 1900)
    }

    /* 로고 드로잉 애니메이션 재생 시간(약 4초) 후 사이트 공개. 모션 최소화 시 즉시. */
    const t = setTimeout(finish, reduced ? 300 : 4200)
    return () => clearTimeout(t)
  }, [onDone])

  /* 번들 애니메이션의 로딩/에러 인디케이터 숨김 (same-origin) */
  const onFrameLoad = (e) => {
    try {
      const doc = e.currentTarget.contentDocument
      if (!doc) return
      const s = doc.createElement('style')
      s.textContent = '#__bundler_loading,#__bundler_err{display:none!important}'
      doc.head?.appendChild(s)
    } catch { /* cross-origin 등 무시 */ }
  }

  if (gone) return null

  return (
    <div id="loader" className={done ? 'done' : ''}>
      <div className="curtains">
        <div className="curtain" /><div className="curtain" /><div className="curtain" />
        <div className="curtain" /><div className="curtain" />
      </div>
      <div className="inner">
        <iframe
          className="loader-anim"
          src="/viren-draw-animation.html"
          title="VIREN"
          tabIndex={-1}
          aria-hidden="true"
          scrolling="no"
          onLoad={onFrameLoad}
        />
      </div>
    </div>
  )
}
