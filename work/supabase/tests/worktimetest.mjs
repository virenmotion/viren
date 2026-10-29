/* 근무시간 셈법을 가이드의 검증 스냅샷과 맞춰 본다.
   실행:  node work/supabase/tests/worktimetest.mjs
   node 는 확장자 없는 import 를 못 찾으므로 사본을 만들어 돌린다. */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const lib = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'lib') + '/'
const tmp = mkdtempSync(join(tmpdir(), 'viren-worktime-'))
writeFileSync(join(tmp, 'worktime.mjs'),
  readFileSync(lib + 'worktime.js', 'utf8')
    .replace("from './dates'", `from ${JSON.stringify(pathToFileURL(lib + 'dates.js').href)}`))

const { workStat, dayMinutes, isWorkingDay, workTone, nightCarry, NIGHT_END_H } =
  await import(pathToFileURL(join(tmp, 'worktime.mjs')).href)

let pass = 0, fail = 0
const T = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? '✅' : '❌'} ${label.padEnd(46)} ${JSON.stringify(got)}`
    + (ok ? '' : `   ← 기대: ${JSON.stringify(want)}`))
}

console.log('── 하루 9시간(540분) 기준 ──')
/* 가이드에 적힌 검증 스냅샷 그대로 */
T('442분 → 82%', workStat(442).pct, 82)
T('442분 → 98분 남음', workStat(442).left, 98)
T('530분 → 98%', workStat(530).pct, 98)
T('530분 → 10분 부족', workStat(530).left, 10)
T('530분 → 충족 아님', workStat(530).done, false)
T('550분 → 102%', workStat(550).pct, 102)
T('550분 → 10분 초과', workStat(550).over, 10)
T('540분 → 100% 충족', [workStat(540).pct, workStat(540).done], [100, true])
/* ⚠️ 초과를 100% 로 자르지 않는다 */
T('1080분 → 200% (자르지 않음)', workStat(1080).pct, 200)
/* ⚠️ 충족 판정은 반올림한 % 가 아니라 실제 분으로 한다 */
T('538분 → 반올림 100% 지만 미충족', [workStat(538).pct, workStat(538).done], [100, false])

console.log('\n── 퇴근 기록이 없는 날 ──')
const NOW = new Date('2026-10-22T19:49:00+09:00')
const mk = (i, o) => ({ check_in: i, check_out: o })
T('퇴근함 → 출근~퇴근', dayMinutes(mk('2026-10-22T09:27:00+09:00', '2026-10-22T16:49:00+09:00'), '2026-10-22', NOW), 442)
T('오늘 근무 중 → 지금까지', dayMinutes(mk('2026-10-22T09:27:00+09:00', null), '2026-10-22', NOW), 622)
/* ⚠️ 여기가 핵심 — 지난 날을 현재 시각까지 이어 세면 하루가 20시간이 된다 */
T('지난 날 퇴근 누락 → 0', dayMinutes(mk('2026-10-20T09:00:00+09:00', null), '2026-10-20', NOW), 0)
T('출근 기록 없음 → 0', dayMinutes(null, '2026-10-22', NOW), 0)
T('근무 중 판정 (오늘)', isWorkingDay(mk('2026-10-22T09:27:00+09:00', null), '2026-10-22', NOW), true)
T('근무 중 판정 (지난 날은 아님)', isWorkingDay(mk('2026-10-20T09:00:00+09:00', null), '2026-10-20', NOW), false)

console.log('\n── 막대 색 ──')
T('근무 중', workTone(442, true), 'now')
T('충족', workTone(540, false), 'done')
T('초과', workTone(550, false), 'over')
T('미달', workTone(530, false), 'short')

/* ── 자정을 넘긴 퇴근 (2026-10-29) ───────────────────────────────
   어제 줄이 '출근은 찍고 퇴근은 안 찍은' 채로 열려 있고, 지금이 아침 9시 전이면
   홈에 '어제 근무 퇴근하기' 가 떠야 한다. 안 그러면 퇴근을 찍을 길이 없다. */
const OPEN = { check_in: '2026-10-28T13:00:00Z', check_out: null }   // 어제 22시 출근
const SHUT = { check_in: '2026-10-28T13:00:00Z', check_out: '2026-10-28T23:00:00Z' }
const at = (h) => new Date(2026, 9, 29, h, 30)

T('기준 시각은 9시', NIGHT_END_H, 9)
T('새벽 1시 — 어제 퇴근을 찍게', nightCarry(OPEN, at(1)), true)
T('아침 8시 — 아직 찍게', nightCarry(OPEN, at(8)), true)
T('🔴 아침 9시 — 넘겼으니 안 찍게', nightCarry(OPEN, at(9)), false)
T('🔴 낮 2시 — 안 찍게', nightCarry(OPEN, at(14)), false)
T('🔴 어제 이미 퇴근했으면', nightCarry(SHUT, at(1)), false)
T('🔴 어제 출근을 안 했으면', nightCarry({ check_in: null }, at(1)), false)
T('🔴 어제 줄이 아예 없으면', nightCarry(null, at(1)), false)
T('🔴 어제 줄이 undefined 여도 버틴다', nightCarry(undefined, at(1)), false)


console.log(`\n${pass}개 통과 · ${fail}개 실패`)
process.exit(fail ? 1 : 0)
