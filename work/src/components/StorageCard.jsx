import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ErrorBox } from './ui'

/* 관리 → 저장소. 얼마나 찼는지 보여 주고, 보관 기간을 정하고, 급하면 바로 정리한다.
   (지은님 2026-10-21: 대화에 붙인 사진은 60일 뒤 자동 삭제) */

const FREE_GB = 1                         // 무료 플랜 저장소
const LIMIT = FREE_GB * 1024 * 1024 * 1024

const mb = (b) => `${(Number(b || 0) / 1024 / 1024).toFixed(1)}MB`

export default function StorageCard() {
  const [rows, setRows] = useState(null)
  const [days, setDays] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [{ data: use }, { data: st }] = await Promise.all([
      supabase.rpc('storage_usage'),
      supabase.from('settings').select('chat_file_days').eq('id', 1).maybeSingle(),
    ])
    setRows(use || [])
    setDays(String(st?.chat_file_days ?? 60))
  }, [])

  useEffect(() => { load() }, [load])

  const total = (rows || []).reduce((a, r) => a + Number(r.bytes || 0), 0)
  const pct = Math.min(100, Math.round((total / LIMIT) * 1000) / 10)

  async function saveDays() {
    const n = Number(days)
    if (!Number.isInteger(n) || n < 1 || n > 3650) return setErr('1 에서 3650 사이의 날수를 넣어 주세요.')
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.from('settings').update({ chat_file_days: n }).eq('id', 1)
    setBusy(false)
    if (error) return setErr('저장하지 못했어요.')
    setMsg(`${n}일로 바꿨어요. 오늘 새벽부터 적용돼요.`)
  }

  async function cleanNow() {
    if (!window.confirm(`${days}일보다 오래된 대화 사진·파일을 지금 지웁니다. 되돌릴 수 없어요. 계속할까요?`)) return
    setBusy(true); setErr(''); setMsg('')
    const { data } = await supabase.auth.getSession()
    const res = await fetch('/api/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token}` },
      body: JSON.stringify({ now: true }),
    })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setErr(out.error || '정리하지 못했어요.')
    setMsg(out.deleted ? `${out.deleted}개 지웠어요 (${mb(out.bytes)} 확보).` : '지울 만큼 오래된 파일이 없어요.')
    load()
  }

  return (
    <section className="card stack-sm">
      <h2>저장소</h2>
      <p className="hint">
        무료 저장소는 <strong>1GB</strong> 입니다. 차면 파일 올리기가 멈춰요.
        대화에 붙인 사진·파일은 정한 기간이 지나면 <strong>매일 새벽 3시에 저절로</strong> 사라집니다.
        글은 남고 파일 자리에만 ‘기간이 지나 사라진 파일’ 이라고 뜹니다.
      </p>

      {rows === null ? <p className="hint">세는 중…</p> : (
        <>
          <div className="bar" aria-label={`저장소 ${pct}% 사용`}>
            <span className={pct > 80 ? 'hot' : ''} style={{ width: `${Math.max(pct, 0.6)}%` }} />
          </div>
          <p className="hint tnum">{mb(total)} / {FREE_GB}GB 사용 ({pct}%)</p>
          <table className="table compact">
            <thead><tr><th>종류</th><th className="r">개수</th><th className="r">크기</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.kind}><td>{r.kind}</td>
                  <td className="r tnum">{r.files}</td>
                  <td className="r tnum">{mb(r.bytes)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="hint">결재 첨부는 <strong>지우지 않습니다.</strong> 근거 문서라 남겨야 해요.</p>
        </>
      )}

      <div className="form-row">
        <label className="field half"><span>대화 파일 보관 기간</span>
          <span className="with-unit">
            <input className="tnum" inputMode="numeric" value={days}
              onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} />
            <i>일</i>
          </span>
        </label>
      </div>

      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}

      <div className="actions start">
        <button className="btn" disabled={busy} onClick={saveDays}>기간 저장</button>
      </div>

      {/* 파일을 **지우는** 동작이라 일반 동작과 눈으로도 갈라 둔다(가이드 제안).
          ⚠️ 확인 창은 서버 쪽 cleanup 이 하는 게 아니라 여기서 물어본다. */}
      <div className="danger-zone">
        <div>
          <strong>파일 정리</strong>
          <p className="hint">보관 기간이 지난 대화 파일을 지금 지웁니다. 되돌릴 수 없습니다.</p>
        </div>
        <button className="btn danger" disabled={busy} onClick={cleanNow}>지금 정리</button>
      </div>
    </section>
  )
}
