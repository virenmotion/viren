import { useEffect, useRef } from 'react'

/* 커스텀 커서 — mix-blend-mode difference. [data-hover] 요소 위에서 확대된다.
   [data-hover]는 동적으로 추가되므로 문서 전체에 이벤트 위임한다. */
export default function Cursor() {
  const ref = useRef(null)

  useEffect(() => {
    const cur = ref.current
    if (!cur) return
    let cx = 0, cy = 0, tx = 0, ty = 0, raf

    const move = (e) => { tx = e.clientX; ty = e.clientY }
    addEventListener('mousemove', move)

    const loop = () => {
      cx += (tx - cx) * 0.18
      cy += (ty - cy) * 0.18
      cur.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`
      raf = requestAnimationFrame(loop)
    }
    loop()

    const over = (e) => { if (e.target.closest('[data-hover]')) cur.classList.add('big') }
    const out = (e) => { if (e.target.closest('[data-hover]')) cur.classList.remove('big') }
    document.addEventListener('mouseover', over)
    document.addEventListener('mouseout', out)

    return () => {
      removeEventListener('mousemove', move)
      document.removeEventListener('mouseover', over)
      document.removeEventListener('mouseout', out)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <div id="cursor" ref={ref} />
}
