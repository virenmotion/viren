import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isConfigured } from '../lib/supabase'
import {
  signIn, signOut, getUser, onAuthChange,
  createProject, updateProject, deleteProject, uploadThumb,
} from '../lib/projectStore'
import { CATEGORIES, catLabel, slugify } from '../workProjects'
import { useProjects } from '../ProjectsContext'

const EMPTY = {
  slug: '', cat: 'media-art', kind: '',
  client: '', year: '', titleEn: '', titleKo: '',
  youtube: '', thumb: '', desc: '', sort: 0,
}

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

/* ---------- 대시보드 ---------- */
function Dashboard({ user }) {
  const { projects, loading, refresh } = useProjects()
  const [editing, setEditing] = useState(null) // 편집 중 원본 slug (null=미편집, ''=신규)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)

  const isNew = editing === ''
  const slugAuto = useMemo(() => slugify(form.slug || form.titleEn), [form.slug, form.titleEn])

  function startNew() { setEditing(''); setForm(EMPTY); setMsg('') }
  function startEdit(p) { setEditing(p.slug); setForm({ ...EMPTY, ...p }); setMsg('') }
  function cancel() { setEditing(null); setForm(EMPTY); setMsg('') }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

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
    if (!slug || !form.titleEn.trim()) { setMsg('영문 프로젝트명은 필수입니다.'); return }
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
    if (!window.confirm(`"${p.title}" 을(를) 삭제할까요?`)) return
    try { await deleteProject(p.slug); await refresh() }
    catch (e2) { setMsg('삭제 실패: ' + e2.message) }
  }

  return (
    <AdminShell>
      <div className="adm-top">
        <h1 className="adm-h1">WORK 관리</h1>
        <div className="adm-top-right">
          <span className="adm-muted">{user.email}</span>
          <button className="adm-btn" onClick={() => signOut()}>로그아웃</button>
        </div>
      </div>

      {editing === null ? (
        <>
          <button className="adm-btn adm-btn-primary" onClick={startNew}>+ 새 프로젝트</button>
          {loading ? <p className="adm-muted">불러오는 중…</p> : (
            <ul className="adm-list">
              {projects.map((p) => (
                <li key={p.slug} className="adm-row">
                  <span className="adm-thumb" style={p.thumb ? { backgroundImage: `url(${p.thumb})` } : undefined} />
                  <span className="adm-row-main">
                    <span className="adm-row-title">{p.titleEn}{p.titleKo ? ` — ${p.titleKo}` : ''}</span>
                    <span className="adm-row-meta">{p.client || catLabel(p.cat)} · {p.year || '연도 없음'} · /{p.slug}</span>
                  </span>
                  <span className="adm-row-actions">
                    <button className="adm-btn" onClick={() => startEdit(p)}>수정</button>
                    <button className="adm-btn adm-btn-danger" onClick={() => remove(p)}>삭제</button>
                  </span>
                </li>
              ))}
              {projects.length === 0 && <li className="adm-muted">프로젝트가 없습니다.</li>}
            </ul>
          )}
        </>
      ) : (
        <form className="adm-card adm-form" onSubmit={save}>
          <h2 className="adm-h2">{isNew ? '새 프로젝트' : '프로젝트 수정'}</h2>

          <div className="adm-grid2">
            <label>발주처명<input value={form.client} onChange={set('client')} placeholder="KAKAO" /></label>
            <label>사업연도<input value={form.year} onChange={set('year')} placeholder="2025.12" /></label>
          </div>

          <label>영문 프로젝트명 *<input value={form.titleEn} onChange={set('titleEn')} placeholder="SEOUL STATION KAKAO FRIENDS" required /></label>
          <label>한글 프로젝트명<input value={form.titleKo} onChange={set('titleKo')} placeholder="서울역 플랫폼111 산타프렌즈" /></label>

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
            <label>구분(태그)<input value={form.kind} onChange={set('kind')} placeholder="MEDIA FACADE / EXHIBITION …" /></label>
          </div>

          <label>YouTube ID<input value={form.youtube} onChange={set('youtube')} placeholder="aqz-KE-bpKQ" /></label>

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

          <label>본문<textarea rows={6} value={form.desc} onChange={set('desc')} /></label>

          {msg && <p className="adm-err">{msg}</p>}
          <div className="adm-form-actions">
            <button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
            <button type="button" className="adm-btn" onClick={cancel}>취소</button>
          </div>
        </form>
      )}
      {msg && editing === null && <p className="adm-err">{msg}</p>}
    </AdminShell>
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
