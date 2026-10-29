import { useCallback, useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { WEEK, addDays, hm, hoursText, isWeekend, minutesBetween, monthDays, parse, today, weekday } from '../lib/dates'
import { holidayName } from '../lib/holidays'
import { leaveName, leaveShort } from '../lib/labels'
import { downloadCsv } from '../lib/csv'
import { ErrorBox } from '../components/ui'
import WorkBar from '../components/WorkBar'
import { useNow } from '../lib/useNow'
import { FULL_MIN, dayMinutes, isWorkingDay, workStat, workTone } from '../lib/worktime'

/* 'HH:MM' + 날짜 → 한국 시간 timestamptz 문자열 */
const toTs = (date, t) => (t ? `${date}T${t}:00+09:00` : null)

/* 이 줄의 퇴근이 **다음날**에 찍힌 것인가 (밤을 새운 날).
   ⚠️ 시각만 보면 알 수 없다 — 저장된 날짜끼리 견준다. */
const outIsNext = (row) => {
  if (!row?.check_out) return false
  const d = new Date(row.check_out).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  return d > row.work_date
}

/* 고칠 거리 한 벌. next = 퇴근이 다음날인가, nextSet = 사람이 직접 건드렸는가
   (건드렸으면 더는 자동으로 바꾸지 않는다). */
const editOf = (d, r) => ({
  date: d, in_t: hm(r?.check_in), out_t: hm(r?.check_out),
  note: r?.note || '', next: outIsNext(r), nextSet: false,
})

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
  /* 고른 날짜(dates)가 있으면 그 날만. 옛 문서는 예전처럼 기간으로 본다. */
  const leaveOn = (uid, d) => lv.data.find((x) => {
    if (x.drafter_id !== uid) return false
    if (Array.isArray(x.data?.dates)) return x.data.dates.includes(d)
    return x.data.start <= d && x.data.end >= d
  })
  return { days, rows: att.data, leaveOn }
}

