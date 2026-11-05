/* 내보내기·되돌리기 SQL 만들기를 시험한다. **운영 DB 를 건드리지 않는다** —
   가짜 줄을 넣고 글자만 본다.
   ⚠️ 여기서 지키려는 것은 하나다: **반쪽짜리를 '다 받았다' 로 내주지 않는 것.**
   실행: node supabase/tests/backuptest.mjs   (SP 환경변수가 필요 없다) */
import { pathToFileURL } from 'node:url'

const lib = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/src/lib/'
const B = await import(pathToFileURL(`${lib}backup.js`).href)

let pass = 0, fail = 0
const ok = (name, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want)
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(46)} ${good ? '' : `받음 ${JSON.stringify(got)} / 기대 ${JSON.stringify(want)}`}`)
}

/* ── 글자로 굳히기 ──────────────────────────────────────────────── */
ok('키 차례가 달라도 같은 글자',
  B.stable({ b: 1, a: 2 }) === B.stable({ a: 2, b: 1 }), true)
ok('null 을 버틴다', B.stable(null), 'null')
ok('중첩된 것도 굳힌다', B.stable({ x: [{ q: 1, p: 2 }] }), '{"x":[{"p":2,"q":1}]}')

/* ── 해시 ───────────────────────────────────────────────────────── */
const rowsA = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }]
const rowsB = [{ n: 2, id: 'b' }, { n: 1, id: 'a' }]   // 차례도 키 순서도 다름
ok('줄 차례가 달라도 같은 해시', await B.hashRows(rowsA) === await B.hashRows(rowsB), true)
ok('한 글자만 달라도 해시가 다르다',
  await B.hashRows(rowsA) === await B.hashRows([{ id: 'a', n: 1 }, { id: 'b', n: 3 }]), false)
ok('빈 표도 해시가 난다', (await B.hashRows([])).length, 64)

/* ── 꾸러미 만들기 ──────────────────────────────────────────────── */
const fake = {}
for (const t of B.TABLES) fake[t.name] = [{ id: `${t.name}-1`, v: 1 }]
const fetchOk = async (name) => fake[name]
const listOk = async (b) => [{ path: `${b}/a.png`, size: 10 }]

const pack = await B.buildBackup({ fetchTable: fetchOk, listFiles: listOk, now: new Date('2026-11-05T00:00:00Z') })
ok('판 번호가 붙는다', pack.version, B.BACKUP_VERSION)
ok('받은 때가 붙는다', pack.exported_at, '2026-11-05T00:00:00.000Z')
ok('표를 다 담았다', Object.keys(pack.tables).length, B.TABLES.length)
ok('표마다 건수를 적는다', pack.counts.employees, 1)
ok('표마다 해시를 적는다', pack.hashes.employees.length, 64)
ok('저장소 세 곳의 파일 목록', Object.keys(pack.files), B.BUCKETS)
ok('★ 전체가 아니라고 못박는다', pack.complete, false)
ok('빠진 것을 적어 둔다', pack.missing.length > 0, true)
ok('빠진 것에 메신저가 있다', pack.missing.some((m) => m.what.includes('메신저')), true)
ok('빠진 것에 비밀 설정이 있다',
  pack.missing.some((m) => m.what.includes('user_mail') && m.what.includes('push_config')), true)
ok('비밀 설정은 아예 안 담긴다',
  ['user_mail', 'push_config', 'messages', 'rooms'].some((t) => t in pack.tables), false)

/* ★ 한 표라도 실패하면 꾸러미를 내주지 않는다 */
let threw = null
try {
  await B.buildBackup({
    fetchTable: async (n) => { if (n === 'attendance') throw new Error('권한 없음'); return fake[n] },
  })
} catch (e) { threw = e }
ok('★ 한 표가 실패하면 멈춘다', threw !== null, true)
ok('어느 표가 왜 안 됐는지 말한다',
  threw.message.includes('근태') && threw.message.includes('권한 없음'), true)
ok('반쪽 꾸러미를 따로 들고 있다', threw.partial.problems[0].table, 'attendance')

/* 줄을 배열로 안 주면 그것도 실패로 본다 */
let threw2 = null
try { await B.buildBackup({ fetchTable: async () => null }) } catch (e) { threw2 = e }
ok('줄이 배열이 아니면 멈춘다', threw2 !== null, true)

/* 파일 목록이 안 되어도 자료는 내준다 — 다만 적어 둔다 */
const pack2 = await B.buildBackup({
  fetchTable: fetchOk,
  listFiles: async () => { throw new Error('저장소 못 읽음') },
})
ok('파일 목록이 실패해도 자료는 나온다', Object.keys(pack2.tables).length, B.TABLES.length)
ok('파일 목록 실패를 적어 둔다', pack2.problems.length, B.BUCKETS.length)

/* ── 꾸러미 검사 ────────────────────────────────────────────────── */
const good = await B.checkBackup(pack)
ok('성한 꾸러미는 통과', good.ok, true)
ok('표마다 건수를 보여 준다', good.tables.length, B.TABLES.length)
ok('해시까지 맞춰 본다', good.tables[0].hashOk, true)

const badCount = JSON.parse(JSON.stringify(pack)); badCount.counts.employees = 99
ok('★ 건수가 어긋나면 잡는다', (await B.checkBackup(badCount)).ok, false)

const badHash = JSON.parse(JSON.stringify(pack)); badHash.tables.employees.push({ id: 'x' })
const bh = await B.checkBackup(badHash)
ok('★ 내용이 바뀌면 잡는다', bh.ok, false)
ok('바뀌었다고 말해 준다', bh.problems.some((p) => p.includes('해시')), true)

const noTable = JSON.parse(JSON.stringify(pack)); delete noTable.tables.attendance
const nt = await B.checkBackup(noTable)
ok('★ 표가 통째로 빠지면 잡는다', nt.ok, false)
ok('어느 표가 빠졌는지 말한다', nt.problems.some((p) => p.includes('근태')), true)

const oldVer = JSON.parse(JSON.stringify(pack)); oldVer.version = 1
ok('옛 판은 잡는다', (await B.checkBackup(oldVer)).ok, false)
ok('판 번호가 없어도 잡는다', (await B.checkBackup({ tables: {} })).ok, false)
ok('빈 것도 버틴다', (await B.checkBackup(null)).ok, false)

/* ── 되돌리기 미리보기 — 아무것도 쓰지 않는다 ─────────────────────── */
const pv = B.previewRestore(pack, { employees: 5 })
const pvEmp = pv.find((r) => r.name === 'employees')
ok('미리보기 — 들어갈 건수', pvEmp.rows, 1)
ok('미리보기 — 지금 건수', pvEmp.have, 5)
ok('미리보기 — 덮어쓰기라고 알린다', pvEmp.mode, '덮어씀')
ok('미리보기 — 비어 있으면 새로 넣기',
  B.previewRestore(pack, {}).find((r) => r.name === 'employees').mode, '새로 넣음')
ok('미리보기 — 꾸러미에 없는 표를 표시', B.previewRestore({ tables: {} })[0].missing, true)

/* ── 되돌리는 SQL ──────────────────────────────────────────────── */
const sql = B.restoreSql(pack)
ok('★ 한 덩어리로 돈다(begin)', sql.includes('begin;'), true)
ok('★ 한 덩어리로 돈다(commit)', sql.includes('commit;'), true)
ok('계정을 먼저 만들라고 적는다', sql.includes('계정을 먼저 만들어야'), true)
ok('메신저가 빠졌다고 적는다', sql.includes('메신저'), true)
ok('표를 넣는 글이 있다', sql.includes('insert into public.employees'), true)
ok('칸 이름을 손으로 안 적는다', sql.includes('jsonb_populate_recordset'), true)
ok('복합키도 제대로 적는다', sql.includes('on conflict ("doc_id", "step")'), true)
ok('부모 표가 먼저 나온다',
  sql.indexOf('insert into public.employees') < sql.indexOf('insert into public.employee_hr'), true)
ok('고를 수도 있다',
  B.restoreSql(pack, { only: ['settings'] }).includes('insert into public.employees'), false)

/* 0건·빠진 표는 넣지 않고 까닭을 적는다 */
const zero = JSON.parse(JSON.stringify(pack)); zero.tables.events = []; delete zero.tables.attendance
const zsql = B.restoreSql(zero)
ok('0건은 건너뛴다', zsql.includes('insert into public.events'), false)
ok('0건이라고 적는다', zsql.includes('0건이라 건너뜁니다'), true)
ok('없는 표는 건너뛴다', zsql.includes('insert into public.attendance'), false)
ok('없다고 적는다', zsql.includes('꾸러미에 없어서 건너뜁니다'), true)

/* 따옴표·달러가 든 자료가 SQL 을 깨지 않는다 */
const nasty = JSON.parse(JSON.stringify(pack))
nasty.tables.settings = [{ id: 1, memo: `'; drop table employees; --` }]
const nsql = B.restoreSql(nasty)
ok('★ 따옴표가 든 자료도 깨지 않는다', nsql.includes('$viren$'), true)
ok('자료는 JSON 한 덩어리로만 들어간다',
  nsql.includes(`$viren$[{"id":1,"memo":"'; drop table employees; --"}]$viren$`), true)

const dollar = JSON.parse(JSON.stringify(pack))
dollar.tables.settings = [{ id: 1, memo: '$viren$ 라고 적어 봄' }]
ok('자료에 인용 표시가 있으면 다른 표시를 쓴다',
  B.restoreSql(dollar).includes('$viren1$'), true)

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
