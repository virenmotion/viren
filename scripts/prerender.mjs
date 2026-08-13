/* 라우트별 정적 HTML 생성 (vite build 직후 실행)
   ─────────────────────────────────────────────────────────────
   왜 필요한가:
   이 사이트는 클라이언트 렌더링이라 모든 주소가 같은 index.html을 받는다. 그 안의
   title·description·canonical은 전부 홈(/) 값이고, useSeo가 JS 실행 후에 덮어쓴다.
   구글은 JS를 실행하므로 문제가 없지만, 네이버 Yeti는 원본 HTML만 읽는다.
   → Yeti에게는 /work·/contact·프로젝트 상세가 전부 'canonical=홈'인 중복 문서로 보이고,
     수집해도 홈 하나로 합쳐진다(실제로 네이버 수집 페이지가 2건에서 멈춰 있었다).

   그래서 빌드 때 라우트마다 head와 noscript만 바꾼 HTML을 dist에 구워 둔다.
   Vercel은 실제 파일이 있으면 그걸 먼저 내주고 없을 때만 vercel.json의 rewrite로
   SPA에 넘기므로, 사용자 동작은 그대로이고 크롤러가 받는 원본만 달라진다.

   ⚠️ noscript 내용은 화면에 실제로 보이는 정보만 담을 것(다르면 클로킹으로 간주됨).
   ⚠️ 문구 규칙은 src/lib/seoRoutes.js 한 곳에만 둔다. 여기에 따로 적지 말 것. */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { SITE, SEO, H1, projectTitle, projectDescription } from '../src/lib/seoRoutes.js'
import { SEED_PROJECTS } from '../src/workProjects.js'

const DIST = path.resolve('dist')

/* Vercel은 환경변수를 process.env로 주지만, 로컬 빌드는 .env.local 파일에만 있다.
   (vite는 이 파일을 읽지만 그건 번들 안쪽 이야기라 이 스크립트에는 전달되지 않는다) */
for (const f of ['.env.local', '.env']) {
  try {
    for (const line of (await readFile(f, 'utf8')).split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* 파일이 없으면 무시 — Vercel에서는 정상 */ }
}

const SB_URL = process.env.VITE_SUPABASE_URL
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY

/* ---------- 데이터 ---------- */

/* PostgREST 직접 호출 — 빌드 스크립트라 supabase-js를 쓰지 않는다(브라우저 전제 모듈). */
async function sb(query) {
  if (!SB_URL || !SB_KEY) return null
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${query}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json()
  } catch (e) {
    console.warn(`  ! Supabase 조회 실패 (${query}): ${e.message}`)
    return null
  }
}

async function loadProjects() {
  const rows = await sb(
    'projects?select=slug,cat,client,year,title_en,title_ko,location,deliverables,description,blocks&order=sort.asc',
  )
  if (!rows) {
    /* DB에 못 닿으면 앱과 같은 시드로 폴백한다. 시드는 DB보다 오래된 목록일 수 있으므로
       빌드 로그에 반드시 남긴다 — 프로젝트 페이지가 조용히 누락되는 사고를 막기 위함. */
    console.warn('  ! DB 미연결 → 시드 프로젝트로 폴백 (최신 목록이 아닐 수 있음)')
    return SEED_PROJECTS
  }
  return rows.map((r) => ({
    slug: r.slug, cat: r.cat, client: r.client, year: r.year,
    titleEn: r.title_en, titleKo: r.title_ko,
    location: r.location, deliverables: r.deliverables,
    desc: r.description, blocks: Array.isArray(r.blocks) ? r.blocks : [],
  }))
}

async function loadCatLabel() {
  const rows = await sb('site_settings?select=value&key=eq.work_categories')
  const list = Array.isArray(rows?.[0]?.value) ? rows[0].value : []
  /* 화면(ProjectsContext)과 동일한 규칙 — 못 찾으면 slug를 그대로 쓴다 */
  return (slug) => list.find((c) => c.slug === slug)?.label || slug
}

async function loadJobs() {
  const rows = await sb('jobs?select=title_en,title_ko,type,description&order=sort.asc')
  return rows || []
}

/* 홈의 '제작 분야' — 화면(WhatWeDo)과 같은 출처를 써야 내용이 어긋나지 않는다 */
async function loadWhatWeDo() {
  const rows = await sb('site_settings?select=value&key=eq.what_we_do')
  const list = Array.isArray(rows?.[0]?.value) ? rows[0].value : []
  return list.filter((x) => !x.hidden)
}

