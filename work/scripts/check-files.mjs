#!/usr/bin/env node
/* 받아 둔 꾸러미와 **내려받은 파일**을 맞춰 보는 도구.
   아무것도 바꾸지 않는다 — 읽고 세어서 알려 줄 뿐이다.

   쓰는 법
     node scripts/check-files.mjs 꾸러미.json
         → 꾸러미만 본다(인터넷도, 서버도 필요 없다). 기본 동작.
     node scripts/check-files.mjs 꾸러미.json --files 내려받은폴더
         → 폴더와 맞춰 본다. 폴더 안은 <저장소 이름>/<경로> 꼴이어야 한다.
     ... --hash
         → 파일 해시까지 잰다. 느리지만 내용이 바뀌었는지까지 안다.

   ⚠️ 이 도구가 "다 맞다" 고 해도 **되살릴 수 있다는 뜻은 아니다.**
      메신저·로그인 계정은 여기서 보지 않는다(BACKUP.md 2·4번). */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const here = new URL('.', import.meta.url)
const B = await import(new URL('../src/lib/backup.js', here).href)

const args = process.argv.slice(2)
const packPath = args.find((a) => !a.startsWith('--'))
const dirAt = args.indexOf('--files')
const filesDir = dirAt >= 0 ? args[dirAt + 1] : null
const wantHash = args.includes('--hash')

if (!packPath) {
  console.log('쓰는 법: node scripts/check-files.mjs 꾸러미.json [--files 내려받은폴더] [--hash]')
  process.exit(2)
}

let bad = 0
const say = (good, text, detail = '') => {
  if (!good) bad++
  console.log(`${good ? '✅' : '❌'} ${text}${detail ? `\n     ${detail}` : ''}`)
}

/* ── ① 꾸러미만 본다 (기본) ───────────────────────────────────── */
console.log(`\n══ 꾸러미: ${packPath}`)
let pack
try { pack = JSON.parse(readFileSync(packPath, 'utf8')) }
catch (e) { console.log(`❌ 파일을 읽지 못했습니다: ${e.message}`); process.exit(1) }

const check = await B.checkBackup(pack)
say(check.ok, check.ok ? '꾸러미가 성합니다(판 번호·받은 때·건수·해시·줄 모양).' : '꾸러미에 문제가 있습니다.',
  check.problems.slice(0, 8).join('\n     '))

console.log(`\n   받은 때: ${pack.exported_at || '(없음)'}`)
console.log('   표별 건수:')
for (const t of check.tables) {
  console.log(`     ${t.what.padEnd(20)} ${String(t.rows).padStart(7)}건  해시 ${t.hashOk ? '맞음' : '안 맞음'}`)
}

/* ⚠️ 어떤 꾸러미도 '전체' 가 아니다. 그 사실을 늘 적는다. */
console.log(`\n   ⚠️ 이 꾸러미에 **없는 것**: ${pack.missing?.length ?? B.MISSING.length}가지`)
for (const m of (pack.missing || B.MISSING)) console.log(`     · ${m.what}`)
if (pack.complete === true) say(false, '꾸러미가 스스로 ‘전체’ 라고 적고 있습니다 — 그럴 리가 없습니다.')

if (pack.problems?.length) {
  say(false, `받을 때 못 읽은 것이 ${pack.problems.length}가지 있었습니다.`,
    pack.problems.map((p) => `${p.bucket || p.table}: ${p.error}`).join('\n     '))
}

/* ── ② 파일 목록 모양 보기 ────────────────────────────────────── */
console.log('\n══ 파일 목록')
for (const b of B.BUCKETS) {
  const list = pack.files?.[b]
  if (!Array.isArray(list)) { say(false, `저장소 ‘${b}’의 목록이 꾸러미에 없습니다.`); continue }
  const unsafe = list.filter((f) => !B.safePath(f?.path))
  const bytes = list.reduce((a, f) => a + (Number(f?.size) || 0), 0)
  say(unsafe.length === 0,
    `${b.padEnd(16)} ${String(list.length).padStart(5)}개 · ${(bytes / 1024 / 1024).toFixed(1)}MB`,
    unsafe.length ? `쓸 수 없는 경로 ${unsafe.length}개: ${unsafe.slice(0, 3).map((f) => String(f?.path).slice(0, 60)).join(' · ')}` : '')
}

/* ── ③ 내려받은 폴더와 맞춰 보기 (--files 를 줬을 때만) ─────────── */
if (!filesDir) {
  console.log('\n   (파일 본체는 안 봤습니다. 보려면 --files 내려받은폴더 를 주세요)')
} else {
  const root = resolve(filesDir)
  console.log(`\n══ 내려받은 폴더와 맞추기: ${root}`)
  if (!existsSync(root)) {
    say(false, '그런 폴더가 없습니다.')
  } else {
    for (const b of B.BUCKETS) {
      const want = pack.files?.[b] || []
      const base = join(root, b)
      if (!existsSync(base)) { say(false, `‘${b}’ 폴더가 없습니다 — 아직 안 받았나요?`); continue }

      /* 폴더를 훑는다. **폴더 밖으로 나가는 것은 세지 않는다.** */
      const got = []
      async function walk(dir) {
        for (const e of await readdir(dir, { withFileTypes: true })) {
          const full = join(dir, e.name)
          if (e.isDirectory()) { await walk(full); continue }
          const rel = relative(base, full).split(sep).join('/')
          if (!B.safePath(rel)) continue
          got.push({ path: rel, size: statSync(full).size })
        }
      }
      await walk(base)

      const r = B.checkManifest(want, got)
      say(r.ok, `${b.padEnd(16)} 꾸러미 ${want.length}개 / 폴더 ${got.length}개`,
        [
          r.missing.length ? `안 받은 것 ${r.missing.length}개: ${r.missing.slice(0, 3).join(' · ')}` : '',
          r.wrongSize.length ? `크기가 다른 것 ${r.wrongSize.length}개: ${r.wrongSize.slice(0, 3).map((x) => `${x.path}(${x.want}→${x.got})`).join(' · ')}` : '',
          r.unsafe.length ? `이상한 경로 ${r.unsafe.length}개` : '',
          /* 더 받은 것은 잘못이 아니다 — 꾸러미를 받은 뒤 올라온 파일일 수 있다 */
          r.extra.length ? `(꾸러미에 없는 파일 ${r.extra.length}개 — 그 뒤에 올라온 것일 수 있습니다)` : '',
        ].filter(Boolean).join('\n     '))

      if (wantHash) {
        const sha = (f) => new Promise((ok2, no) => {
          const h = createHash('sha256')
          createReadStream(f).on('data', (d) => h.update(d)).on('end', () => ok2(h.digest('hex'))).on('error', no)
        })
        let n = 0
        for (const f of got.slice(0, 2000)) { await sha(join(base, f.path)); n++ }
        console.log(`     해시를 ${n}개 쟀습니다. (꾸러미에는 해시가 없어 맞춰 볼 대상이 없습니다 —`)
        console.log('      다음에 받을 때와 비교하려면 이 값을 따로 적어 두세요)')
      }
    }
  }
}

console.log(`\n${bad === 0 ? '✅ 본 것 중에는 어긋나는 게 없습니다.' : `❌ 어긋나는 것이 ${bad}가지 있습니다.`}`)
console.log('⚠️ 이것만으로 **되살릴 수 있다는 뜻은 아닙니다.** 메신저·로그인 계정은 여기서 안 봅니다.')
process.exit(bad ? 1 : 0)
