/* scripts/restore-guard.mjs 를 **실제로 돌려서** 시험한다.
   가짜 주소만 쓴다 — 어디에도 붙지 않는다.

   ⚠️ 여기서 지키려는 것
      ① 운영 자리로는 **절대** 통과하지 않는다
      ② **물음표 뒤로 대상을 바꿔치기** 할 수 없다 (2026-11-05 에 뚫렸던 길)
      ③ **비밀번호를 화면에 찍지 않는다** — 받은 주소도 그대로 찍지 않는다
      ④ 되돌이 주소 + 연습용 문 + 연습용 DB 가 **모두** 맞아야 통과한다

   실행: node supabase/tests/guardtest.mjs   (SP 가 필요 없다) */
import { execFileSync } from 'node:child_process'

const TOOL = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/scripts/restore-guard.mjs'

let pass = 0, fail = 0
const ok = (name, good, detail = '') => {
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(50)} ${good ? '' : detail}`)
}

function run(...args) {
  try {
    const out = execFileSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}
/* 멈춰야 하는 주소를 한 줄로 */
const blocked = (name, url, detail = '') => {
  const r = run('--target', url)
  ok(name, r.code === 1, detail || `끝난 값 ${r.code}\n${r.out.slice(-200)}`)
  return r
}

/* 어디에도 쓰이지 않는 가짜 글자 */
const PW = 'FAKE-TEST-ONLY-7391-xyzzy'
const GOOD = 'postgresql://postgres@127.0.0.1:54322/postgres'

/* ── ① 제대로 된 연습용 주소 ─────────────────────────────────── */
const g = run('--target', GOOD)
ok('연습용 주소는 통과', g.code === 0, `끝난 값 ${g.code}\n${g.out}`)
ok('연습용이라고 말해 준다', g.out.includes('연습용 모양입니다'), '')
ok('★ 글자만 본다는 한계를 적는다', g.out.includes('증명하지 못합니다'), g.out.slice(-400))
ok('사람이 확인할 것을 알려 준다', g.out.includes('project_id'), '')
ok('IPv6 되돌이도 통과', run('--target', 'postgresql://postgres@[::1]:54322/postgres').code === 0, '')
ok('postgres:// 짧은 것도 통과', run('--target', 'postgres://postgres@127.0.0.1:54322/postgres').code === 0, '')

/* ── ② ★ 물음표 뒤로 바꿔치기 — 예전에 뚫렸던 길 ─────────────── */
const inj = blocked('★ ?host= 로 딴 데를 가리키면 멈춘다',
  `postgresql://postgres@127.0.0.1:54322/postgres?host=example.invalid&password=${PW}`)
ok('★ 그 비밀번호를 화면에 안 찍는다', !inj.out.includes(PW), '비밀번호가 나왔다')
ok('물음표 뒤라고 말해 준다', inj.out.includes('물음표'), inj.out.slice(-300))

blocked('★ ?hostaddr= 도 멈춘다', 'postgresql://postgres@127.0.0.1:54322/postgres?hostaddr=203.0.113.9')
blocked('★ ?options= 도 멈춘다', 'postgresql://postgres@127.0.0.1:54322/postgres?options=-c%20search_path%3Dx')
blocked('★ ?service= 도 멈춘다', 'postgresql://postgres@127.0.0.1:54322/postgres?service=prod')
blocked('물음표만 있어도 멈춘다', 'postgresql://postgres@127.0.0.1:54322/postgres?')
blocked('우물정 뒤가 있어도 멈춘다', 'postgresql://postgres@127.0.0.1:54322/postgres#x')

/* ── ③ ★ 비밀번호가 든 주소는 아예 안 받는다 ────────────────── */
const wp = blocked('★ 주소에 비밀번호가 있으면 멈춘다', `postgresql://postgres:${PW}@127.0.0.1:54322/postgres`)
ok('★ 그 비밀번호도 안 찍는다', !wp.out.includes(PW), '비밀번호가 나왔다')
ok('빼고 달라고 말해 준다', wp.out.includes('빼고 주세요'), wp.out.slice(-300))

/* ── ④ 운영 자리 ─────────────────────────────────────────────── */
const p = blocked('★ 운영 ref 면 멈춘다', 'postgresql://postgres@db.mappjgurhsvymamkohoo.supabase.co:5432/postgres')
ok('운영이라고 말해 준다', p.out.includes('운영 자리입니다'), p.out.slice(-300))
blocked('★ 이름(viren-work)으로도 멈춘다', 'postgresql://postgres@viren-work.example:5432/postgres')
/* 퍼센트로 숨겨도 */
blocked('★ % 로 숨긴 운영 이름도 멈춘다',
  'postgresql://postgres@127.0.0.1:54322/%6D%61%70%70%6A%67%75%72%68%73%76%79%6D%61%6D%6B%6F%68%6F%6F')
