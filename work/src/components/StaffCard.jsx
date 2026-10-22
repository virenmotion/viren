import { useCallback, useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { dot, today } from '../lib/dates'
import { age, careerSummary, duration, rangeDays } from '../lib/hr'
import {
  DESIGN_TRACK, EDUS, MAJOR_TYPES, SKILL_TRACK, TECH_TRACK,
  bestQual, majorStatus, suggestDesignGrade, suggestGrades, tierOf, yearsOf,
} from '../lib/grade'
import { DateInput, ErrorBox } from './ui'

/* 인사기록카드. 노션 '직원현황관리 · 직원경력관리' 를 옮긴 것. (2026-10-22)
   ⚠️ 주민번호 칸은 **일부러 없다**(지은님 결정). 나이·경력은 생년월일로 충분하다.
   관리 → 직원에서 이름을 누르면 열린다. 관리자와 본인만 볼 수 있다(DB 정책). */

const EMPTY_CAREER = { company: '', start_date: '', end_date: '', note: '' }
const EMPTY_CERT = { cert_no: '', name: '', kind: '국가기술자격', got_date: '' }
/* 날짜 칸을 비우면 '' 가 들어간다. date 칸은 '' 를 받지 않으므로 저장 전에 null 로 바꾼다. */
const DATE_COLS = ['birth_date', 'qual_date', 'edu_date', 'viren_start']

export default function StaffCard({ emp, onClose, onSaved }) {
  const [hr, setHr] = useState(null)
  const [careers, setCareers] = useState([])
  const [certs, setCerts] = useState([])
  const [addCert, setAddCert] = useState(EMPTY_CERT)
  const [add, setAdd] = useState(EMPTY_CAREER)
  /* 경력 줄을 고치는 중인 값. { 줄id: {company,start_date,end_date,note} } */
  const [rowEdit, setRowEdit] = useState({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [{ data: h }, { data: c }, { data: q }] = await Promise.all([
      supabase.from('employee_hr').select('*').eq('user_id', emp.id).maybeSingle(),
      supabase.from('employee_careers').select('*').eq('user_id', emp.id).order('start_date', { ascending: false }),
      supabase.from('employee_certs').select('*').eq('user_id', emp.id).order('got_date', { ascending: false }),
    ])
    setHr(h || { user_id: emp.id })
    setCareers(c || [])
    setCerts(q || [])
  }, [emp.id])

  useEffect(() => { load() }, [load])

  const set = (k) => (e) => setHr({ ...hr, [k]: e.target.value })

  async function save() {
    setBusy(true); setErr(''); setMsg('')
    const { user_id, updated_at, ...rest } = hr   // eslint-disable-line no-unused-vars
    for (const k of DATE_COLS) if (rest[k] === '') rest[k] = null
    const { error } = await supabase.from('employee_hr')
      .upsert({ user_id: emp.id, ...rest, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setBusy(false)
    if (error) return setErr(errText(error))
    setMsg('저장했습니다.')
    onSaved?.()
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

  async function saveCert() {
    if (!addCert.name.trim()) return setErr('종목명을 넣어 주세요.')
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.from('employee_certs').insert({
      user_id: emp.id,
      cert_no: addCert.cert_no.trim(),
      name: addCert.name.trim(),
      kind: addCert.kind,
      got_date: addCert.got_date || null,
    })
    setBusy(false)
    if (error) return setErr(errText(error))
    setAddCert(EMPTY_CERT)
    load()
  }

  async function delCert(id) {
    if (!window.confirm('이 자격증을 지울까요?')) return
    const { error } = await supabase.from('employee_certs').delete().eq('id', id)
    if (error) return setErr(errText(error))
    load()
  }

  /* 경력 줄 고치기 — 건강보험 자격득실확인서와 맞추려면 고칠 수 있어야 한다.
     (지은님 2026-10-22: 입사일과 자격취득일이 다른 분이 있다.) */
  const rowOf = (c) => rowEdit[c.id] || c
  const setRow = (c, patch) => setRowEdit({ ...rowEdit, [c.id]: { ...rowOf(c), ...patch } })

  async function saveCareer(c) {
    const v = rowOf(c)
    if (!String(v.company || '').trim() || !v.start_date) return setErr('회사 이름과 시작일을 넣어 주세요.')
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.from('employee_careers').update({
      company: v.company.trim(),
      start_date: v.start_date,
      end_date: v.end_date || null,
      note: String(v.note || '').trim(),
    }).eq('id', c.id)
    setBusy(false)
    if (error) return setErr(errText(error))
    setRowEdit(Object.fromEntries(Object.entries(rowEdit).filter(([k]) => k !== c.id)))
    setMsg('경력을 고쳤습니다.')
    load()
  }

  async function delCareer(id) {
    if (!window.confirm('이 경력을 지울까요?')) return
    const { error } = await supabase.from('employee_careers').delete().eq('id', id)
    if (error) return setErr(errText(error))
    load()
  }

  if (!hr) return <section className="card"><p className="hint">불러오는 중…</p></section>

  /* 경력은 4대보험 자격취득일 기준이다. 입사일과 다를 수 있어 따로 적는다.
     ⚠️ 연차는 그대로 employees.hire_date 로 센다 — 여기 날짜는 경력에만 쓴다. */
  const vstart = hr.viren_start || emp.hire_date || ''
  const sum = careerSummary(careers, vstart)
  /* 기준표대로 등급을 제시한다. 고르는 건 사람이 한다. */
  /* 등급에 쓰는 자격은 자격증 표에서 뽑는다(국가기술자격만, 비고 1) */
  const withQual = { ...hr, ...bestQual(certs) }
  const tech = suggestGrades(withQual, careers, vstart)
  const design = suggestDesignGrade(withQual, careers, vstart)
  const mj = majorStatus(hr)
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
        <div><span>바이렌 근속</span><strong>{duration(sum.here)}</strong>
          <small className="tnum">{sum.here.toLocaleString()}일</small></div>
        <div><span>전 직장 경력</span><strong>{duration(sum.past)}</strong>
          <small className="tnum">{sum.past.toLocaleString()}일</small></div>
        <div className="hot"><span>총 경력</span><strong>{duration(sum.total)}</strong>
          <small className="tnum">{sum.total.toLocaleString()}일</small></div>
      </div>
      <p className="hint no-print">
        총 경력은 <strong>겹치는 기간을 한 번만</strong> 셉니다. 그래서 ‘전 직장 + 근속’ 과 다를 수 있어요.
        {sum.on === today() && ' 오늘 기준입니다.'}
        {' '}년·개월은 1년을 365일, 1개월을 30일로 본 <strong>어림값</strong>입니다 — 일수가 정확합니다.
      </p>

      <div className="form-row">
        <label className="field half"><span>영문명</span>
          <input value={hr.name_en || ''} onChange={set('name_en')} placeholder="GILDONG HONG" /></label>
        <label className="field half"><span>한자명</span>
          <input value={hr.name_cn || ''} onChange={set('name_cn')} /></label>
      </div>
      <div className="form-row three">
        <label className="field half"><span>생년월일</span>
          <DateInput value={hr.birth_date || ''} onChange={set('birth_date')} /></label>
        <label className="field half"><span>전화번호</span>
          <input value={hr.phone || ''} onChange={set('phone')} placeholder="010-0000-0000" /></label>
        <label className="field"><span>주소</span>
          <input value={hr.address || ''} onChange={set('address')} /></label>
      </div>

      <div className="form-row three">
        <label className="field"><span>학력</span>
          <select value={hr.edu_level || ''} onChange={set('edu_level')}>
            <option value="">선택</option>
            {EDUS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
        <label className="field"><span>졸업학교</span>
          <input value={hr.school || ''} onChange={set('school')} /></label>
        <label className="field"><span>학과</span>
          <input value={hr.major || ''} onChange={set('major')} /></label>
        <label className="field"><span>관련 학과인가</span>
          <select value={hr.major_related || ''} onChange={set('major_related')}>
            <option value="">자동 — {mj.auto ? mj.value || '정해야 함' : '고시 목록으로'}</option>
            <option value="관련 학과">관련 학과</option>
            <option value="관련 없음">관련 없음</option>
          </select></label>
      </div>
      <p className="hint no-print">
        {mj.auto && <strong>고시 목록으로 본 결과 — </strong>}
        {mj.why}
        {mj.auto && mj.value === '관련 없음' && (
          <> <span className="warn-text">학력으로는 기술자등급을 못 받습니다</span></>
        )}
        {' '}근거는 엔지니어링산업 진흥법 시행령 [별표 2] 「엔지니어링기술관련학과의 범위」
        (학과 1,305개)입니다. 졸업증명서에 적힌 그대로 넣으세요 — ‘○○과 · ○○학과 ·
        ○○공학과 · ○○전공’ 처럼 뒤에 붙는 말은 알아서 뗍니다.
      </p>
      <div className="form-row three">
        <label className="field"><span>전공 구분</span>
          <select value={hr.major_type || ''} onChange={set('major_type')}>
            <option value="">선택</option>
            {MAJOR_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
        <label className="field"><span>졸업일</span>
          <DateInput value={hr.edu_date || ''} onChange={set('edu_date')} /></label>
      </div>

      <div className="form-row">
        <label className="field half"><span>기술자등급</span>
          <select value={hr.tech_grade || ''} onChange={set('tech_grade')}>
            <option value="">해당 없음</option>
            <optgroup label="기술계">
              {TECH_TRACK.map((v) => <option key={v} value={v}>{v}</option>)}
            </optgroup>
            <optgroup label="숙련기술계">
              {SKILL_TRACK.map((v) => <option key={v} value={v}>{v}</option>)}
            </optgroup>
          </select></label>
        <label className="field half"><span>디자이너등급</span>
          <select value={hr.design_grade || ''} onChange={set('design_grade')}>
            <option value="">해당 없음</option>
            {DESIGN_TRACK.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
      </div>

      <Suggest
        tech={tech} design={design}
        onTech={(v) => setHr({ ...hr, tech_grade: v })}
        onDesign={(v) => setHr({ ...hr, design_grade: v })}
      />

      <label className="field"><span>메모</span>
        <textarea rows={2} value={hr.note || ''} onChange={set('note')} /></label>

      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}
      <div className="actions start no-print">
        <button className="btn primary" disabled={busy} onClick={save}>인사기록 저장</button>
      </div>

      {/* ── 자격증 ─────────────────────────────────────────── */}
      <h3 className="hr-sub">자격증</h3>
      <p className="hint no-print">
        등급 판정에는 <strong>국가기술자격만</strong> 쓰입니다(시행령 별표2 비고 1).
        급은 종목명 끝글자로 읽습니다 — ‘실내건축<strong>산업기사</strong>’.
      </p>

      <div className="table-wrap">
        <table className="table">
          <thead><tr>
            <th>번호</th><th>종목명</th><th>구분</th><th>취득일</th><th>급</th><th className="no-print" />
          </tr></thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id}>
                <td className="tnum">{c.cert_no || '—'}</td>
                <td>{c.name}</td>
                <td>{c.kind}</td>
                <td className="tnum">{c.got_date ? dot(c.got_date) : '—'}</td>
                <td>{c.kind === '국가기술자격' ? (tierOf(c.name) || '—') : '—'}</td>
                <td className="no-print">
                  <button className="icon" aria-label="지우기" onClick={() => delCert(c.id)}>✕</button>
                </td>
              </tr>
            ))}
            {!certs.length && <tr><td colSpan={6} className="muted center">적힌 자격증이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="form-row no-print">
        <label className="field half"><span>자격증 번호</span>
          <input value={addCert.cert_no} onChange={(e) => setAddCert({ ...addCert, cert_no: e.target.value })} /></label>
        <label className="field"><span>종목명</span>
          <input value={addCert.name} onChange={(e) => setAddCert({ ...addCert, name: e.target.value })}
            placeholder="실내건축산업기사" /></label>
        <label className="field half"><span>구분</span>
          <select value={addCert.kind} onChange={(e) => setAddCert({ ...addCert, kind: e.target.value })}>
            <option>국가기술자격</option><option>민간자격</option>
          </select></label>
        <label className="field half"><span>자격취득일</span>
          <DateInput value={addCert.got_date} onChange={(e) => setAddCert({ ...addCert, got_date: e.target.value })} /></label>
      </div>
      <div className="actions start no-print">
        <button className="btn" disabled={busy} onClick={saveCert}>자격증 추가</button>
      </div>

      {/* ── 경력 ───────────────────────────────────────────── */}
      <h3 className="hr-sub">경력</h3>
      <p className="hint no-print">
        <strong>건강보험 자격득실확인서</strong>의 자격취득일 ~ 상실일로 적습니다.
        끝난 날을 비우면 ‘재직 중’ 입니다. 넣은 뒤에도 고칠 수 있어요 —
        고친 줄의 <strong>저장</strong>을 눌러 주세요.
      </p>

      <div className="table-wrap">
        <table className="table career">
          <thead><tr>
            <th>회사</th><th>시작</th><th>종료</th>
            <th className="r">기간</th><th className="r">일수</th><th>비고</th>
            <th className="no-print" /><th className="no-print" />
          </tr></thead>
          <tbody>
            <tr className="sum">
              <td>바이렌 (현재)</td>
              <td>
                <DateInput value={hr.viren_start || ''} onChange={set('viren_start')}
                  aria-label="바이렌 자격취득일" />
              </td>
              <td>재직 중</td>
              <td className="r">{duration(sum.here)}</td>
              <td className="r tnum">{sum.here.toLocaleString()}</td>
              <td className="small muted">
                {hr.viren_start
                  ? '자격득실확인서 기준'
                  : '비우면 입사일(' + (emp.hire_date ? dot(emp.hire_date) : '없음') + ')'}
              </td>
              <td className="no-print" />
              <td className="no-print" />
            </tr>
            {careers.map((c) => {
              const v = rowOf(c)
              const dirty = !!rowEdit[c.id]
              return (
                <tr key={c.id}>
                  <td><input value={v.company || ''} aria-label="회사"
                    onChange={(e) => setRow(c, { company: e.target.value })} /></td>
                  <td><DateInput value={v.start_date || ''} aria-label="자격취득일"
                    onChange={(e) => setRow(c, { start_date: e.target.value })} /></td>
                  <td><DateInput value={v.end_date || ''} aria-label="자격상실일"
                    onChange={(e) => setRow(c, { end_date: e.target.value })} /></td>
                  <td className="r">{duration(rangeDays(v))}</td>
                  <td className="r tnum">{rangeDays(v).toLocaleString()}</td>
                  <td><input value={v.note || ''} aria-label="비고"
                    onChange={(e) => setRow(c, { note: e.target.value })} /></td>
                  <td className="no-print">
                    <button className="btn small-btn primary" disabled={!dirty || busy}
                      onClick={() => saveCareer(c)}>저장</button>
                  </td>
                  <td className="no-print">
                    <button className="icon" aria-label="지우기" onClick={() => delCareer(c.id)}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="form-row no-print">
        <label className="field"><span>회사</span>
          <input value={add.company} onChange={(e) => setAdd({ ...add, company: e.target.value })}
            placeholder="주식회사 ○○" /></label>
        <label className="field half"><span>자격취득일</span>
          <DateInput value={add.start_date} onChange={(e) => setAdd({ ...add, start_date: e.target.value })} /></label>
        <label className="field half"><span>자격상실일</span>
          <DateInput value={add.end_date} onChange={(e) => setAdd({ ...add, end_date: e.target.value })} /></label>
      </div>
      <div className="actions start no-print">
        <button className="btn" disabled={busy} onClick={addCareer}>경력 추가</button>
      </div>
    </section>
  )
}

/* 기준표로 뽑은 등급 제시.
   ⚠️ **자동으로 바꾸지 않는다.** '해당 전문분야와 관련된 업무' 인지는 기계가 모른다.
   버튼을 눌러야 위 드롭다운에 들어가고, 저장은 따로 눌러야 한다. */
function Suggest({ tech, design, onTech, onDesign }) {
  const rows = [
    { label: '기술계', v: tech.tech, put: onTech },
    { label: '숙련기술계', v: tech.skill, put: onTech },
    { label: '디자이너', v: design.grade ? { grade: design.grade, why: design.why } : null, put: onDesign },
  ]
  return (
    <section className="suggest no-print">
      <h4>기준표로 본 등급</h4>
      <ul>
        {rows.map((r) => (
          <li key={r.label}>
            <span className="s-kind">{r.label}</span>
            {r.v ? (
              <>
                <strong>{r.v.grade}</strong>
                <span className="s-why">{r.v.why}</span>
                <button type="button" className="linkbtn" onClick={() => r.put(r.v.grade)}>이걸로 넣기</button>
              </>
            ) : (
              <span className="s-why">{r.label === '디자이너' ? design.why : '해당하는 등급이 없어요.'}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="hint">
        인정경력 — 자격 기준 <strong className="tnum">{yearsOf(tech.days.byQual || 0)}년</strong> ·
        학력 기준 <strong className="tnum">{yearsOf(tech.days.byEdu || 0)}년</strong>
        {tech.majorUnsure && (
          <> · <span className="warn-text">학과가 ‘관련 학과’ 인지 정해 주세요 —
            관련 없으면 학력으로는 등급을 못 받습니다</span></>
        )}
        {tech.guessed && (
          <> · <span className="warn-text">자격취득일·졸업일을 적으면 더 정확해져요
            (갖추기 전 경력은 60%만 인정됩니다)</span></>
        )}
      </p>
      <p className="hint">
        적어 둔 경력을 <strong>전부 ‘해당 전문분야 관련 업무’로 보고</strong> 셉니다.
        관련 없는 경력이 섞여 있으면 직접 낮춰 주세요. <strong>최종 결정은 사람이 합니다.</strong>
      </p>
    </section>
  )
}
