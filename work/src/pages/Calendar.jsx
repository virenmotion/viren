import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, errText } from '../lib/supabase'
import { useSession } from '../lib/session'
import { holidayName } from '../lib/holidays'
import { LEAVE_SHORT } from '../lib/labels'
import { WEEK, addDays, addMonths, dot, parse, today } from '../lib/dates'

/* 회사 공용 달력.
   · 일정은 재직자 누구나 올린다. 고치고 지우는 건 올린 사람과 관리자만(DB 정책이 막는다).
   · 분류(이름 + 색)는 관리자가 관리 → 일정 분류에서 만든다. 일정은 그 분류를 고른다.
   · 승인된 휴가는 leave_days() 로 따로 받아 '[연차] 박지은팀장' 처럼 같이 띄운다. */

const ym = (d) => d.slice(0, 7)
const firstOf = (m) => `${m}-01`
const lastOf = (m) => {
  const [y, mm] = m.split('-').map(Number)
  return `${m}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, '0')}`
}
/* 달력 격자는 그 달 1일이 든 주의 일요일부터 말일이 든 주의 토요일까지 */
const gridStart = (m) => addDays(firstOf(m), -parse(firstOf(m)).getUTCDay())
const gridEnd = (m) => addDays(lastOf(m), 6 - parse(lastOf(m)).getUTCDay())

const LEAVE_COLOR = '#24507d'
const NO_CAT_COLOR = '#fbc825'
const EMPTY = { title: '', start_date: '', end_date: '', all_day: true, start_time: '', end_time: '', place: '', memo: '', category_id: '' }

/* 색 막대·칩에 쓸 모양. 글자는 어두운 색 그대로 두고 배경만 옅게 깐다. */
const chipStyle = (color) => ({ borderLeftColor: color, background: `${color}22` })

