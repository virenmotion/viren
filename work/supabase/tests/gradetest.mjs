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

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
