/* 메일 머리글 읽는 부분만 따로 시험한다.
   실제 메일 서버에 붙지 않고도 **여기가 맞는지**는 알 수 있어야 한다.
   실행: SP=<임시폴더> node supabase/tests/mailparsetest.mjs */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const src = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/functions/api/mail-check.js'

// Cloudflare 전용·이웃 파일 import 는 떼고 사본을 만든다(다른 시험과 같은 방식).
// 떼어 낸 것들은 onRequestPost 안에서만 쓰이므로 여기 시험에는 상관이 없다.
const copy = process.env.SP + '/mailcheck.copy.mjs'
writeFileSync(copy, readFileSync(src, 'utf8')
  .replace(/^import .*from 'cloudflare:sockets'$/m, '')
  .replace(/^import .*from '\.\/mail\.js'$/m, '')
  .replace(/^import .*from '\.\/notify\.js'$/m, ''))
const { parseFetch, headerValue, decodeWords, fromName, recipientText, forGroup,
  splitMime, decodeBody, tidy, previewOf, literalOf } = await import(pathToFileURL(copy).href)

let pass = 0, fail = 0
const ok = (name, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want)
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(46)} ${good ? '' : `받음 ${JSON.stringify(got)}\n     기대 ${JSON.stringify(want)}`}`)
}

/* ── ① FETCH 답 쪼개기 ─────────────────────────────────────────────── */
const h1 = 'From: OpenAI <noreply@tm.openai.com>\r\nSubject: Your subscription renews\r\n\r\n'
const h2 = 'From: Dropbox <no-reply@dropbox.com>\r\nSubject: Shared folder update\r\n\r\n'
const raw = [
  `* 12 FETCH (UID 456 FLAGS (\\Seen) BODY[HEADER.FIELDS (FROM SUBJECT)] {${h1.length}}`,
  h1 + ')',
  `* 13 FETCH (UID 457 FLAGS () BODY[HEADER.FIELDS (FROM SUBJECT)] {${h2.length}}`,
  h2 + ')',
  'a4 OK Success',
].join('\r\n')

const items = parseFetch(raw)
ok('두 통을 찾는다', items.length, 2)
ok('UID', items.map((x) => x.uid), [456, 457])
ok('읽음 표시', items.map((x) => x.seen), [true, false])
ok('UID 없는 줄은 버린다', parseFetch('* 1 FETCH (FLAGS (\\Seen))\r\na1 OK').length, 0)
ok('빈 답', parseFetch('a1 OK Success').length, 0)

/* ── ② 머리글 한 줄 꺼내기 ──────────────────────────────────────────── */
ok('From', headerValue(items[0].header, 'From'), 'OpenAI <noreply@tm.openai.com>')
ok('Subject', headerValue(items[1].header, 'Subject'), 'Shared folder update')
ok('없는 머리글', headerValue(items[0].header, 'Cc'), '')
ok('대소문자 안 가린다', headerValue('subject: 안녕\r\n', 'Subject'), '안녕')
// 긴 줄은 다음 줄로 접혀 온다
ok('접힌 줄을 잇는다',
  headerValue('Subject: 앞부분\r\n 뒷부분입니다\r\nFrom: a@b.c\r\n', 'Subject'),
  '앞부분 뒷부분입니다')
ok('접힌 줄 다음 머리글은 안 섞인다',
  headerValue('Subject: 가\r\n 나\r\nFrom: a@b.c\r\n', 'From'), 'a@b.c')

/* ── ③ =?UTF-8?B?...?= 풀기 (한글 제목) ────────────────────────────── */
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
ok('보통 글은 그대로', decodeWords('Hello world'), 'Hello world')
ok('빈 글', decodeWords(''), '')
ok('UTF-8 B', decodeWords(`=?UTF-8?B?${b64('10월 정산 안내')}?=`), '10월 정산 안내')
ok('소문자 utf-8 b', decodeWords(`=?utf-8?b?${b64('안녕하세요')}?=`), '안녕하세요')
ok('UTF-8 Q', decodeWords('=?UTF-8?Q?hello=20world?='), 'hello world')
ok('Q 의 밑줄은 빈칸', decodeWords('=?UTF-8?Q?hello_world?='), 'hello world')
// 긴 한글 제목은 여러 조각으로 나뉘어 오고, 조각 사이 빈칸은 글자가 아니다
ok('붙은 두 조각',
  decodeWords(`=?UTF-8?B?${b64('바이렌 ')}?= =?UTF-8?B?${b64('10월 보고서')}?=`),
  '바이렌 10월 보고서')
ok('조각 + 보통 글 섞임',
  decodeWords(`[알림] =?UTF-8?B?${b64('결재 요청')}?= 입니다`),
  '[알림] 결재 요청 입니다')
ok('못 푸는 건 원문 그대로',
  decodeWords('=?MADE-UP-CHARSET?B?Zm9v?='), '=?MADE-UP-CHARSET?B?Zm9v?=')
ok('깨진 base64 도 원문 그대로',
  decodeWords('=?UTF-8?B?!!!not-base64!!!?='), '=?UTF-8?B?!!!not-base64!!!?=')

/* ── ④ 보낸사람 이름 ────────────────────────────────────────────────── */
ok('이름 + 주소', fromName('OpenAI <noreply@tm.openai.com>'), 'OpenAI')
ok('따옴표 친 이름', fromName('"Dropbox" <no-reply@dropbox.com>'), 'Dropbox')
ok('주소만', fromName('no-reply@dropbox.com'), 'no-reply@dropbox.com')
ok('이름이 빈 경우', fromName('<a@b.c>'), 'a@b.c')
ok('한글 이름', fromName(`=?UTF-8?B?${b64('백승민')}?= <seung@viren.kr>`), '백승민')
ok('빈 값', fromName(''), '보낸사람 모름')

/* ── ⑤ 공용함(그룹메일)으로 온 것만 고르기 ─────────────────────────── */
/* ⚠️ 여기가 느슨하면 지은님 **개인 메일**의 보낸사람·제목이 전 직원에게 간다.
   반대로 너무 빡빡하면 공용 메일이 하나도 안 뜬다. 둘 다 시험한다. */
const G = 'viren@viren.kr'
const mail = (hdr) => hdr

ok('To 에 공용함', forGroup(mail('From: a@b.c\r\nTo: viren@viren.kr\r\n'), G), true)
ok('Cc 에 공용함', forGroup(mail('From: a@b.c\r\nTo: x@y.z\r\nCc: viren@viren.kr\r\n'), G), true)
ok('Delivered-To 에 공용함',
  forGroup(mail('From: a@b.c\r\nDelivered-To: viren@viren.kr\r\n'), G), true)
ok('X-Original-To 에 공용함',
  forGroup(mail('From: a@b.c\r\nX-Original-To: viren@viren.kr\r\n'), G), true)
ok('이름 달고 온 것',
  forGroup(mail('To: "바이렌" <viren@viren.kr>\r\n'), G), true)
ok('대소문자 안 가린다', forGroup(mail('To: VIREN@Viren.KR\r\n'), G), true)
ok('여러 명 중에 끼어 있음',
  forGroup(mail('To: a@b.c, viren@viren.kr, d@e.f\r\n'), G), true)
ok('접힌 줄에 있음',
  forGroup(mail('To: a@b.c,\r\n viren@viren.kr\r\n'), G), true)

ok('🔴 개인 메일은 거른다',
  forGroup(mail('From: friend@x.com\r\nTo: jieunp711@viren.kr\r\n'), G), false)
ok('🔴 다른 그룹 주소도 거른다',
  forGroup(mail('To: sales@viren.kr\r\n'), G), false)
ok('🔴 받는사람 머리글이 아예 없음',
  forGroup(mail('From: a@b.c\r\nSubject: 제목만\r\n'), G), false)
ok('🔴 보낸사람에만 있으면 안 된다',
  forGroup(mail('From: viren@viren.kr\r\nTo: jieunp711@viren.kr\r\n'), G), false)
ok('🔴 제목에 적혀 있을 뿐이면 안 된다',
  forGroup(mail('To: jieunp711@viren.kr\r\nSubject: viren@viren.kr 관련 문의\r\n'), G), false)

ok('주소를 둘 적으면 둘 다',
  [forGroup(mail('To: viren@viren.kr\r\n'), 'viren@viren.kr, help@viren.kr'),
    forGroup(mail('To: help@viren.kr\r\n'), 'viren@viren.kr, help@viren.kr')], [true, true])
/* 비워 두면 거르지 않는다. 다만 **실제로는 그럴 수 없다** —
   MAIL_GROUP 이 없으면 onRequestPost 가 503 으로 돌아서 아예 돌지 않는다. */
ok('비우면 거르지 않는다(실제로는 못 비움)',
  forGroup(mail('To: jieunp711@viren.kr\r\n'), ''), true)

ok('받는사람만 모은다',
  recipientText('From: a@b.c\r\nTo: x@y.z\r\nSubject: hi\r\nCc: q@r.s\r\n'), 'x@y.z q@r.s')

/* ── ⑥ 본문 미리보기 ───────────────────────────────────────────────── */
/* ⚠️ 못 읽겠으면 **빈 글자**여야 한다. 깨진 글자를 보여 주느니 안 보이는 게 낫다. */
const CRLF = '\r\n'
const mk = (lines) => lines.join(CRLF)

ok('머리글과 본문 가르기',
  splitMime('From: a@b.c\r\nSubject: hi\r\n\r\n본문입니다'),
  { head: 'From: a@b.c\r\nSubject: hi', body: '본문입니다' })
ok('본문이 없으면', splitMime('From: a@b.c').body, '')

ok('여러 줄을 한 줄로', tidy('  가\n\n 나   다  '), '가 나 다')
ok('길면 자른다', tidy('가'.repeat(200)).length, 141)   // 140 + …
ok('빈 값', tidy(null), '')

ok('base64 풀기', decodeBody(Buffer.from('안녕하세요', 'utf8').toString('base64'), 'base64', 'utf-8'), '안녕하세요')
ok('base64 가 끊겨 있어도 되는 데까지',
  decodeBody(`${Buffer.from('안녕하세요 반갑습니다', 'utf8').toString('base64').slice(0, 12)}`, 'base64', 'utf-8'),
  '안녕하')
ok('quoted-printable 풀기', decodeBody('=EC=95=88=EB=85=95', 'quoted-printable', 'utf-8'), '안녕')
ok('quoted-printable 줄바꿈 이음', decodeBody('abc=\r\ndef', 'quoted-printable', 'utf-8'), 'abcdef')
ok('그냥 글(7bit)', decodeBody('hello', '', 'us-ascii'), 'hello')
ok('🔴 모르는 글자표는 포기(깨진 글자 안 보임)', decodeBody('뭔가', '8bit', 'euc-kr'), null)

ok('단순 text/plain',
  previewOf(mk(['From: a@b.c', 'Content-Type: text/plain; charset=UTF-8', '', '안녕하세요 바이렌입니다.'])),
  '안녕하세요 바이렌입니다.')

ok('text/html 은 태그를 벗긴다',
  previewOf(mk(['Content-Type: text/html; charset=UTF-8', '',
    '<html><head><style>p{color:red}</style></head><body><p>안녕</p><p>하세요</p></body></html>'])),
  '안녕 하세요')

const BND = '----=_Part_1'
ok('multipart 는 text/plain 을 고른다',
  previewOf(mk([`Content-Type: multipart/alternative; boundary="${BND}"`, '',
    `--${BND}`, 'Content-Type: text/plain; charset=UTF-8', '', '글자판 내용', '',
    `--${BND}`, 'Content-Type: text/html; charset=UTF-8', '', '<p>에이치티엠엘</p>', '',
    `--${BND}--`])),
  '글자판 내용')

ok('text/plain 이 없으면 html 을 쓴다',
  previewOf(mk([`Content-Type: multipart/alternative; boundary="${BND}"`, '',
    `--${BND}`, 'Content-Type: text/html; charset=UTF-8', '', '<p>에이치티엠엘만</p>', '',
    `--${BND}--`])),
  '에이치티엠엘만')

ok('multipart + base64 한글',
  previewOf(mk([`Content-Type: multipart/mixed; boundary="${BND}"`, '',
    `--${BND}`, 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '',
    Buffer.from('10월 정산 내역 보냅니다.', 'utf8').toString('base64'), '',
    `--${BND}--`])),
  '10월 정산 내역 보냅니다.')

ok('🔴 글자가 든 조각이 없으면 빈 글자',
  previewOf(mk([`Content-Type: multipart/mixed; boundary="${BND}"`, '',
    `--${BND}`, 'Content-Type: image/png', 'Content-Transfer-Encoding: base64', '', 'iVBORw0KGgo=', '',
    `--${BND}--`])), '')
ok('🔴 아무것도 아닌 것', previewOf(''), '')
ok('🔴 머리글만', previewOf('From: a@b.c\r\nSubject: hi'), '')

/* FETCH 답에서 알맹이만 떼기 */
ok('알맹이 떼기',
  literalOf('* 1 FETCH (UID 5 BODY[]<0> {20}\r\nFrom: a@b.c\r\n\r\n하이\r\n)\r\na3 OK Success\r\n'),
  'From: a@b.c\r\n\r\n하이')
ok('🔴 알맹이가 없으면', literalOf('a3 OK Success'), '')

/* ── ⑦ 처음부터 끝까지 한 번 ───────────────────────────────────────── */
/* 여기서 나온 {from, subject} 가 그대로 post_mail() 로 넘어가고,
   DB 쪽에서 '새 메일 · 백승민\n10월 영상 시안' 두 줄로 바뀐다. */
const korHead = `From: =?UTF-8?B?${b64('백승민')}?= <seung@viren.kr>\r\nSubject: =?UTF-8?B?${b64('10월 영상 시안')}?=\r\n\r\n`
const korRaw = `* 20 FETCH (UID 500 FLAGS () BODY[HEADER.FIELDS (FROM SUBJECT)] {${korHead.length}}\r\n${korHead})\r\na1 OK`
const got = parseFetch(korRaw).map((x) => ({
  from: fromName(headerValue(x.header, 'From')),
  subject: decodeWords(headerValue(x.header, 'Subject')).trim(),
}))
ok('한글 메일 한 통 전체', got, [{ from: '백승민', subject: '10월 영상 시안' }])

/* 이미 읽은 메일은 걸러진다 */
const twoHead = 'From: a@b.c\r\nSubject: one\r\n\r\n'
const twoRaw =
  `* 1 FETCH (UID 10 FLAGS (\\Seen) BODY[HEADER.FIELDS (FROM SUBJECT)] {${twoHead.length}}\r\n${twoHead})\r\n` +
  `* 2 FETCH (UID 11 FLAGS () BODY[HEADER.FIELDS (FROM SUBJECT)] {${twoHead.length}}\r\n${twoHead})\r\na1 OK`
ok('읽은 건 빼고 센다', parseFetch(twoRaw).filter((x) => !x.seen).map((x) => x.uid), [11])
/* 'UID FETCH n:*' 는 해당하는 게 없어도 마지막 한 통을 돌려준다 — 한 번 더 거른다 */
ok('지난번에 본 것은 거른다', parseFetch(twoRaw).filter((x) => x.uid > 11).length, 0)

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
