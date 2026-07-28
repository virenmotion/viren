import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { isConfigured } from '../lib/supabase'
import {
  signIn, signOut, getUser, onAuthChange,
  createProject, updateProject, deleteProject, uploadThumb, reorderProjects,
} from '../lib/projectStore'
import { listJobs, createJob, updateJob, deleteJob } from '../lib/careerStore'
import { CATEGORIES, catLabel, slugify } from '../workProjects'
import { JOB_FORM_CATEGORIES, jobCatLabel } from '../careerJobs'
import { useProjects } from '../ProjectsContext'

export default function Admin() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    getUser().then((u) => { setUser(u); setAuthReady(true) })
    return onAuthChange(setUser)
  }, [])

  if (!isConfigured) return <NotConfigured />
  if (!authReady) return <AdminShell><p className="adm-muted">확인 중…</p></AdminShell>
  if (!user) return <Login onDone={setUser} />
  return <Dashboard user={user} />
}

/* ---------- 미연결 안내 ---------- */
function NotConfigured() {
  return (
    <AdminShell>
      <h1 className="adm-h1">관리자</h1>
      <div className="adm-card adm-warn">
        <p><strong>Supabase가 아직 연결되지 않았습니다.</strong></p>
        <p className="adm-muted">프로젝트 루트의 <code>.env.local</code> 에 <code>VITE_SUPABASE_URL</code> 과 <code>VITE_SUPABASE_ANON_KEY</code> 를 입력하고 dev 서버를 재시작하세요. 설정 방법은 <code>SUPABASE_SETUP.md</code> 를 참고하세요.</p>
      </div>
    </AdminShell>
  )
}

/* ---------- 로그인 ---------- */
function Login({ onDone }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const u = await signIn(email.trim(), pw)
      onDone(u)
    } catch (e2) {
      setErr('로그인 실패: 이메일/비밀번호를 확인하세요.')
    } finally { setBusy(false) }
  }

  return (
    <AdminShell>
      <h1 className="adm-h1">관리자 로그인</h1>
      <form className="adm-card adm-login" onSubmit={submit}>
        <label>이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label>비밀번호<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /></label>
        {err && <p className="adm-err">{err}</p>}
        <button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
      </form>
    </AdminShell>
  )
}

/* ---------- 대시보드 (탭: WORK / CAREER) ---------- */
function Dashboard({ user }) {
  const [tab, setTab] = useState('work')
  return (
    <AdminShell>
      <div className="adm-top">
        <div className="adm-tabs">
          <button className={tab === 'work' ? 'on' : undefined} onClick={() => setTab('work')}>WORK</button>
          <button className={tab === 'career' ? 'on' : undefined} onClick={() => setTab('career')}>CAREER</button>
        </div>
        <div className="adm-top-right">
          <span className="adm-muted">{user.email}</span>
          <button className="adm-btn" onClick={() => signOut()}>로그아웃</button>
        </div>
      </div>
      {tab === 'work' ? <ProjectManager /> : <JobManager />}
    </AdminShell>
  )
}

/* ---------- WORK 관리 ---------- */
const EMPTY_PROJECT = {
  slug: '', cat: 'media-art', kind: '',
  client: '', year: '', titleEn: '', titleKo: '',
  youtube: '', location: '', deliverables: '', thumb: '', desc: '', blocks: [], sort: 0,
}

