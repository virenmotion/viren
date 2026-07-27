import { Link, useParams } from 'react-router-dom'
import { catLabel } from '../workProjects'
import { useProjects } from '../ProjectsContext'

/* YouTube 전체 주소 또는 ID → 임베드용 11자리 ID 추출 */
function ytId(v) {
  if (!v) return ''
  const s = String(v).trim()
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/)
  if (m) return m[1]
  if (/^[\w-]{11}$/.test(s)) return s
  return s
}

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
        <span>{p.titleEn || p.titleKo}</span>
      </div>
      {p.kind && <p className="wd-tag">{p.kind}</p>}

      {p.youtube && (
        <div className="wd-video">
          <iframe
            src={`https://www.youtube.com/embed/${ytId(p.youtube)}?autoplay=1&mute=1&playsinline=1&rel=0`}
            title={p.titleEn || p.titleKo}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      <h1 className="wd-title">{p.titleEn || p.titleKo}</h1>
      {p.titleEn && p.titleKo && <p className="wd-subtitle">{p.titleKo}</p>}
      {(p.client || p.year) && (
        <p className="wd-meta">
          {p.client && <span>{p.client}</span>}
          {p.client && p.year && <span className="wd-sep">·</span>}
          {p.year && <span>{p.year}</span>}
        </p>
      )}

      {(p.location || p.deliverables) && (
        <dl className="wd-spec">
          {p.location && <div><dt>Location</dt><dd>{p.location}</dd></div>}
          {p.deliverables && <div><dt>Deliverables</dt><dd>{p.deliverables}</dd></div>}
        </dl>
      )}

      {p.desc && <p className="wd-desc">{p.desc}</p>}

      <Link className="wd-back" to="/work">← WORK 목록</Link>
    </section>
  )
}
