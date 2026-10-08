import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import SecStatement from './SecStatement'

/* WHAT WE DO와 푸터 사이의 대문구 + CTA 섹션 (중앙 정렬) */
const SRC = '/assets/outro-bg.mp4'

export default function Outro() {
  const vidRef = useRef(null)
  /* 화면 근처에 왔을 때 비로소 받아서 재생한다. 벗어나면 멈춘다. */
  useEffect(() => {
    const el = vidRef.current
    if (!el) return
    const start = () => {
      if (!el.src) el.src = SRC
      el.play?.().catch(() => {})       // 자동재생 차단 시 조용히 무시
    }
    if (typeof IntersectionObserver !== 'function') { start(); return }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) start(); else el.pause?.() },
      { rootMargin: '300px' },          // 조금 미리 받아 스크롤 도달 시 끊기지 않게
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section id="outro">
      {/* ⚠️ autoPlay 를 쓰면 preload 를 metadata 로 둬도 브라우저가 바로 받아 재생한다.
          화면 맨 아래 영상인데 페이지를 열자마자 2.1MB 를 쓰는 셈이라,
          화면에 들어올 때 src 를 붙이고 재생한다(WorkDetail 의 LazyClip 과 같은 방식). */}
      <video
        ref={vidRef}
        className="outro-bg"
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      />
      <div className="outro-veil" aria-hidden="true" />
      <SecStatement>Beyond Motion, Beyond Experience</SecStatement>
      <div className="outro-cta">
        <Link className="btn" to="/contact">
          프로젝트 문의
          <span className="btn-arrow" aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  )
}
