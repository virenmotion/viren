import { Link } from 'react-router-dom'
import SecStatement from './SecStatement'

/* WHAT WE DO와 푸터 사이의 대문구 + CTA 섹션 (중앙 정렬) */
export default function Outro() {
  return (
    <section id="outro">
      <video
        className="outro-bg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/assets/outro-bg.mp4" type="video/mp4" />
      </video>
      <div className="outro-veil" aria-hidden="true" />
      <SecStatement>Beyond Motion, Beyond Experience</SecStatement>
      <div className="outro-cta">
        <Link className="btn" to="/contact">
          프로젝트 문의
          <span className="btn-arrow" aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  )
}
