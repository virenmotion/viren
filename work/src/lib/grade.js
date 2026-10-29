import { parse, today } from './dates'
import { mergeRanges } from './hr'
import { HOME_FIELDS, findMajor } from './majors'

/* 엔지니어링기술자 등급 제시. (지은님이 준 기준표, 2026-10-22)
   근거: 엔지니어링산업 진흥법 시행령 [별표 2]
         가. 기술계 엔지니어링기술자 / 나. 숙련기술계 엔지니어링기술자

   ⚠️ **제시만 한다. 정하는 건 사람이다.**
      '해당 전문분야와 관련된 업무' 인지는 기계가 알 수 없다. 여기서는 적어 둔 경력을
      전부 관련 경력으로 보고 센다. 실제로는 관련 없는 경력이 섞여 있을 수 있다.

   ⚠️ 비고 5: **자격·학력을 갖추기 전 경력은 60%만** 반영한다.
      그래서 자격취득일·졸업일이 필요하다. 비어 있으면 100% 로 세고 '최대치' 라고 알린다. */

const DAY = 86400000
const Y = 365   // 1년을 365일로 본다. 시행령에 일수 환산 규정이 없어 통상 방식을 쓴다.

/* 고르는 값 — 화면의 드롭다운과 규칙이 같은 글자를 써야 한다 */
export const QUALS = ['기술사', '기능장', '기사', '산업기사', '기능사', '기능사보']
export const EDUS = ['박사', '석사', '학사', '전문학사', '고졸', '직업훈련 이수']

export const TECH_TRACK = ['기술사', '특급기술자', '고급기술자', '중급기술자', '초급기술자']
export const SKILL_TRACK = ['고급숙련기술자', '중급숙련기술자', '초급숙련기술자']

/* 규칙: 위에서부터 높은 등급. 하나라도 맞으면 그 등급. */
const RULES = [
  // ── 가. 기술계 ────────────────────────────────────────────
  { grade: '기술사', qual: '기술사', years: 0 },

  { grade: '특급기술자', qual: '기사', years: 10 },
  { grade: '특급기술자', qual: '산업기사', years: 13 },
  { grade: '특급기술자', edu: '박사', years: 4 },
  { grade: '특급기술자', edu: '석사', years: 9 },
  { grade: '특급기술자', edu: '학사', years: 12 },
  { grade: '특급기술자', edu: '전문학사', years: 15 },

  { grade: '고급기술자', qual: '기사', years: 7 },
  { grade: '고급기술자', qual: '산업기사', years: 10 },
  { grade: '고급기술자', edu: '박사', years: 1 },
  { grade: '고급기술자', edu: '석사', years: 6 },
  { grade: '고급기술자', edu: '학사', years: 9 },
  { grade: '고급기술자', edu: '전문학사', years: 12 },

  { grade: '중급기술자', qual: '기사', years: 4 },
  { grade: '중급기술자', qual: '산업기사', years: 7 },
  { grade: '중급기술자', edu: '박사', years: 0 },
  { grade: '중급기술자', edu: '석사', years: 3 },
  { grade: '중급기술자', edu: '학사', years: 6 },
  { grade: '중급기술자', edu: '전문학사', years: 9 },

  { grade: '초급기술자', qual: '기사', years: 0 },
  { grade: '초급기술자', qual: '산업기사', years: 2 },
  { grade: '초급기술자', edu: '석사', years: 0 },
  { grade: '초급기술자', edu: '학사', years: 0 },
  { grade: '초급기술자', edu: '전문학사', years: 3 },

  // ── 나. 숙련기술계 ────────────────────────────────────────
  { grade: '고급숙련기술자', qual: '기능장', years: 0 },
  { grade: '고급숙련기술자', qual: '산업기사', years: 4 },
  { grade: '고급숙련기술자', qual: '기능사', years: 7 },
  { grade: '고급숙련기술자', qual: '기능사보', years: 10 },
  { grade: '고급숙련기술자', edu: '전문학사', years: 5 },   // 기능대학 또는 전문대학
  { grade: '고급숙련기술자', edu: '고졸', years: 8 },
  { grade: '고급숙련기술자', edu: '직업훈련 이수', years: 8 },

  { grade: '중급숙련기술자', qual: '산업기사', years: 0 },
  { grade: '중급숙련기술자', qual: '기능사', years: 3 },
  { grade: '중급숙련기술자', qual: '기능사보', years: 5 },
  { grade: '중급숙련기술자', edu: '전문학사', years: 1 },
  { grade: '중급숙련기술자', edu: '고졸', years: 4 },
  { grade: '중급숙련기술자', edu: '직업훈련 이수', years: 6 },
  { grade: '중급숙련기술자', years: 10 },                   // 학력·자격 무관

  { grade: '초급숙련기술자', qual: '기능사', years: 0 },
  { grade: '초급숙련기술자', qual: '기능사보', years: 2 },
  { grade: '초급숙련기술자', edu: '고졸', years: 1 },
  { grade: '초급숙련기술자', edu: '직업훈련 이수', years: 1 },
  { grade: '초급숙련기술자', years: 5 },                    // 학력·자격 무관
]

