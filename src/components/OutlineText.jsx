import outlinePaths from '../outlinePaths.json'

/* 아웃라인(외곽선) 텍스트 — Montserrat 글리프를 벡터 패스로 변환해 stroke.
   브라우저는 <text>의 stroke-linejoin을 무시하므로, 패스로 그려야 모서리(bevel)가 적용된다.
   패스 데이터는 scripts/genOutlines.cjs 로 생성 (단어 바꾸면 재실행). */
const VB_H = 100
const STROKE = 2.6

export default function OutlineText({ children, stroke = 'rgba(244,242,238,.62)' }) {
  const word = typeof children === 'string' ? children : ''
  const data = outlinePaths[word]

  // 패스가 없는 새 단어는 일반 텍스트로 폴백 (genOutlines 재생성 필요)
  if (!data) return <span>{children}</span>

  return (
    <svg
      className="out-svg"
      viewBox={`0 0 ${data.w} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: `${(data.w / VB_H).toFixed(3)}em` }}
      role="img"
      aria-label={word}
    >
      <path
        d={data.d}
        fill="none"
        stroke={stroke}
        strokeWidth={STROKE}
        strokeLinejoin="bevel"
        strokeLinecap="butt"
      />
    </svg>
  )
}
