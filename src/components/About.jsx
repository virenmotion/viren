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

    /* 문장: 왼쪽→오른쪽 흰색 채움 (줄 단위 순차) */
    const onScroll = () => {
      if (!lines.length) return
      const s = innerHeight * 0.75, e = innerHeight * 0.22
      let p = (s - stmt.getBoundingClientRect().top) / (s - e)
      p = Math.min(1, Math.max(0, p))
      lines.forEach((line, i) => {
        const q = Math.min(1, Math.max(0, p * lines.length - i))
        line.style.setProperty('--p', (q * 100).toFixed(1) + '%')
      })
    }
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    onScroll()
    return () => {
      removeEventListener('resize', syncBodyWidth)
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
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
