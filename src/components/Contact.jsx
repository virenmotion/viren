import { useState } from 'react'
import Reveal from './Reveal'
import SecStatement from './SecStatement'
import ContactModal from './ContactModal'
import { SOCIAL, SocialLink } from '../socials'

const EMAIL = 'virenmotion@viren.kr'
const PHONE = '02-3144-1222'
const ADDRESS = '서울특별시 마포구 양화로8길 32-17'
/* MAP 링크 — 카카오맵. 네이버지도로 바꾸려면 아래 NAVER 줄로 교체:
   const MAP_URL = 'https://map.naver.com/p/search/' + encodeURIComponent(ADDRESS) */
const MAP_URL = 'https://map.kakao.com/?q=' + encodeURIComponent(ADDRESS)

/* 위치 핀 아이콘 */
function Pin() {
  return (
    <svg className="ct-pin" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill="currentColor" />
    </svg>
  )
}

export default function Contact() {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <section id="contact-page">
      <p className="sec-label">CONTACT</p>

      <SecStatement>GLOBAL CREATIVE <br className="br-t" />VIREN STUDIOS</SecStatement>

      <Reveal className="contact-intro">
        <p>새로운 프로젝트, 협업, 채용 등 무엇이든 편하게 문의해 주세요. 확인 후 빠르게 연락드리겠습니다.</p>
      </Reveal>

      {/* 1. 대문구 하단 가로선 */}
      <div className="ct-rule" />

      {/* 2. [SEOUL + MAP] | 주소·전화·메일 | 문의하기 */}
      <Reveal className="ct-office">
        <div className="ct-city-col">
          <h3 className="ct-city">SEOUL</h3>
          <a className="ct-map" href={MAP_URL} target="_blank" rel="noopener noreferrer" data-hover>
            <Pin /> MAP
          </a>
        </div>
        <div className="ct-lines">
          <p>서울특별시 마포구 양화로8길 32-17, 3층 04044</p>
          <p>3F, 32-17, Yanghwa-ro 8-gil, Mapo-gu, Seoul</p>
          <p>T. {PHONE}</p>
          <p><a href={`mailto:${EMAIL}`} data-hover>{EMAIL}</a></p>
        </div>
        <button type="button" className="btn ct-inquiry" onClick={() => setModalOpen(true)}>
          문의하기
          <span className="btn-arrow" aria-hidden="true">↗</span>
        </button>
      </Reveal>

      <div className="ct-rule" />

      {/* 3. 로고 모션 (VIsion→Render→ENvision→VIctory→VIREN) */}
      <div className="ct-logo">
        <video autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
          <source src="/assets/viren-logo-motion.mp4" type="video/mp4" />
        </video>
      </div>

      {/* 4. 소셜 */}
      <div className="ct-bottom">
        <ul className="ct-social">
          {SOCIAL.map((s) => (
            <li key={s.label}><SocialLink s={s} /></li>
          ))}
        </ul>
      </div>

      <ContactModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  )
}
