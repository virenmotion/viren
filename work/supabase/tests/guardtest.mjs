/* scripts/restore-guard.mjs 를 **실제로 돌려서** 시험한다.
   가짜 주소만 쓴다 — 어디에도 붙지 않는다.

   ⚠️ 여기서 지키려는 것
      ① 운영 자리로는 **절대** 통과하지 않는다
      ② 내 컴퓨터가 아니면 통과하지 않는다
      ③ **비밀번호를 화면에 찍지 않는다**
      ④ 멈췄을 때는 복구 명령을 **만들어 주지도 않는다**

   실행: node supabase/tests/guardtest.mjs   (SP 가 필요 없다) */
import { execFileSync } from 'node:child_process'

const TOOL = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/scripts/restore-guard.mjs'

let pass = 0, fail = 0
const ok = (name, good, detail = '') => {
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(48)} ${good ? '' : detail}`)
}

function run(...args) {
  try {
    const out = execFileSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

/* 가짜 비밀번호 — 어디에도 쓰이지 않는 글자다 */
const PW = 'xyzzy-not-a-real-password-7391'
const LOCAL = `postgresql://postgres:${PW}@127.0.0.1:54322/postgres`
const PROD = `postgresql://postgres:${PW}@db.mappjgurhsvymamkohoo.supabase.co:5432/postgres`

/* ── ① 운영 자리는 막는다 ─────────────────────────────────────── */
const p = run('--target', PROD)
ok('★ 운영 자리면 멈춘다', p.code === 1, `끝난 값 ${p.code}`)
ok('운영이라고 말해 준다', p.out.includes('운영 자리입니다'), p.out.slice(0, 300))
ok('어느 것인지 말해 준다', p.out.includes('viren-work'), '')

/* ref 만 들어 있어도(주소 모양이 달라도) 막는다 */
const p2 = run('--target', `postgresql://u:${PW}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?options=project%3Dmappjgurhsvymamkohoo`)
ok('★ 이름이 섞여 있어도 운영이면 멈춘다', p2.code === 1, `끝난 값 ${p2.code}`)

/* ── ② 내 컴퓨터가 아니면 막는다 ──────────────────────────────── */
ok('★ 남의 서버면 멈춘다', run('--target', `postgresql://u:${PW}@db.example.com:5432/postgres`).code === 1, '')
ok('★ Supabase 서버면 멈춘다', run('--target', `postgresql://u:${PW}@db.abcdefghijklmnop.supabase.co:5432/postgres`).code === 1, '')
ok('★ pooler 면 멈춘다', run('--target', `postgresql://u:${PW}@aws-0-ap-northeast-2.pooler.supabase.com:6543/db`).code === 1, '')
ok('사설 IP 도 내 컴퓨터는 아니다', run('--target', `postgresql://u:${PW}@192.168.0.5:5432/postgres`).code === 1, '')

/* ── ③ 내 컴퓨터는 통과 ──────────────────────────────────────── */
const L = run('--target', LOCAL)
ok('내 컴퓨터는 통과', L.code === 0, `끝난 값 ${L.code}\n${L.out}`)
ok('연습용이라고 말해 준다', L.out.includes('연습용 자리가 맞습니다'), '')
ok('localhost 도 통과', run('--target', `postgresql://u:${PW}@localhost:54322/postgres`).code === 0, '')
ok('IPv6 뒷자리도 통과', run('--target', `postgresql://u:${PW}@[::1]:54322/postgres`).code === 0, '')

/* ── ④ ★ 비밀번호를 찍지 않는다 ─────────────────────────────── */
ok('★ 통과해도 비밀번호를 안 찍는다', !L.out.includes(PW), '비밀번호가 화면에 나왔다')
ok('★ 멈춰도 비밀번호를 안 찍는다', !p.out.includes(PW), '비밀번호가 화면에 나왔다')
ok('가렸다고 보여 준다', L.out.includes('***'), L.out.slice(0, 200))

/* ── ⑤ 주소가 이상하면 ───────────────────────────────────────── */
ok('주소를 안 주면 쓰는 법', run().code === 2, '')
ok('빈 주소면 쓰는 법', run('--target', '').code === 2, '')
ok('postgres 주소가 아니면 멈춘다', run('--target', 'https://127.0.0.1').code === 1, '')
ok('아무 글자나 주면 멈춘다', run('--target', '우리집').code === 1, '')

/* ── ⑥ ★ 멈췄으면 복구 명령을 만들어 주지도 않는다 ───────────── */
const pc = run('--target', PROD, '--print-command', 'roles.sql', 'schema.sql', 'data.sql')
ok('★ 운영이면 명령을 안 만든다', !pc.out.includes('psql "<연결 주소>"'), pc.out.slice(-300))
ok('그때도 멈춘 값', pc.code === 1, `끝난 값 ${pc.code}`)

const lc = run('--target', LOCAL, '--print-command', 'roles.sql', 'schema.sql', 'data.sql')
ok('통과하면 명령을 만들어 준다', lc.out.includes('psql "<연결 주소>"'), lc.out.slice(-300))
ok('한 덩어리로 돌게 적는다', lc.out.includes('--single-transaction') && lc.out.includes('ON_ERROR_STOP=1'), '')
ok('방아쇠를 끄게 적는다', lc.out.includes('session_replication_role = replica'), '')
ok('차례가 roles → schema → data',
  lc.out.indexOf('roles.sql') < lc.out.indexOf('schema.sql')
  && lc.out.indexOf('schema.sql') < lc.out.indexOf('data.sql'), '')
ok('끝난 값 보는 법을 알려 준다', lc.out.includes('LASTEXITCODE'), '')
ok('★ 만들어 준 명령에도 비밀번호가 없다', !lc.out.includes(PW), '')
ok('파일 수가 틀리면 쓰는 법', run('--target', LOCAL, '--print-command', 'a.sql').code === 2, '')

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
