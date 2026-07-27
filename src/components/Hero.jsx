import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const WORDS = [
  'Memorable Scenes',
  'Meaningful Moments',
  'Powerful Stories',
  'Visual Impact',
  'Lasting Experiences',
]

const EASE = [0.16, 1, 0.3, 1]

export default function Hero({ ready }) {
  const [active, setActive] = useState(0)
  const hintRef = useRef(null)

  /* 두 번째 줄 단어 순환 */
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || WORDS.length < 2) return
    const id = setInterval(() => {
      if (document.hidden) return
      setActive((c) => (c + 1) % WORDS.length)
    }, 4600)
    return () => clearInterval(id)
  }, [])

  /* 스크롤 시작하면 인디케이터 페이드아웃 */
  useEffect(() => {
    const hint = hintRef.current
    if (!hint) return
    hint.style.transition = 'opacity .45s var(--ease)'
    let last = -1
    const onScroll = () => {
      let o = Math.max(0, 1 - scrollY / (innerHeight * 0.25))
      o = Math.round(o * 100) / 100
      if (o !== last) { hint.style.opacity = o; last = o }
    }
    addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section className="hero" id="hero">
      <p className="hero-tag">
        <span className="l1">
          <motion.i
            initial={{ y: '105%' }}
            animate={ready ? { y: 0 } : { y: '105%' }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.75 }}
          >
            We Create
          </motion.i>
        </span>
        <motion.span
          className="l2"
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.95 }}
          aria-label="Memorable Scenes"
        >
          {WORDS.map((w, wi) => (
            <span className={`word${wi === active ? ' on' : ''}`} key={w} aria-hidden="true">
              {[...w].map((c, i) => (
                <b key={i} style={{ '--i': i }}>{c === ' ' ? ' ' : c}</b>
              ))}
            </span>
          ))}
        </motion.span>
      </p>

      <div className="scroll-hint" ref={hintRef}><i />SCROLL</div>
    </section>
  )
}
