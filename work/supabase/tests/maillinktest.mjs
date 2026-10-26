/* '앱으로 열기' 주소를 제대로 거르는지. (2026-10-26)
   ⚠️ 여기가 느슨하면 아무 주소나 '자세히 읽기' 가 열게 된다.
   실행: SP=<임시폴더> node supabase/tests/maillinktest.mjs */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const src = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/src/components/MailLinkCard.jsx'

// 화면 부분은 떼고 순수 계산만 가져온다(다른 시험과 같은 방식).
const copy = `${process.env.SP}/maillink.copy.mjs`
const text = readFileSync(src, 'utf8')
const start = text.indexOf("const OK_PREFIX")
const end = text.indexOf('export default function')
writeFileSync(copy, text.slice(start, end))
const { tidyMailLink } = await import(pathToFileURL(copy).href)

let pass = 0, fail = 0
const ok = (name, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want)
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(44)} ${good ? '' : `받음 ${JSON.stringify(got)} / 기대 ${JSON.stringify(want)}`}`)
}

const P = 'https://kakaowork.com/archives/'

ok('대화방 주소 그대로', tidyMailLink(`${P}4XmAZszPj`), `${P}4XmAZszPj`)
// 메시지까지 가리키는 긴 주소는 **그때 그 메일**로만 간다 — 대화방까지만 남긴다
ok('메시지 번호는 떼어 낸다', tidyMailLink(`${P}4XmAZszPj/1EQzMk1Iqh6`), `${P}4XmAZszPj`)
ok('물음표 뒤도 떼어 낸다', tidyMailLink(`${P}4XmAZszPj?from=share`), `${P}4XmAZszPj`)
ok('# 뒤도 떼어 낸다', tidyMailLink(`${P}4XmAZszPj#top`), `${P}4XmAZszPj`)
ok('앞뒤 공백', tidyMailLink(`  ${P}4XmAZszPj  `), `${P}4XmAZszPj`)
ok('끝에 / 하나', tidyMailLink(`${P}4XmAZszPj/`), `${P}4XmAZszPj`)

ok('비우면 비운 채로', tidyMailLink(''), '')
ok('공백만 넣어도 비움', tidyMailLink('   '), '')
ok('없는 값', tidyMailLink(null), '')

// 🔴 아래는 전부 막혀야 한다
ok('🔴 다른 사이트', tidyMailLink('https://example.com/archives/abc'), null)
ok('🔴 http (안전하지 않음)', tidyMailLink('http://kakaowork.com/archives/abc'), null)
ok('🔴 비슷한 이름의 사이트', tidyMailLink('https://kakaowork.com.evil.kr/archives/abc'), null)
ok('🔴 자바스크립트', tidyMailLink('javascript:alert(1)'), null)
ok('🔴 앞에 다른 글자', tidyMailLink(`보세요 ${P}abc`), null)
ok('🔴 archives 가 아닌 길', tidyMailLink('https://kakaowork.com/mail/list.do'), null)
ok('🔴 코드가 없음', tidyMailLink(P), null)
ok('🔴 코드 자리가 비어 있음', tidyMailLink(`${P}?x=1`), null)

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
