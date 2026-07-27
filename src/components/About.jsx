import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

export default function About() {
  const sectionRef = useRef(null)
  const stmtRef = useRef(null)
  const bodyRef = useRef(null)

  useEffect(() => {
    const about = sectionRef.current
    const stmt = stmtRef.current
    const body = bodyRef.current
    if (!about || !stmt) return
    const lines = stmt.querySelectorAll('.line i')

    /* 본문 폭을 1행 글자 폭에 맞춘다 */
    const syncBodyWidth = () => {
      if (!body || !lines.length || innerWidth <= 760) return
      const range = document.createRange()
      range.selectNodeContents(lines[0])
      const w = Math.round(range.getBoundingClientRect().width)
      if (w > 240) body.style.setProperty('--body-w', w + 'px')
    }
    addEventListener('resize', syncBodyWidth)
    if (document.fonts?.ready) document.fonts.ready.then(syncBodyWidth)
    syncBodyWidth()

    /* 문장 흰색 채움 (왼쪽→오른쪽, 줄 단위 순차).
       풀페이지 스크롤 대응 — 스크롤 위치가 아니라 "화면 진입 시" 타임 애니메이션으로 재생.
       나갔다 다시 들어오면 재생됨. */
    const setFill = (p) => {
      lines.forEach((line, i) => {
        const q = Math.min(1, Math.max(0, p * lines.length - i))
        line.style.setProperty('--p', (q * 100).toFixed(1) + '%')
      })
    }
    setFill(0)
    let raf = 0
    let playing = false
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const play = () => {
      if (playing) return
      playing = true
      const dur = 1200
      let start = 0
      const step = (ts) => {
        if (!start) start = ts
        const t = Math.min(1, (ts - start) / dur)
        setFill(easeInOut(t))
        if (t < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { play() }
        else { playing = false; cancelAnimationFrame(raf); setFill(0) }
      }),
      { threshold: 0.55 },
    )
    io.observe(stmt)

    return () => {
      removeEventListener('resize', syncBodyWidth)
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section className="intro" id="about" ref={sectionRef}>
      <div className="about-top">
        <motion.p
          className="about-label"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          ABOUT VIREN
        </motion.p>
        <h2 className="about-statement" ref={stmtRef}>
          <span className="line r"><i>We Turn It Into A Scene,</i></span>
          <span className="line l"><i>We Create Memorable Scenes</i></span>
        </h2>
      </div>

      <motion.hr
        className="rule"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1.3, ease: EASE, delay: 0.3 }}
      />

      <motion.div
        className="about-body"
        ref={bodyRef}
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1, ease: EASE, delay: 0.5 }}
      >
        <p className="about-h">우리는 특별하고 <em>기억에 남는</em> 순간을 담아냅니다.</p>
        <p className="about-p">
          <b>VIREN</b>은<br />
          공간과 기술, 콘텐츠를 연결하여 사람들이 경험하는 새로운 가치를 디자인합니다.<br />
          브랜드의 메시지와 공간이 전하는 이야기를 콘텐츠로 구현하여 기억되는 경험을 만듭니다.
        </p>
      </motion.div>

      <motion.hr
        className="rule rule-end"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1.3, ease: EASE, delay: 0.65 }}
      />
    </section>
  )
}