/* 학력은 위가 아래를 포함한다. 박사는 '학사 + N년' 규칙도 만족한다. */
const EDU_ORDER = ['고졸', '직업훈련 이수', '전문학사', '학사', '석사', '박사']
const eduMeets = (have, need) => {
  if (!have) return false
  if (have === need) return true
  // 직업훈련 이수는 학위 계통이 아니라 따로 본다 — 고졸 규칙만 같이 만족한다고 보지 않는다
  if (have === '직업훈련 이수' || need === '직업훈련 이수') return false
  const h = EDU_ORDER.indexOf(have)
  const n = EDU_ORDER.indexOf(need)
  return h >= 0 && n >= 0 && h >= n
}

/* 자격도 위가 아래를 포함한다 (기술사 > 기능장 > 기사 > 산업기사 > 기능사 > 기능사보) */
const QUAL_ORDER = ['기능사보', '기능사', '산업기사', '기사', '기능장', '기술사']
const qualMeets = (have, need) => {
  if (!have) return false
  const h = QUAL_ORDER.indexOf(have)
  const n = QUAL_ORDER.indexOf(need)
  return h >= 0 && n >= 0 && h >= n
}

const dayNum = (s) => Math.floor(parse(s).getTime() / DAY)

/* 갖추기 전 경력은 60% 만. cutoff 가 없으면 전부 100%. */
function credited(ranges, cutoff) {
  const c = cutoff ? dayNum(cutoff) : null
  let before = 0
  let after = 0
  for (const [a, b] of ranges) {
    if (c == null) { after += b - a + 1; continue }
    const pb = Math.min(b, c - 1)
    if (pb >= a) before += pb - a + 1
    const pa = Math.max(a, c)
    if (b >= pa) after += b - pa + 1
  }
  return after + before * 0.6
}

/* hr: { qual_kind, qual_date, edu_level, edu_date }
   careers: employee_careers 줄들, hireDate: 바이렌 입사일 */
export function suggestGrades(hr, careers, hireDate, on = today()) {
  const all = [
    ...(careers || []).map((c) => ({ start: c.start_date, end: c.end_date })),
    ...(hireDate ? [{ start: hireDate, end: null }] : []),
  ]
  const { ranges } = mergeRanges(all)
  if (!ranges.length) return { tech: null, skill: null, days: {}, guessed: false }

  const byQual = credited(ranges, hr?.qual_date || null)
  const byEdu = credited(ranges, hr?.edu_date || null)
  const plain = credited(ranges, null)

  /* 비고 2: 관련 없는 학과면 학력으로는 등급을 받을 수 없다.
     '아직 모름' 은 일단 쓰되 화면에서 확인하라고 알린다. */
  const ms = majorStatus(hr)
  const eduUsable = ms.value !== '관련 없음'

  const hit = (r) => {
    if (r.qual) return qualMeets(hr?.qual_kind, r.qual) && byQual >= r.years * Y
    if (r.edu) return eduUsable && eduMeets(hr?.edu_level, r.edu) && byEdu >= r.years * Y
    return plain >= r.years * Y          // 학력·자격 무관
  }

  const found = RULES.filter(hit)
  const pick = (track) => {
    const m = found.filter((r) => track.includes(r.grade))
    if (!m.length) return null
    // track 은 높은 등급이 앞에 있다
    m.sort((a, b) => track.indexOf(a.grade) - track.indexOf(b.grade))
    return m[0]
  }

  const why = (r) => {
    if (!r) return ''
    const base = r.qual ? r.qual : r.edu ? r.edu : '학력·자격 무관'
    return r.years ? `${base} + 경력 ${r.years}년` : base
  }

  const tech = pick(TECH_TRACK)
  const skill = pick(SKILL_TRACK)
  return {
    tech: tech ? { grade: tech.grade, why: why(tech) } : null,
    skill: skill ? { grade: skill.grade, why: why(skill) } : null,
    days: { byQual, byEdu, plain },
    /* 자격취득일·졸업일을 안 적었으면 60% 규칙을 못 써서 실제보다 높게 나올 수 있다 */
    guessed: (!!hr?.qual_kind && !hr?.qual_date) || (!!hr?.edu_level && !hr?.edu_date),
    /* 학과가 관련 학과인지 아직 못 정했다 — 학력으로 등급이 나왔다면 확인이 필요하다 */
    majorUnsure: !!hr?.edu_level && ms.value === '',
    major: ms,
    on,
  }
}

