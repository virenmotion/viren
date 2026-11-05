import { useCallback, useEffect, useRef, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { downloadBlob } from '../lib/csv'
import { ymd } from '../lib/dates'
import {
  BUCKETS, MISSING, TABLES, buildBackup, checkBackup, previewRestore, restoreSql,
} from '../lib/backup'
import { ErrorBox } from './ui'

/* 관리 → 기타 설정. 업무 자료를 내려받고, 받아 둔 꾸러미를 검사하고,
   되돌리는 SQL 을 만든다.

   ⚠️⚠️ **'전체 백업' 이라고 부르지 않는다.** 메신저·파일 본체·로그인 계정은
        브라우저로 가져올 수 없다. 전체라고 적어 두면 그걸 믿고 있다가
        정작 필요할 때 없다 — 그게 백업에서 제일 나쁜 일이다.

   ⚠️ 되돌리기는 **여기서 돌리지 않는다.** SQL 을 만들어 줄 뿐이고, 사람이 보고
      Supabase SQL Editor 에서 돌린다. 핵심 표에는 insert 정책이 아예 없어서
      브라우저로는 넣을 수도 없다(문서·직원·인사 기록은 함수로만 만들어진다). */

const PAGE = 1000
const DEEP = 4            // 저장소 폴더를 이만큼까지만 파고든다

/* 한 표를 전부 가져온다.
   ⚠️ **기본키 전부로 줄을 세운다.** 차례 없이 range 로 넘기면 페이지마다 순서가
      달라질 수 있어서 1000건이 넘는 표에서 줄이 겹치거나 빠진다. 복합키를 한 칸만
      쓰는 것도 같은 문제다 — doc_id 가 같은 줄들의 차례가 안 정해진다
      (2026-11-05 검토 지적). */
async function fetchTable(name, keyCols) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(name).select('*')
    for (const c of keyCols) q = q.order(c, { ascending: true })
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

/* 저장소의 파일 **경로와 크기**만. 본체는 안 받는다(너무 크다).
   ⚠️ 끝까지 읽는다 — 페이지도 넘기고 폴더도 파고든다. 못 읽은 곳이 있으면
      `truncated` 로 알린다. **조용히 적게 담는 게 제일 나쁘다**(검토 지적). */
async function listFiles(bucket) {
  const files = []
  const errors = []
  let deepCut = false

  async function walk(prefix, depth) {
    if (depth > DEEP) { deepCut = true; return }
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await supabase.storage.from(bucket)
        .list(prefix, { limit: PAGE, offset: off, sortBy: { column: 'name', order: 'asc' } })
      if (error) { errors.push(`${prefix || '/'} — ${error.message}`); return }
      const list = data || []
      for (const e of list) {
        const path = prefix ? `${prefix}/${e.name}` : e.name
        /* id 가 있으면 파일, 없으면 폴더(Supabase 가 그렇게 준다) */
        if (e.id) files.push({ path, size: e.metadata?.size ?? null })
        else await walk(path, depth + 1)
      }
      if (list.length < PAGE) break
    }
  }
  await walk('', 0)

  const note = errors.length
    ? `못 읽은 곳 ${errors.length}군데: ${errors.slice(0, 3).join(' / ')}`
    : deepCut ? `폴더가 ${DEEP}단보다 깊어 일부를 건너뛰었습니다.` : ''
  return { files, truncated: errors.length > 0 || deepCut, note }
}

const mb = (b) => `${(Number(b || 0) / 1024 / 1024).toFixed(1)}MB`

