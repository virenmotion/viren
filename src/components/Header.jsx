import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SplitText from './SplitText'

const NAV = [
  { label: 'ABOUT', to: '/#about' },
  { label: 'WORK', to: '/work' },
  { label: 'CAREER', to: '/career' },
  { label: 'CONTACT', to: '/contact' },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  /* 메뉴 열림 시 배경 스크롤 잠금 + Esc 닫기 */
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <header className={open ? 'nav-open' : ''}>
      <Link to="/" className="logo wm" aria-label="VIREN 홈" onClick={close}>
        <img src="/assets/viren_wordmark.png" alt="VIREN" />
      </Link>

      <button
        type="button"
        className="nav-toggle"
        aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>

      <nav>
        {NAV.map((n) => (
          <SplitText key={n.to} as={Link} to={n.to} text={n.label} onClick={close} />
        ))}
      </nav>
    </header>
  )
}
