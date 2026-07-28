import { Link } from 'react-router-dom'
import SplitText from './SplitText'
import { SOCIAL, SocialLink } from '../socials'

export default function Footer() {
  return (
    <footer id="contact">
      <div className="footer-grid">
        <div className="brand">
          <div className="wm foot-mark"><img src="/assets/viren_wordmark.png" alt="VIREN" /></div>
          <a className="foot-download" href="/assets/viren_company_profile.pdf" download data-hover>
            회사소개서 DOWNLOAD<span className="dl-ic" aria-hidden="true">↓</span>
          </a>
          <SplitText as={Link} to="/contact" className="mail" data-hover text="virenmotion@viren.kr" />
          <p>
            서울특별시 마포구 양화로8길 32-17, 3층 04044<br />
            3F, 32-17, Yanghwa-ro 8-gil, Mapo-gu, Seoul
          </p>
        </div>
        <div className="social-col">
          <h5>Social</h5>
          <ul>
            {SOCIAL.map((s) => (
              <li key={s.label}><SocialLink s={s} /></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 VIREN Co., Ltd. All rights reserved.</span>
      </div>
    </footer>
  )
}
