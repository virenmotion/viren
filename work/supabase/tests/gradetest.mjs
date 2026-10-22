/* 등급 판정을 기준표와 맞춰 본다. node 는 확장자 없는 import 를 못 찾으므로 사본을 만든다. */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const lib = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/src/lib/'
const url = (n) => pathToFileURL(lib + n).href
const hrCopy = pathToFileURL(process.env.SP + '/hr.copy.mjs').href
const fix = (name, out) => {
  const src = readFileSync(lib + name, 'utf8')
    .replace("from './dates'", `from ${JSON.stringify(url('dates.js'))}`)
    .replace("from './hr'", `from ${JSON.stringify(hrCopy)}`)
    .replace("from './majors'", `from ${JSON.stringify(url('majors.js'))}`)
  writeFileSync(process.env.SP + '/' + out, src)
}
// hr.js 사본 먼저 (grade 가 이걸 부른다)
writeFileSync(process.env.SP + '/hr.copy.mjs',
  readFileSync(lib + 'hr.js', 'utf8').replace("from './dates'", `from ${JSON.stringify(url('dates.js'))}`))
fix('grade.js', 'grade.copy.mjs')

const { suggestGrades, suggestDesignGrade } = await import(pathToFileURL(process.env.SP + '/grade.copy.mjs').href)

const ON = '2026-10-22'
/* n년치 경력 한 줄 만들기 (오늘에서 거꾸로) */
const career = (years) => {
  const end = new Date(Date.UTC(2026, 9, 22))
  const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - years)
  return [{ start_date: start.toISOString().slice(0, 10), end_date: ON }]
}

let pass = 0, fail = 0
const T = (label, got, want) => {
  const ok = got === want
  ok ? pass++ : fail++
  console.log(`${ok ? '✅' : '❌'} ${label.padEnd(44)} ${String(got)}${ok ? '' : `   ← 기대: ${want}`}`)
}

console.log('── 가. 기술계 엔지니어링기술자 ──')
const tech = (hr, yrs) => suggestGrades({ ...hr }, career(yrs), null, ON).tech?.grade ?? null
T('기술사 (경력 0)', tech({ qual_kind: '기술사' }, 0), '기술사')
T('기사 + 10년 → 특급', tech({ qual_kind: '기사' }, 10), '특급기술자')
T('기사 + 9년 → 고급', tech({ qual_kind: '기사' }, 9), '고급기술자')
T('기사 + 7년 → 고급', tech({ qual_kind: '기사' }, 7), '고급기술자')
T('기사 + 4년 → 중급', tech({ qual_kind: '기사' }, 4), '중급기술자')
T('기사 + 0년 → 초급', tech({ qual_kind: '기사' }, 0), '초급기술자')
T('산업기사 + 13년 → 특급', tech({ qual_kind: '산업기사' }, 13), '특급기술자')
T('산업기사 + 2년 → 초급', tech({ qual_kind: '산업기사' }, 2), '초급기술자')
T('산업기사 + 1년 → 없음', tech({ qual_kind: '산업기사' }, 1), null)
T('박사 + 4년 → 특급', tech({ edu_level: '박사' }, 4), '특급기술자')
T('박사 + 1년 → 고급', tech({ edu_level: '박사' }, 1), '고급기술자')
T('박사 + 0년 → 중급', tech({ edu_level: '박사' }, 0), '중급기술자')
T('석사 + 9년 → 특급', tech({ edu_level: '석사' }, 9), '특급기술자')
T('석사 + 0년 → 초급', tech({ edu_level: '석사' }, 0), '초급기술자')
T('학사 + 12년 → 특급', tech({ edu_level: '학사' }, 12), '특급기술자')
T('학사 + 6년 → 중급', tech({ edu_level: '학사' }, 6), '중급기술자')
T('학사 + 0년 → 초급', tech({ edu_level: '학사' }, 0), '초급기술자')
T('전문학사 + 15년 → 특급', tech({ edu_level: '전문학사' }, 15), '특급기술자')
T('전문학사 + 3년 → 초급', tech({ edu_level: '전문학사' }, 3), '초급기술자')
T('전문학사 + 2년 → 없음', tech({ edu_level: '전문학사' }, 2), null)
T('고졸 + 20년 → 기술계 없음', tech({ edu_level: '고졸' }, 20), null)

