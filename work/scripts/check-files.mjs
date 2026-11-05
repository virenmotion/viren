#!/usr/bin/env node
/* 받아 둔 꾸러미·목록(manifest)과 **실제로 내려받은 파일**을 맞춰 보는 도구.

   ⚠️ **기본 동작은 읽기만 한다.** 아무것도 쓰지 않는다.
      목록을 만드는 것(--write-manifest)만 파일을 쓰고, 그것도 **일부러 줘야** 한다.

   쓰는 법
     node scripts/check-files.mjs 꾸러미.json
         → 꾸러미만 본다(인터넷도 서버도 필요 없다). 기본.

     node scripts/check-files.mjs 꾸러미.json --files 내려받은폴더
         → 폴더와 맞춰 본다. **크기**까지. 폴더 안은 <저장소 이름>/<경로> 꼴.

     node scripts/check-files.mjs --write-manifest 목록.json --files 내려받은폴더
         → 폴더를 훑어 path·size·sha256 **목록을 만든다.** 받은 그날 만들어 두세요.

     node scripts/check-files.mjs --manifest 목록.json --files 내려받은폴더
         → 그 목록과 폴더를 **해시까지** 맞춘다. 크기가 같은 손상도 잡는다.
           (꾸러미도 함께 주면 꾸러미↔목록도 맞춰 본다)

   ⚠️ 이 도구가 "다 맞다" 고 해도 **되살릴 수 있다는 뜻은 아니다.**
      메신저·로그인 계정은 여기서 보지 않는다(BACKUP.md).

   ⚠️ **바로가기(심볼릭 링크·junction)는 따라가지 않는다.** 따라가면 폴더 밖 파일을
      안에 있는 것처럼 세게 된다. 보이면 **실패로 센다.** */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { lstat, readdir, realpath, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

const B = await import(new URL('../src/lib/backup.js', import.meta.url).href)

/* ── 들어온 말 읽기 ─────────────────────────────────────────────── */
const argv = process.argv.slice(2)
const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }
/* --xxx 다음 한 칸은 그 옵션의 값이다. 남은 첫 낱말이 꾸러미 파일. */
const VALOPT = new Set(['--files', '--write-manifest', '--manifest'])
let packPath = null
for (let i = 0; i < argv.length; i++) {
  if (VALOPT.has(argv[i])) { i++; continue }
  if (argv[i].startsWith('--')) continue
  packPath = argv[i]; break
}
const filesDir = val('--files')
const writeTo = val('--write-manifest')
const manifestAt = val('--manifest')

if (!packPath && !writeTo && !manifestAt) {
  console.log(`쓰는 법
  node scripts/check-files.mjs 꾸러미.json                         꾸러미만 본다(기본)
  node scripts/check-files.mjs 꾸러미.json --files 폴더             폴더와 크기까지 맞춘다
  node scripts/check-files.mjs --write-manifest 목록.json --files 폴더   목록을 만든다(해시 포함)
  node scripts/check-files.mjs --manifest 목록.json --files 폴더         목록과 해시까지 맞춘다`)
  process.exit(2)
}

const NL5 = String.fromCharCode(10) + '     '   // 여러 줄 설명을 들여쓸 때
let bad = 0
const say = (good, text, detail = '') => {
  if (!good) bad++
  console.log(`${good ? '✅' : '❌'} ${text}${detail ? `\n     ${detail}` : ''}`)
}
const mb = (b) => `${(Number(b || 0) / 1024 / 1024).toFixed(1)}MB`

/* ── 폴더 훑기 — 바로가기를 따라가지 않는다 ───────────────────── */

/* real 이 base 안에 있나. 윈도는 대소문자를 안 가리므로 맞춰서 본다. */
function inside(base, real) {
  const r = relative(base, real)
  if (r === '') return true
  if (isAbsolute(r)) return false
  return !r.split(sep).includes('..')
}

