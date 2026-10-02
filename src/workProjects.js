/* WORK 게시판 — 카테고리(고정)와 시드 데이터.
   실제 글은 Supabase DB에서 불러오며(ProjectsContext), DB 미연결 시 아래 SEED로 폴백한다.
   관리자 화면(/admin)에서 글을 쓰면 DB에 저장되고 그리드·상세에 반영된다.

   카드 하단 캡션 = client(발주처, 좌상단) · year(연도, 우상단) · titleEn / titleKo(2줄). */

/* WORK 분야(카테고리) 기본값 — DB(site_settings.work_categories) 미설정 시 폴백.
   label=표시명, slug=식별자(프로젝트 cat·/work#slug 필터), hidden=WORK 필터에서 숨김 */
export const DEFAULT_CATEGORIES = [
  { slug: 'media-art', label: 'MEDIA ART', hidden: false },
  { slug: 'immersive', label: 'IMMERSIVE', hidden: false },
  { slug: 'brand-film', label: 'BRAND FILM', hidden: false },
  { slug: 'cgi', label: 'CGI', hidden: false },
  { slug: 'motion-graphics', label: 'MOTION GRAPHICS', hidden: false },
]

/* 하위호환용 파생값 (기본값 기준) */
export const FILTERS = [{ slug: 'all', label: '전체' }, ...DEFAULT_CATEGORIES.map(({ slug, label }) => ({ slug, label }))]
export const CATEGORIES = DEFAULT_CATEGORIES.map(({ slug, label }) => ({ slug, label }))

/* slug → 표시명 (기본값 기준; 동적 라벨은 ProjectsContext의 categories 사용) */
export const catLabel = (slug) => (DEFAULT_CATEGORIES.find((c) => c.slug === slug)?.label) || slug

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

/* DB 미연결 시 폴백 시드. slug = URL 식별자.
   ⚠️ 이 배열은 Supabase projects 테이블의 **목록 수준** 사본이다. 상세 콘텐츠 블록(blocks)은
   일부러 넣지 않는다 — 폴백은 사이트가 깨져 보이지 않게 하는 용도고, blocks까지 복제하면
   프로젝트를 고칠 때마다 시드도 같이 관리해야 해서 금방 어긋난다.
   WorkDetail 은 `Array.isArray(p.blocks)` 로 감싸고 있어 blocks 가 없어도 상세가 깨지지 않는다.
   ⚠️ **숨김(hidden) 프로젝트는 넣지 않는다.** 공개로 전환할 때 여기에도 추가할 것.
   마지막 동기화: 2026-10-02 (공개 10건). */
