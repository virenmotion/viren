import { useEffect, useState } from 'react'
import { errText, supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { leavePeriod } from '../lib/leave'
import { ymd } from '../lib/dates'
import { downloadBlob } from '../lib/csv'
import { ErrorBox } from '../components/ui'

const TABS = [['staff', '직원'], ['settings', '출근 설정'], ['backup', '백업']]

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
      {tab === 'backup' && <Backup />}
    </div>
  )
}

function Staff() {
  const { employees, reloadEmployees, userId } = useSession()
  const [rows, setRows] = useState(employees)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => setRows(employees), [employees])

  const set = (id, patch) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)))

  async function save(r) {
    setErr(''); setMsg('')
    const { error } = await supabase.from('employees').update({
      name: r.name.trim(), dept: r.dept.trim(), position: r.position.trim(), role: r.role,
      hire_date: r.hire_date || null,
      leave_override: r.leave_override === '' || r.leave_override == null ? null : Number(r.leave_override),
      active: r.active,
    }).eq('id', r.id)
    if (error) return setErr(errText(error))
    setMsg(`${r.name} 님 정보를 저장했습니다.`)
    reloadEmployees()
  }

  return (
    <section className="stack-sm">
      <div className="card info">
        <p><strong>직원 추가:</strong> Supabase 대시보드 → Authentication → Users → <em>Add user</em> → <em>Create new user</em>에서 회사 이메일과 임시 비밀번호를 넣고 <em>Auto Confirm User</em>를 켭니다. 그러면 이 목록에 <strong>재직이 꺼진 상태</strong>로 나타납니다. 이름·직위·입사일을 채우고 ‘재직’을 켠 뒤 저장해야 로그인할 수 있습니다. 본인에게는 첫 로그인 후 비밀번호를 바꾸라고 알려 주세요.</p>
        <p><strong>퇴사:</strong> 계정을 지우지 말고 ‘재직’ 체크를 끄세요. 결재 기록은 그대로 남고 로그인만 막힙니다.</p>
        <p><strong>연차:</strong> 비워 두면 입사일 기준 근로기준법 방식으로 자동 계산합니다. 상시 5인 미만 사업장은 법정 연차 적용 대상이 아니므로, 회사 규정이 따로 있으면 ‘연차 직접 지정’에 일수를 넣으세요.</p>
      </div>
      <ErrorBox>{err}</ErrorBox>
      {msg && <p className="ok">{msg}</p>}
      <div className="table-wrap card flush">
        <table className="table staff">
          <thead><tr><th>이름</th><th>이메일</th><th>부서</th><th>직위</th><th>입사일</th><th>자동 연차</th><th>연차 직접 지정</th><th>권한</th><th>재직</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = leavePeriod(r.hire_date)
              return (
                <tr key={r.id} className={r.active ? '' : 'inactive'}>
                  <td><input id={`n-${r.id}`} value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} /></td>
                  <td className="small">{r.email}</td>
                  <td><input id={`d-${r.id}`} value={r.dept} onChange={(e) => set(r.id, { dept: e.target.value })} /></td>
                  <td><input id={`p-${r.id}`} value={r.position} placeholder="예: 대표" onChange={(e) => set(r.id, { position: e.target.value })} /></td>
                  <td><input id={`h-${r.id}`} type="date" value={r.hire_date || ''} onChange={(e) => set(r.id, { hire_date: e.target.value })} /></td>
                  <td className="tnum small">{p ? `${p.legal}일` : '—'}</td>
                  <td><input id={`o-${r.id}`} className="tnum" type="number" step="0.5" min="0" value={r.leave_override ?? ''} placeholder="자동" onChange={(e) => set(r.id, { leave_override: e.target.value })} /></td>
                  <td>
                    <select id={`r-${r.id}`} value={r.role} onChange={(e) => set(r.id, { role: e.target.value })}>
                      <option value="member">직원</option><option value="admin">관리자</option>
                    </select>
                  </td>
                  <td><input id={`a-${r.id}`} type="checkbox" checked={r.active} disabled={r.id === userId} onChange={(e) => set(r.id, { active: e.target.checked })} aria-label="재직" /></td>
                  <td><button className="btn small-btn primary" disabled={!r._dirty} onClick={() => save(r)}>저장</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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

const BACKUP_TABLES = ['employees', 'settings', 'approval_docs', 'approval_steps', 'approval_refs', 'approval_files', 'attendance']

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
      <p>무료 서버에는 자동 백업이 없습니다. <strong>한 달에 한 번</strong> 아래 버튼으로 전체 기록(직원, 결재 문서, 결재선, 근태)을 내려받아 회사 Dropbox에 보관해 주세요.</p>
      <p className="hint">첨부파일 자체는 이 파일에 들어가지 않습니다. 첨부파일은 Supabase 대시보드 → Storage → approval-files 에서 따로 내려받을 수 있습니다.</p>
      <ErrorBox>{err}</ErrorBox>
      <div className="actions"><button className="btn primary" disabled={busy} onClick={run}>{busy ? '내려받는 중…' : '전체 백업 내려받기'}</button></div>
    </section>
  )
}
