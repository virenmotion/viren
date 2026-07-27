import SplitText from './SplitText'

const SOCIAL = [
  { label: 'Instagram', url: 'https://www.instagram.com/viren_creative/' },
  { label: 'Vimeo', url: '#' },
  { label: 'YouTube', url: '#' },
  { label: 'Behance', url: '#' },
]

export default function Footer() {
  return (
    <footer id="contact">
      <div className="footer-grid">
        <div className="brand">
          <div className="wm foot-mark"><img src="/assets/viren_wordmark.png" alt="VIREN" /></div>
          <h5>Contact · 프로젝트 문의</h5>
          <SplitText as="a" href="mailto:virenmotion@viren.kr" className="mail" data-hover text="virenmotion@viren.kr" />
          <p>
            서울특별시 마포구 양화로8길 32-17, 3층 04044<br />
            3F, 32-17, Yanghwa-ro 8-gil, Mapo-gu, Seoul
          </p>
        </div>
        <div className="social-col">
          <h5>Social</h5>
          <ul>
            {SOCIAL.map((s) => (
              <li key={s.label}>
                <SplitText
                  as="a"
                  href={s.url}
                  target={s.url !== '#' ? '_blank' : undefined}
                  rel={s.url !== '#' ? 'noopener noreferrer' : undefined}
                  data-hover
                  text={s.label}
                />
              </li>
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
