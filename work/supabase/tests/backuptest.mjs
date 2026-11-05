/* 내보내기·되돌리기 SQL 만들기를 시험한다. **운영 DB 를 건드리지 않는다** —
   가짜 줄을 넣고 글자만 본다.
   ⚠️ 여기서 지키려는 것은 둘이다.
      ① 반쪽짜리를 '다 받았다' 로 내주지 않는 것
      ② **믿을 수 없는 자료로 SQL 글자를 짓지 않는 것**
   실행: node supabase/tests/backuptest.mjs   (SP 환경변수가 필요 없다) */
import { pathToFileURL } from 'node:url'

const lib = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/src/lib/'
const B = await import(pathToFileURL(`${lib}backup.js`).href)

let pass = 0, fail = 0
const ok = (name, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want)
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(48)} ${good ? '' : `받음 ${JSON.stringify(got)} / 기대 ${JSON.stringify(want)}`}`)
}
const threw = async (fn) => { try { await fn(); return null } catch (e) { return e } }
const clone = (o) => JSON.parse(JSON.stringify(o))

/* ── 글자로 굳히기 · 해시 ──────────────────────────────────────── */
ok('키 차례가 달라도 같은 글자', B.stable({ b: 1, a: 2 }) === B.stable({ a: 2, b: 1 }), true)
ok('null 을 버틴다', B.stable(null), 'null')
ok('중첩된 것도 굳힌다', B.stable({ x: [{ q: 1, p: 2 }] }), '{"x":[{"p":2,"q":1}]}')

const rowsA = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }]
ok('줄 차례가 달라도 같은 해시',
  await B.hashRows(rowsA) === await B.hashRows([{ n: 2, id: 'b' }, { n: 1, id: 'a' }]), true)
ok('한 글자만 달라도 해시가 다르다',
  await B.hashRows(rowsA) === await B.hashRows([{ id: 'a', n: 1 }, { id: 'b', n: 3 }]), false)
ok('빈 표도 해시가 난다', (await B.hashRows([])).length, 64)

/* ── 믿어도 되는 모양인지 ──────────────────────────────────────── */
ok('평범한 칸 이름은 통과', B.safeIdent('work_date'), '"work_date"')
ok('★ 따옴표가 든 칸 이름은 거절', (await threw(() => B.safeIdent('a" = 1, b'))) !== null, true)
ok('★ 세미콜론이 든 칸 이름은 거절', (await threw(() => B.safeIdent('x; drop table t'))) !== null, true)
ok('대문자도 거절', (await threw(() => B.safeIdent('Id'))) !== null, true)
ok('빈 이름도 거절', (await threw(() => B.safeIdent(''))) !== null, true)
ok('숫자로 시작해도 거절', (await threw(() => B.safeIdent('1col'))) !== null, true)

ok('ISO 시각은 통과', B.isIsoTime('2026-11-05T10:00:00.000Z'), true)
ok('시간대가 붙어도 통과', B.isIsoTime('2026-11-05T10:00:00+09:00'), true)
ok('★ 줄바꿈이 섞이면 거절', B.isIsoTime('2026-11-05T10:00:00Z\n-- x'), false)
ok('아무 글자나 거절', B.isIsoTime('어제'), false)
ok('빈 것도 거절', B.isIsoTime(null), false)

/* ── 줄 모양 보기 ───────────────────────────────────────────────── */
const tAtt = B.TABLES.find((t) => t.name === 'attendance')
ok('기본키가 비면 잡는다',
  B.checkRows(tAtt, [{ user_id: null, work_date: '2026-11-05' }]).problems.length > 0, true)
ok('기본키가 겹치면 잡는다',
  B.checkRows(tAtt, [{ user_id: 'u', work_date: 'd' }, { user_id: 'u', work_date: 'd' }])
    .problems.some((p) => p.includes('번호가 같습니다')), true)
ok('칸 구성이 다르면 잡는다',
  B.checkRows(tAtt, [{ user_id: 'u', work_date: 'd' }, { user_id: 'u', work_date: 'e', extra: 1 }])
    .problems.some((p) => p.includes('칸 구성')), true)
ok('★ 이상한 칸 이름을 잡는다',
  B.checkRows(tAtt, [{ user_id: 'u', work_date: 'd', 'a"b': 1 }])
    .problems.some((p) => p.includes('쓸 수 없는 글자')), true)
ok('칸은 모든 줄에서 모은다',
  B.checkRows(tAtt, [{ user_id: 'u', work_date: 'd' }, { user_id: 'v', work_date: 'd', memo: 1 }])
    .cols.sort(), ['memo', 'user_id', 'work_date'])

/* ── 꾸러미 만들기 ─────────────────────────────────────────────── */
const fake = {}
for (const t of B.TABLES) {
  const r = { v: 1 }
  for (const k of t.key) r[k] = `${t.name}-${k}`
  fake[t.name] = [r]
}
const fetchOk = async (name) => fake[name]
const pack = await B.buildBackup({
  fetchTable: fetchOk,
  listFiles: async (b) => ({ files: [{ path: `${b}/a.png`, size: 10 }], truncated: false }),
  now: new Date('2026-11-05T00:00:00Z'),
})
ok('판 번호가 붙는다', pack.version, B.BACKUP_VERSION)
ok('받은 때가 ISO 로 붙는다', B.isIsoTime(pack.exported_at), true)
ok('표를 다 담았다', Object.keys(pack.tables).length, B.TABLES.length)
ok('표마다 건수를 적는다', pack.counts.employees, 1)
ok('표마다 해시를 적는다', pack.hashes.employees.length, 64)
ok('저장소 세 곳의 파일 목록', Object.keys(pack.files), B.BUCKETS)
ok('★ 전체가 아니라고 못박는다', pack.complete, false)
ok('빠진 것에 메신저가 있다', pack.missing.some((m) => m.what.includes('메신저')), true)
ok('비밀 설정은 아예 안 담긴다',
  ['user_mail', 'push_config', 'messages', 'rooms'].some((t) => t in pack.tables), false)

/* ★ 복합키는 **전부** 로 줄을 세운다 */
const seenOrder = []
await B.buildBackup({ fetchTable: async (n, k) => { seenOrder.push([n, k.join('+')]); return fake[n] } })
ok('★ 결재선은 doc_id+step 으로 세운다',
  seenOrder.find((x) => x[0] === 'approval_steps')[1], 'doc_id+step')
ok('★ 근태는 user_id+work_date 로 세운다',
  seenOrder.find((x) => x[0] === 'attendance')[1], 'user_id+work_date')

/* ★ 한 표라도 실패하면 꾸러미를 내주지 않는다 */
const e1 = await threw(() => B.buildBackup({
  fetchTable: async (n) => { if (n === 'attendance') throw new Error('권한 없음'); return fake[n] },
}))
ok('★ 한 표가 실패하면 멈춘다', e1 !== null, true)
ok('어느 표가 왜 안 됐는지 말한다', e1.message.includes('근태') && e1.message.includes('권한 없음'), true)
ok('반쪽 꾸러미를 따로 들고 있다', e1.partial.problems[0].table, 'attendance')
ok('줄이 배열이 아니면 멈춘다', (await threw(() => B.buildBackup({ fetchTable: async () => null }))) !== null, true)

/* ★ 파일 목록을 끝까지 못 읽었으면 **적어 둔다** */
const cut = await B.buildBackup({
  fetchTable: fetchOk,
  listFiles: async () => ({ files: [{ path: 'a', size: 1 }], truncated: true, note: '범위 제한' }),
})
ok('★ 목록이 잘렸으면 적어 둔다', cut.problems.length, B.BUCKETS.length)
ok('잘린 까닭을 적는다', cut.problems[0].error, '범위 제한')
const fErr = await B.buildBackup({ fetchTable: fetchOk, listFiles: async () => { throw new Error('저장소 못 읽음') } })
ok('목록이 실패해도 자료는 나온다', Object.keys(fErr.tables).length, B.TABLES.length)
ok('목록 실패를 적어 둔다', fErr.problems.length, B.BUCKETS.length)

/* ── 꾸러미 검사 ───────────────────────────────────────────────── */
ok('성한 꾸러미는 통과', (await B.checkBackup(pack)).ok, true)
ok('표마다 결과를 보여 준다', (await B.checkBackup(pack)).tables.length, B.TABLES.length)
ok('해시까지 맞춰 본다', (await B.checkBackup(pack)).tables[0].hashOk, true)

/* ★ 건수·해시를 아예 빼 버린 꾸러미를 통과시키지 않는다 (검토 지적) */
const noCounts = clone(pack); delete noCounts.counts
const nc = await B.checkBackup(noCounts)
ok('★ 건수가 통째로 없으면 거절', nc.ok, false)
ok('건수가 없다고 말한다', nc.problems.some((p) => p.includes('건수(counts)가 통째로')), true)

const noHashes = clone(pack); delete noHashes.hashes
ok('★ 해시가 통째로 없으면 거절', (await B.checkBackup(noHashes)).ok, false)

const oneGone = clone(pack); delete oneGone.counts.employees; delete oneGone.hashes.employees
const og = await B.checkBackup(oneGone)
ok('★ 한 표의 건수·해시만 빠져도 거절', og.ok, false)
ok('어느 표인지 말한다', og.problems.some((p) => p.includes('직원')), true)

const shortHash = clone(pack); shortHash.hashes.employees = 'abc'
ok('★ 해시 모양이 이상하면 거절', (await B.checkBackup(shortHash)).ok, false)

const badCount = clone(pack); badCount.counts.employees = 99
ok('★ 건수가 어긋나면 잡는다', (await B.checkBackup(badCount)).ok, false)

const badHash = clone(pack); badHash.tables.employees.push({ id: 'x' })
ok('★ 내용이 바뀌면 잡는다', (await B.checkBackup(badHash)).ok, false)

const noTable = clone(pack); delete noTable.tables.attendance
ok('★ 표가 통째로 빠지면 잡는다', (await B.checkBackup(noTable)).ok, false)

const badTime = clone(pack); badTime.exported_at = '2026-11-05T00:00:00Z\n-- 주석 빠져나가기'
const bt = await B.checkBackup(badTime)
ok('★ 받은 때에 줄바꿈이 섞이면 잡는다', bt.ok, false)
ok('받은 때가 이상하다고 말한다', bt.problems.some((p) => p.includes('받은 때')), true)

const badCol = clone(pack); badCol.tables.settings = [{ id: 1, 'x" = 1, y': 2 }]
badCol.counts.settings = 1; badCol.hashes.settings = await B.hashRows(badCol.tables.settings)
ok('★ 이상한 칸 이름이 든 꾸러미는 거절', (await B.checkBackup(badCol)).ok, false)

ok('옛 판은 잡는다', (await B.checkBackup({ ...clone(pack), version: 1 })).ok, false)
ok('판 번호가 없어도 잡는다', (await B.checkBackup({ tables: {} })).ok, false)
ok('빈 것도 버틴다', (await B.checkBackup(null)).ok, false)
ok('배열을 줘도 버틴다', (await B.checkBackup([])).ok, false)

/* ── 되돌리기 미리보기 ─────────────────────────────────────────── */
const pv = B.previewRestore(pack, { employees: 5 })
const pvEmp = pv.find((r) => r.name === 'employees')
ok('미리보기 — 들어갈 건수', pvEmp.rows, 1)
ok('미리보기 — 지금 건수', pvEmp.have, 5)
ok('미리보기 — 덮어쓴다고 알린다', pvEmp.mode, '덮어씀')
ok('미리보기 — 0건이면 새로 넣음',
  B.previewRestore(pack, { employees: 0 }).find((r) => r.name === 'employees').mode, '새로 넣음')
/* ★ 못 센 것을 0 으로 바꾸지 않는다 (검토 지적) */
const unk = B.previewRestore(pack, { employees: null }).find((r) => r.name === 'employees')
ok('★ 못 셌으면 확인 불가', unk.mode, '확인 불가')
ok('★ 못 셌음을 따로 표시', unk.unknown, true)
ok('★ 안 넘겨줘도 확인 불가', B.previewRestore(pack, {})[0].mode, '확인 불가')
ok('미리보기 — 꾸러미에 없는 표를 표시', B.previewRestore({ tables: {} })[0].missing, true)

/* ── 되돌리는 SQL ─────────────────────────────────────────────── */
const good = await B.checkBackup(pack)

/* ★ 검사를 통과하지 않으면 만들지 않는다 (검토 지적) */
ok('★ 검사 결과 없이는 안 만든다', (await threw(() => B.restoreSql(pack))) !== null, true)
ok('★ 검사에 떨어진 꾸러미로는 안 만든다',
  (await threw(() => B.restoreSql(badCount, { ok: false, problems: [], tables: [] }))) !== null, true)
ok('★ ok 를 손으로 꾸며도 받은 때를 다시 본다',
  (await threw(() => B.restoreSql(badTime, { ok: true, problems: [], tables: [] }))) !== null, true)

const sql = B.restoreSql(pack, good)
ok('★ 한 덩어리로 돈다(begin)', sql.includes('begin;'), true)
ok('★ 한 덩어리로 돈다(commit)', sql.includes('commit;'), true)
ok('계정을 먼저 만들라고 적는다', sql.includes('계정을 먼저 만들어야'), true)
ok('메신저가 빠졌다고 적는다', sql.includes('메신저'), true)
ok('표를 넣는 글이 있다', sql.includes('insert into public.employees'), true)
ok('칸 이름을 손으로 안 적는다', sql.includes('jsonb_populate_recordset'), true)
ok('복합키도 제대로 적는다', sql.includes('on conflict ("doc_id", "step")'), true)
ok('부모 표가 먼저 나온다',
  sql.indexOf('insert into public.employees') < sql.indexOf('insert into public.employee_hr'), true)
ok('고를 수도 있다', B.restoreSql(pack, good, { only: ['settings'] }).includes('insert into public.employees'), false)

/* ★ 칸은 모든 줄에서 모은다 — 첫 줄만 보면 뒤 줄의 칸이 안 덮인다 */
const wide = clone(pack)
wide.tables.events = [{ id: 'e1', a: 1 }, { id: 'e2', a: 1, b: 2 }]
wide.counts.events = 2; wide.hashes.events = await B.hashRows(wide.tables.events)
const wideCheck = await B.checkBackup(wide)
/* 칸 구성이 다르면 검사에서 걸린다 — 그게 맞다 */
ok('★ 칸 구성이 다른 줄이 있으면 검사에서 걸린다', wideCheck.ok, false)

/* 0건·빠진 표는 넣지 않고 까닭을 적는다 */
const zero = clone(pack)
zero.tables.events = []; zero.counts.events = 0; zero.hashes.events = await B.hashRows([])
delete zero.tables.attendance; delete zero.counts.attendance; delete zero.hashes.attendance
const zsql = B.restoreSql(zero, { ok: true, problems: [], tables: [] })
ok('0건은 건너뛴다', zsql.includes('insert into public.events'), false)
ok('0건이라고 적는다', zsql.includes('0건이라 건너뜁니다'), true)
ok('없는 표는 건너뛴다', zsql.includes('insert into public.attendance'), false)
ok('없다고 적는다', zsql.includes('꾸러미에 없어서 건너뜁니다'), true)

/* 따옴표·달러가 든 **값**은 SQL 을 깨지 않는다 (칸 이름과 달리 값은 괜찮다) */
const nasty = clone(pack)
nasty.tables.settings = [{ id: 1, memo: `'; drop table employees; --` }]
const nsql = B.restoreSql(nasty, { ok: true, problems: [], tables: [] })
ok('★ 따옴표가 든 값도 깨지 않는다', nsql.includes('$viren$'), true)
ok('값은 JSON 한 덩어리로만 들어간다',
  nsql.includes(`$viren$[{"id":1,"memo":"'; drop table employees; --"}]$viren$`), true)