blocked('되돌이에 운영 이름을 섞어도 멈춘다',
  'postgresql://mappjgurhsvymamkohoo@127.0.0.1:54322/postgres')

/* ── ⑤ 되돌이가 아니면 ───────────────────────────────────────── */
blocked('남의 서버면 멈춘다', 'postgresql://postgres@db.example.com:54322/postgres')
blocked('Supabase 서버면 멈춘다', 'postgresql://postgres@db.abcdefghijklmnop.supabase.co:54322/postgres')
blocked('pooler 면 멈춘다', 'postgresql://postgres@aws-0-ap-northeast-2.pooler.supabase.com:54322/postgres')
blocked('사설 IP 도 멈춘다', 'postgresql://postgres@192.168.0.5:54322/postgres')
const lh = blocked('★ localhost 도 멈춘다(이름은 딴 데를 가리킬 수 있다)',
  'postgresql://postgres@localhost:54322/postgres')
ok('127.0.0.1 을 달라고 말해 준다', lh.out.includes('127.0.0.1 이 아닙니다'), lh.out.slice(-300))

/* ── ⑥ 문·DB 가 연습용이어야 ────────────────────────────────── */
const bp = blocked('★ 다른 문 번호면 멈춘다', 'postgresql://postgres@127.0.0.1:5432/postgres')
ok('연습용 번호를 알려 준다', bp.out.includes('54322'), bp.out.slice(-300))
blocked('★ 문 번호가 없으면 멈춘다', 'postgresql://postgres@127.0.0.1/postgres')
const bd = blocked('★ 다른 DB 이름이면 멈춘다', 'postgresql://postgres@127.0.0.1:54322/운영자료')
ok('연습용 이름을 알려 준다', bd.out.includes('연습용'), bd.out.slice(-300))
blocked('DB 이름이 없으면 멈춘다', 'postgresql://postgres@127.0.0.1:54322')

/* 일부러 다르게 주면 그때는 통과 */
ok('--expect-port 로 바꿔 주면 통과',
  run('--target', 'postgresql://postgres@127.0.0.1:55555/drill', '--expect-port', '55555', '--expect-db', 'drill').code === 0, '')

/* ── ⑦ 주소 모양 ─────────────────────────────────────────────── */
blocked('postgres 주소가 아니면 멈춘다', 'https://127.0.0.1:54322/postgres')
blocked('아무 글자나 주면 멈춘다', '우리집')
const ctl = blocked('★ 보이지 않는 글자가 섞이면 멈춘다',
  `postgresql://postgres@127.0.0.1:54322/postgres${String.fromCharCode(10)}DROP`)
ok('섞였다고 말해 준다', ctl.out.includes('보이지 않는 글자'), ctl.out.slice(-300))
blocked('% 표기가 깨지면 멈춘다', 'postgresql://postgres@127.0.0.1:54322/%zz')
blocked('너무 길면 멈춘다', `postgresql://postgres@127.0.0.1:54322/${'a'.repeat(600)}`)

/* ── ⑧ 인자 ──────────────────────────────────────────────────── */
ok('주소를 안 주면 쓰는 법', run().code === 2, '')
ok('빈 주소면 멈춘다', run('--target', '').code === 2, '')
ok('★ --target 을 두 번 주면 거절', run('--target', GOOD, '--target', 'postgresql://x@127.0.0.1:54322/postgres').code === 2, '')
ok('★ 모르는 옵션은 거절', run('--target', GOOD, '--force').code === 2, '')
ok('★ 옵션 아닌 말이 있으면 거절', run(GOOD).code === 2, '')
ok('값 없는 옵션은 거절', run('--target').code === 2, '')
ok('--expect-port 가 숫자가 아니면 거절', run('--target', GOOD, '--expect-port', 'abc').code === 2, '')

/* ── ⑨ ★ 복구 명령을 만들어 주지 않는다 ─────────────────────── */
ok('★ --print-command 는 이제 없다(모르는 옵션)',
  run('--target', GOOD, '--print-command', 'a.sql').code === 2, '')
ok('★ 통과해도 psql 명령을 찍지 않는다', !g.out.includes('psql '), g.out.slice(-300))

