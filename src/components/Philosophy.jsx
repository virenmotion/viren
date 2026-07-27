import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import SecStatement from './SecStatement'
import ghostPaths from '../ghostPaths.json'

const EASE = [0.16, 1, 0.3, 1]

/* VIREN 의미 — 강조 글자가 VI·R·EN = VIREN, VIctory는 헤드라인과 연결되는 마무리 */
const MEANING = [
  { n: '01', em: 'VI', rest: 'sion', ghost: 'VI', l1: '아이디어의 발견', l2: '공간이 지닌 스토리로 가능성을 찾다.' },
  { n: '02', em: 'R', rest: 'ender', ghost: 'R', l1: '정교한 구현', l2: '기술로 비전을 형상화 하다.' },
  { n: '03', em: 'EN', rest: 'vision', ghost: 'EN', l1: '새로운 가능성', l2: '기억될 장면을 구현한다.' },
  { n: '04', em: 'VI', rest: 'ctory', ghost: 'VI', l1: '공간의 가치 증명', l2: '결과로 신뢰를 남긴다.' },
]

/* 컨테이너: 컬럼을 순차(stagger)로 등장시킨다 */
const grid = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }
const col = {
  hidden: { opacity: 0, y: 44 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
}

/* Colonnade 컨베이어: 호버 시 패널이 아래(101%)→제자리(0), 벗어나면 위(-101%)로 빠져나간 뒤
   화면 밖에서 다시 아래로 순간 복귀 → 항상 위로만 흐르는 컨베이어 */
const PHASE_Y = { bottom: '101%', in: '0%', out: '-101%' }

function MeaningColumn({ m }) {
  const [phase, setPhase] = useState('bottom')
  const ref = useRef(null)

  /* 커서 위치를 CSS 변수로 (re-render 없이) → 외곽선 스포트라이트가 커서를 따라온다.
     glow 요소는 컬럼보다 16px 바깥에서 시작하므로 +16 보정 */
  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left - 10}px`)
    el.style.setProperty('--my', `${e.clientY - r.top + 16}px`)
  }

  return (
    <motion.div
      className="meaning-col"
      ref={ref}
      variants={col}
      onMouseEnter={() => setPhase('in')}
      onMouseLeave={() => setPhase('out')}
      onMouseMove={onMove}
    >
      <span className="aura" aria-hidden="true" />
      <span className="glow" aria-hidden="true" />
      <div className="mp-wrap" aria-hidden="true">
        <motion.div
          className="mp"
          initial={false}
          animate={{ y: PHASE_Y[phase] }}
          transition={phase === 'bottom' ? { duration: 0 } : { duration: phase === 'in' ? 0.7 : 0.6, ease: EASE }}
          onAnimationComplete={() => { if (phase === 'out') setPhase('bottom') }}
        />
      </div>

      <svg className="ghost" viewBox="0 0 380 180" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <g transform={`translate(${(188 - ghostPaths[m.ghost].w / 2).toFixed(1)},0)`}>
          <path className="g-base" d={ghostPaths[m.ghost].d} />
          <path className="g-trace" pathLength="100" d={ghostPaths[m.ghost].d} />
        </g>
      </svg>

      <span className="mn">{m.n}</span>
      <h3 className="mw"><em>{m.em}</em>{m.rest}</h3>
      <p className="mt1">{m.l1}</p>
      <p className="mt2">{m.l2}</p>
    </motion.div>
  )
}

export default function Philosophy() {
  return (
    <section id="philosophy">
      <p className="sec-label">PHILOSOPHY</p>

      <SecStatement>
        From <em>VI</em>SION to <em>VI</em>CTORY
      </SecStatement>

      {/* VIREN 의미 4분할 — Colonnade 호버 컨베이어 */}
      <motion.div
        className="meaning"
        variants={grid}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
      >
        {MEANING.map((m) => (
          <MeaningColumn key={m.n} m={m} />
        ))}
      </motion.div>
    </section>
  )
}
