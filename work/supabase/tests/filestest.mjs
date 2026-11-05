/* scripts/check-files.mjs 를 **실제로 돌려서** 시험한다.
   ⚠️ 운영 파일은 건드리지 않는다 — 임시 폴더에 가짜 파일을 만들어 쓴다.

   여기서 지키려는 것
     ① 크기가 같아도 **속이 바뀌면** 잡는다 (해시)
     ② 파일이 2000개를 넘어도 **전부** 센다
     ③ **바로가기로 폴더 밖**을 가리키면 세지 않고 실패로 본다
     ④ 없는 파일·겹친 경로는 실패다

   실행: SP=<임시폴더> node supabase/tests/filestest.mjs */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SP = process.env.SP
if (!SP) { console.log('❌ SP 환경변수(임시 폴더)가 필요합니다.'); process.exit(2) }

const TOOL = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/scripts/check-files.mjs'
const ROOT = join(SP, 'files-test')
const OUT = join(SP, 'files-test-밖')
const MAN = join(SP, 'files-test-목록.json')

let pass = 0, fail = 0
/* ⚠️ 둘째 자리는 **참·거짓**이다. 값 두 개를 넘기면(실제, 기대) 틀려도 통과한다 —
   2026-11-05 에 네 곳에서 그랬다. 비교는 여기서 하고 detail 에 실제값을 적는다. */
