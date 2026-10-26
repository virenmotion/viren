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
const { parseFetch, headerValue, decodeWords, fromName, mailMessage } =
  await import(pathToFileURL(copy).href)

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

/* ── ⑤ 알림 문구 ───────────────────────────────────────────────────── */
ok('없으면 안 보낸다', mailMessage([]), null)
ok('한 통', mailMessage([{ from: 'OpenAI', subject: '구독 갱신' }]),
  { title: '새 메일 · OpenAI', body: '구독 갱신' })
ok('제목 없는 한 통', mailMessage([{ from: 'OpenAI', subject: '' }]),
  { title: '새 메일 · OpenAI', body: '(제목 없음)' })
ok('세 통', mailMessage([
  { from: 'OpenAI', subject: 'a' }, { from: 'Dropbox', subject: 'b' }, { from: '백승민', subject: 'c' },
]), { title: '새 메일 3통', body: 'OpenAI · Dropbox · 백승민' })
ok('같은 사람 두 통은 이름 한 번', mailMessage([
  { from: 'OpenAI', subject: 'a' }, { from: 'OpenAI', subject: 'b' },
]), { title: '새 메일 2통', body: 'OpenAI' })
ok('많으면 이름은 셋까지', mailMessage(
  ['가', '나', '다', '라', '마'].map((x) => ({ from: x, subject: x }))),
  { title: '새 메일 5통', body: '가 · 나 · 다' })

/* ── ⑥ 처음부터 끝까지 한 번 ───────────────────────────────────────── */
const korHead = `From: =?UTF-8?B?${b64('백승민')}?= <seung@viren.kr>\r\nSubject: =?UTF-8?B?${b64('10월 영상 시안')}?=\r\n\r\n`
const korRaw = `* 20 FETCH (UID 500 FLAGS () BODY[HEADER.FIELDS (FROM SUBJECT)] {${korHead.length}}\r\n${korHead})\r\na1 OK`
const got = parseFetch(korRaw).map((x) => ({
  from: fromName(headerValue(x.header, 'From')),
  subject: decodeWords(headerValue(x.header, 'Subject')).trim(),
}))
ok('한글 메일 한 통 전체', mailMessage(got),
  { title: '새 메일 · 백승민', body: '10월 영상 시안' })

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
