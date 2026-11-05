#!/usr/bin/env node
/* 🔴 **되살리기 전에 대상이 연습용인지 확인하는 문지기.**

   되살리기는 **덮어쓰는 일**입니다. 대상을 한 번 잘못 짚으면 운영 자료가 사라집니다.
   이 도구는 연결 주소를 보고 **연습용 자리가 맞는지**만 봅니다.

   ⚠️ **아무것도 실행하지 않습니다.** DB 에 붙지도 않습니다. 글자만 봅니다.
   ⚠️ **비밀번호는 찍지 않습니다.** 주소에 들어 있으면 `***` 로 가립니다.

   쓰는 법
     node scripts/restore-guard.mjs --target "postgresql://postgres:***@127.0.0.1:54322/postgres"
         → 연습용이면 끝난 값 0, 아니면 1.

     node scripts/restore-guard.mjs --target "<주소>" --print-command roles.sql schema.sql data.sql
         → 통과했을 때만 **psql 명령을 만들어 보여 줍니다.** 돌리지는 않습니다.

   끝난 값: 0 연습용이 맞음 · 1 멈춰야 함 · 2 쓰는 법이 틀림 */

/* 🔴 **운영 자리.** 여기 적힌 것은 **절대 연습 대상이 아닙니다.**
   새 프로젝트가 생기면 여기에 더하세요. 비밀이 아닙니다(주소일 뿐). */
const PRODUCTION = [
  { ref: 'mappjgurhsvymamkohoo', what: 'viren-work (바이렌워크 운영)' },
]

/* 연습용으로 받아 주는 자리 — 내 컴퓨터뿐입니다. */
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]']

const argv = process.argv.slice(2)
const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }
const target = val('--target')
const printAt = argv.indexOf('--print-command')
const files = printAt >= 0 ? argv.slice(printAt + 1).filter((a) => !a.startsWith('--')) : []

if (!target) {
  console.log(`쓰는 법
  node scripts/restore-guard.mjs --target "<연결 주소>"
  node scripts/restore-guard.mjs --target "<연결 주소>" --print-command roles.sql schema.sql data.sql

연습용(127.0.0.1)이 아니면 멈춥니다. 아무것도 실행하지 않습니다.`)
  process.exit(2)
}

/* ── 주소에서 비밀번호를 지운다. 이 뒤로는 가린 것만 쓴다. ───────── */
function maskUrl(u) {
  if (typeof u !== 'string') return '(빈 주소)'
  /* postgresql://사용자:비밀번호@호스트... 에서 비밀번호 자리만 가린다 */
  return u.replace(/^([a-zA-Z0-9+.-]+:\/\/[^:/@]+:)[^@]*(@)/, '$1***$2')
}

/* ── 주소를 뜯어본다 ──────────────────────────────────────────── */
function readTarget(u) {
  const out = { ok: false, host: null, port: null, db: null, why: [] }
  if (typeof u !== 'string' || u.trim() === '') { out.why.push('주소가 비어 있습니다.'); return out }
  let url
  try { url = new URL(u) } catch { out.why.push('주소 모양이 아닙니다.'); return out }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    out.why.push(`postgres 주소가 아닙니다(${url.protocol}).`)
    return out
  }
  out.host = url.hostname
  out.port = url.port || '5432'
  out.db = url.pathname.replace(/^\//, '') || '(없음)'
  out.ok = true
  return out
}

/* ── 연습용으로 받아 줘도 되나 ───────────────────────────────── */
function judge(u) {
  const r = readTarget(u)
  const stop = []
  if (!r.ok) return { pass: false, stop: r.why, info: r }

  /* ① 운영 자리면 **무조건** 멈춘다 — 다른 조건을 보기 전에 */
  const low = String(u).toLowerCase()
  for (const p of PRODUCTION) {
    if (low.includes(p.ref.toLowerCase())) {
      stop.push(`🔴 운영 자리입니다 — ${p.what}. 여기에는 절대 되살리지 않습니다.`)
    }
  }

  /* ② 내 컴퓨터가 아니면 멈춘다 */
  if (!LOCAL_HOSTS.includes(r.host)) {
    stop.push(`내 컴퓨터(127.0.0.1)가 아닙니다 — ${r.host}. 연습은 컴퓨터 안에서만 합니다.`)
  }

  /* ③ 클라우드 냄새가 나면 멈춘다(이름이 바뀌어도 걸리게) */
  if (/supabase\.(co|com|net)$/i.test(r.host) || /pooler\./i.test(r.host)) {
    stop.push(`Supabase 서버 주소로 보입니다 — ${r.host}.`)
  }

  return { pass: stop.length === 0, stop, info: r }
}

/* ── 보여 주기 ───────────────────────────────────────────────── */
const v = judge(target)
console.log('')
console.log('══ 되살릴 자리를 봅니다 (아무것도 실행하지 않습니다)')
console.log(`   주소: ${maskUrl(target)}`)
console.log(`   컴퓨터: ${v.info.host ?? '(모름)'}   문: ${v.info.port ?? '(모름)'}   DB: ${v.info.db ?? '(모름)'}`)
console.log('')

if (!v.pass) {
  console.log('🔴 멈춥니다. 여기에 되살리면 안 됩니다.')
  for (const s of v.stop) console.log(`   · ${s}`)
  console.log('')
  console.log('   연습은 내 컴퓨터에 띄운 Supabase 에서 합니다 — BACKUP.md 10-③, RESTORE-DRILL.md.')
  process.exit(1)
}

console.log('✅ 연습용 자리가 맞습니다(내 컴퓨터).')

if (printAt >= 0) {
  if (files.length !== 3) {
    console.log('')
    console.log('❌ --print-command 에는 파일 셋을 차례로 주세요: roles.sql schema.sql data.sql')
    process.exit(2)
  }
  const [roles, schema, data] = files
  console.log('')
  console.log('── 아래를 **직접 보고** 돌리세요. 이 도구는 돌리지 않습니다.')
  console.log('   (비밀번호가 든 주소는 화면에 찍지 않았습니다 — 직접 넣으세요)')
  console.log('')
  console.log(`psql "<연결 주소>" --single-transaction --variable ON_ERROR_STOP=1 \\`)
  console.log(`  -f ${roles} \\`)
  console.log(`  -f ${schema} \\`)
  console.log(`  -c 'SET session_replication_role = replica' \\`)
  console.log(`  -f ${data}`)
  console.log('')
  console.log('   끝난 뒤 반드시 끝난 값을 보세요 — bash `echo $?` · PowerShell `$LASTEXITCODE`.')
  console.log('   0 이 아니어도 "아무것도 안 들어갔다" 고 단정하지 마세요(BACKUP.md 5-③).')
}
console.log('')
process.exit(0)
