/* 직원 메일 비밀번호를 잠그고 푸는 부분. (2026-10-26)
   ⚠️ 여기가 틀리면 ① 비밀번호가 평문으로 남거나 ② 다 넣어 놓고 못 풀어서
      전 직원 메일 알림이 멈춘다. 둘 다 조용히 일어난다.
   실행: SP=<임시폴더> node supabase/tests/mailkeytest.mjs */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { webcrypto } from 'node:crypto'

const src = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/functions/api/mymail.js'

// 화면·DB 를 타지 않는 부분만 떼어 온다(onRequestPost 앞까지).
const copy = `${process.env.SP}/mymail.copy.mjs`
const text = readFileSync(src, 'utf8')
writeFileSync(copy, text.slice(text.indexOf('const te ='), text.indexOf('function db(env)')))
const { seal, unseal } = await import(pathToFileURL(copy).href)

if (!globalThis.crypto) globalThis.crypto = webcrypto

let pass = 0, fail = 0
const ok = (name, good, extra = '') => {
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(44)} ${good ? '' : extra}`)
}

const KEY = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64')
const env = { MAIL_KEY: KEY }

/* ── 잠그고 다시 풀기 ─────────────────────────────────────────────── */
for (const secret of ['abc123', '한글비밀번호!', 'a'.repeat(200), 'p@ss:word.with.dots', ' 앞뒤 빈칸 ']) {
  const packed = await seal(env, secret)
  ok(`왕복 — ${secret.slice(0, 12)}…`, (await unseal(env, packed)) === secret)
}

const packed = await seal(env, 'secret-pw')
ok('모양은 v1.<소금>.<암호문>', /^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(packed), packed)
ok('🔴 암호문에 원문이 안 보인다', !packed.includes('secret-pw'), packed)

/* 같은 글을 두 번 잠가도 **다른 암호문**이어야 한다(소금이 매번 달라야 함) */
const again = await seal(env, 'secret-pw')
ok('🔴 두 번 잠그면 서로 다르다', packed !== again)
ok('그래도 둘 다 풀린다', (await unseal(env, again)) === 'secret-pw')

/* ── 열쇠가 틀리면 못 푼다 ────────────────────────────────────────── */
const other = { MAIL_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64') }
let blocked = false
try { await unseal(other, packed) } catch { blocked = true }
ok('🔴 다른 열쇠로는 못 푼다', blocked)

/* ── 망가진 값 ───────────────────────────────────────────────────── */
for (const [name, bad] of [
  ['빈 값', ''], ['없는 값', null], ['판 번호 없음', 'abc.def'],
  ['모르는 판', 'v9.aaaa.bbbb'], ['조각 부족', 'v1.aaaa'],
  ['암호문이 망가짐', `${packed.slice(0, -4)}AAAA`],
]) {
  let threw = false
  try { await unseal(env, bad) } catch { threw = true }
  ok(`🔴 못 푸는 건 오류로 — ${name}`, threw)
}

/* ── 열쇠 길이 ───────────────────────────────────────────────────── */
let shortKey = false
try { await seal({ MAIL_KEY: Buffer.from('짧음').toString('base64') }, 'x') } catch { shortKey = true }
ok('🔴 32바이트가 아닌 열쇠는 거절', shortKey)

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
