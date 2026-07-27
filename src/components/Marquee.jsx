/* CSS 애니메이션 마퀴 — 동일한 문구를 두 번 렌더해 무한 슬라이드.
   children으로 별/아웃라인 텍스트가 포함된 마크업을 받는다. */
export default function Marquee({ children, className = '' }) {
  return (
    <div className={`marquee ${className}`.trim()}>
      <p>{children}</p>
      <p aria-hidden="true">{children}</p>
    </div>
  )
}
