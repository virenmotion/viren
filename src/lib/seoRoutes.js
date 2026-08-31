/* 라우트별 검색 노출 메타데이터 — 앱(useSeo)과 빌드 프리렌더(scripts/prerender.mjs)가 함께 쓴다.
   같은 문구를 두 곳에 적어두면 반드시 한쪽만 고쳐져 어긋나므로 여기 한 곳에만 둔다.

   ⚠️ 이 파일에서는 react를 import하지 말 것. Node가 빌드 중에 그대로 불러 쓴다. */

export const SITE = 'https://www.viren.kr'
export const BRAND = 'VIREN 바이렌'

/* 설명문은 80자 이내 — 네이버 URL 검사 권장치 */
export const SEO = {
  home: {
    title: BRAND,
    description: '바이렌(VIREN)은 미디어아트, 미디어파사드, LED 콘텐츠를 제작하는 서울의 콘텐츠 프로덕션 스튜디오입니다.',
    path: '/',
  },
  work: {
    title: `WORK 프로젝트 | ${BRAND}`,
    description: '바이렌(VIREN)이 제작한 미디어아트, 미디어파사드, LED 콘텐츠 프로젝트를 소개합니다.',
    path: '/work',
  },
  career: {
    title: `CAREER 채용 | ${BRAND}`,
    description: '바이렌(VIREN)과 함께할 크리에이터를 찾습니다. 채용 공고와 지원 방법을 확인하세요.',
    path: '/career',
  },
  contact: {
    title: `CONTACT 문의 | ${BRAND}`,
    description: '프로젝트 문의와 협업 제안은 바이렌(VIREN)으로 연락 주세요. 서울 마포구 소재.',
    path: '/contact',
  },
}

/* 페이지 주제를 알리는 h1. 화면의 헤딩이 전부 영문 장식 문구라 h1이 없었고,
   그 탓에 '바이렌'이 본문 텍스트에 한 번도 등장하지 않아 해당 키워드로 매칭이 불가능했다.
   스크린리더 사용자에게도 페이지 주제를 알려주는 역할을 겸한다. */
export const H1 = {
  home: '바이렌(VIREN) — 미디어아트 · 미디어파사드 · LED 콘텐츠 제작 스튜디오',
  work: '바이렌(VIREN) 프로젝트 — 미디어아트 · 미디어파사드 · LED 콘텐츠 제작 사례',
  career: '바이렌(VIREN) 채용 — 함께할 크리에이터를 찾습니다',
  contact: '바이렌(VIREN) 문의 — 서울 마포구 콘텐츠 프로덕션 스튜디오',
}

/* 프로젝트 상세의 제목·설명 — 화면(WorkDetail)과 프리렌더가 같은 규칙을 써야
   크롤러가 본 내용과 실제 화면이 어긋나지 않는다(어긋나면 클로킹으로 간주됨). */
export function projectTitle(p) {
  return `${p.titleKo || p.titleEn} | ${BRAND}`
}
export function projectDescription(p, catLabel) {
  const summary = (p.desc || '').replace(/\s+/g, ' ').trim().slice(0, 78)
  if (summary) return summary
  return `${catLabel(p.cat)} 프로젝트 — 바이렌(VIREN)이 제작한 ${p.titleKo || p.titleEn}입니다.`.slice(0, 78)
}

/* 다른 프로젝트 추천 — 화면(WorkDetail)과 프리렌더가 **같은 결과**를 내야 한다.
   서로 다르면 크롤러가 보는 링크와 사람이 보는 링크가 어긋나 클로킹으로 간주된다.

   왜 필요한가: 내부 링크 구조가 별 모양이었다. /work → 상세 9개 → 다시 /work.
   각 상세 페이지가 받는 내부 링크가 1개뿐이라 검색엔진이 중요도를 낮게 본다.
   같은 분야를 먼저 채우고 모자라면 나머지로 채운다(정렬 순서 유지 = 결과가 항상 같다). */
export function pickRelated(all, current, n = 3) {
  if (!Array.isArray(all) || !current) return []
  const others = all.filter((p) => p.slug !== current.slug)
  const sameCat = others.filter((p) => p.cat === current.cat)
  const rest = others.filter((p) => p.cat !== current.cat)
  return [...sameCat, ...rest].slice(0, n)
}
