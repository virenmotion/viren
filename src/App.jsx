import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Preloader from './components/Preloader'
import Cursor from './components/Cursor'
import Header from './components/Header'
import Backdrop from './components/Backdrop'
import Hero from './components/Hero'
import About from './components/About'
import Philosophy from './components/Philosophy'
import Band from './components/Band'
import WhatWeDo from './components/WhatWeDo'
import Outro from './components/Outro'
import Work from './components/Work'
import WorkDetail from './components/WorkDetail'
import Admin from './components/Admin'
import Career from './components/Career'
import Contact from './components/Contact'
import Footer from './components/Footer'
import { ProjectsProvider } from './ProjectsContext'
import useFullpage from './lib/useFullpage'

/* 라우트/해시 변경 시 스크롤 관리 — 해시가 있으면 해당 요소로(헤더 오프셋은 scroll-margin으로),
   없으면 페이지 최상단으로. 새 페이지가 마운트될 때까지 잠깐 재시도한다. */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      let tries = 0
      const go = () => {
        const el = document.querySelector(hash)
        if (el) { el.scrollIntoView({ behavior: 'smooth' }); return }
        if (tries++ < 6) { setTimeout(go, 50); return }
        window.scrollTo({ top: 0, behavior: 'auto' }) // 해시가 요소가 아니면(예: WORK 필터) 최상단
      }
      go()
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [pathname, hash])
  return null
}

function HomePage({ ready }) {
  useFullpage(ready)
  return (
    <main className="home">
      <Backdrop />
      <div className="fp-panel"><Hero ready={ready} /></div>
      <div className="fp-panel"><About /></div>
      <div className="fp-panel panel-philo"><Philosophy /><Band /></div>
      <div className="fp-panel panel-wwd"><WhatWeDo /></div>
      <div className="fp-panel panel-end"><Outro /><Footer /></div>
    </main>
  )
}

function WorkPage() {
  return (
    <main>
      <Work />
    </main>
  )
}

function WorkDetailPage() {
  return (
    <main>
      <WorkDetail />
    </main>
  )
}

function CareerPage() {
  return (
    <main>
      <Career />
    </main>
  )
}

function ContactPage() {
  return (
    <main>
      <Contact />
    </main>
  )
}

function AdminPage() {
  return (
    <main>
      <Admin />
    </main>
  )
}

/* 관리자 페이지에서는 마케팅용 헤더/푸터를 숨긴다.
   홈('/')은 마지막 패널에 자체 푸터를 포함하므로 전역 푸터를 렌더하지 않는다. */
function Chrome() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/admin')) return null
  const isHome = pathname === '/'
  return (
    <>
      <Header />
      {!isHome && <Footer />}
    </>
  )
}

/* 인트로 프리로더 게이트 — /admin 등 관리자 경로에선 인트로를 건너뛰고 즉시 진입 */
function Boot({ setReady }) {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  // 프리로더는 onDone(사이트 공개) 이후에도 마운트를 유지하며 종료 전환(줌+페이드)을
  // 스스로 재생한 뒤, onGone에서 마운트를 해제한다. (조기 언마운트 시 전환이 렌더되지 않음)
  const [mounted, setMounted] = useState(true)
  useEffect(() => {
    if (isAdmin) {
      document.body.classList.remove('is-loading')
      document.body.classList.add('loaded')
      setReady(true)
      setMounted(false)
    }
  }, [isAdmin, setReady])
  if (isAdmin || !mounted) return null
  return <Preloader onDone={() => setReady(true)} onGone={() => setMounted(false)} />
}

export default function App() {
  const [ready, setReady] = useState(false)

  return (
    <BrowserRouter>
      <ProjectsProvider>
        <Boot setReady={setReady} />
        <Cursor />
        <ScrollManager />

        <Routes>
          <Route path="/" element={<HomePage ready={ready} />} />
          <Route path="/work" element={<WorkPage />} />
          <Route path="/work/:id" element={<WorkDetailPage />} />
          <Route path="/career" element={<CareerPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>

        <Chrome />
      </ProjectsProvider>
    </BrowserRouter>
  )
}
