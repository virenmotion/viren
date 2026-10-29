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
const { roomTitle, fileSize, mailFeed, linkParts } = await import(pathToFileURL(copy).href)

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

/* ── 메일 알림방 가리기 (2026-10-26) ────────────────────────────────
   ⚠️ **이름으로 가리면 안 된다.** 누가 방 이름을 '대표메일 알림' 이라 지어도
      메일방 행세를 못 해야 한다. 방에 달린 표시(rooms.feed)만 본다. */
ok('공용 메일방',
  mailFeed({ name: '대표메일 알림', feed: { kind: 'mail', scope: 'group', addr: 'viren@viren.kr' } }),
  { scope: 'group', addr: 'viren@viren.kr' })
ok('개인 메일방',
  mailFeed({ name: '내 메일 알림', feed: { kind: 'mail', scope: 'own', addr: 'a@b.kr' } }),
  { scope: 'own', addr: 'a@b.kr' })
ok('주소가 없어도 된다',
  mailFeed({ feed: { kind: 'mail', scope: 'group' } }), { scope: 'group', addr: '' })
ok('scope 가 이상하면 공용으로',
  mailFeed({ feed: { kind: 'mail', scope: '뭔가' } }), { scope: 'group', addr: '' })

ok('🔴 보통 단체방', mailFeed({ kind: 'group', name: '전체 공지' }), null)
ok('🔴 이름만 흉내 낸 방', mailFeed({ kind: 'group', name: '대표메일 알림' }), null)
ok('🔴 표시가 비어 있음', mailFeed({ name: 'x', feed: null }), null)
ok('🔴 kind 가 다름', mailFeed({ feed: { kind: 'notice', scope: 'group' } }), null)
ok('🔴 표시가 글자', mailFeed({ feed: 'mail' }), null)
ok('🔴 방이 없음', mailFeed(null), null)

/* ── 파일 크기 ──────────────────────────────────────────────────── */
ok('바이트', fileSize(500), '500B')
ok('킬로바이트', fileSize(2048), '2KB')
ok('메가바이트', fileSize(3 * 1024 * 1024), '3.0MB')
ok('0', fileSize(0), '0B')
ok('숫자가 아니면', fileSize(undefined), '')


/* ── 글 속 링크 찾기 (2026-10-29) ────────────────────────────────
   ⚠️ 한글 조사가 주소에 바로 붙어 오는 일이 잦다. 거기서 끊는지 꼭 지킨다. */
const L = (t) => linkParts(t).filter((x) => x.kind === 'link').map((x) => x.href)
const T = (t) => linkParts(t).map((x) => x.s).join('')

ok('주소 하나', L('https://viren.kr 보세요'), ['https://viren.kr'])
ok('www 는 https 를 붙인다', L('www.viren.kr 참고'), ['https://www.viren.kr'])
ok('한글 조사 앞에서 끊는다', L('https://viren.kr에서 봐'), ['https://viren.kr'])
ok('한글 조사는 글로 남는다', linkParts('https://viren.kr에서 봐')[1].s, '에서 봐')
ok('끝의 마침표는 뺀다', L('자료는 https://viren.kr/work 입니다.'), ['https://viren.kr/work'])
ok('닫는 괄호는 뺀다', L('(www.viren.kr) 참고'), ['https://www.viren.kr'])
ok('물음표·우물정은 주소', L('https://viren.kr/work?id=3#top 끝'), ['https://viren.kr/work?id=3#top'])
ok('주소 둘', L('https://a.kr 과 https://b.kr'), ['https://a.kr', 'https://b.kr'])
ok('🔴 javascript: 는 링크가 아니다', L('javascript:alert(1) 조심'), [])
ok('🔴 ftp 도 아니다', L('ftp://viren.kr 받기'), [])
ok('링크가 없으면 글 그대로', linkParts('그냥 글입니다'), [{ kind: 'text', s: '그냥 글입니다' }])
ok('줄바꿈을 잃지 않는다', T('첫 줄\nhttps://viren.kr\n끝'), '첫 줄\nhttps://viren.kr\n끝')
ok('글자를 하나도 안 잃는다', T('자료 https://viren.kr에서 보세요.'), '자료 https://viren.kr에서 보세요.')
ok('빈 글', linkParts(''), [])
ok('null 도 버틴다', linkParts(null), [])

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