const dollar = clone(pack)
dollar.tables.settings = [{ id: 1, memo: '$viren$ 라고 적어 봄' }]
ok('값에 인용 표시가 있으면 다른 표시를 쓴다',
  B.restoreSql(dollar, { ok: true, problems: [], tables: [] }).includes('$viren1$'), true)

/* ★ 칸 이름이 이상하면 검사를 건너뛰어도 SQL 을 안 만든다 (마지막 방어선) */
const colInj = clone(pack)
colInj.tables.settings = [{ id: 1, 'x" = 1, y': 2 }]
ok('★ 이상한 칸 이름이면 SQL 을 안 만든다',
  (await threw(() => B.restoreSql(colInj, { ok: true, problems: [], tables: [] }))) !== null, true)

/* ── 파일 경로가 안전한가 ─────────────────────────────────────── */
ok('보통 경로는 통과', B.safePath('abc/def.png'), true)
ok('★ 폴더를 빠져나가면 거절', B.safePath('../../etc/passwd'), false)
ok('★ 가운데에 .. 가 있어도 거절', B.safePath('a/../../b.png'), false)
ok('★ 뿌리부터 적으면 거절', B.safePath('/etc/passwd'), false)
ok('★ 윈도 드라이브도 거절', B.safePath('C:/Windows/x.dll'), false)
ok('★ 윈도 구분자도 거절', B.safePath('a\\b.png'), false)
ok('★ 널 글자도 거절', B.safePath(`a/b${String.fromCharCode(0)}.png`), false)
ok('빈 칸이 든 경로는 거절', B.safePath('a//b.png'), false)
ok('점 하나짜리 칸도 거절', B.safePath('a/./b.png'), false)
ok('빈 글자는 거절', B.safePath(''), false)
ok('글자가 아니면 거절', B.safePath(null), false)
ok('너무 길면 거절', B.safePath('a'.repeat(1100)), false)