export default function Calendar() {
  const { userId, isAdmin, nameOf } = useSession()
  const [month, setMonth] = useState(ym(today()))
  const [picked, setPicked] = useState(today())
  const [events, setEvents] = useState([])
  const [leaves, setLeaves] = useState([])
  const [cats, setCats] = useState([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null) // null | {…일정} (id 가 있으면 고치기)

  const from = gridStart(month)
  const to = gridEnd(month)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const [ev, lv, ct] = await Promise.all([
      supabase.from('events').select('*').lte('start_date', to).gte('end_date', from)
        .order('start_date').order('start_time', { nullsFirst: true }),
      supabase.rpc('leave_days', { p_from: from, p_to: to }),
      supabase.from('event_categories').select('*').order('sort').order('name'),
    ])
    /* DB 설정이 덜 됐을 때. **달력 자체는 죽지 않게** 한다 —
       일정 표(events)가 없을 때만 화면을 멈추고, 분류·휴가처럼 곁가지가 없으면
       그 부분만 비운다.
       ⚠️ 2026-10-20: 분류 표 하나가 없다고 **달력 전체가 안 뜨는 일이 실제로 있었다.**
          곁가지 때문에 본체가 멈추지 않게 할 것. */
    const notReady = (e) => e && /schema cache|does not exist|Could not find the (table|function)/i.test(`${e.message || ''} ${e.details || ''}`)
    if (notReady(ev.error)) {
      setErr('캘린더를 쓰려면 데이터베이스 설정을 한 번 해야 합니다. 관리자에게 알려 주세요. (work/supabase/migrations 의 SQL)')
      setEvents([]); setLeaves([]); setCats([]); setLoading(false)
      return
    }
    if (notReady(lv.error) || notReady(ct.error)) {
      setErr('설정이 덜 됐습니다. 일정은 쓸 수 있지만 분류 색과 휴가 표시가 나오지 않습니다. 관리자에게 알려 주세요.')
    }
    if (ev.error) setErr(errText(ev.error)); else setEvents(ev.data)
    setLeaves(lv.error ? [] : (lv.data || []))
    setCats(ct.error ? [] : (ct.data || []))
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const catOf = useCallback((id) => cats.find((c) => c.id === id), [cats])

  /* 날짜별로 미리 묶어 둔다. 칸마다 전체를 훑지 않도록. */
  const byDay = useMemo(() => {
    const map = {}
    const put = (d, item) => { (map[d] ||= []).push(item) }
    for (const e of events) {
      const c = cats.find((x) => x.id === e.category_id)
      for (let d = e.start_date < from ? from : e.start_date; d <= e.end_date && d <= to; d = addDays(d, 1)) {
        put(d, { kind: 'event', label: e.title, color: c?.color || NO_CAT_COLOR, cat: c, row: e })
      }
    }
    for (const l of leaves) {
      const tag = LEAVE_SHORT[l.kind] || '휴가'
      const who = `${l.name}${l.job_title || ''}`
      const mark = (d) => put(d, { kind: 'leave', label: `[${tag}] ${who}`, color: LEAVE_COLOR })
      if (Array.isArray(l.dates)) {
        /* 고른 날짜만 칠한다. 띄엄띄엄 쓴 연차가 사이 날까지 물들지 않게. */
        for (const d of l.dates) if (d >= from && d <= to) mark(d)
        continue
      }
      /* 옛 문서(dates 없음)는 예전처럼 기간으로. 주말은 뺀다. */
      for (let d = l.start_date < from ? from : l.start_date; d <= l.end_date && d <= to; d = addDays(d, 1)) {
        if ([0, 6].includes(parse(d).getUTCDay())) continue
        mark(d)
      }
    }
    return map
  }, [events, leaves, cats, from, to])

  const days = useMemo(() => {
    const out = []
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
    return out
  }, [from, to])

  const openNew = () => setForm({ ...EMPTY, start_date: picked, end_date: picked })

  async function remove(ev) {
    if (!window.confirm(`${ev.title} 일정을 지울까요? 되돌릴 수 없습니다.`)) return
    const { error } = await supabase.from('events').delete().eq('id', ev.id)
    if (error) return setErr(errText(error))
    load()
  }

  const canEdit = (ev) => ev.created_by === userId || isAdmin
  const pickedItems = byDay[picked] || []
  const pickedHol = holidayName(picked)

  return (
    <div className="stack">
      <div className="row-between cal-head">
        <div className="cal-nav">
          <button className="icon" aria-label="지난달" onClick={() => setMonth(ym(addMonths(firstOf(month), -1)))}>‹</button>
          <strong className="cal-month tnum">{month.replace('-', '년 ')}월</strong>
          <button className="icon" aria-label="다음달" onClick={() => setMonth(ym(addMonths(firstOf(month), 1)))}>›</button>
          <button className="btn small-btn" onClick={() => { setMonth(ym(today())); setPicked(today()) }}>오늘</button>
        </div>
        <button className="btn primary" onClick={openNew}>+ 일정</button>
      </div>

      {err && <p className="error">{err}</p>}

      <div className={`cal card${loading ? ' cal-loading' : ''}`}>
        <div className="cal-week">
          {WEEK.map((w, i) => <div key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</div>)}
        </div>
        <div className="cal-grid">
          {days.map((d) => {
            const dow = parse(d).getUTCDay()
            const hol = holidayName(d)
            const items = byDay[d] || []
            const out = ym(d) !== month
            return (
              <button
                type="button" key={d}
                className={`cal-day${out ? ' out' : ''}${d === picked ? ' on' : ''}${d === today() ? ' now' : ''}`}
                onClick={() => setPicked(d)}
                aria-pressed={d === picked}
                aria-label={`${dot(d)} 일정 ${items.length}건`}
              >
                <span className={`cal-num tnum${hol || dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}`}>{Number(d.slice(8))}</span>
                {hol && <span className="cal-hol">{hol}</span>}
                <span className="cal-chips">
                  {items.slice(0, 3).map((it, i) => (
                    <span key={i} className="cal-chip" style={chipStyle(it.color)}>{it.label}</span>
                  ))}
                  {items.length > 3 && <span className="cal-more">+{items.length - 3}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {(cats.length > 0 || leaves.length > 0) && (
        <div className="cal-legend">
          {cats.map((c) => (
            <span key={c.id} className="cal-leg"><i style={{ background: c.color }} />{c.name}</span>
          ))}
          {leaves.length > 0 && <span className="cal-leg"><i style={{ background: LEAVE_COLOR }} />휴가</span>}
        </div>
      )}

      <section className="card stack-sm">
        <div className="row-between">
          <h2 className="cal-picked">
            {dot(picked)} ({WEEK[parse(picked).getUTCDay()]})
            {pickedHol && <span className="cal-hol-tag">{pickedHol}</span>}
          </h2>
          <button className="btn small-btn" onClick={openNew}>+ 이 날 일정</button>
        </div>
        {!pickedItems.length && <p className="muted">일정이 없습니다.</p>}
        <ul className="cal-list">
          {pickedItems.map((it, i) => it.kind === 'leave' ? (
            <li key={i} className="cal-item"><span className="cal-dot" style={{ background: it.color }} />{it.label}</li>
          ) : (
            <li key={i} className="cal-item">
              <span className="cal-dot" style={{ background: it.color }} />
              <div className="cal-item-body">
                <strong>{it.row.title}</strong>
                <span className="small muted">
                  {it.cat && `${it.cat.name} · `}
                  {it.row.all_day ? '종일' : `${it.row.start_time?.slice(0, 5)}${it.row.end_time ? ` ~ ${it.row.end_time.slice(0, 5)}` : ''}`}
                  {it.row.start_date !== it.row.end_date && ` · ${dot(it.row.start_date)} ~ ${dot(it.row.end_date)}`}
                  {it.row.place && ` · ${it.row.place}`}
                  {` · ${nameOf(it.row.created_by)}`}
                </span>
                {it.row.memo && <span className="small">{it.row.memo}</span>}
              </div>
              {canEdit(it.row) && (
                <span className="cal-item-act">
                  <button className="linkbtn" onClick={() => setForm({ ...it.row, start_time: it.row.start_time || '', end_time: it.row.end_time || '', category_id: it.row.category_id || '' })}>고치기</button>
                  <button className="linkbtn danger" onClick={() => remove(it.row)}>지우기</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {form && <EventForm form={form} setForm={setForm} cats={cats} userId={userId} onDone={() => { setForm(null); load() }} />}
    </div>
  )
}

function EventForm({ form, setForm, cats, userId, onDone }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (p) => setForm({ ...form, ...p })

  async function save(e) {
    e.preventDefault()
    setErr('')
    if (!form.title.trim()) return setErr('제목을 넣어 주세요.')
    if (form.end_date < form.start_date) return setErr('종료일이 시작일보다 빠릅니다.')
    if (!form.all_day && !form.start_time) return setErr('시작 시각을 넣어 주세요.')

    const row = {
      title: form.title.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      all_day: form.all_day,
      start_time: form.all_day ? null : form.start_time,
      end_time: form.all_day || !form.end_time ? null : form.end_time,
      place: form.place.trim(),
      memo: form.memo.trim(),
      category_id: form.category_id || null,
    }
    setBusy(true)
    const { error } = form.id
      ? await supabase.from('events').update({ ...row, updated_at: new Date().toISOString() }).eq('id', form.id)
      : await supabase.from('events').insert({ ...row, created_by: userId })
    setBusy(false)
    if (error) return setErr(errText(error))
    onDone()
  }

  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
      <form className="card stack-sm modal-card" onSubmit={save}>
        <h2>{form.id ? '일정 고치기' : '새 일정'}</h2>
        <label className="field"><span>제목</span>
          <input id="ev-title" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="예: 충주댐 현장 답사" autoFocus /></label>
        <label className="field"><span>분류</span>
          <select id="ev-cat" value={form.category_id} onChange={(e) => set({ category_id: e.target.value })}>
            <option value="">분류 없음</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!cats.length && <span className="hint">분류는 관리 → 일정 분류에서 만듭니다.</span>}
        </label>
        <div className="form-row">
          <label className="field"><span>시작일</span>
            <input id="ev-start" type="date" required value={form.start_date}
              onChange={(e) => set({ start_date: e.target.value, end_date: e.target.value > form.end_date ? e.target.value : form.end_date })} /></label>
          <label className="field"><span>종료일</span>
            <input id="ev-end" type="date" required min={form.start_date} value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} /></label>
        </div>
        <label className="check">
          <input id="ev-allday" type="checkbox" checked={form.all_day} onChange={(e) => set({ all_day: e.target.checked })} />
          종일
        </label>
        {!form.all_day && (
          <div className="form-row">
            <label className="field"><span>시작 시각</span>
              <input id="ev-st" type="time" value={form.start_time} onChange={(e) => set({ start_time: e.target.value })} /></label>
            <label className="field"><span>종료 시각</span>
              <input id="ev-et" type="time" value={form.end_time} onChange={(e) => set({ end_time: e.target.value })} /></label>
          </div>
        )}
        <label className="field"><span>장소</span>
          <input id="ev-place" value={form.place} onChange={(e) => set({ place: e.target.value })} placeholder="비워도 됩니다" /></label>
        <label className="field"><span>메모</span>
          <textarea id="ev-memo" rows={3} value={form.memo} onChange={(e) => set({ memo: e.target.value })} /></label>
        {err && <p className="error">{err}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={() => setForm(null)}>취소</button>
          <button className="btn primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </div>
  )
}
