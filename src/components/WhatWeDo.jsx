import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Reveal from './Reveal'
import SplitText from './SplitText'
import SecStatement from './SecStatement'
import { getWhatWeDo } from '../lib/projectStore'

/* WHAT WE DO — WORK 분야와 무관한 독립 항목들. 관리자에서 추가/삭제/링크 지정.
   DB(site_settings.what_we_do) 미설정 시 아래 기본값 폴백. link=클릭 시 이동 페이지. */
export const WWD_DEFAULT = [
  { label: 'MEDIA ART', desc: '공간과 미디어가 만나는 순간, 새로운 몰입 경험을 제공합니다.', link: '/work#media-art' },
  { label: 'IMMERSIVE', desc: '관객이 직접 참여하고 경험하는 몰입형 인터랙티브 콘텐츠를 제공합니다.', link: '/work#immersive' },
  { label: 'BRAND FILM', desc: '브랜드의 철학과 가치를 담아 오래 기억되는 브랜드 경험을 만듭니다.', link: '/work#brand-film' },
  { label: 'CGI', desc: '현실을 넘어 상상을 가장 정교한 비주얼로 구현합니다.', link: '/work#cgi' },
  { label: 'MOTION GRAPHICS', desc: '직관적인 모션과 그래픽으로 복잡한 정보를 명확하게 전달합니다.', link: '/work#motion-graphics' },
]

/* 링크 유형에 맞는 래퍼: 외부(http) → a, 내부(/…) → Link, 없음 → div(비클릭) */
function SvcRow({ s }) {
  const inner = (
    <>
      <span className="n">{s.n}</span>
      <SplitText as="h3" text={s.label} />
      {s.desc && <p>{s.desc}</p>}
      {s.link && <span className="arrow">↗</span>}
    </>
  )
  if (!s.link) return <div className="svc-row svc-row--static">{inner}</div>
  if (/^https?:\/\//i.test(s.link))
    return <a className="svc-row" data-hover href={s.link} target="_blank" rel="noopener noreferrer">{inner}</a>
  return <Link className="svc-row" data-hover to={s.link}>{inner}</Link>
}

export default function WhatWeDo() {
  const [items, setItems] = useState(WWD_DEFAULT)

  useEffect(() => {
    getWhatWeDo().then((v) => { if (v && v.length) setItems(v) }).catch(() => {})
  }, [])

  const shown = items.filter((s) => !s.hidden).map((s, i) => ({ ...s, n: String(i + 1).padStart(2, '0') }))

  return (
    <section id="whatwedo">
      <p className="sec-label">WHAT WE DO</p>

      <SecStatement>Content Areas</SecStatement>

      <Reveal className="svc">
        {shown.map((s, i) => <SvcRow key={i} s={s} />)}
      </Reveal>
    </section>
  )
}
