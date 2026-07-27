/* TRIONN식 글자 블러 디졸브 호버 — 원본 + 클론 2레이어.
   원본 텍스트 마크업의 [data-split]을 대체한다. */
export default function SplitText({ text, as: Tag = 'span', className = '', ...rest }) {
  const chars = [...text]
  const n = chars.length

  const layer = (cls) => (
    <span className={`text-layer ${cls}`} aria-hidden={cls === 'clone' ? 'true' : undefined}>
      {chars.map((c, i) => (
        <span
          key={i}
          className="char"
          style={{ '--i': i, '--r': n - 1 - i }}
        >
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  )

  return (
    <Tag className={`split ${className}`.trim()} {...rest}>
      {layer('original')}
      {layer('clone')}
    </Tag>
  )
}
