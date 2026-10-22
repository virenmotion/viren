import { useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { leavePeriod } from '../lib/leave'
import { DUTIES, RANKS } from '../lib/labels'
import { ymd } from '../lib/dates'
import { downloadBlob } from '../lib/csv'
import { DateInput, ErrorBox } from '../components/ui'
import AdminForms from './AdminForms'
import StorageCard from '../components/StorageCard'
import StaffCard from '../components/StaffCard'

const TABS = [['staff', '직원'], ['settings', '출근 설정'], ['forms', '양식'], ['cats', '일정 분류'], ['storage', '저장소'], ['backup', '백업']]

export default function Admin() {
  const [tab, setTab] = useState('staff')
  return (
    <div className="stack">
      <h1>관리</h1>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'staff' && <Staff />}
      {tab === 'settings' && <Settings />}
      {tab === 'forms' && <AdminForms />}
      {tab === 'cats' && <Categories />}
      {tab === 'storage' && <StorageCard />}
      {tab === 'backup' && <Backup />}
    </div>
  )
}

/* 일정 분류 — 이름과 색을 관리자가 직접 만든다. 달력(캘린더)의 색 구분이 이걸 따른다.
   색은 '#rrggbb' 만 받는다(DB check 와 같은 규칙). */
const NEW_CAT = { name: '', color: '#fbc825' }

function Categories() {
  const [rows, setRows] = useState(null)
  const [add, setAdd] = useState(NEW_CAT)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [dragFrom, setDragFrom] = useState(null)  // 끌고 있는 줄
  const [canDrag, setCanDrag] = useState(null)    // 손잡이를 누르고 있을 때만 끌린다

  async function load() {
    const { data, error } = await supabase.from('event_categories').select('*').order('sort').order('name')
    if (error) return setErr(/event_categories|schema cache/i.test(error.message)
      ? '아직 데이터베이스 설정 전입니다. work/supabase/migrations 의 분류 추가 SQL 을 한 번 실행해 주세요.'
      : errText(error))
    setErr(''); setRows(data)
  }
  useEffect(() => { load() }, [])

  const set = (id, patch) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)))

  async function save(r) {
    setErr(''); setMsg('')
    const { error } = await supabase.from('event_categories')
      .update({ name: r.name.trim(), color: r.color }).eq('id', r.id)
    if (error) return setErr(errText(error))
    setMsg(`'${r.name}' 분류를 저장했습니다.`)
    load()
  }

  /* 순서 바꾸기 — 화면을 먼저 바꾸고 바뀐 줄만 저장한다 */
  async function reorder(from, to) {
    if (from == null || to == null || from === to || to < 0 || to >= rows.length) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const renumbered = next.map((r, i) => ({ ...r, sort: i + 1 }))
    setRows(renumbered)
    setErr(''); setMsg('')

    /* 순서 번호가 실제로 달라진 줄만 저장한다 */
    const before = new Map(rows.map((r) => [r.id, r.sort]))
    const changed = renumbered.filter((r) => before.get(r.id) !== r.sort)
    for (const r of changed) {
      const { error } = await supabase.from('event_categories').update({ sort: r.sort }).eq('id', r.id)
      if (error) { setErr(errText(error)); load(); return }
    }
    setMsg('순서를 바꿨습니다.')
  }

  async function create(e) {
    e.preventDefault()
    setErr(''); setMsg('')
    if (!add.name.trim()) return setErr('분류 이름을 넣어 주세요.')
    const { error } = await supabase.from('event_categories')
      .insert({ name: add.name.trim(), color: add.color, sort: (rows?.length || 0) + 1 })
    if (error) return setErr(errText(error))
    setAdd(NEW_CAT); setMsg('분류를 만들었습니다.')
    load()
  }

  async function remove(r) {
    if (!window.confirm(`'${r.name}' 분류를 지울까요? 이 분류를 쓰던 일정은 남고 색만 빠집니다.`)) return
    setErr(''); setMsg('')
    const { error } = await supabase.from('event_categories').delete().eq('id', r.id)
    if (error) return setErr(errText(error))
    load()
  }

  if (!rows) return <section className="card"><ErrorBox>{err}</ErrorBox>{!err && <p className="muted">불러오는 중…</p>}</section>

  return (
    <section className="card stack-sm narrow-form">
      <h2>일정 분류</h2>
      <p className="hint">달력의 색 구분입니다. 여기서 만든 분류를 일정마다 고르면 그 색으로 표시됩니다.
        <strong>왼쪽 손잡이(⠿)를 끌어</strong> 순서를 바꾸세요. 바꾸면 바로 저장됩니다.</p>

      {!rows.length && <p className="muted">아직 분류가 없습니다. 아래에서 만들어 주세요.</p>}
      <ul className="cat-list">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={`cat-row${dragFrom === i ? ' dragging' : ''}`}
            draggable={canDrag === r.id}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); reorder(dragFrom, i); setDragFrom(null); setCanDrag(null) }}
            onDragEnd={() => { setDragFrom(null); setCanDrag(null) }}
          >
            {/* 손잡이를 누르고 있을 때만 끌리게 한다. 안 그러면 글자 선택이 안 된다. */}
            <span
              className="drag-handle" aria-hidden="true" title="끌어서 순서 바꾸기"
              onMouseDown={() => setCanDrag(r.id)} onMouseUp={() => setCanDrag(null)}
            >⠿</span>
            <input type="color" aria-label={`${r.name} 색`} value={r.color} onChange={(e) => set(r.id, { color: e.target.value })} />
            <input aria-label="분류 이름" value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} />
            <span className="ord-btns">
              <button className="icon" aria-label={`${r.name} 위로`} disabled={i === 0} onClick={() => reorder(i, i - 1)}>↑</button>
              <button className="icon" aria-label={`${r.name} 아래로`} disabled={i === rows.length - 1} onClick={() => reorder(i, i + 1)}>↓</button>
            </span>
            <button className="btn small-btn primary" disabled={!r._dirty} onClick={() => save(r)}>저장</button>
            <button className="btn small-btn danger" onClick={() => remove(r)}>삭제</button>
          </li>
        ))}
      </ul>

      <form className="cat-row cat-add" onSubmit={create}>
        <input type="color" aria-label="새 분류 색" value={add.color} onChange={(e) => setAdd({ ...add, color: e.target.value })} />
        <input aria-label="새 분류 이름" placeholder="예: 촬영" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
        <button className="btn small-btn primary">추가</button>
      </form>

      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}
    </section>
  )
}

