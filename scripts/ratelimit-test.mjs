/* 문의폼 횟수 제한 시험 — 2026-11-19
   api/send.js 가 실제로 쓰는 함수를 그대로 불러서 검사한다. 사본을 만들지 않는다.
   돌리는 법:  node scripts/ratelimit-test.mjs                                   */

import { __rate } from '../api/send.js'

const { clientIp, recentSends, sweep, sentAt, RATE_WINDOW_MS, RATE_MAX, RATE_MAX_KEYS } = __rate

let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✅ ' + name) } else { fail++; console.log('  ❌ ' + name) } }
const reset = () => sentAt.clear()

const req = (headers) => ({ headers })

console.log('\n=== 1. 보낸 곳 알아내기 ===')
ok(clientIp(req({ 'x-forwarded-for': '1.2.3.4' })) === '1.2.3.4', '헤더 하나')
ok(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 10.0.0.2' })) === '1.2.3.4', '여러 개면 맨 앞(진짜 손님)')
ok(clientIp(req({ 'x-forwarded-for': ['5.6.7.8', '9.9.9.9'] })) === '5.6.7.8', '배열로 와도 맨 앞')
ok(clientIp(req({ 'x-forwarded-for': '  1.2.3.4  ' })) === '1.2.3.4', '앞뒤 빈칸 제거')
ok(clientIp(req({ 'x-real-ip': '7.7.7.7' })) === '7.7.7.7', 'x-forwarded-for 없으면 x-real-ip')
ok(clientIp(req({})) === '', '못 알아내면 빈 값 — 제한을 걸지 않는다')
ok(clientIp(req({ 'x-forwarded-for': '' })) === '', '빈 헤더도 빈 값')

console.log('\n=== 2. 10분 안에 5통까지 ===')
reset()
const now = Date.now()
const ip = '1.1.1.1'
for (let i = 0; i < RATE_MAX; i++) sentAt.set(ip, [...(sentAt.get(ip) || []), now - i * 1000])
ok(recentSends(ip, now).length === RATE_MAX, RATE_MAX + '통을 셌다')
ok(recentSends(ip, now).length >= RATE_MAX, '한도에 닿으면 막힌다')

console.log('\n=== 3. 10분이 지나면 풀린다 ===')
reset()
const old = now - RATE_WINDOW_MS - 1000
sentAt.set(ip, [old, old, old, old, old])
ok(recentSends(ip, now).length === 0, '창 밖의 기록은 세지 않는다')
ok(!sentAt.has(ip), '다 지나면 자리도 비운다')

console.log('\n=== 4. 창 경계 ===')
reset()
sentAt.set(ip, [now - RATE_WINDOW_MS + 1000, now - RATE_WINDOW_MS - 1000])
ok(recentSends(ip, now).length === 1, '창 안 1건만 남는다')

console.log('\n=== 5. 다른 곳은 서로 영향 없음 ===')
reset()
sentAt.set('1.1.1.1', [now, now, now, now, now])
sentAt.set('2.2.2.2', [now])
ok(recentSends('1.1.1.1', now).length === 5, '한쪽은 5통')
ok(recentSends('2.2.2.2', now).length === 1, '다른 쪽은 1통 — 막히지 않는다')

console.log('\n=== 6. 메모리가 무한정 늘지 않는다 ===')
reset()
for (let i = 0; i < RATE_MAX_KEYS + 500; i++) sentAt.set('ip-' + i, [now])
sweep(now)
ok(sentAt.size <= RATE_MAX_KEYS, '상한 ' + RATE_MAX_KEYS + ' 이하로 줄인다 (지금 ' + sentAt.size + ')')

console.log('\n=== 7. 오래된 것은 청소된다 ===')
reset()
for (let i = 0; i < 100; i++) sentAt.set('old-' + i, [old])
sentAt.set('new', [now])
sweep(now)
ok(sentAt.size === 1 && sentAt.has('new'), '창 밖 기록은 모두 비운다 (남은 ' + sentAt.size + ')')

console.log('\n=== 8. 기다려야 하는 시간 계산 ===')
reset()
const first = now - 3 * 60 * 1000   // 첫 통이 3분 전
const wait = Math.ceil((RATE_WINDOW_MS - (now - first)) / 1000)
ok(wait === 7 * 60, '3분 전에 첫 통이면 7분 뒤 풀린다 (계산 ' + wait + '초)')

reset()
console.log('\n' + pass + '개 통과 · ' + fail + '개 실패\n')
process.exit(fail ? 1 : 0)
