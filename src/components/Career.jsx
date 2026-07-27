import Reveal from './Reveal'
import SecStatement from './SecStatement'

/* CAREER — 별도 페이지 (스캐폴드). 채용 정보는 추후 채워넣는다. */
export default function Career() {
  return (
    <section id="career">
      <p className="sec-label">CAREER</p>

      <SecStatement>Join the Studio</SecStatement>

      <Reveal className="sec-head">
        <p className="sec-desc">함께 몰입형 콘텐츠를 만들 크리에이터를 찾습니다. 채용 공고는 곧 업데이트됩니다.</p>
      </Reveal>
    </section>
  )
}