/* ── 파일 목록 맞춰 보기 ───────────────────────────────────────── */
const M = (w, g) => B.checkManifest(w, g)
ok('같으면 통과', M([{ path: 'a.png', size: 3 }], [{ path: 'a.png', size: 3 }]).ok, true)
ok('★ 안 받은 파일을 잡는다',
  M([{ path: 'a.png', size: 3 }, { path: 'b.png', size: 4 }], [{ path: 'a.png', size: 3 }]).missing, ['b.png'])
ok('★ 크기가 다르면 잡는다',
  M([{ path: 'a.png', size: 3 }], [{ path: 'a.png', size: 9 }]).wrongSize,
  [{ path: 'a.png', want: 3, got: 9 }])
ok('크기가 다르면 통과 못 한다', M([{ path: 'a.png', size: 3 }], [{ path: 'a.png', size: 9 }]).ok, false)
ok('크기를 모르면 안 따진다', M([{ path: 'a.png', size: null }], [{ path: 'a.png', size: 9 }]).ok, true)
ok('더 있는 파일은 잘못이 아니다',
  M([{ path: 'a.png', size: 3 }], [{ path: 'a.png', size: 3 }, { path: 'c.png', size: 1 }]).ok, true)
ok('더 있는 파일은 따로 알린다',
  M([{ path: 'a.png', size: 3 }], [{ path: 'a.png', size: 3 }, { path: 'c.png', size: 1 }]).extra, ['c.png'])
