import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
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
import useSeo from './lib/useSeo'
import { SEO, H1, BRAND } from './lib/seoRoutes'

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
  useSeo(SEO.home)
  return (
    <main className="home">
      <h1 className="sr-only">{H1.home}</h1>
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
  useSeo(SEO.work)
  return (
    <main>
      <h1 className="sr-only">{H1.work}</h1>
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

/* 없는 주소 처리. SPA라 서버는 어떤 경로든 200을 주므로, 라우트가 없으면 빈 화면이
   200으로 응답돼 검색엔진에 소프트 404로 잡힌다(예: /about — ABOUT은 홈의 한 구간이라
   별도 주소가 없다). noindex로 색인에서 빼고 홈으로 돌아갈 길을 준다. */
function NotFoundPage() {
  useSeo({ title: `페이지를 찾을 수 없습니다 | ${BRAND}`, noindex: true })
  return (
    <main>
      <section id="work-detail">
        <p className="wd-empty">페이지를 찾을 수 없습니다.</p>
        <Link className="wd-back" to="/">← 홈으로</Link>
      </section>
    </main>
  )
}

function CareerPage() {
  useSeo(SEO.career)
  return (
    <main>
      <h1 className="sr-only">{H1.career}</h1>
      <Career />
    </main>
  )
}

function ContactPage() {
  useSeo(SEO.contact)
  return (
    <main>
      <h1 className="sr-only">{H1.contact}</h1>
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <Chrome />
      </ProjectsProvider>
    </BrowserRouter>
  )
}