export const yearsOf = (days) => Math.floor((days / Y) * 10) / 10

/* ── 디자이너 등급 (지은님이 준 기준표, 2026-10-22) ──────────────────
   등급은 **인정 실무경력 년수 구간**으로 정해진다.
     총괄 20년↑ · 특급 16~20 · 고급 12~16 · 중급 8~12 · 초급 4~8 · 보조 ~4

   예외와 가산
     · 기술사 자격소지자 → 고급디자이너 (경력·학력 안 봐도 됨)
     · 디자인 박사 2년, 디자인 석사 1년을 경력으로 인정
     · 보조디자이너로 '들어오는' 요건이 전공 여부·학력·자격마다 다르다

   ⚠️ 고졸을 전공 구분으로 가르는 것은 **내가 정한 게 아니라 표가 그렇게 돼 있다**
      (디자인 전공=특성화고 디자인전공, 준 전공=특성화고 미술전공, 비전공=일반고).
      2026-10-29 에 원본 표와 한 줄씩 맞춰 확인했다.

   ⚠️ 표에 **칸이 없는 곳이 한 군데** 있다 — 준 전공자의 석사·박사.
      **0년으로 본다(지은님 2026-10-29 확정).** 표가 쓰는 규칙을 그대로 이었다:
        비전공은 석사 이상 1년 · 학사 2년 — 석사가 학사보다 한 해 유리하다.
        준전공 학사가 1년이니 석사 이상은 0년이 된다.
      ⚠️ 이건 **등급을 높게 주는 쪽**이다. 표에 없는 칸이라 다툼이 생기면
         근거가 이 주석뿐이다. 서류를 다투게 되면 여기부터 본다. */

export const MAJOR_TYPES = ['디자인 전공', '준 전공(미술 등)', '비전공']

export const DESIGN_TRACK = [
  '총괄 디자이너', '특급 디자이너', '고급 디자이너',
  '중급 디자이너', '초급 디자이너', '보조 디자이너',
]

/* 보조디자이너로 들어오는 데 필요한 실무경력(년). 없으면 그 길은 막힘. */
const ENTRY_BY_EDU = {
  '디자인 전공':      { 박사: 0, 석사: 0, 학사: 0, 전문학사: 2, 고졸: 4 },
  '준 전공(미술 등)': { 박사: 0, 석사: 0, 학사: 1, 전문학사: 3, 고졸: 5 },
  '비전공':           { 박사: 1, 석사: 1, 학사: 2, 전문학사: 4, 고졸: 6 },
}
/* 자격으로 들어오는 길 */
const ENTRY_BY_QUAL = { 기사: 0, 산업기사: 2, 기능사: 4 }

/* 등급 구간 — 위에서부터 */
const BANDS = [
  ['총괄 디자이너', 20],
  ['특급 디자이너', 16],
  ['고급 디자이너', 12],
  ['중급 디자이너', 8],
  ['초급 디자이너', 4],
  ['보조 디자이너', 0],
]

export function suggestDesignGrade(hr, careers, hireDate, on = today()) {
  const all = [
    ...(careers || []).map((c) => ({ start: c.start_date, end: c.end_date })),
    ...(hireDate ? [{ start: hireDate, end: null }] : []),
  ]
  const { ranges } = mergeRanges(all)
  const real = credited(ranges, null) / Y          // 실제 실무경력(년)

  /* 디자인 석·박사는 경력으로 인정 */
  const design = hr?.major_type === '디자인 전공'
  const bonus = design && hr?.edu_level === '박사' ? 2
    : design && hr?.edu_level === '석사' ? 1 : 0
  const years = real + bonus

  /* 기술사는 경력·학력을 안 봐도 고급디자이너 */
  if (qualMeets(hr?.qual_kind, '기술사')) {
    return { grade: '고급 디자이너', why: '기술사 자격소지자', years, bonus, on }
  }

  /* 들어올 수 있나 */
  const byEdu = ENTRY_BY_EDU[hr?.major_type]?.[hr?.edu_level]
  const byQual = Object.entries(ENTRY_BY_QUAL)
    .filter(([q]) => qualMeets(hr?.qual_kind, q))
    .map(([, y]) => y)
  const need = [byEdu, ...byQual].filter((v) => v != null)
  if (!need.length) {
    return { grade: null, why: '전공 구분·학력 또는 자격을 적어야 판정할 수 있어요.', years, bonus, on }
  }
  const lowest = Math.min(...need)
  if (years < lowest) {
    return {
      grade: null,
      why: `보조디자이너가 되려면 실무경력 ${lowest}년이 필요해요 (지금 ${yearsOf(years * Y)}년).`,
      years, bonus, on,
    }
  }

  const band = BANDS.find(([, y]) => years >= y)
  const why = [
    hr?.major_type,
    hr?.edu_level,
    `인정경력 ${yearsOf(years * Y)}년`,
    bonus ? `(학위 ${bonus}년 포함)` : '',
  ].filter(Boolean).join(' · ')
  return { grade: band[0], why, years, bonus, on }
}

