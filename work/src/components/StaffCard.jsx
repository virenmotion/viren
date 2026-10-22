import { useCallback, useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { dot, today } from '../lib/dates'
import { DESIGN_GRADES, EDU_LEVELS, TECH_GRADES, age, careerSummary, duration, rangeDays } from '../lib/hr'
import { ErrorBox } from './ui'

/* 인사기록카드. 노션 '직원현황관리 · 직원경력관리' 를 옮긴 것. (2026-10-22)
   ⚠️ 주민번호 칸은 **일부러 없다**(지은님 결정). 나이·경력은 생년월일로 충분하다.
   관리 → 직원에서 이름을 누르면 열린다. 관리자와 본인만 볼 수 있다(DB 정책). */

const EMPTY_CAREER = { company: '', start_date: '', end_date: '', note: '' }

export default function StaffCard({ emp, onClose }) {
  const [hr, setHr] = useState(null)
  const [careers, setCareers] = useState([])
  const [add, setAdd] = useState(EMPTY_CAREER)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [{ data: h }, { data: c }] = await Promise.all([
      supabase.from('employee_hr').select('*').eq('user_id', emp.id).maybeSingle(),
      supabase.from('employee_careers').select('*').eq('user_id', emp.id).order('start_date', { ascending: false }),
    ])
    setHr(h || { user_id: emp.id })
    setCareers(c || [])
  }, [emp.id])

  useEffect(() => { load() }, [load])

  const set = (k) => (e) => setHr({ ...hr, [k]: e.target.value })

  async function save() {
    setBusy(true); setErr(''); setMsg('')
    const { user_id, updated_at, ...rest } = hr   // eslint-disable-line no-unused-vars
    const { error } = await supabase.from('employee_hr')
      .upsert({ user_id: emp.id, ...rest, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setBusy(false)
    if (error) return setErr(errText(error))
    setMsg('저장했습니다.')
  }

  async function addCareer() {
    if (!add.company.trim() || !add.start_date) return setErr('회사 이름과 시작일을 넣어 주세요.')
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.from('employee_careers').insert({
      user_id: emp.id,
      company: add.company.trim(),
      start_date: add.start_date,
      end_date: add.end_date || null,
      note: add.note.trim(),
    })
    setBusy(false)
    if (error) return setErr(errText(error))
    setAdd(EMPTY_CAREER)
    load()
  }

  async function delCareer(id) {
    if (!window.confirm('이 경력을 지울까요?')) return
    const { error } = await supabase.from('employee_careers').delete().eq('id', id)
    if (error) return setErr(errText(error))
    load()
  }

  if (!hr) return <section className="card"><p className="hint">불러오는 중…</p></section>

  const sum = careerSummary(careers, emp.hire_date)
  const yrs = age(hr.birth_date)

  return (
    <section className="card stack-sm hr-card">
      <div className="row-between no-print">
        <h2>{emp.name} 인사기록</h2>
        <div className="actions">
          <button className="btn small-btn" onClick={() => window.print()}>인쇄</button>
          <button className="btn small-btn" onClick={onClose}>닫기</button>
        </div>
      </div>

      {/* 인쇄할 때만 보이는 제목 */}
      <h1 className="print-only">인사기록카드</h1>

      <div className="hr-sum">
        <div><span>나이</span><strong className="tnum">{yrs == null ? '—' : `만 ${yrs}세`}</strong></div>
        <div><span>바이렌 근속</span><strong>{duration(sum.here)}</strong></div>
        <div><span>전 직장 경력</span><strong>{duration(sum.past)}</strong></div>
        <div className="hot"><span>총 경력</span><strong>{duration(sum.total)}</strong></div>
      </div>
      <p className="hint no-print">
        총 경력은 <strong>겹치는 기간을 한 번만</strong> 셉니다. 그래서 ‘전 직장 + 근속’ 과 다를 수 있어요.
        {sum.on === today() && ' 오늘 기준입니다.'}
      </p>

      <div className="form-row">
        <label className="field half"><span>영문명</span>
          <input value={hr.name_en || ''} onChange={set('name_en')} placeholder="GILDONG HONG" /></label>
        <label className="field half"><span>한자명</span>
          <input value={hr.name_cn || ''} onChange={set('name_cn')} /></label>
      </div>
      <div className="form-row">
        <label className="field half"><span>생년월일</span>
          <input type="date" value={hr.birth_date || ''} onChange={set('birth_date')} /></label>
        <label className="field half"><span>전화번호</span>
          <input value={hr.phone || ''} onChange={set('phone')} placeholder="010-0000-0000" /></label>
      </div>
      <label className="field"><span>주소</span>
        <input value={hr.address || ''} onChange={set('address')} /></label>

      <div className="form-row three">
        <label className="field"><span>학력</span>
          <select value={hr.edu_level || ''} onChange={set('edu_level')}>
            <option value="">선택</option>
            {EDU_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
        <label className="field"><span>졸업학교</span>
          <input value={hr.school || ''} onChange={set('school')} /></label>
        <label className="field"><span>학과</span>
          <input value={hr.major || ''} onChange={set('major')} /></label>
      </div>

      <div className="form-row">
        <label className="field half"><span>기술자등급</span>
          <select value={hr.tech_grade || ''} onChange={set('tech_grade')}>
            <option value="">해당 없음</option>
            {TECH_GRADES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
        <label className="field half"><span>디자이너등급</span>
          <select value={hr.design_grade || ''} onChange={set('design_grade')}>
            <option value="">해당 없음</option>
            {DESIGN_GRADES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
      </div>
      <p className="hint no-print">
        등급은 <strong>직접 고릅니다.</strong> 법에서 정한 기준표(학력·경력 조합)를 주시면 총 경력으로
        후보를 자동 제시하게 만들 수 있어요.
      </p>

      <label className="field"><span>보유자격증</span>
        <textarea rows={2} value={hr.certs || ''} onChange={set('certs')} placeholder="한 줄에 하나씩" /></label>
      <label className="field"><span>메모</span>
        <textarea rows={2} value={hr.note || ''} onChange={set('note')} /></label>

      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}
      <div className="actions start no-print">
        <button className="btn primary" disabled={busy} onClick={save}>인사기록 저장</button>
      </div>

      {/* ── 경력 ───────────────────────────────────────────── */}
      <h3 className="hr-sub">경력</h3>
      <p className="hint no-print">4대보험 자격취득일 ~ 상실일로 적습니다. 끝난 날을 비우면 ‘재직 중’ 입니다.</p>

      <div className="table-wrap">
        <table className="table">
          <thead><tr>
            <th>회사</th><th>시작</th><th>종료</th><th className="r">기간</th><th>비고</th><th className="no-print" />
          </tr></thead>
          <tbody>
            {emp.hire_date && (
              <tr className="sum">
                <td>바이렌 (현재)</td><td className="tnum">{dot(emp.hire_date)}</td><td>재직 중</td>
                <td className="r">{duration(sum.here)}</td><td /><td className="no-print" />
              </tr>
            )}
            {careers.map((c) => (
              <tr key={c.id}>
                <td>{c.company}</td>
                <td className="tnum">{dot(c.start_date)}</td>
                <td className="tnum">{c.end_date ? dot(c.end_date) : '재직 중'}</td>
                <td className="r">{duration(rangeDays(c))}</td>
                <td>{c.note}</td>
                <td className="no-print">
                  <button className="icon" aria-label="지우기" onClick={() => delCareer(c.id)}>✕</button>
                </td>
              </tr>
            ))}
            {!careers.length && !emp.hire_date && (
              <tr><td colSpan={6} className="muted center">적힌 경력이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="form-row no-print">
        <label className="field"><span>회사</span>
          <input value={add.company} onChange={(e) => setAdd({ ...add, company: e.target.value })}
            placeholder="주식회사 ○○" /></label>
        <label className="field half"><span>자격취득일</span>
          <input type="date" value={add.start_date} onChange={(e) => setAdd({ ...add, start_date: e.target.value })} /></label>
        <label className="field half"><span>자격상실일</span>
          <input type="date" value={add.end_date} onChange={(e) => setAdd({ ...add, end_date: e.target.value })} /></label>
      </div>
      <div className="actions start no-print">
        <button className="btn" disabled={busy} onClick={addCareer}>경력 추가</button>
      </div>
    </section>
  )
}