export const SEED_PROJECTS = [
  {
    slug: "heritage-media-art-in-ganghwa", cat: "media-art", kind: null, sort: 0,
    titleEn: "HERITAGE MEDIA ART in Ganghwa",
    titleKo: "대한성공회 강화성당 국가유산 미디어아트 콘텐츠 제작",
    client: "인천광역시 강화군청", year: "2026",
    location: "대한성공회 강화성당, 인천", deliverables: "미디어아트 3종 · 대기영상 4종",
    youtube: "https://youtu.be/jxRjmemwlD4",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-mtwnfl9l-f5sw.webp",
    desc: "인천 강화군 대한성공회 강화성당에 강화의 역사와 성공회 선교 이야기를 담은 국가유산 미디어아트를 제작했습니다.",
  },
  {
    slug: "seasonal-media-content", cat: "media-art", kind: null, sort: 0,
    titleEn: "SEASONAL MEDIA CONTENT",
    titleKo: "충주댐 물문화관 봄 시즌 미디어파사드 콘텐츠 제작",
    client: "한국수자원공사", year: "2026",
    location: "충청북도 충주시", deliverables: "봄 시즌 이벤트영상 1종",
    youtube: "https://youtu.be/bujFcDQ5efw",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-mso48thw-28xk.png",
    desc: "충청북도 충주시 충주댐 물문화관에 벚꽃 피는 봄밤을 그린 시즌 이벤트 미디어파사드를 연출했습니다.",
  },
  {
    slug: "architectural-media-facade", cat: "media-art", kind: null, sort: 1,
    titleEn: "ARCHITECTURAL MEDIA FACADE",
    titleKo: "충주댐 야간경관 미디어파사드 콘텐츠 제작",
    client: "한국수자원공사", year: "2025",
    location: "충청북도 충주시", deliverables: "대기영상 2종 · 미디어파사드 4종 · 사계절영상 4종",
    youtube: "https://youtu.be/BtFLeWqiAEA",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-ms2okvk6-9ihw.jpeg",
    desc: "충청북도 충주시 충주댐에 사계절 물빛이 흐르는 'Waterful Night' 야간경관 미디어파사드를 연출했습니다.",
  },
  {
    slug: "apec-gyeongju-3d-stereoscopic-media-facade", cat: "media-art", kind: "MEDIA FACADE", sort: 2,
    titleEn: "3D STEREOSCOPIC MEDIA EXPERIENCE",
    titleKo: "APEC 경주 3D 입체영상 미디어파사드 콘텐츠 제작",
    client: "경상북도문화관광공사", year: "2025",
    location: "경상북도 경주시 ", deliverables: "대기영상 1종 · 이벤트영상 3종 · 미디어파사드 3종",
    youtube: "https://youtu.be/7C7I6yxXQRk",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-mti6m7nk-k7i1.webp",
    desc: "경상북도 경주시 APEC 정상회의 현장에 신라 금관과 21개 회원국 상징을 담은 3D 입체영상 미디어파사드를 선보였습니다.",
  },
  {
    slug: "pellong-pellong-bit-modorak-media-art", cat: "media-art", kind: null, sort: 3,
    titleEn: "HERITAGE MEDIA ART in Jeju",
    titleKo: "국가유산 미디어아트 제주목 관아 콘텐츠 제작",
    client: "국가유산청", year: "2025",
    location: "제주특별자치도 제주시", deliverables: "홍보영상 2종 · 대기영상 2종 · 디지털안내 8종 · 모션그래픽 6종 · 홀로그램 1종",
    youtube: "https://youtu.be/7oNqGiGMKvU",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-mti6fkp8-2k8u.webp",
    desc: "제주시 제주목 관아에 '펠롱펠롱 빛 모드락'을 주제로 한 국가유산 미디어아트를 연출했습니다.",
  },
  {
    slug: "production-of-led-content-for-ganghwa-history-museum", cat: "led", kind: null, sort: 4,
    titleEn: "HERITAGE MUSEUM LED CONTENT",
    titleKo: "강화역사박물관 LED 콘텐츠 제작",
    client: "강화군청", year: "2025",
    location: "인천광역시 강화군", deliverables: "LED콘텐츠 2종",
    youtube: "https://youtu.be/eydGEh85UAw",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-mti6h1nh-dasu.webp",
    desc: "인천 강화군 강화역사박물관에 개성 유적과 강화 유물을 되살린 'TRACE OF TIME' LED 콘텐츠를 제작했습니다.",
  },
  {
    slug: "coastal-multimedia-show", cat: "media-art", kind: null, sort: 5,
    titleEn: "COASTAL MULTIMEDIA SHOW",
    titleKo: "대천해수욕장 분수광장 멀티미디어쇼 모션그래픽 제작",
    client: "충청남도 보령시청", year: "2024",
    location: "충청남도 보령시", deliverables: "모션그래픽 14종",
    youtube: "https://youtu.be/-Q66W67dg2A",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-ms2onris-bsib.jpeg",
    desc: "충청남도 보령시 대천해수욕장 분수광장에 인기 음악 14곡에 맞춘 멀티미디어쇼 모션그래픽을 제작했습니다.",
  },
  {
    slug: "cheongju-seomungyo-led-content-production", cat: "led", kind: null, sort: 6,
    titleEn: "URBAN LED LIGHTING ART",
    titleKo: "청주 서문교 LED 콘텐츠 제작",
    client: "충청북도 청주시청", year: "2024",
    location: "충청북도 청주시", deliverables: "미디어아트 2종 · 음악콘텐츠 2종 · 인터랙티브 9종 · 모션그래픽 2종 · 대기영상 1종",
    youtube: "https://youtu.be/Znl424GvZps",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-mti6j1dg-elu7.webp",
    desc: "충청북도 청주시 서문교에 참여형 인터랙티브와 음악이 어우러진 LED 미디어아트를 선보였습니다.",
  },
  {
    slug: "asia-culture-museum-exhibition-a-world-opened-by-the-monsoon", cat: "exhibition", kind: null, sort: 7,
    titleEn: "MUSEUM EXHIBITION CONTENT",
    titleKo: "아시아문화박물관 ‘몬순으로 열린 세계’ 전시 콘텐츠 제작",
    client: "국립아시아문화전당", year: "2023",
    location: "광주광역시 동구", deliverables: "전시콘텐츠 5종 · OLED콘텐츠 1종 · 인터랙티브 1종 · 키오스크영상 1종 · 편집영상 1종",
    youtube: "https://youtu.be/oGae44JRuk4",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-msmykt2f-3ubx.png",
    desc: "광주 국립아시아문화전당에 계절풍의 여정을 담은 '몬순으로 열린 세계' 전시 콘텐츠를 제작했습니다.",
  },
  {
    slug: "immersive-exhibition-content", cat: "exhibition", kind: null, sort: 8,
    titleEn: "IMMERSIVE EXHIBITION CONTENT",
    titleKo: "POSCO ‘h2 meet’ 전시 실감콘텐츠 제작",
    client: "POSCO", year: "2022",
    location: "경기도 고양시", deliverables: "실감콘텐츠 6종",
    youtube: "https://youtu.be/Ipj9uZdFdtE",
    thumb: "https://wxggycizpfmwjaeltabg.supabase.co/storage/v1/object/public/work-thumbs/thumb-ms2oozjt-bb2w.jpeg",
    desc: "경기도 고양시 POSCO 'h2 meet' 전시관에 수소 밸류체인을 담은 실감콘텐츠를 제작했습니다.",
  },
]
