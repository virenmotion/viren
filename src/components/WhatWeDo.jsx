import { Link } from 'react-router-dom'
import Reveal from './Reveal'
import SplitText from './SplitText'
import SecStatement from './SecStatement'

/* WHAT WE DO — ABOUT 그룹(About → Philosophy → What We Do)의 마지막 섹션.
   기존 AREAS 서비스 4개를 재활용. */
const SERVICES = [
  { n: '01', t: 'MEDIA ART', slug: 'media-art', p: '공간과 미디어가 만나는 순간, 새로운 몰입 경험을 제공합니다.' },
  { n: '02', t: 'IMMERSIVE', slug: 'immersive', p: '관객이 직접 참여하고 경험하는 몰입형 인터랙티브 콘텐츠를 제공합니다.' },
  { n: '03', t: 'BRAND FILM', slug: 'brand-film', p: '브랜드의 철학과 가치를 담아 오래 기억되는 브랜드 경험을 만듭니다.' },
  { n: '04', t: 'CGI', slug: 'cgi', p: '현실을 넘어 상상을 가장 정교한 비주얼로 구현합니다.' },
  { n: '05', t: 'MOTION GRAPHICS', slug: 'motion-graphics', p: '직관적인 모션과 그래픽으로 복잡한 정보를 명확하게 전달합니다.' },
]

export default function WhatWeDo() {
  return (
    <section id="whatwedo">
      <p className="sec-label">WHAT WE DO</p>

      <SecStatement>Content Areas</SecStatement>

      <Reveal className="svc">
        {SERVICES.map((s) => (
          <Link className="svc-row" data-hover to={`/work#${s.slug}`} key={s.n}>
            <span className="n">{s.n}</span>
            <SplitText as="h3" text={s.t} />
            <p>{s.p}</p>
            <span className="arrow">↗</span>
          </Link>
        ))}
      </Reveal>
    </section>
  )
}
