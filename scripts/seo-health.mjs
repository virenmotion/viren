/* SEO 건강검진 — 라이브 사이트를 밖에서 점검한다.
   실행: node scripts/seo-health.mjs

   왜 필요한가:
   구글 서치 콘솔의 "색인 생성됨" 수치는 로그인이 필요해 자동 조회가 안 된다.
   대신 **그 수치를 떨어뜨리는 원인**을 점검한다. 실제로 겪은 사고들이다.
     · 프로젝트를 추가하고 재배포를 안 해 사이트맵이 옛날 것 (2026-09-01)
     · DB 조회 실패 → 시드 폴백 → 프로젝트 페이지 전부 noindex (2026-09-01)
     · 프리렌더가 깨져 canonical이 전부 홈을 가리킴 (2026-08-18)
   전부 밖에서 감지 가능하다. 하나라도 어긋나면 색인이 조용히 빠진다. */

const SITE = 'https://www.viren.kr'
const YETI = 'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)'

const fails = []
const warns = []
const ok = (m) => console.log('  ✅ ' + m)
const bad = (m) => { fails.push(m); console.log('  ❌ ' + m) }
const warn = (m) => { warns.push(m); console.log('  ⚠️  ' + m) }

const get = async (url, ua = YETI) => {
  const r = await fetch(url, { headers: { 'User-Agent': ua } })
  return { status: r.status, html: await r.text() }
}
const pick = (html, re) => (html.match(re) || [])[1]

/* ---------- 1. 사이트맵 ---------- */
console.log('\n[1] 사이트맵')
const sm = await get(`${SITE}/sitemap.xml`)
if (sm.status !== 200) bad(`sitemap.xml 응답 ${sm.status}`)
const urls = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
const workUrls = urls.filter((u) => u.includes('/work/'))
ok(`URL ${urls.length}개 (프로젝트 ${workUrls.length}개)`)

/* ---------- 2. DB와 사이트맵이 맞는가 (재배포 누락 감지) ---------- */
console.log('\n[2] DB ↔ 사이트맵')
const SB = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY
if (!SB || !KEY) {
  warn('Supabase 환경변수 없음 — DB 대조를 건너뛴다')
} else {
  /* hidden(숨김) 프로젝트는 사이트맵에서 일부러 뺀다 — 누락으로 세면 안 된다.
     hidden 컬럼이 없는 DB에서는 400이 나므로 slug만 받는 조회로 한 번 더 시도한다. */
  const q = async (sel) => {
    const r = await fetch(`${SB}/rest/v1/projects?select=${sel}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    })
    return r.ok ? await r.json() : null
  }
  const rows = (await q('slug,hidden')) || (await q('slug')) || []
  const shown = rows.filter((p) => !p.hidden)
  const hiddenN = rows.length - shown.length
  const dbSlugs = shown.map((p) => p.slug)
  const smSlugs = workUrls.map((u) => u.split('/work/')[1])
  const missing = dbSlugs.filter((s) => !smSlugs.includes(s))
  const extra = smSlugs.filter((s) => !dbSlugs.includes(s))
  if (missing.length) bad(`사이트맵에 없는 DB 프로젝트 ${missing.length}건 → 재배포 필요: ${missing.join(', ')}`)
  if (extra.length) bad(`DB에 없는 사이트맵 항목 ${extra.length}건: ${extra.join(', ')}`)
  if (!missing.length && !extra.length) {
    ok(`공개 ${dbSlugs.length}건과 완전히 일치${hiddenN ? ` (숨김 ${hiddenN}건 제외)` : ''}`)
  }
}

/* ---------- 3. 페이지별 점검 ---------- */
console.log('\n[3] 페이지별 (Yeti 기준)')
let pageFail = 0
for (const u of urls) {
  const { status, html } = await get(u)
  const canonical = pick(html, /rel="canonical" href="([^"]+)"/)
  const robots = pick(html, /name="robots" content="([^"]+)"/)
  const noscript = (pick(html, /<noscript>([\s\S]*?)<\/noscript>/) || '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const path = u.replace(SITE, '') || '/'
  const problems = []
  if (status !== 200) problems.push(`응답 ${status}`)
  if (canonical?.replace(/\/$/, '') !== u.replace(/\/$/, '')) problems.push(`canonical 불일치(${canonical})`)
  if (!/^index/.test(robots || '')) problems.push(`robots=${robots}`)
  if (noscript.length < 150) problems.push(`본문 ${noscript.length}자`)
  if (problems.length) { bad(`${path} — ${problems.join(' / ')}`); pageFail++ }
}
if (!pageFail) ok(`${urls.length}개 전부 정상 (200 · canonical 자기참조 · index · 본문 있음)`)

/* ---------- 4. 내부 링크 (다른 프로젝트) ---------- */
console.log('\n[4] 상세 간 내부 링크')
let linkFail = 0
for (const u of workUrls) {
  const { html } = await get(u)
  const ns = pick(html, /<noscript>([\s\S]*?)<\/noscript>/) || ''
  const n = (ns.match(/href="\/work\/[a-z0-9-]+"/g) || []).length
  if (n < 3) { bad(`${u.split('/work/')[1]} — 다른 프로젝트 링크 ${n}개`); linkFail++ }
}
if (!linkFail) ok(`프로젝트 ${workUrls.length}개 전부 3개씩 연결됨`)

/* ---------- 5. robots.txt ---------- */
console.log('\n[5] robots.txt')
const rb = await get(`${SITE}/robots.txt`)
if (rb.status !== 200) bad(`robots.txt 응답 ${rb.status}`)
else if (/Disallow:\s*\/\s*$/m.test(rb.html)) bad('robots.txt가 전체를 차단하고 있다')
else ok('정상 (전체 허용 + /admin 제외)')

/* ---------- 결과 ---------- */
console.log('\n' + '─'.repeat(52))
if (fails.length) {
  console.log(`🔴 문제 ${fails.length}건`)
  fails.forEach((f) => console.log('   · ' + f))
} else {
  console.log('🟢 이상 없음' + (warns.length ? ` (경고 ${warns.length}건)` : ''))
}
process.exitCode = fails.length ? 1 : 0