/* 직원 — 정보 수정과 **순서 정하기**.
   순서는 employees.sort 하나로 정한다. 줄을 끌어 옮기면 바로 저장되고,
   결재자 고르기 등 직원 목록이 쓰이는 모든 곳이 이 순서를 따른다.
   (2026-10-21 전에는 settings.dept_order 로 부서 순서만 정했다. 그 칸은
    더 이상 쓰지 않는다 — 지우지는 않았다.) */
function Staff() {
  const { employees, reloadEmployees, userId } = useSession()
  const [rows, setRows] = useState(employees)
  /* 인사기록카드를 열어 둔 직원 (노션 직원현황관리를 옮긴 화면, 2026-10-22) */
  const [cardOf, setCardOf] = useState(null)
  /* 목록에서 바로 보려고 등급만 따로 읽는다(값을 고치는 건 인사기록카드에서).
     employee_hr 은 관리자와 본인만 보이므로, 직원 권한이면 자기 줄만 온다. */
  const [grades, setGrades] = useState({})
  const [dragFrom, setDragFrom] = useState(null)
  const [canDrag, setCanDrag] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => setRows(employees), [employees])

  async function loadGrades() {
    const { data } = await supabase.from('employee_hr').select('user_id, tech_grade, design_grade')
    setGrades(Object.fromEntries((data || []).map((h) => [h.user_id, h])))
  }
  useEffect(() => { loadGrades() }, [])

  const set = (id, patch) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)))

  /* 줄을 끌어 순서 바꾸기 — 일정 분류와 같은 방식. 놓으면 바로 저장된다.
     ⚠️ 끌기는 터치 화면에서 안 되므로 ↑↓ 도 같이 둔다. */
  async function reorder(from, to) {
    if (from == null || to == null || from === to || to < 0 || to >= rows.length) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const renumbered = next.map((r, i) => ({ ...r, sort: i + 1 }))
    setRows(renumbered)
    setErr(''); setMsg('')
    const before = new Map(rows.map((r) => [r.id, r.sort]))
    for (const r of renumbered.filter((r) => before.get(r.id) !== r.sort)) {
      const { error } = await supabase.from('employees').update({ sort: r.sort }).eq('id', r.id)
      if (error) {
        return setErr(/sort/i.test(error.message)
          ? '아직 데이터베이스 설정 전입니다. work/supabase/migrations 의 직원 순서 SQL 을 한 번 실행해 주세요.'
          : errText(error))
      }
    }
    setMsg('순서를 바꿨습니다.')
    reloadEmployees()
  }


  async function save(r) {
    setErr(''); setMsg('')
    const { error } = await supabase.from('employees').update({
      name: r.name.trim(), dept: r.dept.trim(), position: r.position.trim(), duty: (r.duty || '').trim(), role: r.role,
      hire_date: r.hire_date || null,
      leave_override: r.leave_override === '' || r.leave_override == null ? null : Number(r.leave_override),
      leave_used_before: Number(r.leave_used_before) || 0,
      /* 어느 연차 기간의 숫자인지 알 수 있게 적어 넣은 날짜를 같이 남긴다.
         0 으로 되돌리면 날짜도 지운다. */
      leave_used_before_at: Number(r.leave_used_before) > 0 ? ymd() : null,
      active: r.active,
    }).eq('id', r.id)
    if (error) return setErr(errText(error))
    setMsg(`${r.name} 님 정보를 저장했습니다.`)
    reloadEmployees()
  }

  return (
    <section className="stack-sm">
      <div className="card info">
        <p><strong>순서:</strong> 왼쪽 손잡이(⠿)를 끌어 직원 순서를 바꿉니다. 이 순서가 결재자 고르기 등 직원 목록이 쓰이는 모든 곳에 적용됩니다.</p>
        <p><strong>직원 추가:</strong> Supabase 대시보드 → Authentication → Users → <em>Add user</em> → <em>Create new user</em>에서 회사 이메일과 임시 비밀번호를 넣고 <em>Auto Confirm User</em>를 켭니다. 그러면 이 목록에 <strong>재직이 꺼진 상태</strong>로 나타납니다. 이름·직급·입사일을 채우고 ‘재직’을 켠 뒤 저장해야 로그인할 수 있습니다. 본인에게는 첫 로그인 후 비밀번호를 바꾸라고 알려 주세요.</p>
        <p><strong>퇴사:</strong> 계정을 지우지 말고 ‘재직’ 체크를 끄세요. 결재 기록은 그대로 남고 로그인만 막힙니다.</p>
        <p><strong>연차:</strong> 비워 두면 입사일 기준 근로기준법 방식으로 자동 계산합니다. 상시 5인 미만 사업장은 법정 연차 적용 대상이 아니므로, 회사 규정이 따로 있으면 ‘연차 직접 지정’에 일수를 넣으세요.</p>
        <p><strong>이전 사용:</strong> 카카오워크처럼 전에 쓰던 곳에서 이미 쓴 연차 일수입니다. 남은 연차에서 함께 빠집니다. <strong>입사 1주년이 지나 연차가 새로 생기면 저절로 빠지지 않게 되므로, 따로 지우실 필요 없습니다.</strong></p>
      </div>
      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}
      <div className="table-wrap card flush">
        <table className="table staff">
          <thead><tr><th aria-label="순서" /><th>이름</th><th>이메일</th><th>부서</th><th>기술자등급</th><th>디자이너등급</th><th>직급</th><th>직책</th><th>입사일</th><th>자동 연차</th><th>연차 직접 지정</th><th>이전 사용</th><th>권한</th><th>재직</th><th aria-label="인사기록" /><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const p = leavePeriod(r.hire_date)
              return (
                <tr
                  key={r.id}
                  className={`${r.active ? '' : 'inactive'}${dragFrom === i ? ' dragging' : ''}`}
                  draggable={canDrag === r.id}
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); reorder(dragFrom, i); setDragFrom(null); setCanDrag(null) }}
                  onDragEnd={() => { setDragFrom(null); setCanDrag(null) }}
                >
                  <td className="ord-cell">
                    <span className="drag-handle" aria-hidden="true" title="끌어서 순서 바꾸기"
                      onMouseDown={() => setCanDrag(r.id)} onMouseUp={() => setCanDrag(null)}>⠿</span>
                    <span className="ord-btns">
                      <button className="icon" aria-label={`${r.name} 위로`} disabled={i === 0} onClick={() => reorder(i, i - 1)}>↑</button>
                      <button className="icon" aria-label={`${r.name} 아래로`} disabled={i === rows.length - 1} onClick={() => reorder(i, i + 1)}>↓</button>
                    </span>
                  </td>
                  <td><input id={`n-${r.id}`} value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} /></td>
                  <td className="small">{r.email}</td>
                  <td><input id={`d-${r.id}`} value={r.dept} onChange={(e) => set(r.id, { dept: e.target.value })} /></td>
                  <td className="small">{grades[r.id]?.tech_grade || '—'}</td>
                  <td className="small">{grades[r.id]?.design_grade || '—'}</td>
                  <td>
                    <select id={`p-${r.id}`} value={r.position || ''} onChange={(e) => set(r.id, { position: e.target.value })}>
                      <option value="">—</option>
                      {RANKS.map((x) => <option key={x} value={x}>{x}</option>)}
                      {/* 목록에 없는 옛 값이 들어 있어도 지워지지 않게 */}
                      {r.position && !RANKS.includes(r.position) && <option value={r.position}>{r.position}</option>}
                    </select>
                  </td>
                  <td>
                    <select id={`u-${r.id}`} value={r.duty || ''} onChange={(e) => set(r.id, { duty: e.target.value })}>
                      <option value="">—</option>
                      {DUTIES.map((x) => <option key={x} value={x}>{x}</option>)}
                      {r.duty && !DUTIES.includes(r.duty) && <option value={r.duty}>{r.duty}</option>}
                    </select>
                  </td>
                  <td><DateInput id={`h-${r.id}`} value={r.hire_date || ''} onChange={(e) => set(r.id, { hire_date: e.target.value })} /></td>
                  <td className="tnum small">{p ? `${p.legal}일` : '—'}</td>
                  <td><input id={`o-${r.id}`} className="tnum" type="number" step="0.5" min="0" value={r.leave_override ?? ''} placeholder="자동" onChange={(e) => set(r.id, { leave_override: e.target.value })} /></td>
                  <td><input id={`b-${r.id}`} className="tnum" type="number" step="0.5" min="0" value={r.leave_used_before ?? 0} onChange={(e) => set(r.id, { leave_used_before: e.target.value })} /></td>
                  <td>
                    <select id={`r-${r.id}`} value={r.role} onChange={(e) => set(r.id, { role: e.target.value })}>
                      <option value="member">직원</option><option value="admin">관리자</option>
                    </select>
                  </td>
                  <td><input id={`a-${r.id}`} type="checkbox" checked={r.active} disabled={r.id === userId} onChange={(e) => set(r.id, { active: e.target.checked })} aria-label="재직" /></td>
                  <td><button className="btn small-btn" onClick={() => setCardOf(r)}>인사기록</button></td>
                  <td><button className="btn small-btn primary" disabled={!r._dirty} onClick={() => save(r)}>저장</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {cardOf && (
        <StaffCard
          key={cardOf.id}
          emp={rows.find((r) => r.id === cardOf.id) || cardOf}
          onClose={() => setCardOf(null)}
          onSaved={loadGrades}
        />
      )}
    </section>
  )
}

