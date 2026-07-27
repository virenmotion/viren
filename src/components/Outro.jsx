import SecStatement from './SecStatement'

/* WHAT WE DO와 푸터 사이의 대문구 + CTA 섹션 (중앙 정렬) */
export default function Outro() {
  return (
    <section id="outro">
      <SecStatement>Beyond Motion, Beyond Experience</SecStatement>
      <div className="outro-cta">
        <a className="btn" href="#contact">
          프로젝트 문의
          <span className="btn-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  )
}
