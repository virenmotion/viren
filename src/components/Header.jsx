import { Link } from 'react-router-dom'
import SplitText from './SplitText'

const NAV = [
  { label: 'HOME', to: '/' },
  { label: 'ABOUT', to: '/#about' },
  { label: 'WORK', to: '/work' },
  { label: 'CAREER', to: '/career' },
  { label: 'CONTACT', to: '/contact' },
]

export default function Header() {
  return (
    <header>
      <Link to="/" className="logo wm" aria-label="VIREN 홈">
        <img src="/assets/viren_wordmark.png" alt="VIREN" />
      </Link>
      <nav>
        {NAV.map((n) => (
          <SplitText key={n.to} as={Link} to={n.to} text={n.label} />
        ))}
      </nav>
    </header>
  )
}