/* ---------- HTML 조립 ---------- */

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* 여러 줄 텍스트 → <p> 묶음. 관리자 입력의 | 와 / 구분자는 화면과 같게 줄로 편다. */
function paras(text) {
  return String(text || '')
    .split(/[\n|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<p>${esc(s)}</p>`)
    .join('')
}

/* 콘텐츠 블록에서 크롤러에게 보여줄 텍스트만 추출 (이미지·영상은 캡션만) */
function blockText(b) {
  switch (b?.type) {
    /* ⚠️ text는 화면에 heading·body만 렌더된다(bodyEn은 무시됨).
       여기서 bodyEn을 넣으면 크롤러만 보는 텍스트가 생겨 클로킹이 된다. */
    case 'text':
      return (b.heading ? `<h3>${esc(b.heading)}</h3>` : '') + paras(b.body)
    case 'center':
      return (b.heading ? `<h3>${esc(b.heading)}</h3>` : '') + paras(b.body) + paras(b.bodyEn)
    case 'label':
      return b.text ? `<h3>${esc(b.text)}</h3>` : ''
    case 'features':
    case 'specs':
      return paras(String(b.body || '').replace(/\//g, '\n'))
    case 'image':
    case 'video':
      return b.caption ? `<p>${esc(b.caption)}</p>` : ''
    default:
      return ''
  }
}

const CONTACT_BLOCK = `<h2>문의</h2>
      <address>
        서울특별시 마포구 양화로8길 32-17, 3층 04044<br />
        T. 02-3144-1222<br />
        <a href="mailto:virenmotion@viren.kr">virenmotion@viren.kr</a>
      </address>`

const NAV = '<p><a href="/">HOME</a> · <a href="/work">WORK</a> · <a href="/career">CAREER</a> · <a href="/contact">CONTACT</a></p>'

/* index.html의 기존 태그를 '덮어쓴다'. 새로 추가하면 head에 title·canonical이 둘씩 생기고
   크롤러는 보통 앞의 것(=홈 값)을 채택해 수정이 무의미해진다. */
function buildPage(tpl, { title, description, url, noscript }) {
  const sub = (re, replacement, label) => {
    if (!re.test(tpl)) throw new Error(`템플릿에서 ${label}를 찾지 못했습니다 — index.html 구조가 바뀌었는지 확인하세요.`)
    tpl = tpl.replace(re, replacement)
  }
  sub(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`, '<title>')
  sub(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`, 'description')
  sub(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`, 'og:title')
  sub(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`, 'og:description')
  sub(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`, 'canonical')
  sub(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`, 'og:url')
  sub(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>\n${noscript}\n    </noscript>`, '<noscript>')
  return tpl
}

/* ---------- 실행 ---------- */

const tpl = await readFile(path.join(DIST, 'index.html'), 'utf8')
const [projects, catLabel, jobs, whatWeDo] = await Promise.all([
  loadProjects(), loadCatLabel(), loadJobs(), loadWhatWeDo(),
])

const pages = []

const workLinks = projects
  .map((p) => `<li><a href="/work/${esc(p.slug)}">${esc(p.titleKo || p.titleEn)}</a></li>`)
  .join('\n        ')

/* 홈 — dist/index.html을 덮어쓴다. 목록을 손으로 적어두면 프로젝트를 추가할 때마다
   어긋나므로(실제로 index.html에는 8개만 적혀 있었다) DB에서 만든다. */
pages.push({
  ...SEO.home,
  noscript: `      <h1>${esc(H1.home)}</h1>
      <p>${esc(SEO.home.description)}</p>
      ${whatWeDo.length ? `<h2>제작 분야</h2>\n      <ul>\n        ${whatWeDo
        .map((w) => `<li>${esc(w.label)}${w.desc ? ` — ${esc(w.desc)}` : ''}</li>`)
        .join('\n        ')}\n      </ul>` : ''}
      <h2>주요 프로젝트</h2>
      <ul>
        ${workLinks}
      </ul>
      ${CONTACT_BLOCK}
      ${NAV}`,
})

pages.push({
  ...SEO.work,
  noscript: `      <h1>${esc(H1.work)}</h1>
      <p>${esc(SEO.work.description)}</p>
      <h2>프로젝트</h2>
      <ul>
        ${workLinks}
      </ul>
      ${NAV}`,
})

pages.push({
  ...SEO.career,
  noscript: `      <h1>${esc(H1.career)}</h1>
      <p>${esc(SEO.career.description)}</p>
      ${jobs.length ? `<h2>채용 공고</h2>\n      <ul>\n        ${jobs
        .map((j) => `<li>${esc(j.title_ko || j.title_en)}${j.type ? ` — ${esc(j.type)}` : ''}</li>`)
        .join('\n        ')}\n      </ul>` : ''}
      ${CONTACT_BLOCK}
      ${NAV}`,
})

pages.push({
  ...SEO.contact,
  noscript: `      <h1>${esc(H1.contact)}</h1>
      <p>${esc(SEO.contact.description)}</p>
      ${CONTACT_BLOCK}
      ${NAV}`,
})

for (const p of projects) {
  const meta = [
    p.client && `발주처 ${p.client}`,
    p.year && `${p.year}`,
    p.location,
    p.deliverables && `산출물 ${p.deliverables}`,
  ].filter(Boolean)
  pages.push({
    title: projectTitle(p),
    description: projectDescription(p, catLabel),
    path: `/work/${p.slug}`,
    noscript: `      <h1>${esc(p.titleKo || p.titleEn)}</h1>
      ${p.titleKo && p.titleEn ? `<p>${esc(p.titleEn)}</p>` : ''}
      <p>${esc(catLabel(p.cat))}${meta.length ? ` · ${esc(meta.join(' · '))}` : ''}</p>
      ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
      ${(p.blocks || []).map(blockText).filter(Boolean).join('\n      ')}
      <p>제작 — 바이렌(VIREN) 콘텐츠 프로덕션 스튜디오</p>
      ${NAV}`,
  })
}

for (const page of pages) {
  const html = buildPage(tpl, {
    title: page.title,
    description: page.description,
    url: SITE + page.path,
    noscript: page.noscript,
  })
  const dir = path.join(DIST, page.path)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html)
}

/* 사이트맵도 여기서 만든다. 손으로 관리하면 프로젝트를 추가/삭제할 때마다 어긋난다. */
const urls = pages.map((p) => {
  const priority = p.path === '/' ? '1.0' : p.path === '/work' ? '0.9' : p.path.startsWith('/work/') ? '0.8' : '0.7'
  return `  <url>\n    <loc>${SITE}${p.path}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`
})
await writeFile(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<!-- 빌드 시 자동 생성 (scripts/prerender.mjs) — 직접 수정하지 말 것 -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
)

console.log(`  ✓ 프리렌더 ${pages.length}쪽 + 사이트맵 ${urls.length}건 (프로젝트 ${projects.length})`)
