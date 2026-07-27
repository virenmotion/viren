/* WORK 게시판 — 카테고리(고정)와 시드 데이터.
   실제 글은 Supabase DB에서 불러오며(ProjectsContext), DB 미연결 시 아래 SEED로 폴백한다.
   관리자 화면(/admin)에서 글을 쓰면 DB에 저장되고 그리드·상세에 반영된다.

   카드 하단 캡션 = client(발주처, 좌상단) · year(연도, 우상단) · titleEn / titleKo(2줄). */

export const FILTERS = [
  { slug: 'all', label: '전체' },
  { slug: 'media-art', label: 'MEDIA ART' },
  { slug: 'immersive', label: 'IMMERSIVE' },
  { slug: 'brand-film', label: 'BRAND FILM' },
  { slug: 'cgi', label: 'CGI' },
  { slug: 'motion-graphics', label: 'MOTION GRAPHICS' },
]

/* 관리자 폼 카테고리 선택지(전체 제외) */
export const CATEGORIES = FILTERS.filter((f) => f.slug !== 'all')

const LABELS = {
  'media-art': 'MEDIA ART', immersive: 'IMMERSIVE', 'brand-film': 'BRAND FILM',
  cgi: 'CGI', 'motion-graphics': 'MOTION GRAPHICS',
}
export const catLabel = (slug) => LABELS[slug] || slug

/* 제목/문자열 → URL용 슬러그. 한글은 유지하되 공백·특수문자는 하이픈으로. */
export function slugify(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/['".,/#!$%^&*;:{}=`~()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/* DB 미연결 시 폴백 시드. slug = URL 식별자. */
export const SEED_PROJECTS = [
  {
    slug: 'seoul-station-kakao-friends', cat: 'media-art', kind: 'MEDIA FACADE',
    client: 'KAKAO', year: '2025.12',
    titleEn: 'SEOUL STATION KAKAO FRIENDS', titleKo: '서울역 플랫폼111 산타프렌즈',
    youtube: 'aqz-KE-bpKQ', thumb: '',
    desc: '서울역 플랫폼111에 카카오프렌즈 산타프렌즈 IP를 활용한 시즌 미디어 파사드를 선보였습니다. 겨울 시즌의 따뜻한 분위기를 빛과 캐릭터 애니메이션으로 공간에 담았습니다.',
  },
  {
    slug: 'glorry-lights', cat: 'media-art', kind: 'PROJECTION MAPPING',
    client: '롯데월드 어드벤처 부산', year: '2025.09',
    titleEn: 'GLORRY LIGHTS', titleKo: '롯데월드 어드벤처 부산 미디어 쇼',
    youtube: 'aqz-KE-bpKQ', thumb: '',
    desc: '2025년 9월, VIREN은 롯데월드 어드벤처 부산의 상징인 로리캐슬에 멀티미디어 쇼 및 프로젝션 맵핑 콘텐츠 ‘GLorry Lights’를 선보였습니다. 캐슬의 건축적 형태를 살린 빛과 색의 연출로 공간 전체를 하나의 무대로 확장했습니다.',
  },
  {
    slug: 'sensory-garden', cat: 'immersive', kind: 'EXHIBITION',
    client: 'VIREN', year: '2025.07',
    titleEn: 'SENSORY GARDEN', titleKo: '몰입형 인터랙티브 전시',
    youtube: 'aqz-KE-bpKQ', thumb: '',
    desc: '관객의 움직임에 실시간으로 반응하는 오감 자극형 인터랙티브 전시 공간을 설계했습니다.',
  },
  {
    slug: 'brand-origin', cat: 'brand-film', kind: 'BRAND FILM',
    client: 'ORIGIN', year: '2025.03',
    titleEn: 'ORIGIN', titleKo: '브랜드 필름',
    youtube: 'aqz-KE-bpKQ', thumb: '',
    desc: '브랜드의 철학과 가치를 공간과 연결해 오래 기억되는 브랜드 경험을 담은 필름입니다.',
  },
  {
    slug: 'unreal-city', cat: 'cgi', kind: 'CGI',
    client: 'VIREN', year: '2025.02',
    titleEn: 'UNREAL CITY', titleKo: 'CGI 비주얼',
    youtube: 'aqz-KE-bpKQ', thumb: '',
    desc: '현실을 넘어선 상상의 도시를 가장 정교한 CGI 비주얼로 구현했습니다.',
  },
  {
    slug: 'flow-motion', cat: 'motion-graphics', kind: 'MOTION GRAPHICS',
    client: 'VIREN', year: '2025.01',
    titleEn: 'FLOW', titleKo: '모션 그래픽 시리즈',
    youtube: 'aqz-KE-bpKQ', thumb: '',
    desc: '직관적인 모션과 그래픽으로 복잡한 정보를 명확하게 전달하는 모션 그래픽 시리즈입니다.',
  },
]