/* 돌려주는 것: { files: [{path, size}], problems: [...] }
   hash 가 true 면 sha256 까지 잰다(파일을 한 번씩 읽는다 — 느리다). */
async function walkDir(base, { hash = false } = {}) {
  const files = []
  const problems = []
  const realBase = await realpath(base)

  async function go(dir, depth) {
    if (depth > 12) { problems.push(`${relative(base, dir)} — 너무 깊어서 멈췄습니다.`); return }
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) }
    catch (e) { problems.push(`${relative(base, dir) || '/'} — 읽지 못했습니다: ${e.message}`); return }

    for (const e of entries) {
      const full = join(dir, e.name)
      const rel = relative(realBase, full).split(sep).join('/')

      /* ⚠️ 바로가기는 **따라가지 않는다.** 윈도의 junction 도 여기서 걸린다. */
      let st
      try { st = await lstat(full) } catch (err) { problems.push(`${rel} — 살펴보지 못했습니다: ${err.message}`); continue }
      if (st.isSymbolicLink()) { problems.push(`${rel} — 바로가기라서 세지 않았습니다.`); continue }

      /* 그래도 한 번 더 — 실제 자리가 폴더 안인지 본다(마운트·하드링크 대비) */
      let real
      try { real = await realpath(full) } catch (err) { problems.push(`${rel} — 실제 자리를 못 찾았습니다: ${err.message}`); continue }
      if (!inside(realBase, real)) { problems.push(`${rel} — 폴더 밖(${real})을 가리켜서 세지 않았습니다.`); continue }

      if (st.isDirectory()) { await go(full, depth + 1); continue }
      if (!st.isFile()) { problems.push(`${rel} — 보통 파일이 아니라서 세지 않았습니다.`); continue }
      if (!B.safePath(rel)) { problems.push(`${rel} — 쓸 수 없는 경로라서 세지 않았습니다.`); continue }

      const one = { path: rel, size: st.size }
      if (hash) {
        try { one.sha256 = await sha256File(full) }
        catch (err) { problems.push(`${rel} — 해시를 재지 못했습니다: ${err.message}`); continue }
      }
      files.push(one)
    }
  }
  await go(base, 0)
  return { files, problems }
}

function sha256File(f) {
  return new Promise((ok2, no) => {
    const h = createHash('sha256')
    createReadStream(f).on('data', (d) => h.update(d)).on('end', () => ok2(h.digest('hex'))).on('error', no)
  })
}

/* ── ① 목록 만들기 (--write-manifest) ─────────────────────────── */
if (writeTo) {
  if (!filesDir) { console.log('❌ --write-manifest 에는 --files 폴더 도 함께 주세요.'); process.exit(2) }
  const root = resolve(filesDir)
  if (!existsSync(root)) { console.log(`❌ 그런 폴더가 없습니다: ${root}`); process.exit(1) }

  console.log(`\n══ 목록 만들기 (해시까지 잽니다 — 파일이 많으면 오래 걸립니다)`)
  const out = { kind: 'viren-work-files', version: 1, made_at: new Date().toISOString(), buckets: {}, problems: [] }
  for (const b of B.BUCKETS) {
    const base = join(root, b)
    if (!existsSync(base)) { out.problems.push(`${b} — 폴더가 없습니다.`); say(false, `${b} 폴더가 없습니다.`); continue }
    const r = await walkDir(base, { hash: true })
    out.buckets[b] = r.files
    for (const p of r.problems) out.problems.push(`${b}/${p}`)
    const bytes = r.files.reduce((a, f) => a + f.size, 0)
    say(r.problems.length === 0, `${b.padEnd(16)} ${String(r.files.length).padStart(5)}개 · ${mb(bytes)}`,
      r.problems.slice(0, 3).join('\n     '))
  }
  await writeFile(writeTo, JSON.stringify(out, null, 1), 'utf8')
  console.log(`\n   ${writeTo} 에 적었습니다. **꾸러미와 같은 곳에 보관하세요.**`)
  if (out.problems.length) console.log(`   ⚠️ 못 센 것이 ${out.problems.length}가지 있습니다 — 목록 안의 problems 를 보세요.`)
  console.log(`\n${bad === 0 ? '✅ 목록을 만들었습니다.' : `❌ 만들었지만 어긋나는 것이 ${bad}가지 있습니다.`}`)
  process.exit(bad ? 1 : 0)
}