const ok = (name, good, detail = '') => {
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(46)} ${good ? '' : detail}`)
}

/* 도구를 돌리고 { code, out } 을 받는다. 터져도 받아 낸다. */
function run(...args) {
  try {
    const out = execFileSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

/* ── 가짜 자료 만들기 ──────────────────────────────────────────── */
rmSync(ROOT, { recursive: true, force: true })
rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(ROOT, 'approval-files', 'doc1'), { recursive: true })
mkdirSync(join(ROOT, 'chat-files', 'room1'), { recursive: true })
mkdirSync(join(ROOT, 'company'), { recursive: true })
mkdirSync(OUT, { recursive: true })

writeFileSync(join(ROOT, 'approval-files', 'doc1', 'a.txt'), 'AAAA')
writeFileSync(join(ROOT, 'approval-files', 'doc1', 'b.txt'), 'BBBB')
writeFileSync(join(ROOT, 'company', 'seal.png'), 'SEAL')
writeFileSync(join(OUT, '바깥.txt'), '여기는 폴더 밖입니다')

/* ★ 2000개를 넘겨 본다 — 예전 도구는 2000개에서 잘랐다 */
const MANY = 2100
for (let i = 0; i < MANY; i++) {
  writeFileSync(join(ROOT, 'chat-files', 'room1', `f${String(i).padStart(5, '0')}.txt`), `파일${i}`)
}

/* ── ① 목록 만들기 ────────────────────────────────────────────── */
const made = run('--write-manifest', MAN, '--files', ROOT)
ok('목록을 만든다', made.code === 0, `끝난 값 ${made.code}\n${made.out.slice(-400)}`)

const man = JSON.parse(await (await import('node:fs/promises')).readFile(MAN, 'utf8'))
ok('우리 목록이라고 적는다', man.kind === 'viren-work-files', `kind=${man.kind}`)
ok('★ 2000개를 넘겨도 전부 센다', man.buckets['chat-files'].length === MANY, `${man.buckets['chat-files'].length}개만 셌다(기대 ${MANY})`)
ok('해시를 적는다', /^[0-9a-f]{64}$/.test(man.buckets['company'][0].sha256), true)
ok('크기도 적는다', man.buckets['company'][0].size === 4, `size=${man.buckets['company'][0].size}`)
ok('경로는 저장소 안쪽 기준', man.buckets['approval-files'][0].path === 'doc1/a.txt', `path=${man.buckets['approval-files'][0].path}`)

/* ── ② 그대로 맞추면 통과 ─────────────────────────────────────── */
const same = run('--manifest', MAN, '--files', ROOT)
ok('그대로면 통과', same.code === 0, `끝난 값 ${same.code}\n${same.out.slice(-400)}`)

/* ── ③ ★ 크기가 같은데 속만 바꾼다 ───────────────────────────── */
writeFileSync(join(ROOT, 'approval-files', 'doc1', 'a.txt'), 'XXXX')   // 4바이트 그대로
const tamper = run('--manifest', MAN, '--files', ROOT)
ok('★ 크기가 같아도 속이 바뀌면 실패', tamper.code === 1, `끝난 값 ${tamper.code}`)
ok('속이 바뀌었다고 말한다', tamper.out.includes('속이 바뀐 것'), tamper.out.slice(-300))
ok('어느 파일인지 말한다', tamper.out.includes('doc1/a.txt'), '')
writeFileSync(join(ROOT, 'approval-files', 'doc1', 'a.txt'), 'AAAA')   // 되돌린다

/* 크기만 보는 길에서는 **못 잡는다** — 그래서 목록이 필요하다 */
const packLike = join(SP, 'files-test-꾸러미.json')
writeFileSync(packLike, JSON.stringify({
  version: 2, exported_at: new Date().toISOString(), complete: false, tables: {}, counts: {}, hashes: {},
  files: { 'approval-files': man.buckets['approval-files'].map((f) => ({ path: f.path, size: f.size })) },
  missing: [], problems: [],
}))
writeFileSync(join(ROOT, 'approval-files', 'doc1', 'a.txt'), 'XXXX')
const sizeOnly = run(packLike, '--files', ROOT)
ok('크기만 보면 속 바뀜을 못 잡는다(그래서 목록이 필요)',
  !sizeOnly.out.includes('속이 바뀐 것'), '')
ok('크기만 봤다고 알려 준다', sizeOnly.out.includes('크기만 봤습니다'), '')
writeFileSync(join(ROOT, 'approval-files', 'doc1', 'a.txt'), 'AAAA')

/* ── ④ ★ 없는 파일 ───────────────────────────────────────────── */
rmSync(join(ROOT, 'approval-files', 'doc1', 'b.txt'))
const gone = run('--manifest', MAN, '--files', ROOT)
ok('★ 파일이 없으면 실패', gone.code === 1, `끝난 값 ${gone.code}`)
ok('없다고 말한다', gone.out.includes('없는 것') && gone.out.includes('doc1/b.txt'), gone.out.slice(-300))
writeFileSync(join(ROOT, 'approval-files', 'doc1', 'b.txt'), 'BBBB')   // 되돌린다

/* ── ⑤ ★ 바로가기로 폴더 밖 가리키기 ────────────────────────── */
let linkMade = false
const linkAt = join(ROOT, 'company', '밖으로')
try { symlinkSync(OUT, linkAt, 'junction'); linkMade = true }
catch { /* 권한이 없으면 못 만든다 — 아래에서 건너뛴다 */ }

if (linkMade) {
  const link = run('--manifest', MAN, '--files', ROOT)
  ok('★ 바로가기가 있으면 실패', link.code === 1, `끝난 값 ${link.code}\n${link.out.slice(-400)}`)
  ok('바로가기라고 말한다', link.out.includes('바로가기'), link.out.slice(-300))
  ok('★ 폴더 밖 파일을 세지 않는다', !link.out.includes('바깥.txt'), '밖의 파일을 셌다')
  rmSync(linkAt, { recursive: true, force: true })
} else {
  console.log('⚠️ 바로가기를 못 만들어 그 시험은 건너뜁니다(윈도 권한). 코드는 lstat 으로 막습니다.')
}

/* ── ⑥ 다시 통과하는지 ───────────────────────────────────────── */
const back = run('--manifest', MAN, '--files', ROOT)
ok('되돌리면 다시 통과', back.code === 0, `끝난 값 ${back.code}\n${back.out.slice(-400)}`)

/* ── ⑦ 폴더가 없으면 실패 ────────────────────────────────────── */
rmSync(join(ROOT, 'company'), { recursive: true, force: true })
const noDir = run('--manifest', MAN, '--files', ROOT)
ok('저장소 폴더가 없으면 실패', noDir.code === 1, `끝난 값 ${noDir.code}`)
ok('어느 폴더인지 말한다', noDir.out.includes('company'), '')

/* ⑦ 에서 지운 폴더를 되살린다 — 아래 시험은 폴더가 있어야 한다 */
mkdirSync(join(ROOT, 'company'), { recursive: true })
writeFileSync(join(ROOT, 'company', 'seal.png'), 'SEAL')
/* ── ⑧ ★ 목록 자체가 망가진 경우 ─────────────────────────────── */
const manText = await (await import('node:fs/promises')).readFile(MAN, 'utf8')
const putMan = (obj) => writeFileSync(MAN, JSON.stringify(obj))
const freshMan = () => JSON.parse(manText)

/* 저장소가 통째로 빠진 목록 */
const noBucket = freshMan(); delete noBucket.buckets['company']
putMan(noBucket)
const nb = run('--manifest', MAN, '--files', ROOT)
ok('★ 목록에 저장소가 빠지면 실패', nb.code === 1, `끝난 값 ${nb.code}`)
ok('어느 저장소인지 말한다', nb.out.includes('‘company’가 목록에 없습니다'), nb.out.slice(-300))

/* 빈 배열로 낮춰도 안 된다 — 폴더에는 파일이 있으니 '남는 파일' 로 걸린다 */
const emptyBucket = freshMan(); emptyBucket.buckets['company'] = []
putMan(emptyBucket)
const eb = run('--manifest', MAN, '--files', ROOT)
ok('★ 빈 배열로 낮춰도 실패', eb.code === 1, `끝난 값 ${eb.code}`)

/* 해시를 지운 목록 */
const noHash = freshMan(); delete noHash.buckets['approval-files'][0].sha256
putMan(noHash)
const nh = run('--manifest', MAN, '--files', ROOT)
ok('★ 해시를 지우면 실패', nh.code === 1, `끝난 값 ${nh.code}`)
ok('해시가 없다고 말한다', nh.out.includes('해시가 없거나'), nh.out.slice(-300))

/* 해시 모양이 이상한 목록 */
const badHash = freshMan(); badHash.buckets['approval-files'][0].sha256 = 'abc'
putMan(badHash)
ok('★ 해시 모양이 이상하면 실패', run('--manifest', MAN, '--files', ROOT).code === 1, '')

/* 크기가 정수가 아닌 목록 */
const badSize = freshMan(); badSize.buckets['approval-files'][0].size = '4'
putMan(badSize)
ok('★ 크기가 글자면 실패', run('--manifest', MAN, '--files', ROOT).code === 1, '')

/* 판 번호가 없는 목록 */
const noVer = freshMan(); delete noVer.version
putMan(noVer)
ok('★ 판 번호가 없으면 실패', run('--manifest', MAN, '--files', ROOT).code === 1, '')

/* 만든 때가 이상한 목록 */
const badTime2 = freshMan(); badTime2.made_at = '어제'
putMan(badTime2)
ok('★ 만든 때가 이상하면 실패', run('--manifest', MAN, '--files', ROOT).code === 1, '')

/* 같은 경로가 두 번 든 목록 */
const dupMan = freshMan()
dupMan.buckets['approval-files'].push({ ...dupMan.buckets['approval-files'][0] })
putMan(dupMan)
const dm = run('--manifest', MAN, '--files', ROOT)
ok('★ 같은 경로가 두 번이면 실패', dm.code === 1, `끝난 값 ${dm.code}`)
ok('겹친다고 말한다', dm.out.includes('두 번'), dm.out.slice(-300))

/* ── ⑨ ★ 목록에 없는 파일이 폴더에 더 있으면 ─────────────────── */
putMan(freshMan())
writeFileSync(join(ROOT, 'company', '몰래.txt'), '나중에 들어온 파일')
const ex = run('--manifest', MAN, '--files', ROOT)
ok('★ 목록에 없는 파일이 있으면 실패', ex.code === 1, `끝난 값 ${ex.code}`)
ok('어느 파일인지 말한다', ex.out.includes('몰래.txt'), ex.out.slice(-300))
rmSync(join(ROOT, 'company', '몰래.txt'))
ok('치우면 다시 통과', run('--manifest', MAN, '--files', ROOT).code === 0, '')


/* ── 치우기 ──────────────────────────────────────────────────── */
rmSync(ROOT, { recursive: true, force: true })
rmSync(OUT, { recursive: true, force: true })
rmSync(MAN, { force: true })
rmSync(packLike, { force: true })

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
