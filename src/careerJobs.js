/* CAREER 채용 데이터 — 카테고리(고정)와 시드.
   실제 공고는 Supabase(jobs 테이블)에서 불러오며, DB 미연결 시 아래 SEED_JOBS로 폴백한다.
   관리자(/admin → CAREER 탭)에서 공고를 쓰면 DB에 저장되고 목록에 반영된다.

   펼침 상세 = desc(소개) + 표(headcount/responsibilities/qualifications/preferred) + 지원하기.
   list 항목(responsibilities 등)은 줄바꿈(\n)으로 구분 → 한 줄이 표의 한 항목. */

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

/* DB 미연결 시 폴백 시드. id = 식별자. */
export const SEED_JOBS = [
  {
    id: 'media-art-director', cat: 'media-art', titleEn: 'MEDIA ART DIRECTOR', titleKo: '미디어아트 디렉터',
    type: '정규직 · 경력 5년 이상', sort: 1,
    desc: '미디어아트·프로젝션 맵핑 프로젝트의 비주얼 방향을 총괄하고, 기획부터 구현까지 크리에이티브를 이끌 디렉터를 찾습니다.',
    headcount: '0명(경력)',
    responsibilities: '미디어아트 프로젝트의 아트 디렉션 및 비주얼 컨셉 총괄\n기획·연출·제작 전 과정의 크리에이티브 리드\n아티스트·디자이너 팀 운영 및 퀄리티 관리',
    qualifications: '미디어아트·영상·전시 분야 5년 이상 경력\n프로젝트 아트 디렉션 경험\n레퍼런스 포트폴리오 필수',
    preferred: '대형 미디어 파사드·전시 프로젝트 경험자\n실시간 그래픽(TouchDesigner/Notch) 이해',
  },
  {
    id: 'media-artist', cat: 'media-art', titleEn: 'MEDIA ARTIST', titleKo: '미디어아트 콘텐츠 제작',
    type: '정규직 · 경력 2년 이상', sort: 2,
    desc: '몰입형 미디어아트 콘텐츠를 기획·제작할 아티스트를 찾습니다.',
    headcount: '0명(경력)',
    responsibilities: '미디어아트·모션 콘텐츠 제작\n실시간 그래픽 셋업 및 현장 대응\n프로젝션 맵핑 콘텐츠 제작',
    qualifications: '영상·미디어아트 분야 2년 이상 경력\nTouchDesigner / Notch / After Effects 활용',
    preferred: '인터랙티브 콘텐츠 제작 경험\n현장 셋업 경험자',
  },
  {
    id: 'motion-designer', cat: 'motion', titleEn: 'MOTION GRAPHIC DESIGNER', titleKo: '모션그래픽 디자이너',
    type: '정규직 · 경력 무관', sort: 3,
    desc: '브랜드 필름·모션 그래픽 시리즈를 디자인하고 애니메이팅할 디자이너를 찾습니다.',
    headcount: '0명(경력/신입)',
    responsibilities: '브랜드 필름·모션 그래픽 디자인 및 애니메이팅\n2D/3D 모션 콘텐츠 제작',
    qualifications: 'After Effects / Cinema 4D 활용 능력\n포트폴리오 필수',
    preferred: '3D 모션(Blender/C4D) 경험\n편집·사운드 감각',
  },
  {
    id: '3d-generalist', cat: 'cgi', titleEn: '3D GENERALIST', titleKo: '3D · CGI 아티스트',
    type: '정규직 · 경력 3년 이상', sort: 4,
    desc: '모델링·룩뎁·라이팅·렌더링 전반을 아우르는 3D 제너럴리스트를 찾습니다.',
    headcount: '0명(경력)',
    responsibilities: '3D 모델링·룩뎁·라이팅·렌더링\nCGI 비주얼 콘텐츠 제작',
    qualifications: '3D 분야 3년 이상 경력\nBlender / Houdini / Unreal Engine 활용',
    preferred: '실시간 렌더링(Unreal) 파이프라인 경험\n시뮬레이션(FX) 경험자',
  },
  {
    id: 'creative-technologist', cat: 'tech', titleEn: 'MEDIA SYSTEM ENGINEER', titleKo: '미디어 시스템 엔지니어 / HW PM',
    type: '정규직 · 경력 3년 이상', sort: 5,
    desc: '멀티미디어 전시·체험공간의 디지털미디어 통합 솔루션을 설계하고 HW 구축을 리드할 엔지니어를 찾습니다.',
    headcount: '0명(경력)',
    responsibilities: '멀티미디어 전시/체험공간의 디지털미디어 통합 솔루션 HW 설계\n멀티미디어 전시/체험공간의 HW구축 PM역할\n미디어 서버를 활용한 콘텐츠 업로드 및 타임라인 셋팅, 프로젝터 맵핑 및 영상/음향 셋팅\n프로젝트 PM: 하드웨어 비딩 자료 제작부터 업체 선정, 계약 및 전 공정 일정 관리 리드\n설계 최적화: 국가별 규격에 맞는 실시 설계 검토 및 전력량, 하중, MEP 등 기술적 간섭 해결\n관리: 현장 HW설치 셋팅 총괄 및 시스템 안정성 최종 검증\nR&D 및 가이드 수립: 신규 HW/SW 테스트 및 기술 표준 가이드(트레이, 서버룸 등) 고도화',
    qualifications: '실무 경험: 멀티미디어 전시, 공연, 인테리어 기술 분야에서 3년 이상의 프로젝트 수행 경험이 있으신 분\n설계 역량: AutoCAD 등을 활용하여 HW 배치도, 결선도, 렉 실장도 등의 기술 도면 작성이 능숙하신 분\n협업 능력: 시공, 인테리어, 콘텐츠 제작 등 유관 부서 및 협력사와 유연하게 일정을 조율하고 이슈를 해결할 수 있는 분',
    preferred: '영어 가능자 (중급 이상)\n영상, 음향, 조명, 네트워크 구성 등 특정 분야에 대한 기초 지식이 있거나 관련 프로젝트 유경험자\n관련 학과 전공 / 영상, 전시, 음향 등 관련 학과 전공자\n장비 숙련도: Pandoras Box, Watchout 등 미디어 서버 및 전문 AV 컨트롤 시스템 경험자',
  },
  {
    id: 'experience-designer', cat: 'design', titleEn: 'EXPERIENCE DESIGNER', titleKo: '공간 · 경험 디자이너',
    type: '정규직 · 경력 2년 이상', sort: 6,
    desc: '전시·공간 단위의 몰입형 경험을 설계할 디자이너를 찾습니다.',
    headcount: '0명(경력)',
    responsibilities: '전시·공간 경험 기획 및 설계\n관람 동선·연출 시나리오 설계\n공간 그래픽·사이니지 디자인',
    qualifications: '공간·전시 디자인 2년 이상 경력\n공간 기획 및 도면 이해',
    preferred: '몰입형 전시 프로젝트 경험\n3D 공간 시각화 툴 활용',
  },
  {
    id: 'project-manager', cat: 'pm', titleEn: 'PROJECT MANAGER', titleKo: '프로젝트 매니저',
    type: '정규직 · 경력 3년 이상', sort: 7,
    desc: '프로젝트의 일정·예산·커뮤니케이션을 총괄할 매니저를 찾습니다.',
    headcount: '0명(경력)',
    responsibilities: '프로젝트 일정·예산·리소스 관리\n클라이언트·협력사 커뮤니케이션\n제작 전 공정 진행 관리',
    qualifications: '콘텐츠·전시 프로젝트 관리 3년 이상 경력\n일정·예산 관리 역량',
    preferred: '미디어아트·전시 산업 이해\n영어 커뮤니케이션 가능자',
  },
  {
    id: 'talent-pool', cat: 'talent', titleEn: 'TALENT POOL', titleKo: '인재풀 (상시 지원)',
    type: '상시 모집', sort: 99,
    desc: '지금 열린 공고에 딱 맞는 자리가 없더라도, VIREN과 함께하고 싶다면 언제든 지원해 주세요. 포지션이 열리면 먼저 연락드립니다.',
    headcount: '상시',
    responsibilities: '',
    qualifications: '',
    preferred: '',
  },
]