/* ── ② 꾸러미 보기 ────────────────────────────────────────────── */
let pack = null
if (packPath) {
  console.log(`\n══ 꾸러미: ${packPath}`)
  try { pack = JSON.parse(await (await import('node:fs/promises')).readFile(packPath, 'utf8')) }
  catch (e) { console.log(`❌ 파일을 읽지 못했습니다: ${e.message}`); process.exit(1) }

  const check = await B.checkBackup(pack)
  say(check.ok, check.ok ? '꾸러미가 성합니다(판 번호·받은 때·건수·해시·줄 모양·경로).' : '꾸러미에 문제가 있습니다.',
    check.problems.slice(0, 8).join('\n     '))

  console.log(`\n   받은 때: ${pack.exported_at || '(없음)'}`)
  for (const t of check.tables) {
    console.log(`     ${t.what.padEnd(22)} ${String(t.rows).padStart(7)}건  해시 ${t.hashOk ? '맞음' : '안 맞음'}`)
  }
  console.log(`\n   ⚠️ 이 꾸러미에 **없는 것**: ${(pack.missing || B.MISSING).length}가지`)
  for (const m of (pack.missing || B.MISSING)) console.log(`     · ${m.what}`)
  if (pack.complete === true) say(false, '꾸러미가 스스로 ‘전체’ 라고 적고 있습니다 — 그럴 리가 없습니다.')
  if (pack.problems?.length) {
    say(false, `받을 때 못 읽은 것이 ${pack.problems.length}가지 있었습니다.`,
      pack.problems.map((p) => `${p.bucket || p.table}: ${p.error}`).join('\n     '))
  }
}

/* ── ③ 목록 읽기 (--manifest) ─────────────────────────────────── */
let manifest = null
if (manifestAt) {
  console.log(`\n══ 목록: ${manifestAt}`)
  try { manifest = JSON.parse(await (await import('node:fs/promises')).readFile(manifestAt, 'utf8')) }
  catch (e) { console.log(`❌ 목록을 읽지 못했습니다: ${e.message}`); process.exit(1) }
  /* ⚠️ 폴더와 맞추기 **전에** 목록 자체가 성한지 본다. 저장소가 통째로 빠졌거나
     해시가 지워진 목록으로 맞춰 봐야 **없는 안심**만 준다(2026-11-05 검토 지적). */
  const mc = B.checkFileManifest(manifest)
  say(mc.ok, mc.ok ? '목록이 성합니다(판·만든 때·저장소 셋·경로·크기·해시·겹침).' : '목록 자체에 문제가 있습니다.',
    mc.problems.slice(0, 8).join(NL5))
  if (!mc.ok) console.log('   ⚠️ 목록이 성하지 않아 폴더와 맞춰 봐도 믿을 수 없습니다.')
  console.log(`   만든 때: ${manifest?.made_at || '(없음)'}`)
  if (manifest?.problems?.length) {
    say(false, `목록을 만들 때 못 센 것이 ${manifest.problems.length}가지 있었습니다.`,
      manifest.problems.slice(0, 5).join('\n     '))
  }
}

