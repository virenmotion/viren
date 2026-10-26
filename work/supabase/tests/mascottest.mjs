/* 스티커가 '정해진 한 줄'로만 그림이 되는지 확인한다.
   ⚠️ 여기가 느슨해지면 남이 보낸 아무 글이나 그림으로 바뀐다.
   실행: SP=<임시폴더> node supabase/tests/mascottest.mjs */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const root = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/'
const lib = root + 'src/lib/'

// node 는 확장자 없는 import 를 못 찾으므로 사본을 만든다(다른 시험과 같은 방식).
const copy = process.env.SP + '/mascot.copy.mjs'
writeFileSync(copy, readFileSync(lib + 'mascot.js', 'utf8')
  .replace("from './mascotCatalog.json'",
    `from ${JSON.stringify(pathToFileURL(lib + 'mascotCatalog.json').href)} with { type: 'json' }`))
const { mascotAssets, mascotText, readMascot, mascotSummary } = await import(pathToFileURL(copy).href)

let pass = 0, fail = 0
const ok = (name, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want)
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(52)} ${good ? '' : `받음 ${JSON.stringify(got)} / 기대 ${JSON.stringify(want)}`}`)
}

ok('스티커 20종', mascotAssets.length, 20)
ok('모두 sticker 종류', mascotAssets.every((a) => a.kind === 'sticker'), true)
ok('id 가 겹치지 않는다', new Set(mascotAssets.map((a) => a.id)).size, 20)
ok('글귀가 겹치지 않는다', new Set(mascotAssets.map((a) => a.label)).size, 20)

// 그림 파일이 실제로 있는가
const missing = mascotAssets.filter((a) => !existsSync(root + 'public' + a.src))
ok('그림 파일 20개 모두 있다', missing.map((a) => a.src), [])

// 보낸 글 → 다시 읽기 (왕복)
let round = true
for (const a of mascotAssets) if (readMascot(mascotText(a.id))?.id !== a.id) round = false
ok('보낸 글을 그대로 다시 읽는다', round, true)

ok('글 모양', mascotText('sticker_01'), '[바이렌 스티커: 확인했어요] (viren-mascot:v1:sticker_01)')
ok('목록 미리보기', mascotSummary(mascotText('sticker_01')), '바이렌 스티커 · 확인했어요')

// ── 그림이 되면 안 되는 것들 ──────────────────────────────────
const no = [
  ['보통 글', '오늘 회의 몇 시인가요?'],
  ['빈 글', ''],
  ['모르는 번호', '[바이렌 스티커: 확인했어요] (viren-mascot:v1:sticker_99)'],
  ['모르는 판', '[바이렌 스티커: 확인했어요] (viren-mascot:v2:sticker_01)'],
  ['글귀만 바꿈', '[바이렌 스티커: 아무거나] (viren-mascot:v1:sticker_01)'],
  ['앞에 덧붙임', '안녕 [바이렌 스티커: 확인했어요] (viren-mascot:v1:sticker_01)'],
  ['뒤에 덧붙임', '[바이렌 스티커: 확인했어요] (viren-mascot:v1:sticker_01) ㅋㅋ'],
  ['앞뒤 공백', ' [바이렌 스티커: 확인했어요] (viren-mascot:v1:sticker_01)'],
  ['경로 장난', '[바이렌 스티커: 확인했어요] (viren-mascot:v1:../../etc/passwd)'],
  ['주소 넣기', '[바이렌 스티커: 확인했어요] (viren-mascot:v1:https://example.com/a.png)'],
  ['HTML', '<img src=x onerror=alert(1)>'],
  ['식별자만', '(viren-mascot:v1:sticker_01)'],
]
for (const [name, text] of no) ok(`그림이 되면 안 됨 — ${name}`, readMascot(text), null)
// 그림이 안 되는 글은 목록에서도 **그대로** 보여야 한다
for (const [name, text] of no) ok(`미리보기 그대로 — ${name}`, mascotSummary(text), text)

ok('없는 번호로는 못 보낸다', (() => { try { mascotText('nope'); return '안 막힘' } catch { return '막힘' } })(), '막힘')

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
