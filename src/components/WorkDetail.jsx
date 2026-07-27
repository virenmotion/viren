import { Link, useParams } from 'react-router-dom'
import { catLabel } from '../workProjects'
import { useProjects } from '../ProjectsContext'

/* WORK 상세 — /work/:slug. 카테고리·제목 브레드크럼 + 영상 임베드 + 날짜·본문. */
export default function WorkDetail() {
  const { id } = useParams() // 라우트 파라미터명은 id지만 slug로 사용
  const { findProject, loading } = useProjects()
  const p = findProject(id)

  if (loading) {
    return (
      <section id="work-detail">
        <p className="wd-empty">불러오는 중…</p>
      </section>
    )
  }

  if (!p) {
    return (
      <section id="work-detail">
        <p className="wd-empty">프로젝트를 찾을 수 없습니다.</p>
        <Link className="wd-back" to="/work">← WORK 목록</Link>
      </section>
    )
  }

  return (
    <section id="work-detail">
      <div className="wd-breadcrumb">
        <Link to={`/work#${p.cat}`}>{catLabel(p.cat)}</Link>
        <span>{p.titleEn}</span>
      </div>
      {p.kind && <p className="wd-tag">{p.kind}</p>}

      {p.youtube && (
        <div className="wd-video">
          <iframe
            src={`https://www.youtube.com/embed/${p.youtube}`}
            title={p.titleEn}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      <h1 className="wd-title">{p.titleEn}</h1>
      {p.titleKo && <p className="wd-subtitle">{p.titleKo}</p>}
      {(p.client || p.year) && (
        <p className="wd-meta">
          {p.client && <span>{p.client}</span>}
          {p.client && p.year && <span className="wd-sep">·</span>}
          {p.year && <span>{p.year}</span>}
        </p>
      )}
      {p.desc && <p className="wd-desc">{p.desc}</p>}

      <Link className="wd-back" to="/work">← WORK 목록</Link>
    </section>
  )
}