export default function Attendance() {
  const { userId, isAdmin, activeEmployees, employees, nameOf } = useSession()
  const [ym, setYm] = useState(today().slice(0, 7))
  const [target, setTarget] = useState(userId)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(null)
  /* 달력이 기본. 표는 고치거나 자세히 볼 때(지은님 2026-10-21). */
  const [view, setView] = useState('cal')
  /* 출퇴근 시각·달성률은 날짜 칸에 늘어놓지 않고 이 칸에서 본다(가이드).
     ⚠️ 날짜를 **누르는 것**은 예전처럼 '고치기' 다. 상세는 따로 작은 버튼이다. */
  const [detail, setDetail] = useState(null)
  const now = useNow()

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
            minutesBetween(r?.check_in, r?.check_out) || '', lv ? leaveName(lv.data.kind, lv.data.half) : '',
            r?.in_office == null ? '' : r.in_office ? '사무실' : '외부', r?.note || ''])
        }
      }
      downloadCsv(`viren-attendance-${ym}-${all ? 'all' : (employees.find((e) => e.id === target)?.email || '').split('@')[0]}.csv`, out)
    } catch (e) { setErr(errText(e)) }
  }

  async function saveEdit() {
    const { date, in_t, out_t, note, next } = editing
    /* ⚠️ 밤을 새운 날은 퇴근이 **다음날 날짜**에 찍힌다. '다음날 퇴근' 을 켜지 않은 채
       퇴근이 더 이르면 그건 잘못 적은 것이다(지은님 2026-10-29). */
    if (in_t && out_t && !next && out_t < in_t) {
      return setErr('퇴근이 출근보다 이릅니다. 밤을 새웠다면 “다음날 퇴근” 을 켜 주세요.')
    }
    const { error } = await supabase.from('attendance').upsert({
      user_id: target, work_date: date,
      check_in: toTs(date, in_t),
      check_out: toTs(next ? addDays(date, 1) : date, out_t),
      note: note.trim() || null,
    })
    if (error) return setErr(errText(error))
    setEditing(null); load()
  }

  /* 시각을 고치면 '다음날' 을 알아서 맞춘다.
     ⚠️ 사람이 체크칸을 직접 건드린 뒤에는 **손대지 않는다**(nextSet). */
  const setTime = (key, v) => setEditing((e) => {
    const n = { ...e, [key]: v }
    if (!e.nextSet) n.next = !!n.in_t && !!n.out_t && n.out_t < n.in_t
    return n
  })
  /* 지금 적은 대로면 몇 시간이 되는지 — 저장 전에 눈으로 확인하라고 보여 준다 */
  const editMin = editing?.in_t && editing?.out_t
    ? minutesBetween(toTs(editing.date, editing.in_t),
      toTs(editing.next ? addDays(editing.date, 1) : editing.date, editing.out_t))
    : null

  const rowOf = (d) => data?.rows.find((r) => r.work_date === d)
  const minOf = (d) => dayMinutes(rowOf(d), d, now)
  const workedDays = data?.rows.filter((r) => r.check_in).length || 0
  const totalMin = data?.rows.reduce((a, r) => a + dayMinutes(r, r.work_date, now), 0) || 0
  const leaveDays = data ? data.days.filter((d) => !isWeekend(d) && data.leaveOn(target, d)).length : 0

  /* 오늘 칸은 **이번 달을 보고 있을 때만** 띄운다. 월간 합계와 섞지 않는다(가이드). */
  const d0 = today()
  const showToday = ym === d0.slice(0, 7)
  const todayRow = rowOf(d0)
  const todayMin = showToday ? dayMinutes(todayRow, d0, now) : 0
  const todayWorking = showToday && isWorkingDay(todayRow, d0, now)
  const w = workStat(todayMin)

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>근태</h1>
          <p className="eyebrow">하루 9시간 기준 · 점심 1시간 포함</p>
        </div>
      </header>
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
        <div className="seg" role="tablist" aria-label="보기 방식">
          <button type="button" role="tab" aria-selected={view === 'cal'} className={view === 'cal' ? 'on' : ''} onClick={() => setView('cal')}>달력</button>
          <button type="button" role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>표</button>
        </div>
        <button className="btn small-btn" onClick={() => exportCsv(false)}>엑셀(CSV) 받기</button>
        {isAdmin && <button className="btn small-btn" onClick={() => exportCsv(true)}>전 직원 CSV</button>}
      </div>

      {showToday && (
        <section className="card today-work">
          <div className="tw-main">
            <h2>오늘의 근무</h2>
            <p className="tw-num">
              <strong className="tnum">{hoursText(todayMin) || '0분'}</strong>
              <span className="muted"> / 9시간</span>
              {todayMin > 0 && <span className="tw-pct tnum">{w.pct}%</span>}
            </p>
            <WorkBar minutes={todayMin} height={8} working={todayWorking} />
            <p className="tw-left">
              {!todayRow?.check_in ? '아직 출근 기록이 없어요.'
                : w.over > 0 ? <><strong>{hoursText(w.over)} 초과</strong></>
                  : <>{hoursText(w.left)} 남음</>}
              {' · '}<span className="tnum">{d0.slice(5).replace('-', '.')} ({weekday(d0)}) 기준</span>
            </p>
          </div>
          <div className="tw-side">
            <span className={`punch-state st-${todayWorking ? 'working' : todayRow?.check_out ? 'done' : 'before'}`}>
              {todayWorking ? '근무 중' : todayRow?.check_out ? '퇴근 완료' : '출근 전'}
            </span>
            {/* 색만으로 뜻을 전하지 않는다 — 이름표를 같이 둔다 */}
            <ul className="tw-legend">
              <li><i className="t-done" />충족</li>
              <li><i className="t-over" />초과</li>
              <li><i className="t-short" />미달</li>
              <li><i className="t-now" />근무 중</li>
            </ul>
          </div>
        </section>
      )}

      <div className="stats">
        <div><span className="label">출근일</span><strong className="tnum">{workedDays}일</strong></div>
        <div><span className="label">근무시간 합계</span><strong className="tnum">{hoursText(totalMin) || '0시간'}</strong></div>
        <div><span className="label">휴가(평일)</span><strong className="tnum">{leaveDays}일</strong></div>
      </div>
      <p className="hint">위 세 칸은 <strong>고른 달 전체</strong> 값입니다. ‘오늘의 근무’ 와 섞어 보지 마세요.</p>

      <ErrorBox>{err}</ErrorBox>

      {data && view === 'cal' && (
        <AttCalendar
          ym={ym} data={data} target={target} isAdmin={isAdmin} now={now}
          detail={detail} onDetail={setDetail}
          onPick={(d, r) => setEditing(editOf(d, r))}
        />
      )}

      {detail && view === 'cal' && (
        <DayDetail
          date={detail} row={rowOf(detail)} min={minOf(detail)}
          leave={data?.leaveOn(target, detail)} working={isWorkingDay(rowOf(detail), detail, now)}
          onClose={() => setDetail(null)}
        />
      )}

      {editing && view === 'cal' && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="card stack-sm modal-card">
            <h2 className="tnum">{editing.date.replaceAll('-', '.')} ({weekday(editing.date)})</h2>
            <div className="form-row">
              <label className="field"><span>출근</span>
                <input type="time" value={editing.in_t} onChange={(e) => setTime('in_t', e.target.value)} /></label>
              <label className="field"><span>퇴근</span>
                <input type="time" value={editing.out_t} onChange={(e) => setTime('out_t', e.target.value)} /></label>
            </div>
            {/* 밤을 새운 날. 퇴근이 출근보다 이르면 알아서 켜지고, 직접 끄고 켤 수도 있다. */}
            <label className="nextday">
              <input type="checkbox" checked={!!editing.next}
                onChange={(e) => setEditing({ ...editing, next: e.target.checked, nextSet: true })} />
              <span>다음날 퇴근 {editing.next && <strong className="tnum">{addDays(editing.date, 1).slice(5).replace('-', '.')} {editing.out_t || ''}</strong>}</span>
            </label>
            {editMin !== null && (
              <p className={`edit-sum${editMin <= 0 ? ' bad' : ''}`}>
                이대로 저장하면 <strong>{editMin > 0 ? hoursText(editMin) : '0분'}</strong> 근무가 됩니다.
              </p>
            )}
            <label className="field"><span>수정 사유</span>
              <input value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="왜 고쳤는지 적어 두면 좋습니다" /></label>
            <div className="actions">
              <button className="btn" onClick={() => setEditing(null)}>취소</button>
              <button className="btn primary" onClick={saveEdit}>저장</button>
            </div>
          </div>
        </div>
      )}

      {data && view === 'table' && (
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
                      <td><input id="edit-in" type="time" value={editing.in_t} onChange={(e) => setTime('in_t', e.target.value)} /></td>
                      <td>
                        <input id="edit-out" type="time" value={editing.out_t} onChange={(e) => setTime('out_t', e.target.value)} />
                        <label className="nextday small">
                          <input type="checkbox" checked={!!editing.next}
                            onChange={(e) => setEditing({ ...editing, next: e.target.checked, nextSet: true })} />
                          <span>다음날</span>
                        </label>
                      </td>
                      <td colSpan={2}><input id="edit-note" placeholder="수정 사유" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></td>
                      <td className="nowrap"><button className="btn small-btn primary" onClick={saveEdit}>저장</button> <button className="btn small-btn" onClick={() => setEditing(null)}>취소</button></td>
                    </tr>
                  )
                }
                return (
                  <tr key={d} className={`${off ? 'weekend' : ''} ${d === today() ? 'today' : ''}`}>
                    <td className="tnum">{d.slice(5).replace('-', '.')} ({weekday(d)})</td>
                    <td className="tnum">{hm(r?.check_in)}</td>
                    <td className="tnum">{hm(r?.check_out)}{outIsNext(r) && <span className="plus1">+1일</span>}</td>
                    <td className="tnum">
                      {hoursText(minOf(d))}
                      {isWorkingDay(r, d, now) && <span className="muted small"> 근무 중</span>}
                    </td>
                    <td className="small">
                      {lv && <span className="tag leave">{leaveShort(lv.data.kind, lv.data.half)}</span>}
                      {r?.in_office === false && <span className="tag">외부</span>}
                      {r?.note && <span className="muted"> {r.note}</span>}
                    </td>
                    {isAdmin && (
                      <td><button className="linkbtn small" onClick={() => setEditing(editOf(d, r))}>수정</button></td>
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

/* 근태 달력 — 하루마다 **가는 가로 막대** 하나로 근무량을 보여 준다. (A안, 2026-10-22)

   ⚠️ 날짜 칸에 출퇴근 시각·퍼센트·범례를 늘어놓지 않는다. 한 달이 다 보여야 하는 화면이라
      칸마다 네 줄씩 들어가면 읽을 수 없다. 자세한 건 '상세' 버튼으로 아래 칸에서 본다.
   ⚠️ **기록이 없는 날에는 막대를 그리지 않는다.** 빈 막대를 줄줄이 늘어놓으면
      미기록이 '0시간 미달' 처럼 보인다. 미래도 마찬가지다.
   ⚠️ 날짜를 누르는 것은 예전처럼 **고치기**(관리자)다. 상세 버튼은 그 동작으로
      번지지 않도록 stopPropagation 한다. */
function AttCalendar({ ym, data, target, isAdmin, now, detail, onDetail, onPick }) {
  const first = `${ym}-01`
  const last = monthDays(ym).at(-1)
  const start = addDays(first, -parse(first).getUTCDay())
  const end = addDays(last, 6 - parse(last).getUTCDay())

  const cells = []
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d)

  return (
    <div className="card att-cal">
      <div className="cal-week">
        {WEEK.map((w, i) => <div key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</div>)}
      </div>
      <div className="att-grid">
        {cells.map((d) => {
          const out = d.slice(0, 7) !== ym
          const r = data.rows.find((x) => x.work_date === d)
          const lv = data.leaveOn(target, d)
          const min = dayMinutes(r, d, now)
          const working = isWorkingDay(r, d, now)
          const s = workStat(min)
          const dow = parse(d).getUTCDay()
          const hol = holidayName(d)
          const canEdit = isAdmin && !out
          return (
            <div
              key={d}
              className={`att-day${out ? ' out' : ''}${d === today() ? ' now' : ''}${isWeekend(d) || hol ? ' off' : ''}${detail === d ? ' picked' : ''}${canEdit ? ' can-edit' : ''}`}
            >
              {/* 칸 전체를 덮는 투명 버튼. 누르면 예전처럼 고치기 창이 뜬다. */}
              {canEdit && (
                <button
                  type="button" className="att-hit" title="눌러서 고치기"
                  aria-label={`${Number(d.slice(8))}일 출퇴근 시각 고치기`}
                  onClick={() => onPick(d, r)}
                />
              )}
              <span className="att-top">
                <span className={`cal-num tnum${hol || dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}`}>{Number(d.slice(8))}</span>
                {d === today() && <span className="att-today">오늘</span>}
                {hol && <span className="cal-hol">{hol}</span>}
                {!out && min > 0 && (
                  /* 덮개 버튼의 **형제**다. 겹쳐 있을 뿐 안에 들어 있지 않다. */
                  <button
                    type="button" className="att-more"
                    aria-label={`${Number(d.slice(8))}일 상세`}
                    aria-expanded={detail === d}
                    onClick={() => onDetail(detail === d ? null : d)}
                  ><span className="am-t">상세 </span>›</button>
                )}
              </span>
              {!out && (
                <>
                  {/* 기록이 있는 날만 숫자와 막대를 둔다 */}
                  {min > 0 ? (
                    <span className="att-body">
                      <b className="att-min">{hoursText(min)}</b>
                      <WorkBar minutes={min} height={5} working={working} />
                      <span className={`att-diff t-${workTone(min, working)}`}>
                        {working ? '근무 중'
                          : s.over > 0 ? `+${hoursText(s.over)}`
                            : s.left > 0 ? `-${hoursText(s.left)}` : '100%'}
                      </span>
                    </span>
                  ) : <span className="att-body" />}
                  <span className="att-tags">
                    {lv && <span className="tag leave">{leaveShort(lv.data.kind, lv.data.half)}</span>}
                    {r?.in_office === false && <span className="tag">외부</span>}
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>
      <p className="hint att-legend">
        막대가 가득 차면 <strong>9시간</strong>입니다(점심 1시간 포함).
        <strong>상세</strong>를 누르면 출퇴근 시각과 달성률을 봅니다.
        {isAdmin && ' 날짜를 누르면 출퇴근 시각을 고칠 수 있습니다.'}
      </p>
    </div>
  )
}

/* 고른 날 상세 — 출퇴근 시각·달성률은 여기서만 보여 준다.
   ⚠️ 기록이 없는 날은 '0시간' 이 아니라 **미기록**이다. 결근으로 단정하지 않는다. */
function DayDetail({ date, row, min, leave, working, onClose }) {
  const s = workStat(min)
  return (
    <section className="card day-detail">
      <div className="row-between">
        <h2 className="tnum">{date.replaceAll('-', '.')} ({weekday(date)})</h2>
        <button className="btn small-btn" onClick={onClose}>닫기</button>
      </div>
      {!row?.check_in ? (
        <p className="muted">출근 기록이 없는 날입니다. {leave && `(${leaveName(leave.data.kind, leave.data.half)})`}</p>
      ) : (
        <>
          <dl className="dd-grid">
            <div><dt>출근</dt><dd className="tnum">{hm(row.check_in) || '—'}</dd></div>
            <div><dt>퇴근</dt><dd className="tnum">{row.check_out ? <>{hm(row.check_out)}{outIsNext(row) && <span className="plus1">+1일</span>}</> : (working ? '근무 중' : '기록 없음')}</dd></div>
            <div><dt>근무시간</dt><dd className="tnum">{hoursText(min) || '—'}</dd></div>
            <div><dt>달성률</dt><dd className="tnum">{s.pct}%</dd></div>
            <div>
              <dt>{s.over > 0 ? '초과' : '남은 시간'}</dt>
              <dd className="tnum">{s.over > 0 ? hoursText(s.over) : hoursText(s.left) || '없음'}</dd>
            </div>
            <div><dt>기준</dt><dd className="tnum">9시간 ({FULL_MIN}분)</dd></div>
          </dl>
          <p className="hint">
            {leave && <>휴가: {leaveName(leave.data.kind, leave.data.half)} · </>}
            {row.in_office === false && <>사무실 밖에서 출근을 찍었습니다 · </>}
            점심 1시간이 9시간 안에 들어 있습니다.
          </p>
          {row.note && <p className="small">메모: {row.note}</p>}
        </>
      )}
    </section>
  )
}
