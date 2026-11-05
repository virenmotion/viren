#!/usr/bin/env node
/* 🔴 **되살릴 자리가 연습용인지 보는 문지기.**

   되살리기는 **덮어쓰는 일**입니다. 대상을 한 번 잘못 짚으면 운영 자료가 사라집니다.

   ⚠️ **아무것도 실행하지 않습니다.** DB 에 붙지도 않습니다. 글자만 봅니다.
   ⚠️ **받은 주소를 그대로 찍지 않습니다.** 컴퓨터·문·DB 이름만 따로 보여 줍니다.

   🔴 **이 도구의 한계 — 꼭 알고 쓰세요**
      글자만 봅니다. 이 주소가 **정말 연습용 컨테이너인지는 증명하지 못합니다.**
      같은 127.0.0.1:54322 에 운영 자료가 든 그릇이 떠 있을 수도 있습니다.
      그릇과 볼륨이 연습용인지는 **사람이 따로 확인**해야 합니다(RESTORE-DRILL.md).

   왜 이렇게 깐깐한가 — 2026-11-05 에 이런 주소가 통과했습니다.

       postgresql://postgres@127.0.0.1:54322/postgres?host=남의서버&password=...

   libpq 는 **물음표 뒤의 `host=` 를 앞의 주소보다 먼저 씁니다.** 127.0.0.1 처럼
   보이지만 실제로는 남의 서버로 갑니다. `options=` · `service=` · `hostaddr=` 도
   같습니다. 그래서 **물음표 뒤가 있으면 무조건 거절**합니다.

   쓰는 법
     node scripts/restore-guard.mjs --target "postgresql://postgres@127.0.0.1:54322/postgres"
     node scripts/restore-guard.mjs --target "<주소>" --expect-port 54322 --expect-db postgres

   끝난 값: 0 연습용이 맞음 · 1 멈춰야 함 · 2 쓰는 법이 틀림 */

/* 🔴 **운영 자리.** 여기 적힌 것은 절대 연습 대상이 아닙니다.
   비밀이 아니라 주소입니다. 새 프로젝트가 생기면 여기에 더하세요.
   ⚠️ 아래 ref 를 몰라도 막힙니다 — 127.0.0.1 이 아니면 어차피 거절합니다. */
const PRODUCTION = [
  { ref: 'mappjgurhsvymamkohoo', what: 'viren-work (바이렌워크 운영)' },
  { ref: 'wxggycizpfmwjaeltabg', what: 'viren (홈페이지 운영)' },
  { ref: 'viren-work', what: 'viren-work (이름으로도 막습니다)' },
]

/* 연습용으로 받아 주는 자리 — **이 둘뿐**입니다.
   ⚠️ `localhost` 는 받지 않습니다. 이름 풀이(hosts·DNS)로 다른 곳을 가리킬 수 있습니다. */
const LOOPBACK = ['127.0.0.1', '::1']

/* 연습용 기본값. 다르게 쓰려면 --expect-port · --expect-db 로 **일부러** 줍니다. */
const DEFAULT_PORT = '54322'
const DEFAULT_DB = 'postgres'

const KNOWN = new Set(['--target', '--expect-port', '--expect-db'])

/* ── 들어온 말 읽기 — 모르는 것·겹친 것은 거절 ────────────────── */
function readArgs(argv) {
  const got = new Map()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    /* 🔴 들어온 글을 **되풀이해 찍지 않는다.** 비밀번호가 든 주소를 옵션 자리에
       잘못 넣는 일이 있다. 몇 번째인지와 모양만 알린다(2026-11-05 지적). */
    if (!a.startsWith('--')) return { err: `${i + 1}번째 말이 옵션이 아닙니다. --target 처럼 주세요.` }
    if (!KNOWN.has(a)) return { err: `${i + 1}번째 옵션을 모릅니다. 쓸 수 있는 것: ${[...KNOWN].join(' ')}` }
    if (got.has(a)) return { err: `${a} 를 두 번 주었습니다. 한 번만 주세요.` }
    const v = argv[i + 1]
    if (v === undefined || v.startsWith('--')) return { err: `${a} 뒤에 값이 없습니다.` }
    got.set(a, v)
    i++
  }
  return { got }
}

/* 화면에 찍어도 되는 모양으로. 길이도 자르고 보이지 않는 글자도 지웁니다. */
function safeShow(s) {
  return String(s).replace(/[^\x20-\x7E가-힣ㄱ-ㅎㅏ-ㅣ]/g, '·').slice(0, 60)
}