export default function BackupCard() {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [made, setMade] = useState(null)      // 방금 내려받은 꾸러미
  const [loaded, setLoaded] = useState(null)  // 열어 본 꾸러미 { obj, check, preview }
  const [log, setLog] = useState(null)        // 지난 기록 (표가 아직 없으면 null)
  const pick = useRef(null)

  const loadLog = useCallback(async () => {
    const { data, error } = await supabase.rpc('backup_log_list')
    /* 표를 아직 안 만들었으면 오류가 난다 — 그건 고장이 아니라 '아직 없음' 이다 */
    setLog(error ? null : (data || []))
  }, [])
  useEffect(() => { loadLog() }, [loadLog])

  /* 받은 사실을 DB 에 남긴다. **개인정보는 한 줄도 안 넣는다** — 시각·상태·건수·빠진 것뿐.
     표가 아직 없으면 조용히 넘어가고, 화면에 '기록이 안 남았다' 고 적는다. */
  async function writeLog(pack, failed) {
    const { error } = await supabase.rpc('backup_log_add', {
      p_ok: !failed,
      p_counts: pack ? pack.counts : {},
      p_problems: pack ? pack.problems.map((p) => `${p.table || p.bucket}: ${p.error}`) : [String(failed || '')],
    })
    return !error
  }

  async function makeBackup() {
    setBusy('받는 중'); setErr(''); setNote(''); setMade(null)
    try {
      const pack = await buildBackup({ fetchTable, listFiles })
      downloadBlob(`viren-work-자료-${ymd()}.json`,
        new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' }))
      setMade(pack)
      const kept = await writeLog(pack, null)
      if (!kept) setNote('받은 기록은 남기지 못했어요(기록 표가 아직 없습니다).')
      else loadLog()
    } catch (e) {
      /* 반쪽은 안 내준다 — 어디서 멈췄는지만 말한다 */
      setErr(errText(e))
      await writeLog(e?.partial || null, errText(e))
      loadLog()
    }
    setBusy('')
  }

  async function openPack(file) {
    setBusy('읽는 중'); setErr(''); setNote(''); setLoaded(null)
    try {
      const obj = JSON.parse(await file.text())
      const check = await checkBackup(obj)
      /* 지금 DB 에 몇 건이 있는지 센다.
         ⚠️ **못 세면 null 이다.** 0 으로 바꾸면 '새로 넣음' 으로 보여서, 실은
            덮어쓰는데 안심하게 된다(검토 지적). */
      const now = {}
      for (const t of TABLES) {
        const { count, error } = await supabase.from(t.name).select('*', { count: 'exact', head: true })
        now[t.name] = error || count === null || count === undefined ? null : count
      }
      setLoaded({ obj, check, preview: previewRestore(obj, now) })
    } catch (e) { setErr(`꾸러미를 읽지 못했어요: ${errText(e)}`) }
    setBusy('')
  }

  function makeSql() {
    if (!loaded) return
    try {
      /* 검사를 통과해야만 만든다. 단추도 막지만 여기서 한 번 더 막는다. */
      downloadBlob(`viren-work-되돌리기-${ymd()}.sql`,
        new Blob([restoreSql(loaded.obj, loaded.check)], { type: 'text/plain;charset=utf-8' }))
      setNote('SQL 을 내려받았어요. 열어서 읽어 본 뒤 Supabase SQL Editor 에 붙여넣으세요.')
    } catch (e) { setErr(errText(e)) }
  }

  const unknownCount = loaded?.preview.filter((r) => r.unknown).length || 0

  return (
    <section className="card stack-sm">
      <h2>업무 자료 내보내기</h2>
      <p className="hint">
        무료 서버에는 자동 백업이 없습니다. <strong>한 달에 한 번</strong> 내려받아 회사 드롭박스에
        보관해 주세요. 직원·인사 기록·결재 문서·근태·일정이 들어갑니다.
      </p>

      {/* ⚠️ 이 경고는 지우지 말 것. '전체' 라고 믿는 순간이 제일 위험하다. */}
      <p className="hint warn">
        <strong>이것만으로는 회사를 되살릴 수 없습니다.</strong> 메신저 대화, 파일 본체,
        로그인 계정은 여기에 <strong>안 들어갑니다.</strong> 전체를 받는 방법은
        <code> work/BACKUP.md</code> 에 적어 두었습니다.
      </p>

      <ErrorBox>{err}</ErrorBox>

      <div className="actions start">
        <button className="btn primary" disabled={!!busy} onClick={makeBackup}>
          {busy === '받는 중' ? '받는 중…' : '업무 자료 내려받기'}
        </button>
      </div>

      {made && (
        <>
          <p className="ok">내려받았어요. 아래 건수가 맞는지 보고 드롭박스에 올려 주세요.</p>
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>무엇</th><th className="r">건수</th></tr></thead>
              <tbody>
                {TABLES.map((t) => (
                  <tr key={t.name}><td>{t.what}</td><td className="r tnum">{made.counts[t.name]}</td></tr>
                ))}
                {BUCKETS.map((b) => {
                  const f = made.files[b]
                  const cut = made.problems.find((p) => p.bucket === b)
                  return (
                    <tr key={b}>
                      <td>{b} <span className="small muted">파일 목록만</span></td>
                      <td className={`r tnum ${cut ? 'pl-bad' : ''}`}>
                        {f ? `${f.length}개 · ${mb(f.reduce((a, x) => a + (x.size || 0), 0))}${cut ? ' (일부)' : ''}` : '못 읽음'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {made.problems.length > 0 && (
            <div className="hint warn">
              <strong>끝까지 못 읽은 것이 있습니다.</strong> 이 꾸러미는 <strong>일부가 빠져 있습니다.</strong>
              <ul className="line-list">
                {made.problems.map((p, i) => <li key={i}><span>{p.bucket || p.table} — {p.error}</span></li>)}
              </ul>
            </div>
          )}
        </>
      )}

      <details className="stack-sm">
        <summary>무엇이 빠지나 ({MISSING.length}가지)</summary>
        <ul className="line-list">
          {MISSING.map((m) => (
            <li key={m.what}>
              <span><strong>{m.what}</strong> — {m.why} <span className="muted">{m.how}</span></span>
            </li>
          ))}
        </ul>
      </details>

      {/* ── 지난 기록 ───────────────────────────────────────────── */}
      {log === null ? (
        <p className="hint warn">
          <strong>받은 기록이 안 남고 있습니다.</strong> 기록 표를 아직 안 만들었어요 —
          <code> supabase/migrations/2026-11-05a-backup-log.sql</code> 을 한 번 돌리면 켜집니다.
        </p>
      ) : log.length > 0 && (
        <details className="stack-sm">
          <summary>언제 받았나 (최근 {log.length}번)</summary>
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>때</th><th>결과</th><th className="r">줄 수</th></tr></thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.at}>
                    <td className="tnum">{new Date(r.at).toLocaleString('ko-KR')}</td>
                    <td className={r.ok ? 'pl-ok' : 'pl-bad'}>{r.ok ? '받음' : '실패'}</td>
                    <td className="r tnum">{r.rows ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">기록에는 <strong>시각·성공 여부·건수</strong>만 남습니다. 자료 내용은 안 남습니다.</p>
        </details>
      )}

      {/* ── 되돌리기 ─────────────────────────────────────────────── */}
      <div className="stack-sm restore-box">
        <div>
          <strong>되돌리기</strong>
          <p className="hint">
            받아 둔 꾸러미를 열어 <strong>성한지 검사</strong>하고, 무엇이 몇 건 들어가는지
            <strong> 미리 봅니다.</strong> 여기서는 아무것도 바꾸지 않아요 —
            되돌리는 SQL 을 만들어 줄 뿐입니다.
          </p>
        </div>
        <div className="actions start">
          <button className="btn" disabled={!!busy} onClick={() => pick.current?.click()}>
            {busy === '읽는 중' ? '읽는 중…' : '꾸러미 열기'}
          </button>
        </div>
        <input ref={pick} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) openPack(f) }} />
      </div>

      {loaded && (
        <>
          {loaded.check.ok
            ? <p className="ok">꾸러미가 성합니다. 건수와 해시가 모두 맞아요.</p>
            : (
              <div className="hint warn">
                <strong>이 꾸러미에는 문제가 있습니다. 되돌리기 SQL 을 만들 수 없어요.</strong>
                <ul className="line-list">
                  {loaded.check.problems.map((p, i) => <li key={i}><span>{p}</span></li>)}
                </ul>
              </div>
            )}
          <p className="hint">
            받은 때: <strong>{loaded.obj.exported_at
              ? new Date(loaded.obj.exported_at).toLocaleString('ko-KR') : '모름'}</strong>
          </p>
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>무엇</th><th className="r">꾸러미</th><th className="r">지금</th><th>어떻게 되나</th></tr></thead>
              <tbody>
                {loaded.preview.map((r) => (
                  <tr key={r.name}>
                    <td>{r.what}</td>
                    <td className="r tnum">{r.missing ? '—' : r.rows}</td>
                    <td className="r tnum">{r.have ?? '?'}</td>
                    <td className={r.missing || r.unknown ? 'pl-bad' : ''}>
                      {r.missing ? '꾸러미에 없음' : r.mode}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unknownCount > 0 && (
            <p className="hint warn">
              지금 건수를 <strong>{unknownCount}개 표에서 못 셌습니다.</strong> 덮어쓰는지 새로 넣는지
              알 수 없으니, 돌리기 전에 <strong>지금 자료를 꼭 먼저 받아</strong> 두세요.
            </p>
          )}
          {note && <p className="ok">{note}</p>}
          <div className="actions start">
            {/* ⚠️ 검사를 통과하지 못한 꾸러미로는 만들지 않는다(검토 지적) */}
            <button className="btn" disabled={!loaded.check.ok} onClick={makeSql}>
              되돌리기 SQL 만들기
            </button>
          </div>
          <p className="hint warn">
            만든 SQL 은 <strong>한 덩어리로</strong> 돕니다 — 중간에 하나라도 걸리면 아무것도 안 들어간 채
            되돌아갑니다. 다만 같은 번호의 줄은 <strong>덮어씁니다.</strong> 돌리기 전에
            <strong> 지금 자료를 먼저 내려받아</strong> 두세요.
          </p>
        </>
      )}
    </section>
  )
}
