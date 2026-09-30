import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import SecStatement from './SecStatement'
import ghostPaths from '../ghostPaths.json'

const EASE = [0.16, 1, 0.3, 1]

/* VIREN 의미 — 강조 글자를 순서대로 이으면 V·I·R·E·N.
   ⚠️ ghost 값은 src/ghostPaths.json 의 키다. 글자를 바꾸면 scripts/genOutlines.cjs 의
   GHOSTS 배열도 함께 고치고 `node scripts/genOutlines.cjs` 를 다시 실행해야 한다. */
const MEANING = [
  { n: '01', em: 'V', rest: 'ision', ghost: 'V', l1: '아이디어의 발견', l2: '공간이 지닌 스토리로 가능성을 찾다.' },
  { n: '02', em: 'I', rest: 'magination', ghost: 'I', l1: '상상의 확장', l2: '가능성을 새로운 장면으로 그려내다.' },
  { n: '03', em: 'R', rest: 'ender', ghost: 'R', l1: '정교한 구현', l2: '기술로 비전을 형상화하다.' },
  { n: '04', em: 'E', rest: 'xperience', ghost: 'E', l1: '몰입의 경험', l2: '보는 것을 넘어 경험하다.' },
  { n: '05', em: 'N', rest: 'arrative', ghost: 'N', l1: '공간의 이야기', l2: '공간의 이야기를 기억에 남기다.' },
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

      {/* 강조 글자 V·N = VIREN의 처음과 끝. 아래 다섯 칸(V·I·R·E·N)을 감싸는 문장이다. */}
      <SecStatement>
        From <em>V</em>ISION to <em>N</em>ARRATIVE
      </SecStatement>

      {/* VIREN 의미 5분할 — Colonnade 호버 컨베이어 */}
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