/* ── ④ 폴더와 맞추기 ─────────────────────────────────────────── */
if (!filesDir) {
  console.log('\n   (파일 본체는 안 봤습니다. 보려면 --files 내려받은폴더 를 주세요)')
} else {
  const root = resolve(filesDir)
  console.log(`\n══ 폴더와 맞추기: ${root}`)
  if (!existsSync(root)) {
    say(false, '그런 폴더가 없습니다.')
  } else {
    const needHash = !!manifest
    for (const b of B.BUCKETS) {
      const base = join(root, b)
      if (!existsSync(base)) { say(false, `‘${b}’ 폴더가 없습니다 — 아직 안 받았나요?`); continue }

      const r = await walkDir(base, { hash: needHash })
      /* ⚠️ 훑다가 걸린 것(바로가기·못 읽은 폴더)은 **그 자체로 실패**다 */
      if (r.problems.length) {
        say(false, `${b} — 세지 못한 것이 ${r.problems.length}가지 있습니다.`, r.problems.slice(0, 5).join('\n     '))
      }

      /* 맞출 대상: 목록이 있으면 목록(해시까지), 없으면 꾸러미(크기까지) */
      const want = manifest ? (manifest.buckets?.[b] || []) : (pack?.files?.[b] || [])
      const from = manifest ? '목록' : '꾸러미'
      if (!manifest && !pack) { say(false, '맞출 대상이 없습니다 — 꾸러미나 목록을 주세요.'); break }

      const m = B.checkManifest(want, r.files)
      const bytes = r.files.reduce((a, f) => a + f.size, 0)
      /* ⚠️ 목록 모드에서는 **목록에 없는 파일도 어긋남**이다. 목록은 그 폴더를 훑어
         만든 것이라, 더 있다는 건 바뀌었다는 뜻이다. 꾸러미와 맞출 때는 받은 뒤
         올라온 파일일 수 있어 알리기만 한다. */
      const allOk = m.ok && (!manifest || m.extra.length === 0)
      say(allOk,
        [
          m.missing.length ? `없는 것 ${m.missing.length}개: ${m.missing.slice(0, 3).join(' · ')}` : '',
          m.wrongSize.length ? `크기가 다른 것 ${m.wrongSize.length}개: ${m.wrongSize.slice(0, 3).map((x) => `${x.path}(${x.want}→${x.got})`).join(' · ')}` : '',
          m.wrongHash.length ? `★ 속이 바뀐 것 ${m.wrongHash.length}개: ${m.wrongHash.slice(0, 3).map((x) => x.path).join(' · ')}` : '',
          m.dup.length ? `겹친 경로 ${m.dup.length}개: ${m.dup.slice(0, 3).join(' · ')}` : '',
          m.unsafe.length ? `이상한 경로 ${m.unsafe.length}개` : '',
          m.extra.length ? `${manifest ? '★ ' : '('}목록에 없는 파일 ${m.extra.length}개: ${m.extra.slice(0, 3).join(' · ')}${manifest ? '' : ' — 그 뒤에 올라온 것일 수 있습니다)'}` : '',
        ].filter(Boolean).join('\n     '))

      if (!needHash && want.length) {
        console.log('     ⚠️ 크기만 봤습니다. 크기가 같은 손상은 못 잡습니다 —')
        console.log('        --write-manifest 로 목록을 만들어 두고 --manifest 로 맞추세요.')
      }
    }

    /* 꾸러미와 목록을 둘 다 줬으면 그 둘도 맞춰 본다 */
    if (pack && manifest) {
      console.log('\n══ 꾸러미 ↔ 목록')
      for (const b of B.BUCKETS) {
        const m = B.checkManifest(pack.files?.[b] || [], manifest.buckets?.[b] || [])
        say(m.missing.length === 0,
          `${b.padEnd(16)} 꾸러미 ${(pack.files?.[b] || []).length}개 / 목록 ${(manifest.buckets?.[b] || []).length}개`,
          m.missing.length ? `목록에 없는 것 ${m.missing.length}개: ${m.missing.slice(0, 3).join(' · ')}` : '')
      }
    }
  }
}

console.log(`\n${bad === 0 ? '✅ 본 것 중에는 어긋나는 게 없습니다.' : `❌ 어긋나는 것이 ${bad}가지 있습니다.`}`)
console.log('⚠️ 이것만으로 **되살릴 수 있다는 뜻은 아닙니다.** 메신저·로그인 계정은 여기서 안 봅니다.')
process.exit(bad ? 1 : 0)
