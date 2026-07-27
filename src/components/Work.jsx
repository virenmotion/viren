import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Reveal from './Reveal'
import SecStatement from './SecStatement'
import { FILTERS, catLabel } from '../workProjects'
import { useProjects } from '../ProjectsContext'

/* WORK 게시판 — 3열 그리드. 호버 시 제목 오버레이, 클릭 시 /work/:slug 상세로.
   데이터는 Supabase DB(useProjects)에서. */
export default function Work() {
  const { hash } = useLocation()
  const [filter, setFilter] = useState('all')
  const { projects, loading } = useProjects()

  /* WHAT WE DO에서 /work#{slug}로 진입 시 해당 필터 활성화 */
  useEffect(() => {
    const slug = hash.replace('#', '')
    if (slug && FILTERS.some((f) => f.slug === slug)) setFilter(slug)
  }, [hash])

  const shown = filter === 'all' ? projects : projects.filter((p) => p.cat === filter)

  return (
    <section id="work">
      <SecStatement>Our Portfolio</SecStatement>

      <div className="work-filter">
        {FILTERS.map((f) => (
          <button
            key={f.slug}
            type="button"
            className={filter === f.slug ? 'on' : undefined}
            onClick={() => setFilter(f.slug)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="work-grid">
        {shown.map((p, i) => (
          <Reveal
            as={Link}
            to={`/work/${p.slug}`}
            className="card"
            data-hover
            key={`${filter}-${p.slug}`}
            delay={(i % 3) * 0.06}
          >
            <div
              className="thumb"
              style={p.thumb ? { backgroundImage: `url(${p.thumb})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            />
            <div className="card-cap">
              <div className="cap-top">
                <span className="cap-client">{p.client || catLabel(p.cat)}</span>
                <span className="cap-year">{p.year}</span>
              </div>
              <h3 className="cap-ko">{p.titleKo || p.titleEn}</h3>
              {p.titleKo && p.titleEn && <p className="cap-en">{p.titleEn}</p>}
            </div>
          </Reveal>
        ))}
      </div>

      {!loading && shown.length === 0 && (
        <p className="work-empty">등록된 프로젝트가 없습니다.</p>
      )}
    </section>
  )
}