/* ── 자격증 ──────────────────────────────────────────────────────
   국가기술자격 종목명은 늘 급으로 끝난다('실내건축산업기사' → 산업기사).
   ⚠️ 찾는 차례가 중요하다. '산업기사' 를 '기사' 보다 먼저 봐야 하고,
      '기능사보' 를 '기능사' 보다 먼저 봐야 한다. */
const TIER_BY_SUFFIX = ['기능사보', '산업기사', '기능장', '기술사', '기사', '기능사']

export function tierOf(name) {
  const s = String(name || '').replace(/\s/g, '')
  return TIER_BY_SUFFIX.find((t) => s.endsWith(t)) || ''
}

/* 등급 판정에 쓸 자격 하나.
   ⚠️ 시행령 [별표2] 비고 1 — **국가기술자격만** 쓴다. 민간자격은 기록만 한다.
   같은 급이 여럿이면 **먼저 딴 것**을 쓴다(비고 5 의 60% 구간이 그만큼 짧아진다). */
export function bestQual(certs) {
  const ok = (certs || [])
    .filter((c) => c.kind === '국가기술자격')
    .map((c) => ({ tier: tierOf(c.name), date: c.got_date }))
    .filter((c) => c.tier)
  if (!ok.length) return { qual_kind: '', qual_date: null }
  ok.sort((a, b) => {
    const d = QUAL_ORDER.indexOf(b.tier) - QUAL_ORDER.indexOf(a.tier)
    if (d) return d
    return String(a.date || '9999').localeCompare(String(b.date || '9999'))
  })
  return { qual_kind: ok[0].tier, qual_date: ok[0].date || null }
}

/* ── 관련 학과인가 ───────────────────────────────────────────────
   시행령 [별표2] 비고 2 — '학력자' 는 **엔지니어링기술 관련 학과**를 나온 사람이다.
   관련 없는 학과면 학력으로는 등급을 받지 못한다.

   어느 학과가 관련 학과인지는 고시 '엔지니어링기술관련학과의 범위'([별표 2]) 에 적혀 있다.
   지은님이 2026-10-22 에 그 한글 파일을 주셔서 majors.js 에 1,305개를 그대로 옮겼다.
   이제 이름으로 추측하지 않는다.

   ⚠️ 그래도 **마지막은 사람이 정한다.** 고시 목록은 부문(기계·건설·산업…)으로 나뉘는데,
      등급은 '해당 전문분야' 기준이다. 예를 들어 '경영' 은 산업부문 목록에는 있지만
      바이렌이 하는 건설 쪽 일과는 상관이 없다. 그래서 바이렌 부문(majors.js 의
      HOME_FIELDS)에 있을 때만 자동으로 '관련 학과' 로 보고, 다른 부문에만 있으면
      판단을 사람에게 넘긴다. */

/* 돌려주는 값
     value : '관련 학과' | '관련 없음' | ''(사람이 정해야 함)
     auto  : 고시 목록으로 자동으로 본 것인가 (false = 사람이 골라 둔 값)
     why   : 화면에 그대로 보여 줄 한 줄 */
export function majorStatus(hr) {
  if (hr?.major_related) {
    return { value: hr.major_related, auto: false, why: '직접 정하신 값입니다.' }
  }
  const major = String(hr?.major || '').trim()
  if (!major) return { value: '', auto: false, why: '학과를 적으면 고시 목록에서 찾아봅니다.' }

  const found = findMajor(major)
  if (!found) {
    return {
      value: '관련 없음',
      auto: true,
      why: '고시 「엔지니어링기술관련학과의 범위」 목록에 없습니다 — 학력으로는 기술자등급을 받지 못합니다.',
    }
  }
  if (found.fields.some((x) => HOME_FIELDS.includes(x))) {
    return {
      value: '관련 학과',
      auto: true,
      why: "고시 목록에 있습니다 — '" + found.stem + "' · " + found.fields.join(', '),
    }
  }
  return {
    value: '',
    auto: true,
    why: "고시 목록에 있기는 합니다 — '" + found.stem + "' · " + found.fields.join(', ')
      + '. 바이렌이 하는 건설·설비 쪽 부문은 아니라서 직접 정해 주셔야 합니다.',
  }
}

/* 화면에 띄울 한 줄 */
export const majorHint = (major) => majorStatus({ major }).why
