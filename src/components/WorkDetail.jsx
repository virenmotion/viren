import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProjects } from '../ProjectsContext'
import useSeo, { BRAND } from '../lib/useSeo'
import { projectTitle, projectDescription, pickRelated } from '../lib/seoRoutes'
import Reveal from './Reveal'

/* 라벨 — 기본 자간(.32em) 유지, 텍스트가 기준 폭을 넘을 때만 자간 자동 축소 */
function LabelBlock({ text }) {
  const ref = useRef(null)
  useEffect(() => {
    const wrap = ref.current
    const span = wrap?.querySelector('.wb-label-txt')
    if (!wrap || !span) return
    const TARGET = 0.7 // 라벨 폭의 70%를 기준선으로 — 넘을 때만 조정
    const fit = () => {
      span.style.letterSpacing = '' // 기본 자간(.32em)으로 복귀
      const target = wrap.clientWidth * TARGET
      if (span.scrollWidth <= target) return // 기준 이내 → 조정하지 않음
      const fs = parseFloat(getComputedStyle(span).fontSize) || 20
      span.style.letterSpacing = '0px'
      const base = span.scrollWidth // 자간 0일 때의 폭
      const n = [...text.replace(/\s/g, '')].length
      let ls = n > 1 ? (target - base) / (n - 1) : 0
      ls = Math.max(0, Math.min(fs * 0.32, ls))
      span.style.letterSpacing = ls.toFixed(2) + 'px'
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    if (document.fonts?.ready) document.fonts.ready.then(fit)
    return () => ro.disconnect()
  }, [text])
  return (
    <div className="wb-label" ref={ref}>
      <i className="dl" /><span className="wb-label-txt">{text}</span><i className="dr" />
    </div>
  )
}

/* YouTube 전체 주소 또는 ID → 임베드용 11자리 ID 추출 */
function ytId(v) {
  if (!v) return ''
  const s = String(v).trim()
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/)
  if (m) return m[1]
  if (/^[\w-]{11}$/.test(s)) return s
  return s
}

/* 화면에 들어올 때만 재생하는 클립.
   ⚠️ autoPlay를 쓰면 preload="metadata"가 무시되고 페이지를 열자마자 전체를 내려받는다.
   APEC 경주 상세는 그 탓에 영상 3개(32MB)가 한꺼번에 받아졌다. src는 그대로 둬야
   메타데이터로 세로 크기가 잡힌다(빼면 로드될 때 레이아웃이 튄다).
   화면 밖으로 나가면 일시정지 — 데이터·배터리도 아낀다. */
function LazyClip({ src, label }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const play = () => el.play?.().catch(() => {}) // 자동재생 차단 시 조용히 무시
    if (typeof IntersectionObserver !== 'function') { play(); return }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) play(); else el.pause?.() },
      { rootMargin: '150px' }, // 살짝 미리 시작해 스크롤 시 끊기지 않게
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <video
      ref={ref}
      className="wb-clip"
      src={src}
      muted loop playsInline preload="metadata"
      aria-label={label}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}