/* ── ⑩ ★ 받은 주소를 그대로 찍지 않는다 ─────────────────────── */
const odd = run('--target', 'postgresql://postgres@127.0.0.1:54322/postgres')
ok('★ 주소 전체를 되풀이하지 않는다', !odd.out.includes('postgresql://'), odd.out.slice(0, 300))

/* ── ⑪ ★ 인자 오류에서 원문을 찍지 않는다 ───────────────────── */
/* 비밀번호가 든 주소를 옵션 자리에 잘못 넣는 일이 있다 */
const slip = `postgresql://postgres:${PW}@127.0.0.1:54322/postgres`
const e1 = run(slip)                       // --target 을 빼먹음
ok('옵션 없이 주면 거절', e1.code === 2, `끝난 값 ${e1.code}`)
ok('★ 그때 넣은 주소를 되풀이하지 않는다', !e1.out.includes(slip), e1.out.slice(0, 300))
ok('★ 그때 비밀번호도 안 찍는다', !e1.out.includes(PW), '비밀번호가 나왔다')
ok('몇 번째인지만 알려 준다', e1.out.includes('1번째'), e1.out.slice(0, 200))

const e2 = run('--targett', slip)          // 옵션 이름 오타
ok('모르는 옵션은 거절', e2.code === 2, `끝난 값 ${e2.code}`)
ok('★ 그때도 원문을 안 찍는다', !e2.out.includes(PW) && !e2.out.includes(slip), e2.out.slice(0, 300))
ok('쓸 수 있는 옵션을 알려 준다', e2.out.includes('--target'), e2.out.slice(0, 200))

/* ── ⑫ viren(홈페이지) 운영도 막는다 ───────────────────────── */
blocked('★ viren 홈페이지 ref 면 멈춘다',
  'postgresql://postgres@db.wxggycizpfmwjaeltabg.supabase.co:5432/postgres')
blocked('★ 되돌이에 섞어도 멈춘다',
  'postgresql://postgres@127.0.0.1:54322/wxggycizpfmwjaeltabg')

/* ── ⑬ ★ libpq 환경변수가 켜져 있으면 알린다 ───────────────── */
function runEnv(env, ...args) {
  try {
    const out = execFileSync(process.execPath, [TOOL, ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
    return { code: 0, out }
  } catch (e) { return { code: e.status ?? -1, out: `${e.stdout || ''}${e.stderr || ''}` } }
}
const SECRET_HOST = 'somewhere.invalid'
const withEnv = runEnv({ PGHOSTADDR: SECRET_HOST, PGOPTIONS: '-c x=1' }, '--target', GOOD)
ok('★ 환경변수가 켜져 있으면 **멈춘다**', withEnv.code === 1, `끝난 값 ${withEnv.code}`)
ok('환경변수 때문이라고 말해 준다', withEnv.out.includes('환경변수가 켜져 있습니다'), withEnv.out.slice(-400))
ok('어느 것인지 이름을 알려 준다', withEnv.out.includes('PGHOSTADDR') && withEnv.out.includes('PGOPTIONS'), '')
ok('★ 그 값은 찍지 않는다', !withEnv.out.includes(SECRET_HOST), '환경변수 값이 나왔다')
ok('빈 창에서 하라고 말해 준다', withEnv.out.includes('빈 창'), '')
ok('연결 서비스 파일도 짚어 준다', withEnv.out.includes('pg_service'), '')
ok('환경변수가 없으면 그 말은 안 나온다', !g.out.includes('환경변수가 켜져 있습니다'), '')
ok('★ PGHOSTADDR 하나만 있어도 멈춘다',
  runEnv({ PGHOSTADDR: SECRET_HOST }, '--target', GOOD).code === 1, '')
ok('★ PGSERVICE 하나만 있어도 멈춘다',
  runEnv({ PGSERVICE: 'prod' }, '--target', GOOD).code === 1, '')
ok('★ 막을 때도 값은 안 찍는다',
  !runEnv({ PGHOSTADDR: SECRET_HOST }, '--target', GOOD).out.includes(SECRET_HOST), '값이 나왔다')

/* ── ⑭ ★ 통과 = 허가가 아니라고 못박는다 ──────────────────── */
ok('★ 되살려도 된다는 뜻이 아니라고 적는다', g.out.includes('되살려도 된다는 뜻이 아닙니다'), g.out.slice(-400))
ok('그릇·볼륨도 확인하라고 적는다', g.out.includes('그릇·볼륨'), '')
ok('PG* 환경변수를 확인하라고 적는다', g.out.includes('PG* 환경변수'), '')


console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
