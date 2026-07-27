import { motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

/* as는 문자열 태그('a','div') 또는 컴포넌트(예: react-router Link) 모두 지원.
   컴포넌트는 motion.create로 한 번만 감싸 캐시한다. */
const customCache = new WeakMap()
function resolveComp(as) {
  if (!as || typeof as === 'string') return motion[as] || motion.div
  if (!customCache.has(as)) customCache.set(as, motion.create(as))
  return customCache.get(as)
}

/* [data-reveal] 대체 — 뷰포트 진입 시 아래에서 페이드업. */
export default function Reveal({ as = 'div', className = '', delay = 0, children, ...rest }) {
  const Comp = resolveComp(as)
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 38 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 1, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  )
}
