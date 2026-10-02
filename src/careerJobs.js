/* CAREER 채용 데이터 — 카테고리(고정)와 시드.
   실제 공고는 Supabase(jobs 테이블)에서 불러오며, DB 미연결 시 아래 SEED_JOBS로 폴백한다.
   관리자(/admin → CAREER 탭)에서 공고를 쓰면 DB에 저장되고 목록에 반영된다.

   펼침 상세 = desc(소개) + 표(headcount/responsibilities/qualifications/preferred) + 지원하기.
   list 항목(responsibilities 등)은 줄바꿈(\n)으로 구분 → 한 줄이 표의 한 항목. */

/* 근무조건 — 정적 콘텐츠. 소제목(label)은 한글, 섹션 영문 제목은 WORK CONDITIONS. */
export const WORK_CONDITIONS = [
  { label: '근무지', body: [
    '서울특별시 마포구 양화로8길 32-17, 3층 (VIREN 본사)',
    '프로젝트에 따라 현장 근무 및 출장이 있을 수 있습니다.',
  ] },
  { label: '근무시간', body: [
    '주 5일 근무 (월–금) 10:00 – 19:00',
    '프로젝트 일정에 따라 유연근무제를 운영합니다.',
  ] },
  { label: '채용절차', body: [
    '서류 전형 → 1차 실무 면접 → 2차 최종 면접 → 처우 협의 후 입사',
    '포트폴리오가 필요한 직무는 지원 시 함께 제출해 주세요.',
  ] },
  { label: '복리후생', body: [
    '4대 보험 · 퇴직연금',
    '명절 · 생일 상여, 경조사 지원',
    '중식 지원 및 최신 작업 장비 · 소프트웨어 제공',
    '교육 · 컨퍼런스 참가 및 자기계발 지원',
  ] },
  { label: '공통 자격요건 및 우대사항', body: [
    '자격요건 : 학력·전공 무관이며, 직무 관련 포트폴리오를 보유하고 원활한 커뮤니케이션과 협업이 가능하신 분',
    '우대사항 : 미디어아트·전시·영상 프로젝트 경험자 / 관련 소프트웨어 숙련자 / 해외 프로젝트 커뮤니케이션 가능자',
  ] },
  { label: '유의사항', body: [
    '제출 서류에 허위 사실이 확인될 경우 합격이 취소될 수 있습니다.',
    '지원 서류는 채용 목적으로만 활용되며, 관련 법령에 따라 보관·파기됩니다.',
  ] },
]

export const JOB_FILTERS = [
  { slug: 'all', label: '전체보기' },
  { slug: 'media-art', label: 'MEDIA ART' },
  { slug: 'motion', label: 'MOTION GRAPHICS' },
  { slug: 'cgi', label: '3D / CGI' },
  { slug: 'tech', label: 'CREATIVE TECH' },
  { slug: 'design', label: 'EXPERIENCE DESIGN' },
  { slug: 'pm', label: 'MANAGEMENT' },
]

const JOB_CAT_LABELS = {
  'media-art': 'MEDIA ART', motion: 'MOTION GRAPHICS', cgi: '3D / CGI',
  tech: 'CREATIVE TECH', design: 'EXPERIENCE DESIGN', pm: 'MANAGEMENT', talent: 'TALENT POOL',
}
export const jobCatLabel = (slug) => JOB_CAT_LABELS[slug] || slug

/* 관리자 폼 카테고리 선택지 (talent 포함) */
export const JOB_FORM_CATEGORIES = Object.entries(JOB_CAT_LABELS).map(([slug, label]) => ({ slug, label }))

/* DB 미연결 시 폴백 시드. id = 식별자.
   ⚠️ 이 배열은 Supabase jobs 테이블의 사본이다. 관리자(/admin → CAREER)에서 공고를
   크게 바꾸면 여기도 같이 맞출 것 — 안 맞추면 DB 장애 때 옛 공고가 노출된다.
   마지막 동기화: 2026-10-02 (DB 2건). */
export const SEED_JOBS = [
  {
    id: "talent-pool-인재풀", cat: "general", pinned: true, sort: 0,
    titleEn: "TALENT POOL / 인재풀", titleKo: null,
    type: null,
    desc: "**Create the Next Scene with VIREN**\n바이렌은 브랜드의 이야기를 새로운 경험으로 만드는 콘텐츠 스튜디오 입니다.\n\n우리는 늘 다음 프로젝트를 준비하고,\n그 프로젝트를 함께 완성할 새로운 크리에이터를 찾고 있습니다.\n\n현재 채용 중인 포지션이 아니더라도 괜찮습니다.\n당신만의 시선과 감각, 그리고 가능성을 인재풀에 남겨주세요.\n\n당신의 가능성이 필요한 순간 가장 먼저 연락드리겠습니다.\n\n**We Create Memorable Scenes.**\n**그 장면을 함께 만들어갈 당신을 기다립니다.**",
    headcount: null,
    responsibilities: null,
    qualifications: null,
    preferred: null,
  },
  {
    id: "3d-generalist", cat: "media-art", pinned: false, sort: 0,
    titleEn: "Generalist", titleKo: "미디어아트 / 2D, 3D 디자이너 / 제너럴리스트",
    type: "정규직 · 0년 이상 (수습기간 신입-3개월, 경력-협의)",
    desc: "미디어아트 콘텐츠 제작을 위한 2D, 3D 기반 영상제작 작업",
    headcount: null,
    responsibilities: "콘텐츠 및 뉴미디어 프로젝트를 위한 모션그래픽 디자인\n미디어아트 콘텐츠 기획 및 비주얼 제작\n인터랙티브 콘텐츠 제작",
    qualifications: "2D, 3D 영상 제작 파이프라인에 대한 이해도가 높으신 분\nAdobe 계열 프로그램 활용 가능하신 분\n팀워크의 가치를 이해하고 일할 수 있는 분",
    preferred: "MAYA, C4D, Blender 등 활용 가능하신 분\n영상 촬영 및 편집 가능하신 분\n미디어아트 · 전시 · 영상 제작 관련 프로젝트 경험이 있으신 분",
  },
]