ok('★ 꾸러미 쪽 경로가 이상하면 잡는다', M([{ path: '../x' }], []).unsafe, ['../x'])
ok('★ 폴더 쪽 경로가 이상해도 잡는다', M([], [{ path: '/etc/x' }]).unsafe, ['/etc/x'])
ok('경로가 이상하면 통과 못 한다', M([{ path: '../x' }], []).ok, false)
ok('빈 목록끼리는 통과', M([], []).ok, true)
ok('아무것도 안 줘도 버틴다', M().ok, true)

/* ── 경로 탈출이 든 꾸러미는 검사에서 걸린다 ──────────────────── */
const escape = clone(pack)
escape.files['approval-files'] = [{ path: '../../어딘가/x.png', size: 1 }]
const esc = await B.checkBackup(escape)
ok('★ 경로 탈출이 든 꾸러미는 거절', esc.ok, false)
ok('어느 저장소인지 말한다', esc.problems.some((p) => p.includes('approval-files')), true)

const notList = clone(pack); notList.files['chat-files'] = '파일들'
ok('★ 파일 목록이 배열이 아니면 거절', (await B.checkBackup(notList)).ok, false)

/* 꾸러미를 만들 때도 이상한 경로는 빼고 **적어 둔다** */
const dirty = await B.buildBackup({
  fetchTable: fetchOk,
  listFiles: async () => ({ files: [{ path: 'ok.png', size: 1 }, { path: '../나쁨.png', size: 1 }], truncated: false }),
})
ok('★ 이상한 경로는 빼고 담는다', dirty.files['approval-files'].map((f) => f.path), ['ok.png'])
ok('★ 뺐다는 사실을 적어 둔다',
  dirty.problems.some((p) => p.bucket === 'approval-files' && p.error.includes('쓸 수 없는 경로')), true)
ok('뺀 꾸러미는 전체가 아니다', dirty.complete, false)


console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