function Settings() {
  const [s, setS] = useState(null)
  const [ips, setIps] = useState('')
  const [myIp, setMyIp] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single().then(({ data, error }) => {
      if (error) return setErr(errText(error))
      setS(data); setIps((data.office_ips || []).join('\n'))
    })
    supabase.rpc('my_ip').then(({ data }) => setMyIp(data || ''))
  }, [])

  async function save() {
    setErr(''); setMsg('')
    const list = ips.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
    const { error } = await supabase.from('settings')
      .update({ office_ips: list, require_office_ip: s.require_office_ip, updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) return setErr(/cidr|inet/i.test(error.message) ? '인터넷 주소 형식이 맞지 않습니다. 예: 211.234.10.5' : errText(error))
    setMsg('저장했습니다.')
  }

  if (!s) return <ErrorBox>{err}</ErrorBox>
  return (
    <section className="card stack-sm narrow-form">
      <h2>사무실 인터넷 주소</h2>
      <p className="hint">여기 적은 주소에서 출근을 찍으면 ‘사무실’, 다른 곳이면 ‘외부’로 기록됩니다. 비워 두면 위치를 따지지 않습니다.</p>
      <p className="small">지금 접속한 주소: <strong className="tnum">{myIp || '확인 불가'}</strong>
        {myIp && <> <button className="linkbtn" onClick={() => setIps((ips ? ips + '\n' : '') + myIp)}>목록에 추가</button></>}</p>
      <p className="hint">사무실 와이파이에 연결된 상태에서 ‘목록에 추가’를 누르면 됩니다. 한 줄에 하나씩, 범위는 211.234.10.0/24 처럼 적습니다.</p>
      <label className="field"><span>사무실 주소 목록</span>
        <textarea id="office-ips" rows={4} className="tnum" value={ips} onChange={(e) => setIps(e.target.value)} /></label>
      <label className="check">
        <input id="require-office" type="checkbox" checked={s.require_office_ip} onChange={(e) => setS({ ...s, require_office_ip: e.target.checked })} />
        사무실 밖에서는 출근을 못 찍게 하기
      </label>
      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}
      <div className="actions"><button className="btn primary" onClick={save}>저장</button></div>
    </section>
  )
}