/* 보이지 않는 글자(줄바꿈·탭 등)가 섞였나 */
function hasControl(s) {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001F\u007F]/.test(s)
}

/* 퍼센트 표기를 풀어 본다. 못 풀면 그것도 거절 거리다. */
function unpercent(s) {
  try { return decodeURIComponent(s) } catch { return null }
}

/* ── 판단 ────────────────────────────────────────────────────── */
function judge(raw, wantPort, wantDb) {
  const stop = []
  const info = { host: null, port: null, db: null }

  if (typeof raw !== 'string' || raw.trim() === '') {
    return { pass: false, stop: ['주소가 비어 있습니다.'], info }
  }
  if (hasControl(raw)) {
    return { pass: false, stop: ['주소에 보이지 않는 글자가 섞여 있습니다.'], info }
  }
  if (raw.length > 500) {
    return { pass: false, stop: ['주소가 너무 깁니다.'], info }
  }

  /* 퍼센트로 숨긴 이름도 본다 */
  const decoded = unpercent(raw)
  if (decoded === null) {
    return { pass: false, stop: ['주소의 % 표기가 깨져 있습니다.'], info }
  }

  /* 🔴 운영 이름이 **어느 형태로든** 들어 있으면 거기서 끝 */
  const hay = `${raw}\u0000${decoded}`.toLowerCase()
  for (const p of PRODUCTION) {
    if (hay.includes(p.ref.toLowerCase())) {
      stop.push(`🔴 운영 자리입니다 — ${p.what}. 여기에는 절대 되살리지 않습니다.`)
    }
  }

  let url
  try { url = new URL(raw) } catch { return { pass: false, stop: [...stop, '주소 모양이 아닙니다.'], info } }

  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    stop.push(`postgres 주소가 아닙니다(${safeShow(url.protocol)}).`)
  }

  /* 🔴 물음표 뒤·우물정 뒤는 **무조건 거절**.
     libpq 는 host·hostaddr·options·service 같은 것을 거기서 읽어
     **앞의 주소를 덮어씁니다.** 겉보기로는 127.0.0.1 인데 딴 데로 갑니다. */
  /* ⚠️ 빈 '?' 도 받지 않는다 — url.search 가 빈 글자라 거짓이 된다(2026-11-05 에 새어 나감) */
  if (url.search || raw.includes('?')) stop.push('주소에 물음표(?) 뒤가 붙어 있습니다. 거기서 대상이 바뀔 수 있어 받지 않습니다.')
  if (url.hash || raw.includes('#')) stop.push('주소에 우물정(#) 뒤가 붙어 있습니다.')

  /* 🔴 비밀번호가 든 주소는 받지 않습니다 — 기록과 화면에 남습니다. */
  if (url.password !== '') {
    stop.push('주소에 비밀번호가 들어 있습니다. 빼고 주세요 — psql 이 따로 물어봅니다.')
  }

  info.host = url.hostname
  info.port = url.port || '(안 적음)'
  info.db = url.pathname.replace(/^\//, '') || '(안 적음)'

  /* ① 되돌이 주소(loopback)만 */
  const bare = info.host.replace(/^\[|\]$/g, '')
  if (!LOOPBACK.includes(bare)) {
    stop.push(`127.0.0.1 이 아닙니다 — ${safeShow(info.host)}. 연습은 이 컴퓨터 안에서만 합니다.`)
  }

  /* ② 문(포트)을 **적어야** 하고, 연습용 번호여야 */
  if (!url.port) stop.push('문(포트) 번호를 적지 않았습니다. 연습용 번호를 똑똑히 적어 주세요.')
  else if (url.port !== wantPort) {
    stop.push(`문 번호가 연습용(${wantPort})이 아닙니다 — ${safeShow(url.port)}.`)
  }

  /* ③ DB 이름도 정확히 */
  if (info.db !== wantDb) {
    stop.push(`DB 이름이 연습용(${wantDb})이 아닙니다 — ${safeShow(info.db)}.`)
  }

  return { pass: stop.length === 0, stop, info }
}

