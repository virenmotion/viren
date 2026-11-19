/* 문의폼 전 경로 시험 — 2026-11-19
   api/send.js 의 handler 를 처음부터 끝까지 그대로 돌린다.
   🔴 메일은 한 통도 나가지 않는다 — nodemailer 를 가짜로 바꿔 끼운다.
   🟡 "운영에서" 돌린 것은 아니다. 코드 경로만 같다.
   돌리는 법:  node scripts/send-flow-test.mjs                                */

process.env.VERCEL_ENV = 'production'
process.env.SMTP_HOST = 'smtp.example.invalid'
process.env.SMTP_USER = 'test@example.invalid'
process.env.SMTP_PASS = 'not-a-real-password'
process.env.MAIL_TO = 'inbox@example.invalid'

const nodemailer = (await import('nodemailer')).default

let 보낸통수 = 0
nodemailer.createTransport = () => ({
  sendMail: async () => { 보낸통수++; return { messageId: 'fake-' + 보낸통수 } },
})

const { default: handler, __rate } = await import('../api/send.js')

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log('  ✅ ' + name + (extra ? '  ' + extra : '')) }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  ' + extra : '')) }
}

const call = async (headers, body) => {
  const out = { status: 0, json: null, headers: {} }
  const res = {
    setHeader: (k, v) => { out.headers[k.toLowerCase()] = v },
    status(c) { out.status = c; return this },
    json(j) { out.json = j; return this },
  }
  await handler({ method: 'POST', headers, body }, res)
  return out
}

const FROM_US = { origin: 'https://www.viren.kr', 'x-forwarded-for': '203.0.113.9' }
const 본문 = { subject: '시험', fields: { 내용: '시험 본문' } }

console.log('\n=== 1. 정상 문의 다섯 통 ===')
__rate.sentAt.clear()
for (let i = 1; i <= 5; i++) {
  const r = await call(FROM_US, 본문)
  ok(r.status === 200 && r.json?.ok === true, i + '통째 통과', '(' + r.status + ')')
}
ok(보낸통수 === 5, '실제로 보내기를 다섯 번 불렀다', '(' + 보낸통수 + '번)')

console.log('\n=== 2. 여섯 통째는 막힌다 ===')
const six = await call(FROM_US, 본문)
ok(six.status === 429, '429 로 막힌다', '(' + six.status + ')')
ok(six.json?.error === 'too many', '응답에 too many', JSON.stringify(six.json))
ok(Number(six.headers['retry-after']) > 0, 'Retry-After 를 준다', six.headers['retry-after'] + '초')
ok(Number(six.headers['retry-after']) <= 600, 'Retry-After 가 10분 이하')
ok(보낸통수 === 5, '🔴 막힌 요청은 메일을 보내지 않았다', '(여전히 ' + 보낸통수 + '통)')

console.log('\n=== 3. 다른 곳은 안 막힌다 ===')
const other = await call({ ...FROM_US, 'x-forwarded-for': '198.51.100.7' }, 본문)
ok(other.status === 200, '다른 곳은 그대로 통과', '(' + other.status + ')')

console.log('\n=== 4. 10분이 지나면 풀린다 ===')
const 옛날 = Date.now() - 11 * 60 * 1000
__rate.sentAt.set('203.0.113.9', [옛날, 옛날, 옛날, 옛날, 옛날])
const after = await call(FROM_US, 본문)
ok(after.status === 200, '창이 지나면 다시 보낼 수 있다', '(' + after.status + ')')

console.log('\n=== 5. 실패한 요청은 세지 않는다 ===')
__rate.sentAt.clear()
const before = 보낸통수
await call(FROM_US, { subject: '빈 본문', fields: {} })          // 400
await call(FROM_US, { subject: '빈 본문', fields: { a: '  ' } })  // 400
await call(FROM_US, { ...본문, _hp: '봇' })                       // 허니팟 200
ok(보낸통수 === before, '빈 본문·허니팟은 메일을 안 보냈다')
ok((__rate.sentAt.get('203.0.113.9') || []).length === 0, '🔴 그 셋은 횟수에도 안 들어갔다')

console.log('\n=== 6. 위조 주소는 횟수 이전에 막힌다 ===')
__rate.sentAt.clear()
for (const h of [
  { origin: 'http://localhost:3000', 'x-forwarded-for': '203.0.113.9' },
  { origin: 'https://evil.example.com', 'x-forwarded-for': '203.0.113.9' },
  { 'x-forwarded-for': '203.0.113.9' },
]) {
  const r = await call(h, 본문)
  ok(r.status === 403, (h.origin || '주소 없음') + ' → 403', '(' + r.status + ')')
}

console.log('\n=== 7. 보낸 곳을 모르면 제한하지 않는다 ===')
__rate.sentAt.clear()
let 무명통과 = 0
for (let i = 0; i < 7; i++) {
  const r = await call({ origin: 'https://viren.kr' }, 본문)   // x-forwarded-for 없음
  if (r.status === 200) 무명통과++
}
ok(무명통과 === 7, '일곱 통 다 통과 — 서로 막지 않는다', '(' + 무명통과 + '통)')
ok(__rate.sentAt.size === 0, '기억에도 쌓이지 않는다')

console.log('\n' + pass + '개 통과 · ' + fail + '개 실패')
console.log('🔴 이번 시험에서 실제로 나간 메일: 0통 (가짜 발송기를 끼웠음)\n')
process.exit(fail ? 1 : 0)