console.log('\n── 나. 숙련기술계 ──')
const skill = (hr, yrs) => suggestGrades({ ...hr }, career(yrs), null, ON).skill?.grade ?? null
T('기능장 + 0년 → 고급숙련', skill({ qual_kind: '기능장' }, 0), '고급숙련기술자')
T('기능사 + 7년 → 고급숙련', skill({ qual_kind: '기능사' }, 7), '고급숙련기술자')
T('기능사 + 3년 → 중급숙련', skill({ qual_kind: '기능사' }, 3), '중급숙련기술자')
T('기능사 + 0년 → 초급숙련', skill({ qual_kind: '기능사' }, 0), '초급숙련기술자')
T('고졸 + 8년 → 고급숙련', skill({ edu_level: '고졸' }, 8), '고급숙련기술자')
T('고졸 + 4년 → 중급숙련', skill({ edu_level: '고졸' }, 4), '중급숙련기술자')
T('고졸 + 1년 → 초급숙련', skill({ edu_level: '고졸' }, 1), '초급숙련기술자')
T('학력·자격 없이 10년 → 중급숙련', skill({}, 10), '중급숙련기술자')
T('학력·자격 없이 5년 → 초급숙련', skill({}, 5), '초급숙련기술자')
T('학력·자격 없이 4년 → 없음', skill({}, 4), null)

console.log('\n── 비고 5: 자격 갖추기 전 경력은 60% ──')
// 기사 자격을 5년 전에 땄고, 경력은 10년 → 5년(100%) + 5년(60%)=3년 → 합 8년 → 고급(7년) 해당, 특급(10년) 미달
const r = suggestGrades(
  { qual_kind: '기사', qual_date: '2021-10-22' }, career(10), null, ON)
T('기사(5년 전 취득) + 경력 10년 → 고급', r.tech?.grade, '고급기술자')
console.log('   인정경력:', (r.days.byQual / 365).toFixed(2), '년 (8.00 근처여야)')

console.log('\n── 디자이너 ──')
const dz = (hr, yrs) => suggestDesignGrade({ ...hr }, career(yrs), null, ON).grade ?? null
T('디자인 전공·학사 + 20년 → 총괄', dz({ major_type: '디자인 전공', edu_level: '학사' }, 20), '총괄 디자이너')
T('디자인 전공·학사 + 16년 → 특급', dz({ major_type: '디자인 전공', edu_level: '학사' }, 16), '특급 디자이너')
T('디자인 전공·학사 + 12년 → 고급', dz({ major_type: '디자인 전공', edu_level: '학사' }, 12), '고급 디자이너')
T('디자인 전공·학사 + 8년 → 중급', dz({ major_type: '디자인 전공', edu_level: '학사' }, 8), '중급 디자이너')
T('디자인 전공·학사 + 4년 → 초급', dz({ major_type: '디자인 전공', edu_level: '학사' }, 4), '초급 디자이너')
T('디자인 전공·학사 + 0년 → 보조', dz({ major_type: '디자인 전공', edu_level: '학사' }, 0), '보조 디자이너')
T('디자인 전공·전문학사 + 2년 → 보조', dz({ major_type: '디자인 전공', edu_level: '전문학사' }, 2), '보조 디자이너')
T('디자인 전공·전문학사 + 1년 → 없음', dz({ major_type: '디자인 전공', edu_level: '전문학사' }, 1), null)
T('비전공·학사 + 2년 → 보조', dz({ major_type: '비전공', edu_level: '학사' }, 2), '보조 디자이너')
T('비전공·학사 + 1년 → 없음', dz({ major_type: '비전공', edu_level: '학사' }, 1), null)
T('기술사 → 고급(경력 0)', dz({ qual_kind: '기술사' }, 0), '고급 디자이너')
T('기사 + 0년 → 보조', dz({ qual_kind: '기사' }, 0), '보조 디자이너')
T('기능사 + 4년 → 초급(구간)', dz({ qual_kind: '기능사' }, 4), '초급 디자이너')
// 디자인 석사 1년 인정: 전공 석사 + 경력 3년 → 4년 → 초급
T('디자인 석사 + 경력 3년 → 초급(학위 1년)', dz({ major_type: '디자인 전공', edu_level: '석사' }, 3), '초급 디자이너')
T('디자인 박사 + 경력 2년 → 초급(학위 2년)', dz({ major_type: '디자인 전공', edu_level: '박사' }, 2), '초급 디자이너')
T('아무것도 없음 → 판정 불가', dz({}, 5), null)