/* 콘텐츠 블록 하나 렌더 */
function BlockBody({ b }) {
  if (b.type === 'text') {
    // 본문에 | 가 있으면 행(줄)으로 나눠 표시
    const body = String(b.body || '').includes('|')
      ? b.body.split('|').map((s) => s.trim()).filter(Boolean).join('\n')
      : b.body
    return (
      <div className="wb-textrow">
        {b.heading && <h3 className="wb-heading">{b.heading}</h3>}
        {body && <p className="wb-text">{body}</p>}
      </div>
    )
  }
  /* 라벨 — 장식선 + 중앙 텍스트 (Concept / Intro), 자간 자동 조정 */
  if (b.type === 'label' && b.text) {
    return <LabelBlock text={b.text} />
  }
  /* 중앙 텍스트 — 제목(중앙 프레임) + 아래에 좌/우 텍스트를 같은 높이에서 나란히.
     오른쪽 텍스트는 빈 줄로 문단을 나눈다(한 줄 개행은 문단 안의 줄바꿈으로 유지). */
  if (b.type === 'center') {
    const rightParas = String(b.bodyEn || '')
      .split(/\n\s*\n/)
      .map((s) => s.replace(/\s+$/, '').replace(/^\s+/, ''))
      .filter(Boolean)
    return (
      <div className="wb-center">
        {b.heading && <h3 className="wb-c-title">{b.heading}</h3>}
        {(b.body || rightParas.length > 0) && (
          /* 왼쪽 1칸 + 문단 수만큼의 칸을 균등 분할 → 문단이 늘어도 각 칸 폭이 같다 */
          <div className="wb-c-cols" style={{ '--cols': 1 + Math.max(rightParas.length, 1) }}>
            <div className="wb-c-left">{b.body && <p className="wb-c-ko">{b.body}</p>}</div>
            <div className="wb-c-right">
              {rightParas.map((p, i) => <p className="wb-c-en" key={i}>{p}</p>)}
            </div>
          </div>
        )}
      </div>
    )
  }
  /* 특징 카드 — 한 줄 = "한글 | 영문", / 로 줄바꿈, 다크 카드 3(+)열 */
  if (b.type === 'features') {
    const brk = (s) => String(s || '').split('/').map((t) => t.trim()).filter(Boolean).join('\n')
    const items = String(b.body || '').split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => { const [ko, en] = l.split('|').map((s) => (s || '').trim()); return { ko: brk(ko), en: brk(en) } })
    if (!items.length) return null
    return (
      <div className="wb-features" style={{ '--cols': Math.min(items.length, 3) }}>
        {items.map((it, i) => (
          <div className="wb-feat" key={i}>
            {it.ko && <p className="wb-feat-ko">{it.ko}</p>}
            {it.en && <p className="wb-feat-en">{it.en}</p>}
          </div>
        ))}
      </div>
    )
  }
  /* 상세 항목 표 — 한 줄 = "라벨 | 한글 | 영문", / 로 줄바꿈.
     Object / Tone & Manner / Story 처럼 항목별 설명을 3열로 나열한다. */
  if (b.type === 'specs') {
    const brk = (s) => String(s || '').split('/').map((t) => t.trim()).filter(Boolean).join('\n')
    const rows = String(b.body || '').split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => {
        const [label, ko, en] = l.split('|').map((s) => (s || '').trim())
        return { label, ko: brk(ko), en: brk(en) }
      })
      .filter((r) => r.label || r.ko || r.en)
    if (!rows.length) return null
    return (
      <dl className="wb-specs">
        {rows.map((r, i) => (
          <div className="wb-spec" key={i}>
            <dt className="wb-spec-label">{r.label}</dt>
            <dd className="wb-spec-body">
              {r.ko && <p className="wb-spec-ko">{r.ko}</p>}
              {r.en && <p className="wb-spec-en">{r.en}</p>}
            </dd>
          </div>
        ))}
      </dl>
    )
  }
  if (b.type === 'image' && b.media) {
    return (
      <figure className="wb-figure">
        {/* 우클릭 저장·드래그 반출 차단 (완전 차단은 불가 — 개발자도구·스크린샷은 못 막는다) */}
        <img
          src={b.media}
          alt={b.caption || ''}
          loading="lazy"
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
        />
        {b.caption && <figcaption className="wb-caption">{b.caption}</figcaption>}
      </figure>
    )
  }
  if (b.type === 'video' && b.media) {
    /* media가 영상 파일 URL이면 직접 재생, 아니면 유튜브 ID로 보고 임베드.
       기존 데이터는 전부 유튜브 ID/주소라 자동 판별로도 깨지지 않는다. */
    const isFile = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(b.media)
    return (
      <figure className="wb-figure">
        {isFile ? (
          b.loop ? (
            /* 소리 없이 반복되는 짧은 클립 — 컨트롤 없이 배경처럼 재생 */
            <LazyClip src={b.media} label={b.caption || '영상'} />
          ) : (
            <video
              className="wb-clip"
              src={b.media}
              controls playsInline preload="metadata"
              controlsList="nodownload"
              aria-label={b.caption || '영상'}
              onContextMenu={(e) => e.preventDefault()}
            />
          )
        ) : (
          <div className="wb-video">
            <iframe
              src={`https://www.youtube.com/embed/${ytId(b.media)}?rel=0`}
              title={b.caption || 'video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        )}
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
  const { projects, findProject, loading, catLabel, trusted } = useProjects()
  const p = findProject(id)

  /* 프로젝트별 고유 제목·설명·canonical. 훅은 조건부 호출이 불가하므로 p가 없을 때도 호출한다.
     문구 규칙은 seoRoutes에 두고 빌드 프리렌더와 공유한다(어긋나면 클로킹으로 간주됨). */
  const seoTitle = p ? projectTitle(p) : undefined
  const seoDesc = p ? projectDescription(p, catLabel) : undefined
  /* 삭제된 프로젝트 주소는 SPA라 200으로 응답해 구글에 소프트 404로 잡힌다 → noindex 처리.
     ⚠️ 조건에 !loading이 반드시 필요하다. 로딩 중에도 p는 없으므로, loading을 빼면
     정상 페이지가 데이터 도착 전에 noindex로 스냅샷될 수 있다. */
  /* ⚠️ trusted가 빠지면 안 된다. DB 조회 실패 시 시드로 폴백하는데 시드에는
     현재 프로젝트가 하나도 없어서, 그 상태로 판정하면 멀쩡한 페이지 전부에
     noindex가 붙는다(2026-09-01 실제 발생, ProjectsContext 주석 참고). */
  const notFound = !loading && trusted && !p
  useSeo({
    title: notFound ? `페이지를 찾을 수 없습니다 | ${BRAND}` : seoTitle,
    description: seoDesc,
    path: p ? `/work/${p.slug}` : undefined,
    noindex: notFound,
  })

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

  const related = pickRelated(projects, p)

  return (
    <section id="work-detail">
      {/* 카테고리(좌) + 로케이션(우) — 한 줄에 같은 baseline으로 배치 */}
      <div className="wd-breadcrumb">
        <Link to={`/work#${p.cat}`}>{catLabel(p.cat)}</Link>
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

      {/* 다른 프로젝트 — 상세 페이지끼리 이어주는 내부 링크.
          없으면 각 상세가 목록에서 오는 링크 1개만 받아 검색엔진이 중요도를 낮게 본다.
          선택 규칙은 seoRoutes의 pickRelated에 두고 프리렌더와 공유한다. */}
      {related.length > 0 && (
        <nav className="wd-more" aria-label="다른 프로젝트">
          <h2 className="wd-more-title">다른 프로젝트</h2>
          <ul className="wd-more-list">
            {related.map((r) => (
              <li key={r.slug}>
                <Link className="wd-more-card" to={`/work/${r.slug}`} data-hover>
                  <span
                    className="wd-more-thumb"
                    style={r.thumb ? { backgroundImage: `url(${r.thumb})` } : undefined}
                    aria-hidden="true"
                  />
                  <span className="wd-more-cat">{catLabel(r.cat)}</span>
                  <span className="wd-more-ko">{r.titleKo || r.titleEn}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <Link className="wd-back" to="/work">← WORK 목록</Link>
    </section>
  )
}
