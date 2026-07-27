import { Link, useParams } from 'react-router-dom'
import { catLabel } from '../workProjects'
import { useProjects } from '../ProjectsContext'
import Reveal from './Reveal'

/* YouTube 전체 주소 또는 ID → 임베드용 11자리 ID 추출 */
function ytId(v) {
  if (!v) return ''
  const s = String(v).trim()
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/)
  if (m) return m[1]
  if (/^[\w-]{11}$/.test(s)) return s
  return s
}

/* 콘텐츠 블록 하나 렌더 (텍스트/이미지/영상) */
function BlockBody({ b }) {
  if (b.type === 'text') {
    return (
      <div className="wb-textrow">
        {b.heading && <h3 className="wb-heading">{b.heading}</h3>}
        {b.body && <p className="wb-text">{b.body}</p>}
      </div>
    )
  }
  if (b.type === 'image' && b.media) {
    return (
      <figure className="wb-figure">
        <img src={b.media} alt={b.caption || ''} loading="lazy" />
        {b.caption && <figcaption className="wb-caption">{b.caption}</figcaption>}
      </figure>
    )
  }
  if (b.type === 'video' && b.media) {
    return (
      <figure className="wb-figure">
        <div className="wb-video">
          <iframe
            src={`https://www.youtube.com/embed/${ytId(b.media)}?rel=0`}
            title={b.caption || 'video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        {b.caption && <figcaption className="wb-caption">{b.caption}</figcaption>}
      </figure>
    )
  }
  return null
}

/* 구분선(divider) 기준으로 블록들을 구역으로 묶고, 각 구역은 하나의 Reveal(함께 떠오름)로 감싼다. */
function renderBlockGroups(blocks) {
  const out = []
  let group = []
  const flush = (key) => {
    if (!group.length) return
    const g = group
    out.push(
      <Reveal className="wd-group" key={`g${key}`}>
        {g.map((b, i) => <div className="wd-block" key={i}><BlockBody b={b} /></div>)}
      </Reveal>,
    )
    group = []
  }
  blocks.forEach((b, i) => {
    if (b.type === 'divider') { flush(i); out.push(<div className="wd-divider" key={`d${i}`} />) }
    else group.push(b)
  })
  flush('end')
  return out
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
      </div>
      <div className="wd-tagrow">
        {p.kind && <span className="wd-tag">{p.kind}</span>}
        {p.location && <span className="wd-loc">{p.location}</span>}
      </div>

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
      {(p.client || p.year || p.deliverables) && (
        <div className="wd-metarow">
          <p className="wd-meta">
            {p.client && <span>{p.client}</span>}
            {p.client && p.year && <span className="wd-sep">·</span>}
            {p.year && <span>{p.year}</span>}
          </p>
          {p.deliverables && <p className="wd-deliv">{p.deliverables}</p>}
        </div>
      )}

      {p.desc && <Reveal as="p" className="wd-desc">{p.desc}</Reveal>}

      {/* 본문 ↔ 추가 콘텐츠 사이 구분선 */}
      {Array.isArray(p.blocks) && p.blocks.length > 0 && <div className="wd-block-rule" />}

      {/* 본문 하단 콘텐츠 블록 — 구분선 기준으로 구역 단위 스크롤 리빌 */}
      {Array.isArray(p.blocks) && renderBlockGroups(p.blocks)}

      <Link className="wd-back" to="/work">← WORK 목록</Link>
    </section>
  )
}