function ProjectManager() {
  const { projects, loading, refresh } = useProjects()
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_PROJECT)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)

  /* 드래그 순서 변경 */
  const [rows, setRows] = useState([])
  const [savingOrder, setSavingOrder] = useState(false)
  const dragFrom = useRef(null)
  useEffect(() => { setRows(projects) }, [projects])

  function onDragStart(i) { dragFrom.current = i }
  function onDragEnter(i) {
    const from = dragFrom.current
    if (from === null || from === i) return
    setRows((prev) => {
      const next = [...prev]
      const [m] = next.splice(from, 1)
      next.splice(i, 0, m)
      return next
    })
    dragFrom.current = i
  }
  async function onDrop() {
    dragFrom.current = null
    setSavingOrder(true); setMsg('')
    try { await reorderProjects(rows.map((r) => r.slug)); await refresh() }
    catch (e) { setMsg('순서 저장 실패: ' + e.message) }
    finally { setSavingOrder(false) }
  }

  const isNew = editing === ''
  const slugAuto = useMemo(() => slugify(form.slug || form.titleEn || form.titleKo), [form.slug, form.titleEn, form.titleKo])

  function startNew() { setEditing(''); setForm(EMPTY_PROJECT); setMsg('') }
  function startEdit(p) { setEditing(p.slug); setForm({ ...EMPTY_PROJECT, ...p, blocks: Array.isArray(p.blocks) ? p.blocks : [] }); setMsg('') }
  function cancel() { setEditing(null); setForm(EMPTY_PROJECT); setMsg('') }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  /* 본문 하단 콘텐츠 블록 (텍스트/이미지/영상) */
  const addBlock = (type) => setForm((f) => ({ ...f, blocks: [...(f.blocks || []), { type }] }))
  const updateBlock = (i, patch) => setForm((f) => {
    const b = [...f.blocks]; b[i] = { ...b[i], ...patch }; return { ...f, blocks: b }
  })
  const removeBlock = (i) => setForm((f) => ({ ...f, blocks: f.blocks.filter((_, j) => j !== i) }))
  const moveBlock = (i, dir) => setForm((f) => {
    const b = [...f.blocks]; const j = i + dir
    if (j < 0 || j >= b.length) return f;
    [b[i], b[j]] = [b[j], b[i]]; return { ...f, blocks: b }
  })
  // 블록 드래그앤드롭 재정렬
  const blockDragFrom = useRef(null)
  const [blockDrag, setBlockDrag] = useState(null)
  const onBlockDragStart = (i, e) => { blockDragFrom.current = i; setBlockDrag(i); e.dataTransfer.effectAllowed = 'move' }
  const onBlockDragEnter = (i) => {
    const from = blockDragFrom.current
    if (from === null || from === i) return
    setForm((f) => {
      const b = [...f.blocks]; const [m] = b.splice(from, 1); b.splice(i, 0, m)
      return { ...f, blocks: b }
    })
    blockDragFrom.current = i; setBlockDrag(i)
  }
  const onBlockDragEnd = () => { blockDragFrom.current = null; setBlockDrag(null) }
  async function uploadBlockImage(i, e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg('')
    try { const url = await uploadThumb(file); updateBlock(i, { media: url }) }
    catch (e2) { setMsg('이미지 업로드 실패: ' + e2.message) }
    finally { e.target.value = '' }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMsg('')
    try {
      const url = await uploadThumb(file)
      setForm((f) => ({ ...f, thumb: url }))
    } catch (e2) {
      setMsg('이미지 업로드 실패: ' + e2.message)
    } finally { setUploading(false); e.target.value = '' }
  }

  async function save(e) {
    e.preventDefault()
    const slug = slugAuto
    if (!slug || !form.titleKo.trim()) { setMsg('한글 프로젝트명은 필수입니다.'); return }
    setBusy(true); setMsg('')
    const payload = { ...form, slug, sort: Number(form.sort) || 0 }
    try {
      if (isNew) await createProject(payload)
      else await updateProject(editing, payload)
      await refresh()
      cancel()
    } catch (e2) {
      setMsg('저장 실패: ' + e2.message)
    } finally { setBusy(false) }
  }

  async function remove(p) {
    if (!window.confirm(`"${p.titleEn}" 을(를) 삭제할까요?`)) return
    try { await deleteProject(p.slug); await refresh() }
    catch (e2) { setMsg('삭제 실패: ' + e2.message) }
  }

  if (editing !== null) {
    return (
      <form className="adm-card adm-form" onSubmit={save}>
        <h2 className="adm-h2">{isNew ? '새 프로젝트' : '프로젝트 수정'}</h2>

        <div className="adm-grid2">
          <label>발주처명<input value={form.client} onChange={set('client')} /></label>
          <label>사업연도<input value={form.year} onChange={set('year')} /></label>
        </div>

        <label>한글 프로젝트명 *<input value={form.titleKo} onChange={set('titleKo')} required /></label>
        <label>영문 프로젝트명<input value={form.titleEn} onChange={set('titleEn')} /></label>

        <div className="adm-grid2">
          <label>URL 슬러그<input value={form.slug} onChange={set('slug')} placeholder={slugAuto} />
            <span className="adm-hint">/work/{slugAuto || '…'}</span></label>
          <label>정렬 순서<input type="number" value={form.sort} onChange={set('sort')} /></label>
        </div>

        <div className="adm-grid2">
          <label>카테고리
            <select value={form.cat} onChange={set('cat')}>
              {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </label>
          <label>구분(태그)<input value={form.kind} onChange={set('kind')} /></label>
        </div>

        <div className="adm-grid2">
          <label>Location<input value={form.location} onChange={set('location')} /></label>
          <label>Deliverables<input value={form.deliverables} onChange={set('deliverables')} /></label>
        </div>

        <label>영상 (YouTube 주소 또는 ID)<input value={form.youtube} onChange={set('youtube')} />
          <span className="adm-hint">예: https://youtu.be/aqz-KE-bpKQ 를 붙여넣어도 됩니다 · 비우면 영상 없음</span></label>

        <label>썸네일 이미지
          <input type="file" accept="image/*" onChange={onFile} />
          {uploading && <span className="adm-hint">업로드 중…</span>}
        </label>
        {form.thumb && (
          <div className="adm-thumb-preview">
            <img src={form.thumb} alt="썸네일 미리보기" />
            <button type="button" className="adm-btn" onClick={() => setForm((f) => ({ ...f, thumb: '' }))}>이미지 제거</button>
          </div>
        )}

        <label>본문(요약)<textarea rows={4} value={form.desc} onChange={set('desc')} /></label>

        {/* 본문 하단 콘텐츠 블록 — 스크롤 시 떠오르는 글/이미지/영상 */}
        <div className="adm-blocks">
          <span className="adm-blocks-title">본문 하단 콘텐츠 (순서대로 표시 · 스크롤 애니메이션)</span>
          {(form.blocks || []).map((b, i) => (
            <div
              className={'adm-block' + (blockDrag === i ? ' is-dragging' : '')}
              key={i}
              onDragEnter={() => onBlockDragEnter(i)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={onBlockDragEnd}
              onDrop={(e) => { e.preventDefault(); onBlockDragEnd() }}
            >
              <div className="adm-block-head">
                <span className="adm-block-lead">
                <span
                  className="adm-drag"
                  draggable
                  onDragStart={(e) => onBlockDragStart(i, e)}
                  title="드래그하여 순서 변경"
                  aria-label="드래그하여 순서 변경"
                >⠿</span>
                <select value={b.type} onChange={(e) => updateBlock(i, { type: e.target.value })}>
                  <option value="text">텍스트</option>
                  <option value="center">중앙 텍스트(한/영)</option>
                  <option value="label">라벨(Concept 등)</option>
                  <option value="features">특징 카드</option>
                  <option value="image">이미지</option>
                  <option value="video">영상</option>
                  <option value="divider">구분선</option>
                </select>
                </span>
                <span className="adm-block-actions">
                  <button type="button" className="adm-btn" onClick={() => moveBlock(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" className="adm-btn" onClick={() => moveBlock(i, 1)} disabled={i === form.blocks.length - 1}>↓</button>
                  <button type="button" className="adm-btn adm-btn-danger" onClick={() => removeBlock(i)}>삭제</button>
                </span>
              </div>
              {b.type === 'text' && (
                <>
                  <input placeholder="소제목 (선택)" value={b.heading || ''} onChange={(e) => updateBlock(i, { heading: e.target.value })} />
                  <textarea rows={4} placeholder="내용 (줄을 나누려면 | 로 구분)" value={b.body || ''} onChange={(e) => updateBlock(i, { body: e.target.value })} />
                  <span className="adm-hint">| 로 구분하면 각 항목이 줄(행)로 나뉘어 표시됩니다</span>
                </>
              )}
              {b.type === 'image' && (
                <>
                  <input type="file" accept="image/*" onChange={(e) => uploadBlockImage(i, e)} />
                  {b.media && <img className="adm-block-preview" src={b.media} alt="블록 이미지" />}
                  <input placeholder="캡션 (선택)" value={b.caption || ''} onChange={(e) => updateBlock(i, { caption: e.target.value })} />
                </>
              )}
              {b.type === 'video' && (
                <>
                  <input placeholder="YouTube 주소 또는 ID" value={b.media || ''} onChange={(e) => updateBlock(i, { media: e.target.value })} />
                  <input placeholder="캡션 (선택)" value={b.caption || ''} onChange={(e) => updateBlock(i, { caption: e.target.value })} />
                </>
              )}
              {b.type === 'center' && (
                <>
                  <input placeholder="제목" value={b.heading || ''} onChange={(e) => updateBlock(i, { heading: e.target.value })} />
                  <textarea rows={3} placeholder="한글 내용" value={b.body || ''} onChange={(e) => updateBlock(i, { body: e.target.value })} />
                  <textarea rows={3} placeholder="영문 내용 (선택)" value={b.bodyEn || ''} onChange={(e) => updateBlock(i, { bodyEn: e.target.value })} />
                </>
              )}
              {b.type === 'label' && (
                <input placeholder="라벨 텍스트 (예: Concept)" value={b.text || ''} onChange={(e) => updateBlock(i, { text: e.target.value })} />
              )}
              {b.type === 'features' && (
                <>
                  <textarea rows={4} placeholder={'한 줄에 한 항목, "한글 | 영문" 형식\n예) 각 칸마다 다른 테마 | Parallel episodes\n칸 안에서 줄바꿈은 / 로 구분'} value={b.body || ''} onChange={(e) => updateBlock(i, { body: e.target.value })} />
                  <span className="adm-hint">한 줄 = 한 열 · 형식: 한글 | 영문 · 칸 안 줄바꿈: /</span>
                </>
              )}
              {b.type === 'divider' && <span className="adm-hint">— 구분선 (이 지점에서 구역이 나뉘고, 구역별로 스크롤 효과가 적용됩니다) —</span>}
            </div>
          ))}
          <div className="adm-block-add">
            <button type="button" className="adm-btn" onClick={() => addBlock('text')}>+ 텍스트</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('center')}>+ 중앙텍스트</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('label')}>+ 라벨</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('features')}>+ 특징</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('image')}>+ 이미지</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('video')}>+ 영상</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('divider')}>+ 구분선</button>
          </div>
        </div>

        {msg && <p className="adm-err">{msg}</p>}
        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
          <button type="button" className="adm-btn" onClick={cancel}>취소</button>
        </div>
      </form>
    )
  }

  return (
    <>
      <button className="adm-btn adm-btn-primary" onClick={startNew}>+ 새 프로젝트</button>
      {rows.length > 1 && (
        <p className="adm-drag-hint">⠿ 행을 드래그해서 순서를 바꾸세요{savingOrder ? ' · 저장 중…' : ''}</p>
      )}
      {loading ? <p className="adm-muted">불러오는 중…</p> : (
        <ul className="adm-list">
          {rows.map((p, i) => (
            <li
              key={p.slug}
              className="adm-row"
              draggable
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={onDrop}
            >
              <span className="adm-drag" aria-hidden="true">⠿</span>
              <span className="adm-thumb" style={p.thumb ? { backgroundImage: `url(${p.thumb})` } : undefined} />
              <span className="adm-row-main">
                <span className="adm-row-title">{p.titleKo || p.titleEn}{p.titleKo && p.titleEn ? ` — ${p.titleEn}` : ''}</span>
                <span className="adm-row-meta">{p.client || catLabel(p.cat)} · {p.year || '연도 없음'} · /{p.slug}</span>
              </span>
              <span className="adm-row-actions">
                <button className="adm-btn" onClick={() => startEdit(p)}>수정</button>
                <button className="adm-btn adm-btn-danger" onClick={() => remove(p)}>삭제</button>
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="adm-muted">프로젝트가 없습니다.</li>}
        </ul>
      )}
      {msg && <p className="adm-err">{msg}</p>}
    </>
  )
}

/* ---------- CAREER 관리 ---------- */
const EMPTY_JOB = {
  id: '', cat: 'media-art', titleEn: '', titleKo: '', type: '', desc: '',
  headcount: '', responsibilities: '', qualifications: '', preferred: '', sort: 0,
}

function JobManager() {
  const [jobs, setJobs] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_JOB)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const isNew = editing === ''
  const idAuto = useMemo(() => slugify(form.id || form.titleEn), [form.id, form.titleEn])

  const refresh = () => listJobs().then(setJobs).catch((e) => setMsg('불러오기 실패: ' + e.message))
  useEffect(() => { refresh() }, [])

  function startNew() { setEditing(''); setForm(EMPTY_JOB); setMsg('') }
  function startEdit(j) { setEditing(j.id); setForm({ ...EMPTY_JOB, ...j }); setMsg('') }
  function cancel() { setEditing(null); setForm(EMPTY_JOB); setMsg('') }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    const id = idAuto
    if (!id || !form.titleEn.trim()) { setMsg('영문 직무명은 필수입니다.'); return }
    setBusy(true); setMsg('')
    const payload = { ...form, id, sort: Number(form.sort) || 0 }
    try {
      if (isNew) await createJob(payload)
      else await updateJob(editing, payload)
      await refresh()
      cancel()
    } catch (e2) {
      setMsg('저장 실패: ' + e2.message)
    } finally { setBusy(false) }
  }

  async function remove(j) {
    if (!window.confirm(`"${j.titleEn}" 공고를 삭제할까요?`)) return
    try { await deleteJob(j.id); await refresh() }
    catch (e2) { setMsg('삭제 실패: ' + e2.message) }
  }

  if (editing !== null) {
    return (
      <form className="adm-card adm-form" onSubmit={save}>
        <h2 className="adm-h2">{isNew ? '새 채용 공고' : '공고 수정'}</h2>

        <label>영문 직무명 *<input value={form.titleEn} onChange={set('titleEn')} placeholder="MEDIA ARTIST" required /></label>
        <label>한글 직무명<input value={form.titleKo} onChange={set('titleKo')} placeholder="미디어아트 콘텐츠 제작" /></label>

        <div className="adm-grid2">
          <label>카테고리
            <select value={form.cat} onChange={set('cat')}>
              {JOB_FORM_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </label>
          <label>정렬 순서<input type="number" value={form.sort} onChange={set('sort')} /></label>
        </div>

        <div className="adm-grid2">
          <label>식별자(id)<input value={form.id} onChange={set('id')} placeholder={idAuto} />
            <span className="adm-hint">{idAuto || '…'}</span></label>
          <label>고용형태 · 경력<input value={form.type} onChange={set('type')} placeholder="정규직 · 경력 2년 이상" /></label>
        </div>

        <label>소개(본문)<textarea rows={3} value={form.desc} onChange={set('desc')} placeholder="공고 상단 소개 문구" /></label>

        <label>모집인원<input value={form.headcount} onChange={set('headcount')} placeholder="0명(경력)" /></label>
        <label>담당업무<textarea rows={6} value={form.responsibilities} onChange={set('responsibilities')} placeholder="한 줄에 하나씩 입력" />
          <span className="adm-hint">한 줄 = 표의 한 항목 (– 자동)</span></label>
        <label>자격요건<textarea rows={5} value={form.qualifications} onChange={set('qualifications')} placeholder="한 줄에 하나씩 입력" /></label>
        <label>우대사항<textarea rows={5} value={form.preferred} onChange={set('preferred')} placeholder="한 줄에 하나씩 입력" /></label>

        {msg && <p className="adm-err">{msg}</p>}
        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
          <button type="button" className="adm-btn" onClick={cancel}>취소</button>
        </div>
      </form>
    )
  }

  return (
    <>
      <button className="adm-btn adm-btn-primary" onClick={startNew}>+ 새 채용 공고</button>
      {jobs === null ? <p className="adm-muted">불러오는 중…</p> : (
        <ul className="adm-list">
          {jobs.map((j) => (
            <li key={j.id} className="adm-row">
              <span className="adm-row-main">
                <span className="adm-row-title">{j.titleEn}{j.titleKo ? ` / ${j.titleKo}` : ''}</span>
                <span className="adm-row-meta">{jobCatLabel(j.cat)}{j.type ? ` · ${j.type}` : ''}</span>
              </span>
              <span className="adm-row-actions">
                <button className="adm-btn" onClick={() => startEdit(j)}>수정</button>
                <button className="adm-btn adm-btn-danger" onClick={() => remove(j)}>삭제</button>
              </span>
            </li>
          ))}
          {jobs.length === 0 && <li className="adm-muted">공고가 없습니다.</li>}
        </ul>
      )}
      {msg && <p className="adm-err">{msg}</p>}
    </>
  )
}

/* ---------- 공통 셸 ---------- */
function AdminShell({ children }) {
  return (
    <section id="admin">
      <div className="adm-wrap">
        <Link to="/" className="adm-home">← VIREN</Link>
        {children}
      </div>
    </section>
  )
}
