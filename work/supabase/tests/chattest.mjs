/* 메신저 공용 함수(화면·서버를 안 타는 것)만 따로 시험한다.
   ⚠️ roomTitle 은 **모든 대화방 이름**을 정한다. 여기를 건드리면 기존 방 이름이
      바뀌지 않는지부터 확인해야 한다.
   실행: SP=<임시폴더> node supabase/tests/chattest.mjs */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const lib = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/src/lib/'

// supabase 를 부르는 줄은 떼고 사본을 만든다(다른 시험과 같은 방식).
const copy = `${process.env.SP}/chat.copy.mjs`
writeFileSync(copy, readFileSync(`${lib}chat.js`, 'utf8')
  .replace(/^import .*from '\.\/supabase'$/m, 'const supabase = null'))
const { roomTitle, fileSize } = await import(pathToFileURL(copy).href)

let pass = 0, fail = 0
const ok = (name, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want)
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(42)} ${good ? '' : `받음 ${JSON.stringify(got)} / 기대 ${JSON.stringify(want)}`}`)
}

const ME = 'me-1'
const EMP = { 'you-1': { name: '백승민', position: '팀장' }, 'you-2': { name: '김기선', position: '' } }
const empOf = (id) => EMP[id] || null
const mem = (...ids) => ids.map((id) => ({ user_id: id }))

/* ── 기존 동작이 그대로인지 ───────────────────────────────────────── */
ok('단체방 — 이름 그대로',
  roomTitle({ kind: 'group', name: '전체 공지' }, mem(ME, 'you-1'), ME, empOf), '전체 공지')
ok('단체방 — 이름이 없으면',
  roomTitle({ kind: 'group', name: null }, mem(ME, 'you-1'), ME, empOf), '단체 대화')
ok('1:1 — 상대 이름 + 직급',
  roomTitle({ kind: 'direct', name: null }, mem(ME, 'you-1'), ME, empOf), '백승민 팀장')
ok('1:1 — 직급이 없으면 이름만',
  roomTitle({ kind: 'direct', name: null }, mem(ME, 'you-2'), ME, empOf), '김기선')
ok('1:1 — 퇴사해서 못 찾으면',
  roomTitle({ kind: 'direct', name: null }, mem(ME, 'gone'), ME, empOf), '대화')

/* ── '내 메일' 방 (2026-10-26) ──────────────────────────────────────
   혼자 쓰는 direct 방이라 상대가 없다. 이름이 없으면 '대화' 가 돼 버린다. */
ok('내 메일 — 이름이 뜬다',
  roomTitle({ kind: 'direct', name: '내 메일' }, mem(ME), ME, empOf), '내 메일')
ok('내 메일 — 상대를 찾지 않는다',
  roomTitle({ kind: 'direct', name: '내 메일' }, [], ME, empOf), '내 메일')

/* ── 파일 크기 ──────────────────────────────────────────────────── */
ok('바이트', fileSize(500), '500B')
ok('킬로바이트', fileSize(2048), '2KB')
ok('메가바이트', fileSize(3 * 1024 * 1024), '3.0MB')
ok('0', fileSize(0), '0B')
ok('숫자가 아니면', fileSize(undefined), '')

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