const BACKUP_TABLES = ['employees', 'settings', 'doc_forms', 'approval_docs', 'approval_steps', 'approval_refs', 'approval_files', 'attendance', 'events', 'event_categories']

function Backup() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run() {
    setBusy(true); setErr('')
    try {
      const out = { exported_at: new Date().toISOString(), tables: {} }
      for (const t of BACKUP_TABLES) {
        const rows = []
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from(t).select('*').range(from, from + 999)
          if (error) throw error
          rows.push(...data)
          if (data.length < 1000) break
        }
        out.tables[t] = rows
      }
      downloadBlob(`viren-work-backup-${ymd()}.json`, new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }))
    } catch (e) { setErr(errText(e)) }
    setBusy(false)
  }

  return (
    <section className="card stack-sm narrow-form">
      <h2>데이터 백업</h2>
      <p>무료 서버에는 자동 백업이 없습니다. <strong>한 달에 한 번</strong> 아래 버튼으로 전체 기록(직원, 결재 문서, 결재선, 근태, 일정)을 내려받아 회사 Dropbox에 보관해 주세요.</p>
      <p className="hint">첨부파일 자체는 이 파일에 들어가지 않습니다. 첨부파일은 Supabase 대시보드 → Storage → approval-files 에서 따로 내려받을 수 있습니다.</p>
      <ErrorBox>{err}</ErrorBox>
      <div className="actions"><button className="btn primary" disabled={busy} onClick={run}>{busy ? '내려받는 중…' : '전체 백업 내려받기'}</button></div>
    </section>
  )
}