console.log('\n── 자격증 읽기 · 관련 학과 ──')
const { tierOf, bestQual, majorHint } = await import(pathToFileURL(process.env.SP + '/grade.copy.mjs').href)
T('실내건축산업기사 → 산업기사', tierOf('실내건축산업기사'), '산업기사')
T('실내건축기사 → 기사', tierOf('실내건축기사'), '기사')
T('컴퓨터그래픽스운용기능사 → 기능사', tierOf('컴퓨터그래픽스운용기능사'), '기능사')
T('건축전기설비기술사 → 기술사', tierOf('건축전기설비기술사'), '기술사')
T('전산응용건축제도기능사보 → 기능사보', tierOf('전산응용건축제도기능사보'), '기능사보')
T('용접기능장 → 기능장', tierOf('용접기능장'), '기능장')
T('급이 없는 이름', tierOf('정보처리'), '')
T('민간자격은 등급에 안 씀',
  bestQual([{ kind: '민간자격', name: '컬러리스트기사', got_date: '2020-01-01' }]).qual_kind, '')
T('국가기술자격 중 높은 급을 고름', bestQual([
  { kind: '국가기술자격', name: '실내건축기능사', got_date: '2015-01-01' },
  { kind: '국가기술자격', name: '실내건축산업기사', got_date: '2018-01-01' },
]).qual_kind, '산업기사')
T('같은 급이면 먼저 딴 것', bestQual([
  { kind: '국가기술자격', name: '가기사', got_date: '2020-01-01' },
  { kind: '국가기술자격', name: '나기사', got_date: '2018-01-01' },
]).qual_date, '2018-01-01')
T('관련 없는 학과면 학력 경로 막힘',
  suggestGrades({ edu_level: '학사', major_related: '관련 없음' }, career(10), null, ON).tech?.grade ?? null, null)
T('관련 학과면 학력 경로 열림',
  suggestGrades({ edu_level: '학사', major_related: '관련 학과' }, career(10), null, ON).tech?.grade, '고급기술자')
console.log('   실내건축과 →', majorHint('실내건축과'))
console.log('   경영학과   →', majorHint('경영학과'))

console.log('\n── 고시 「엔지니어링기술관련학과의 범위」 목록 ──')
const { majorStatus } = await import(pathToFileURL(process.env.SP + '/grade.copy.mjs').href)
const mv = (major, extra) => majorStatus({ major, ...extra }).value
T('실내건축학과 → 관련 학과', mv('실내건축학과'), '관련 학과')
T('실내건축과 → 관련 학과', mv('실내건축과'), '관련 학과')
T('건축공학과 → 관련 학과 (공학과 떼기)', mv('건축공학과'), '관련 학과')
T('토목공학전공 → 관련 학과', mv('토목공학전공'), '관련 학과')
T('실내건축디자인(야간) → 관련 학과 (괄호 떼기)', mv('실내건축디자인(야간)'), '관련 학과')
T('기계ㆍ시스템디자인학과 → 관련 학과 (가운뎃점)', mv('기계ㆍ시스템디자인학과'), '관련 학과')
T('국어국문학과 → 관련 없음', mv('국어국문학과'), '관련 없음')
T('시각디자인학과 → 관련 없음 (목록에 없다)', mv('시각디자인학과'), '관련 없음')
T('경영학과 → 사람이 정함 (산업부문만)', mv('경영학과'), '')
T('산업디자인학과 → 사람이 정함 (산업부문만)', mv('산업디자인학과'), '')
T('학과를 안 적으면 빈 값', mv(''), '')
T('사람이 고른 값이 이긴다', mv('국어국문학과', { major_related: '관련 학과' }), '관련 학과')
T('목록에 없으면 학력 경로가 막힌다',
  suggestGrades({ edu_level: '학사', major: '국어국문학과' }, career(10), null, ON).tech?.grade ?? null, null)
T('목록에 있으면 학력 경로가 열린다',
  suggestGrades({ edu_level: '학사', major: '실내건축학과' }, career(10), null, ON).tech?.grade, '고급기술자')

console.log('\n── 기간 표시 ──')
const { duration } = await import(hrCopy)
T('400일 → 1년 1개월 5일', duration(400), '1년 1개월 5일')
T('365일 → 1년', duration(365), '1년')
T('30일 → 1개월', duration(30), '1개월')
T('7일 → 7일', duration(7), '7일')
T('0일 → —', duration(0), '—')

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
