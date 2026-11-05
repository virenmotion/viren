import { useRef, useState } from 'react'
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

/* 한 표를 전부 가져온다.
   ⚠️ **차례(order)를 꼭 준다.** 차례 없이 range 로 넘기면 페이지마다 순서가
      달라질 수 있어서, 1000건이 넘는 표에서 줄이 겹치거나 빠진다
      (2026-11-05 에 찾은 것 — 그전 백업은 이 위험을 안고 있었다). */
async function fetchTable(name, order) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(name)
      .select('*').order(order, { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

/* 저장소의 파일 **경로와 크기**만. 본체는 안 받는다(너무 크다).
   폴더가 한 겹 있다(문서 id · 방 id). 그 안까지만 들어간다. */
async function listFiles(bucket) {
  const out = []
  const { data: top, error } = await supabase.storage.from(bucket).list('', { limit: 1000 })
  if (error) throw error
  for (const e of top || []) {
    if (e.id) { out.push({ path: e.name, size: e.metadata?.size ?? null }); continue }
    const { data: inner } = await supabase.storage.from(bucket).list(e.name, { limit: 1000 })
    for (const f of inner || []) out.push({ path: `${e.name}/${f.name}`, size: f.metadata?.size ?? null })
  }
  return out
}

const mb = (b) => `${(Number(b || 0) / 1024 / 1024).toFixed(1)}MB`

export default function BackupCard() {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [made, setMade] = useState(null)      // 방금 내려받은 꾸러미 요약
  const [loaded, setLoaded] = useState(null)  // 열어 본 꾸러미 { obj, check, preview }
  const pick = useRef(null)

  async function makeBackup() {
    setBusy('받는 중'); setErr(''); setNote(''); setMade(null)
    try {
      const pack = await buildBackup({ fetchTable, listFiles })
      downloadBlob(`viren-work-자료-${ymd()}.json`,
        new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' }))
      setMade(pack)
    } catch (e) {
      /* 반쪽은 안 내준다 — 어디서 멈췄는지만 말한다 */
      setErr(errText(e))
    }
    setBusy('')
  }

  async function openPack(file) {
    setBusy('읽는 중'); setErr(''); setNote(''); setLoaded(null)
    try {
      const obj = JSON.parse(await file.text())
      const check = await checkBackup(obj)
      /* 지금 DB 에 몇 건이 있는지 세어, 덮어쓰기인지 새로 넣기인지 보여 준다.
         ⚠️ 세는 것뿐이다. 아무것도 쓰지 않는다. */
      const now = {}
      for (const t of TABLES) {
        const { count } = await supabase.from(t.name).select('*', { count: 'exact', head: true })
        now[t.name] = count ?? 0
      }
      setLoaded({ obj, check, preview: previewRestore(obj, now) })
    } catch (e) { setErr(`꾸러미를 읽지 못했어요: ${errText(e)}`) }
    setBusy('')
  }

  function makeSql() {
    if (!loaded) return
    downloadBlob(`viren-work-되돌리기-${ymd()}.sql`,
      new Blob([restoreSql(loaded.obj)], { type: 'text/plain;charset=utf-8' }))
    setNote('SQL 을 내려받았어요. 열어서 읽어 본 뒤 Supabase SQL Editor 에 붙여넣으세요.')
  }

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
                  return (
                    <tr key={b}>
                      <td>{b} <span className="small muted">파일 목록만</span></td>
                      <td className="r tnum">
                        {f ? `${f.length}개 · ${mb(f.reduce((a, x) => a + (x.size || 0), 0))}` : '못 읽음'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {made.problems.length > 0 && (
            <p className="hint warn">
              <strong>못 읽은 것이 있습니다.</strong>{' '}
              {made.problems.map((p) => p.bucket || p.table).join(' · ')} — 파일 안의
              <code> problems</code> 를 보세요.
            </p>
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
                <strong>이 꾸러미에는 문제가 있습니다.</strong>
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
                    <td className="r tnum">{r.have ?? '—'}</td>
                    <td className={r.missing ? 'pl-bad' : ''}>{r.missing ? '꾸러미에 없음' : r.mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {note && <p className="ok">{note}</p>}
          <div className="actions start">
            <button className="btn" onClick={makeSql}>되돌리기 SQL 만들기</button>
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
