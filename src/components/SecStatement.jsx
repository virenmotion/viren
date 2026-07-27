import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

/* 섹션 대형 문구 마스크 리빌 — 뷰포트 진입 시 줄이 아래에서 올라온다.
   관찰(useInView)은 이동하지 않는 바깥 <h2>에 걸고, 안쪽 <i>만 슬라이드시킨다.
   (whileInView을 이동 대상 요소에 직접 걸면 트리거가 불안정하다.)
   children으로 <em> 강조가 포함된 마크업을 받는다. */
export default function SecStatement({ children }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  return (
    <h2 className="sec-statement" ref={ref}>
      <span className="line">
        <motion.i
          initial={{ y: '105%' }}
          animate={inView ? { y: 0 } : { y: '105%' }}
          transition={{ duration: 1.15, ease: EASE }}
        >
          {children}
        </motion.i>
      </span>
    </h2>
  )
}