/* ── 돌리기 ──────────────────────────────────────────────────── */
const { got, err } = readArgs(process.argv.slice(2))
if (err) {
  console.log(`\n❌ ${err}\n`)
  console.log(`쓰는 법
  node scripts/restore-guard.mjs --target "postgresql://postgres@127.0.0.1:${DEFAULT_PORT}/${DEFAULT_DB}"
  node scripts/restore-guard.mjs --target "<주소>" --expect-port ${DEFAULT_PORT} --expect-db ${DEFAULT_DB}

  · 비밀번호는 주소에 넣지 마세요(psql 이 물어봅니다).
  · 물음표(?) 뒤가 붙으면 받지 않습니다.`)
  process.exit(2)
}

const target = got.get('--target')
if (!target) {
  console.log(`\n쓰는 법
  node scripts/restore-guard.mjs --target "postgresql://postgres@127.0.0.1:${DEFAULT_PORT}/${DEFAULT_DB}"

연습용(127.0.0.1)이 아니면 멈춥니다. 아무것도 실행하지 않습니다.\n`)
  process.exit(2)
}

const wantPort = got.get('--expect-port') || DEFAULT_PORT
const wantDb = got.get('--expect-db') || DEFAULT_DB
if (!/^[0-9]{1,5}$/.test(wantPort)) { console.log('\n❌ --expect-port 는 숫자여야 합니다.\n'); process.exit(2) }
if (!/^[A-Za-z0-9_-]{1,63}$/.test(wantDb)) { console.log('\n❌ --expect-db 이름이 이상합니다.\n'); process.exit(2) }

const v = judge(target, wantPort, wantDb)

console.log('')
console.log('══ 되살릴 자리를 봅니다 (아무것도 실행하지 않습니다)')
/* ⚠️ 받은 주소를 그대로 찍지 않습니다 — 뜯어본 값만 보여 줍니다. */
console.log(`   컴퓨터: ${safeShow(v.info.host ?? '(모름)')}`)
console.log(`   문    : ${safeShow(v.info.port ?? '(모름)')}   (연습용이어야 할 번호: ${wantPort})`)
console.log(`   DB    : ${safeShow(v.info.db ?? '(모름)')}   (연습용이어야 할 이름: ${wantDb})`)
console.log('')

if (!v.pass) {
  console.log('🔴 멈춥니다. 여기에 되살리면 안 됩니다.')
  for (const s of v.stop) console.log(`   · ${s}`)
  console.log('')
  process.exit(1)
}

/* 🔴 주소가 멀쩡해도 **환경변수가 대상을 바꿉니다.** psql 은 이것들을 먼저 봅니다.
   값은 찍지 않습니다 — 이름만 알리고 **멈춥니다.** */
const LIBPQ = ['PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGDATABASE', 'PGSERVICE',
  'PGSERVICEFILE', 'PGOPTIONS', 'PGPASSFILE', 'PGPASSWORD', 'PGSSLMODE', 'PGTARGETSESSIONATTRS']
const setVars = LIBPQ.filter((k) => process.env[k] !== undefined && process.env[k] !== '')

if (setVars.length) {
  console.log('🔴 멈춥니다. **환경변수가 켜져 있습니다.**')
  console.log('   psql 은 주소보다 이것들을 먼저 볼 수 있습니다:')
  console.log(`     ${setVars.join(' · ')}`)
  console.log('   (값은 찍지 않았습니다)')
  console.log('')
  console.log('   되살리기는 **이것들이 없는 빈 창**에서 하세요.')
  console.log('   연결 서비스 파일(~/.pg_service.conf)도 같습니다 — 있으면 치우고 하세요.')
  console.log('')
  /* ⚠️ 알리고 지나가지 않는다. 지나가면 그 상태로 되살리게 된다. */
  process.exit(1)
}

console.log('✅ 주소는 연습용 모양입니다.')
console.log('')
console.log('🔴 **통과했다고 되살려도 된다는 뜻이 아닙니다.** 이 도구는 글자만 봅니다 —')
console.log('   이 문 뒤에 **정말 연습용 그릇이 떠 있는지는 증명하지 못합니다.**')
console.log('   되살리기 전에 사람이 따로 확인하세요(RESTORE-DRILL.md 4번):')
console.log('     · 그릇 이름이 연습용인지 (project_id)')
console.log('     · 그 그릇이 **바깥으로 못 나가게** 막혀 있는지')
console.log('     · 표가 비어 있는지 (운영 자료가 들어 있지 않은지)')
console.log('     · 그릇·볼륨·문 번호가 연습용인지')
console.log('     · PG* 환경변수와 연결 서비스 파일이 **없는 창**인지')
console.log('')
process.exit(0)
