/* 🐛 **마이그레이션에만 있고 schema.sql 에 없는 것**을 잡는다.
   운영 DB 는 마이그레이션으로 만들어지지만, **새 서버는 schema.sql 하나로** 선다.
   둘이 어긋나면 "백업은 다 받아 뒀는데 되살릴 구조가 틀린" 상태가 된다.

   실제로 두 번 걸렸다 (2026-11-05):
     · user_mail 표 한 절이 통째로 빠져 있었다 → 직원 메일 알림이 안 섬
     · comp_balance 함수가 빠졌는데 schema.sql 안에서 부르고 있었다 → 대휴 신청이 터짐

   실행: node supabase/tests/schematest.mjs */
import { readFileSync, readdirSync } from 'node:fs'

const root = 'C:/Users/c/VIREN Dropbox/박지은/VIREN_경영/2. 디자인관련서류/04. 사내 디자인 작업관리/★클로드문서/viren-react/work/supabase/'
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const S = rd(`${root}schema.sql`)

let pass = 0, fail = 0
const ok = (name, good, detail = '') => {
  good ? pass++ : fail++
  console.log(`${good ? '✅' : '❌'} ${name.padEnd(46)} ${good ? '' : detail}`)
}

/* 한 SQL 글이 **만드는** 것의 이름만 긁는다.
   ⚠️ 함수는 이름만 본다. 인자 모양까지 맞추려 들면 `default` 같은 것 때문에
      헛돌아서, 진짜 빠진 것을 못 보고 지나친다. */
function made(sql) {
  const out = { 표: new Set(), 함수: new Set(), 방아쇠: new Set(), 정책: new Set(), 저장소: new Set() }
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_0-9]+)/gi)) out.표.add(m[1].toLowerCase())
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_0-9]+)/gi)) out.함수.add(m[1].toLowerCase())
  for (const m of sql.matchAll(/create\s+trigger\s+([a-z_0-9]+)/gi)) out.방아쇠.add(m[1].toLowerCase())
  for (const m of sql.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?([a-z_0-9.]+)/gi)) out.정책.add(`${m[2]}:${m[1]}`.toLowerCase())
  for (const m of sql.matchAll(/insert\s+into\s+storage\.buckets[\s\S]{0,200}?values\s*\(\s*'([a-z\-_0-9]+)'/gi)) out.저장소.add(m[1].toLowerCase())
  return out
}

const here = made(S)
const files = readdirSync(`${root}migrations`).filter((f) => f.endsWith('.sql')).sort()

/* ── ① 마이그레이션이 만든 것이 schema.sql 에도 있나 ───────────────── */
const gone = {}
for (const f of files) {
  const m = made(rd(`${root}migrations/${f}`))
  for (const kind of Object.keys(m)) {
    for (const name of m[kind]) {
      if (!here[kind].has(name)) (gone[kind] ||= []).push(`${name} (${f})`)
    }
  }
}
for (const kind of ['표', '함수', '방아쇠', '정책', '저장소']) {
  const list = gone[kind] || []
  ok(`schema.sql 에 빠진 ${kind} 가 없다`, list.length === 0, `빠짐: ${list.join(' · ')}`)
}

/* ── ② schema.sql 이 **부르는데 만들지 않는** 함수 ─────────────────── */
/* 표 이름 뒤의 괄호(`insert into public.employees (…)`)는 함수 호출이 아니다 */
const called = new Set()
for (const m of S.matchAll(/public\.([a-z_0-9]+)\s*\(/gi)) {
  const n = m[1].toLowerCase()
  if (!here.표.has(n)) called.add(n)
}
const ghosts = [...called].filter((n) => !here.함수.has(n)).sort()
ok('schema.sql 이 없는 함수를 부르지 않는다', ghosts.length === 0, `없는데 부름: ${ghosts.join(' · ')}`)

/* ── ③ 달러 인용이 깨지지 않았나 ──────────────────────────────────── */
/* 🐛 자바스크립트 replace 로 SQL 을 옮기면 `$$` 가 `$` 하나로 줄어든다.
   ⚠️ `grep -c` 로 세면 **줄 수**를 세어 홀짝이 뒤집힌다. 횟수로 세야 한다. */
const dollars = (S.match(/\$\$/g) || []).length
ok('$$ 가 짝으로 맞는다', dollars % 2 === 0, `${dollars}개 — 홀수다`)
ok('as $ 로 줄어든 곳이 없다', !/\bas \$[^$]/.test(S))
ok('end $; 로 줄어든 곳이 없다', !/\bend \$;/.test(S))

/* ── ④ 백업이 담는 표가 schema.sql 에 다 있나 ─────────────────────── */
const { TABLES } = await import(`${new URL('../../src/lib/backup.js', import.meta.url)}`)
const noTable = TABLES.filter((t) => !here.표.has(t.name)).map((t) => t.name)
ok('백업이 담는 표가 schema.sql 에 다 있다', noTable.length === 0, `없음: ${noTable.join(' · ')}`)

console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
