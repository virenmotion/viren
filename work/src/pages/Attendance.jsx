import { useCallback, useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { hm, hoursText, isWeekend, minutesBetween, monthDays, today, weekday } from '../lib/dates'
import { LEAVE_KINDS } from '../lib/labels'
import { downloadCsv } from '../lib/csv'
import { ErrorBox } from '../components/ui'

/* 'HH:MM' + 날짜 → 한국 시간 timestamptz 문자열 */
const toTs = (date, t) => (t ? `${date}T${t}:00+09:00` : null)

async function fetchMonth(userIds, ym) {
  const days = monthDays(ym)
  const first = days[0], last = days.at(-1)
  const [att, lv] = await Promise.all([
    supabase.from('attendance').select('*').in('user_id', userIds).gte('work_date', first).lte('work_date', last),
    supabase.from('approval_docs').select('drafter_id, data').eq('form_type', 'leave').eq('status', 'approved')
      .in('drafter_id', userIds).lte('data->>start', last).gte('data->>end', first),
  ])
  if (att.error) throw att.error
  if (lv.error) throw lv.error
  const leaveOn = (uid, d) => lv.data.find((x) => x.drafter_id === uid && x.data.start <= d && x.data.end >= d)
  return { days, rows: att.data, leaveOn }
}

export default function Attendance() {
  const { userId, isAdmin, activeEmployees, employees, nameOf } = useSession()
  const [ym, setYm] = useState(today().slice(0, 7))
  const [target, setTarget] = useState(userId)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => {
    setErr('')
    fetchMonth([target], ym).then(setData).catch((e) => setErr(errText(e)))
  }, [target, ym])
  useEffect(() => { load() }, [load])

  async function exportCsv(all) {
    try {
      const ids = all ? employees.map((e) => e.id) : [target]
      const m = await fetchMonth(ids, ym)
      const out = [['이름', '날짜', '요일', '출근', '퇴근', '근무시간(분)', '휴가', '출근 위치', '메모']]
      for (const uid of ids) {
        for (const d of m.days) {
          const r = m.rows.find((x) => x.user_id === uid && x.work_date === d)
          const lv = m.leaveOn(uid, d)
          if (!r && !lv) continue
          out.push([nameOf(uid), d, weekday(d), hm(r?.check_in), hm(r?.check_out),
            minutesBetween(r?.check_in, r?.check_out) || '', lv ? LEAVE_KINDS[lv.data.kind] : '',
            r?.in_office == null ? '' : r.in_office ? '사무실' : '외부', r?.note || ''])
        }
      }
      downloadCsv(`viren-attendance-${ym}-${all ? 'all' : (employees.find((e) => e.id === target)?.email || '').split('@')[0]}.csv`, out)
    } catch (e) { setErr(errText(e)) }
  }

  async function saveEdit() {
    const { date, in_t, out_t, note } = editing
    if (in_t && out_t && out_t < in_t) return setErr('퇴근 시각이 출근 시각보다 빠릅니다.')
    const { error } = await supabase.from('attendance').upsert({
      user_id: target, work_date: date, check_in: toTs(date, in_t), check_out: toTs(date, out_t), note: note.trim() || null,
    })
    if (error) return setErr(errText(error))
    setEditing(null); load()
  }

  const rowOf = (d) => data?.rows.find((r) => r.work_date === d)
  const workedDays = data?.rows.filter((r) => r.check_in).length || 0
  const totalMin = data?.rows.reduce((a, r) => a + minutesBetween(r.check_in, r.check_out), 0) || 0
  const leaveDays = data ? data.days.filter((d) => !isWeekend(d) && data.leaveOn(target, d)).length : 0

  return (
    <div className="stack">
      <h1>근태</h1>
      <div className="toolbar">
        <label className="field inline"><span>월</span>
          <input id="att-month" type="month" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} /></label>
        {isAdmin && (
          <label className="field inline"><span>직원</span>
            <select id="att-target" value={target} onChange={(e) => { setTarget(e.target.value); setEditing(null) }}>
              {activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select></label>
        )}
        <div className="grow" />
        <button className="btn small-btn" onClick={() => exportCsv(false)}>엑셀(CSV) 받기</button>
        {isAdmin && <button className="btn small-btn" onClick={() => exportCsv(true)}>전 직원 CSV</button>}
      </div>

      <div className="stats">
        <div><span className="label">출근일</span><strong className="tnum">{workedDays}일</strong></div>
        <div><span className="label">근무시간 합계</span><strong className="tnum">{hoursText(totalMin) || '0시간'}</strong></div>
        <div><span className="label">휴가(평일)</span><strong className="tnum">{leaveDays}일</strong></div>
      </div>

      <ErrorBox>{err}</ErrorBox>

      {data && (
        <div className="table-wrap card flush">
          <table className="table att">
            <thead><tr><th>날짜</th><th>출근</th><th>퇴근</th><th>근무시간</th><th>비고</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>
              {data.days.map((d) => {
                const r = rowOf(d)
                const lv = data.leaveOn(target, d)
                const off = isWeekend(d)
                if (editing?.date === d) {
                  return (
                    <tr key={d} className="editing">
                      <td className="tnum">{d.slice(5).replace('-', '.')} ({weekday(d)})</td>
                      <td><input id="edit-in" type="time" value={editing.in_t} onChange={(e) => setEditing({ ...editing, in_t: e.target.value })} /></td>
                      <td><input id="edit-out" type="time" value={editing.out_t} onChange={(e) => setEditing({ ...editing, out_t: e.target.value })} /></td>
                      <td colSpan={2}><input id="edit-note" placeholder="수정 사유" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></td>
                      <td className="nowrap"><button className="btn small-btn primary" onClick={saveEdit}>저장</button> <button className="btn small-btn" onClick={() => setEditing(null)}>취소</button></td>
                    </tr>
                  )
                }
                return (
                  <tr key={d} className={`${off ? 'weekend' : ''} ${d === today() ? 'today' : ''}`}>
                    <td className="tnum">{d.slice(5).replace('-', '.')} ({weekday(d)})</td>
                    <td className="tnum">{hm(r?.check_in)}</td>
                    <td className="tnum">{hm(r?.check_out)}</td>
                    <td className="tnum">{hoursText(minutesBetween(r?.check_in, r?.check_out))}</td>
                    <td className="small">
                      {lv && <span className="tag leave">{LEAVE_KINDS[lv.data.kind]}</span>}
                      {r?.in_office === false && <span className="tag">외부</span>}
                      {r?.note && <span className="muted"> {r.note}</span>}
                    </td>
                    {isAdmin && (
                      <td><button className="linkbtn small" onClick={() => setEditing({ date: d, in_t: hm(r?.check_in), out_t: hm(r?.check_out), note: r?.note || '' })}>수정</button></td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
