import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { isConfigured } from '../lib/supabase'
import {
  signIn, signOut, getUser, onAuthChange,
  createProject, updateProject, deleteProject, uploadThumb, reorderProjects,
  getCategories, saveCategories, getWhatWeDo, saveWhatWeDo,
  getBandWords, saveBandWords, uploadVideo, MAX_VIDEO_MB,
} from '../lib/projectStore'
import { inspectVideo, ffmpegHint, mbText, WARN_MBPS } from '../lib/mediaCompress'
import { listJobs, createJob, updateJob, deleteJob, getWorkConditions, saveWorkConditions } from '../lib/careerStore'
import { WORK_CONDITIONS } from '../careerJobs'
import { slugify, DEFAULT_CATEGORIES } from '../workProjects'
import { WWD_DEFAULT } from './WhatWeDo'
import { DEFAULT_BAND_WORDS } from './Band'
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

/* ---------- 대시보드 (탭: WHAT WE DO / WORK / PROJECT / CAREER / CONDITIONS) ---------- */
const ADMIN_TABS = [
  { key: 'band', label: 'MARQUEE' },
  { key: 'whatwedo', label: 'WHAT WE DO' },
  { key: 'work', label: 'WORK' },
  { key: 'project', label: 'PROJECT' },
  { key: 'career', label: 'CAREER' },
  { key: 'conditions', label: 'CONDITIONS' },
]
function Dashboard({ user }) {
  const [tab, setTab] = useState('project')
  return (
    <AdminShell>
      <div className="adm-top">
        <div className="adm-tabs">
          {ADMIN_TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : undefined} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="adm-top-right">
          <span className="adm-muted">{user.email}</span>
          <button className="adm-btn" onClick={() => signOut()}>로그아웃</button>
        </div>
      </div>
      {tab === 'band' && <BandManager />}
      {tab === 'whatwedo' && <WhatWeDoManager />}
      {tab === 'work' && <CategoryManager />}
      {tab === 'project' && <ProjectManager />}
      {tab === 'career' && <JobManager />}
      {tab === 'conditions' && <ConditionsManager />}
    </AdminShell>
  )
}

/* 편집 화면에서 브라우저 뒤로가기 → 목록으로.
   편집 화면은 라우트가 아니라 상태(editing)로만 전환되므로, 그대로 두면 뒤로가기가
   /admin 이전 페이지(대개 홈)로 나가버린다. 편집을 열 때 히스토리 항목을 하나 쌓고
   popstate에서 닫아, 뒤로가기가 목록으로 돌아오게 한다.
   ⚠️ StrictMode는 이펙트를 두 번 실행하므로 pushed ref로 중복 push를 막는다.
   (ref는 StrictMode 재실행 사이에도 유지된다) */
function useBackToList(open, onBack) {
  const cb = useRef(onBack)
  cb.current = onBack
  const pushed = useRef(false)

  useEffect(() => {
    if (!open) return
    if (!pushed.current) {
      window.history.pushState({ admEdit: true }, '')
      pushed.current = true
    }
    const onPop = () => { pushed.current = false; cb.current() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])

  /* 취소·저장 버튼으로 닫은 경우엔 쌓아둔 항목을 되돌려 히스토리가 늘어나지 않게 한다.
     뒤로가기로 닫혔다면 pushed가 이미 false라 아무것도 하지 않는다. */
  useEffect(() => {
    if (open || !pushed.current) return
    pushed.current = false
    if (window.history.state?.admEdit) window.history.back()
  }, [open])
}

/* ---------- WORK 관리 ---------- */
const EMPTY_PROJECT = {
  slug: '', cat: 'media-art',
  client: '', year: '', titleEn: '', titleKo: '',
  youtube: '', location: '', deliverables: '', thumb: '', desc: '', blocks: [], sort: 0,
}

function ProjectManager() {
  const { projects, loading, refresh, categories, catLabel } = useProjects()
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
  useBackToList(editing !== null, cancel) // 뒤로가기 → 프로젝트 목록
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
    try {
      const url = await uploadThumb(file, (r) =>
        setMsg(`이미지를 자동 압축했습니다 — ${mbText(r.before)} → ${mbText(r.after)}`))
      updateBlock(i, { media: url })
    }
    catch (e2) { setMsg('이미지 업로드 실패: ' + e2.message) }
    finally { e.target.value = '' }
  }
  const [videoUploading, setVideoUploading] = useState(-1) // 업로드 중인 블록 인덱스
  async function uploadBlockVideo(i, e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(''); setVideoUploading(i)
    try {
      /* 브라우저에서 영상을 재인코딩할 수는 없으니, 과한 비트레이트를 알려만 준다.
         960x600을 15.7Mbps로 올린 파일들 때문에 대역폭이 터진 적이 있다. */
      const info = await inspectVideo(file)
      const url = await uploadVideo(file)
      updateBlock(i, { media: url })
      if (info && info.mbps > WARN_MBPS) {
        setMsg(
          `올렸습니다. 다만 ${info.width}×${info.height} 영상이 ${Math.round(info.mbps)}Mbps로 과합니다 ` +
          `(${mbText(file.size)}). 화질 손실 없이 더 줄일 수 있습니다:
${ffmpegHint(file.name)}`)
      }
    }
    catch (e2) { setMsg('영상 업로드 실패: ' + e2.message) }
    finally { setVideoUploading(-1); e.target.value = '' }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMsg('')
    try {
      const url = await uploadThumb(file, (r) =>
        setMsg(`이미지를 자동 압축했습니다 — ${mbText(r.before)} → ${mbText(r.after)}`))
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
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}{c.hidden ? ' (숨김)' : ''}</option>)}
              {!categories.some((c) => c.slug === form.cat) && form.cat && <option value={form.cat}>{form.cat} (목록에 없음)</option>}
            </select>
          </label>
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
                  <option value="center">제목 + 좌/우 텍스트</option>
                  <option value="label">라벨(Concept 등)</option>
                  <option value="features">특징 카드</option>
                  <option value="specs">상세 항목(라벨/한/영)</option>
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
                  <label className="adm-hint" style={{ display: 'block' }}>
                    또는 영상 파일 직접 업로드 (mp4 · 최대 {MAX_VIDEO_MB}MB)
                    <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => uploadBlockVideo(i, e)} />
                  </label>
                  {videoUploading === i && <span className="adm-hint">업로드 중… (용량에 따라 시간이 걸립니다)</span>}
                  {/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(b.media || '') && (
                    <>
                      <video className="adm-block-preview" src={b.media} controls muted playsInline preload="metadata" />
                      <label className="adm-check">
                        <input type="checkbox" checked={!!b.loop} onChange={(e) => updateBlock(i, { loop: e.target.checked })} />
                        <span>소리 없이 자동 반복 재생 (컨트롤 숨김 — 짧은 클립용)</span>
                      </label>
                    </>
                  )}
                  <input placeholder="캡션 (선택)" value={b.caption || ''} onChange={(e) => updateBlock(i, { caption: e.target.value })} />
                  <span className="adm-hint">
                    유튜브 주소를 넣으면 임베드, 파일을 올리면 사이트에서 바로 재생됩니다.<br />
                    긴 영상은 저장공간·트래픽을 많이 쓰니 <strong>유튜브</strong>를, 몇 초짜리 짧은 클립은 <strong>직접 업로드</strong>를 권합니다.
                  </span>
                </>
              )}
              {b.type === 'center' && (
                <>
                  <input placeholder="제목 (가운데 표시)" value={b.heading || ''} onChange={(e) => updateBlock(i, { heading: e.target.value })} />
                  <textarea rows={3} placeholder={'왼쪽 텍스트 (좌측정렬)\n\nEnter를 치면 그 자리에서 줄이 바뀝니다\n예) TRACE OF TIME\n    — 풍경에 새겨진 시간'} value={b.body || ''} onChange={(e) => updateBlock(i, { body: e.target.value })} />
                  <textarea rows={5} placeholder={'오른쪽 텍스트 (우측정렬)\n\n빈 줄로 문단을 나누면 가로로 나란히 배치됩니다\n\n첫 번째 문단\n\n두 번째 문단\n\n세 번째 문단'} value={b.bodyEn || ''} onChange={(e) => updateBlock(i, { bodyEn: e.target.value })} />
                  <span className="adm-hint">
                    왼쪽·오른쪽 텍스트는 같은 높이에서 나란히 표시됩니다 (모바일에선 세로로 쌓임)<br />
                    · <strong>왼쪽</strong>: <strong>Enter</strong> = 줄바꿈. 안 넣으면 칸 너비에 맞춰 자동으로 끊깁니다<br />
                    · <strong>오른쪽</strong>: <strong>빈 줄</strong> = 문단 구분(문단이 가로로 나열) · <strong>Enter</strong> 한 번 = 문단 안 줄바꿈
                  </span>
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
              {b.type === 'specs' && (
                <>
                  <textarea rows={5} placeholder={'한 줄에 한 항목, "라벨 | 한글 | 영문" 형식\n예) Object | 서울역 플랫폼의 장소성을 해석 / 이동과 출발을 상징 | Interpreting Seoul Station. / Using objects of movement.\n칸 안에서 줄바꿈은 / 로 구분'} value={b.body || ''} onChange={(e) => updateBlock(i, { body: e.target.value })} />
                  <span className="adm-hint">한 줄 = 한 항목 · 형식: 라벨 | 한글 | 영문 · 칸 안 줄바꿈: / · 영문은 비워도 됩니다</span>
                </>
              )}
              {b.type === 'divider' && <span className="adm-hint">— 구분선 (이 지점에서 구역이 나뉘고, 구역별로 스크롤 효과가 적용됩니다) —</span>}
            </div>
          ))}
          <div className="adm-block-add">
            <button type="button" className="adm-btn" onClick={() => addBlock('text')}>+ 텍스트</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('center')}>+ 좌우텍스트</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('label')}>+ 라벨</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('features')}>+ 특징</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('specs')}>+ 상세항목</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('image')}>+ 이미지</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('video')}>+ 영상</button>
            <button type="button" className="adm-btn" onClick={() => addBlock('divider')}>+ 구분선</button>
          </div>
        </div>

        {msg && <p className={msg.includes('실패') ? 'adm-err' : 'adm-note'}>{msg}</p>}
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
  id: '', titleEn: '', titleKo: '', type: '', desc: '',
  headcount: '', responsibilities: '', qualifications: '', preferred: '', pinned: false, sort: 0,
}

/* 공지 판별 — 상단 고정 + 채용 상세(담당업무 등) 없음 */
const isNoticeLike = (j) => !!j.pinned && !j.type && !j.responsibilities && !j.qualifications && !j.preferred && !j.headcount

function JobManager() {
  const [jobs, setJobs] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_JOB)
  const [notice, setNotice] = useState(false) // 공지사항 간소 폼 여부
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const isNew = editing === ''
  const idAuto = useMemo(() => slugify(form.id || form.titleEn), [form.id, form.titleEn])

  const refresh = () => listJobs().then(setJobs).catch((e) => setMsg('불러오기 실패: ' + e.message))
  useEffect(() => { refresh() }, [])

  function startNew() { setEditing(''); setNotice(false); setForm(EMPTY_JOB); setMsg('') }
  function startNotice() { setEditing(''); setNotice(true); setForm({ ...EMPTY_JOB, pinned: true }); setMsg('') }
  function startEdit(j) { setEditing(j.id); setNotice(isNoticeLike(j)); setForm({ ...EMPTY_JOB, ...j }); setMsg('') }
  function cancel() { setEditing(null); setNotice(false); setForm(EMPTY_JOB); setMsg('') }
  useBackToList(editing !== null, cancel) // 뒤로가기 → 채용 공고 목록
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

  if (editing !== null && notice) {
    return (
      <form className="adm-card adm-form" onSubmit={save}>
        <h2 className="adm-h2">{isNew ? '새 공지사항' : '공지 수정'}</h2>
        <p className="adm-muted">공지사항은 목록 맨 위에 고정됩니다. 제목과 소개문구만 입력하세요.</p>
        <label>공지 제목 *<input value={form.titleEn} onChange={set('titleEn')} placeholder="2026 상반기 공개채용 안내" required /></label>
        <label>소개문구 (내용)<textarea rows={5} value={form.desc} onChange={set('desc')} placeholder="공지 내용을 입력하세요." />
          <span className="adm-hint">**강조**로 감싸면 노란색 강조글자가 됩니다. 줄바꿈은 그대로 반영됩니다.</span></label>
        {msg && <p className="adm-err">{msg}</p>}
        <div className="adm-form-actions">
          <button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
          <button type="button" className="adm-btn" onClick={cancel}>취소</button>
        </div>
      </form>
    )
  }

  if (editing !== null) {
    return (
      <form className="adm-card adm-form" onSubmit={save}>
        <h2 className="adm-h2">{isNew ? '새 채용 공고' : '공고 수정'}</h2>

        <label>영문 직무명 *<input value={form.titleEn} onChange={set('titleEn')} placeholder="MEDIA ARTIST" required /></label>
        <label>한글 직무명<input value={form.titleKo} onChange={set('titleKo')} placeholder="미디어아트 콘텐츠 제작" /></label>

        <div className="adm-grid2">
          <label>식별자(id)<input value={form.id} onChange={set('id')} placeholder={idAuto} />
            <span className="adm-hint">{idAuto || '…'}</span></label>
          <label>정렬 순서<input type="number" value={form.sort} onChange={set('sort')} /></label>
        </div>

        <label>고용형태 · 경력<input value={form.type} onChange={set('type')} placeholder="정규직 · 경력 2년 이상" /></label>

        <label className="adm-check">
          <input type="checkbox" checked={!!form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} />
          <span>상단 고정 (공지처럼 목록 맨 위에 표시)</span>
        </label>

        <label>소개(본문)<textarea rows={3} value={form.desc} onChange={set('desc')} placeholder="공고 상단 소개 문구" />
          <span className="adm-hint">**강조**로 감싸면 노란색 강조글자가 됩니다.</span></label>

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
      <div className="adm-newrow">
        <button className="adm-btn" onClick={startNotice}>+ 공지사항</button>
        <button className="adm-btn adm-btn-primary" onClick={startNew}>+ 새 채용 공고</button>
      </div>
      {jobs === null ? <p className="adm-muted">불러오는 중…</p> : (
        <ul className="adm-list">
          {jobs.map((j) => (
            <li key={j.id} className="adm-row">
              <span className="adm-row-main">
                <span className="adm-row-title">{j.pinned ? '📌 ' : ''}{j.titleEn}{j.titleKo ? ` / ${j.titleKo}` : ''}</span>
                <span className="adm-row-meta">{[j.pinned && '상단고정', j.type].filter(Boolean).join(' · ') || '—'}</span>
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

/* ---------- 근무조건(WORK CONDITIONS) 편집 ---------- */
const condToForm = (list) =>
  (list || []).map((c) => ({ label: c.label || '', body: Array.isArray(c.body) ? c.body.join('\n') : (c.body || '') }))

/* ---------- 홈 하단 마퀴 문구 관리 ---------- */
function BandManager() {
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getBandWords()
      .then((list) => setItems((list && list.length ? list : DEFAULT_BAND_WORDS).map((text) => ({ text }))))
      .catch(() => setItems(DEFAULT_BAND_WORDS.map((text) => ({ text }))))
  }, [])

  const update = (i, text) => setItems((a) => a.map((it, j) => (j === i ? { text } : it)))
  const add = () => setItems((a) => [...a, { text: '' }])
  const remove = (i) => setItems((a) => a.filter((_, j) => j !== i))
  const move = (i, dir) => setItems((a) => {
    const b = [...a]; const j = i + dir
    if (j < 0 || j >= b.length) return a;
    [b[i], b[j]] = [b[j], b[i]]; return b
  })

  async function save() {
    setBusy(true); setMsg('')
    try {
      const clean = items.map((c) => c.text.trim()).filter(Boolean)
      await saveBandWords(clean)
      setMsg('저장되었습니다. 홈 화면 마퀴에 반영됩니다.')
    } catch (e) { setMsg('저장 실패: ' + e.message) }
    finally { setBusy(false) }
  }

  if (items === null) return <div className="adm-card adm-card-gap"><p className="adm-muted">마퀴 문구 불러오는 중…</p></div>

  return (
    <div className="adm-card adm-card-gap">
      <h2 className="adm-h2">하단 마퀴 문구</h2>
      <p className="adm-muted">홈 화면 PHILOSOPHY 아래에 흐르는 문구입니다. 짝수 번째 항목(2, 4, 6…)은 외곽선 스타일로 표시됩니다. 기존 8개 문구가 아닌 새 문구는 외곽선 그래픽이 없어 일반 글자로만 표시됩니다 — 외곽선 효과가 필요하면 알려주세요.</p>
      {items.map((c, i) => (
        <div className="adm-block" key={i}>
          <div className="adm-block-head">
            <span className="adm-block-lead"><strong>{i + 1}</strong>{i % 2 ? ' · 외곽선' : ''}</span>
            <span className="adm-block-actions">
              <button type="button" className="adm-btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="adm-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              <button type="button" className="adm-btn adm-btn-danger" onClick={() => remove(i)}>삭제</button>
            </span>
          </div>
          <input value={c.text} onChange={(e) => update(i, e.target.value)} placeholder="예: MEDIA ART" />
        </div>
      ))}
      <div className="adm-block-add"><button type="button" className="adm-btn" onClick={add}>+ 문구 추가</button></div>
      {msg && <p className={msg.includes('실패') ? 'adm-err' : 'adm-muted'}>{msg}</p>}
      <div className="adm-form-actions">
        <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>{busy ? '저장 중…' : '마퀴 문구 저장'}</button>
      </div>
    </div>
  )
}

function ConditionsManager() {
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getWorkConditions()
      .then((c) => setItems(condToForm(c && c.length ? c : WORK_CONDITIONS)))
      .catch(() => setItems(condToForm(WORK_CONDITIONS)))
  }, [])

  const update = (i, patch) => setItems((a) => a.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const add = () => setItems((a) => [...a, { label: '', body: '' }])
  const remove = (i) => setItems((a) => a.filter((_, j) => j !== i))
  const move = (i, dir) => setItems((a) => {
    const b = [...a]; const j = i + dir
    if (j < 0 || j >= b.length) return a;
    [b[i], b[j]] = [b[j], b[i]]; return b
  })

  async function save() {
    setBusy(true); setMsg('')
    try {
      const clean = items.map((c) => ({ label: c.label.trim(), body: c.body })).filter((c) => c.label)
      await saveWorkConditions(clean)
      setMsg('저장되었습니다. CAREER 페이지에 반영됩니다.')
    } catch (e) { setMsg('저장 실패: ' + e.message) }
    finally { setBusy(false) }
  }

  if (items === null) return <div className="adm-card adm-card-gap"><p className="adm-muted">근무조건 불러오는 중…</p></div>

  return (
    <div className="adm-card adm-card-gap">
      <h2 className="adm-h2">근무조건 (WORK CONDITIONS)</h2>
      <p className="adm-muted">소제목은 한글, 내용은 한 줄에 하나씩(또는 / 로 구분) 입력하세요. CAREER에서 소제목 + 를 누르면 세부내용이 펼쳐집니다.</p>
      {items.map((c, i) => (
        <div className="adm-block" key={i}>
          <div className="adm-block-head">
            <span className="adm-block-lead"><strong>{i + 1}</strong></span>
            <span className="adm-block-actions">
              <button type="button" className="adm-btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="adm-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              <button type="button" className="adm-btn adm-btn-danger" onClick={() => remove(i)}>삭제</button>
            </span>
          </div>
          <input placeholder="소제목 (예: 근무지)" value={c.label} onChange={(e) => update(i, { label: e.target.value })} />
          <textarea rows={3} placeholder="세부내용 — 한 줄에 하나씩 (또는 / 로 줄바꿈)" value={c.body} onChange={(e) => update(i, { body: e.target.value })} />
        </div>
      ))}
      <div className="adm-block-add">
        <button type="button" className="adm-btn" onClick={add}>+ 항목 추가</button>
      </div>
      {msg && <p className={msg.includes('실패') ? 'adm-err' : 'adm-muted'}>{msg}</p>}
      <div className="adm-form-actions">
        <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>{busy ? '저장 중…' : '근무조건 저장'}</button>
      </div>
    </div>
  )
}

/* ---------- WORK 분야(카테고리) 관리 ---------- */
function CategoryManager() {
  const { refresh } = useProjects()
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getCategories()
      .then((c) => setItems((c && c.length ? c : DEFAULT_CATEGORIES).map((x) => ({ ...x }))))
      .catch(() => setItems(DEFAULT_CATEGORIES.map((x) => ({ ...x }))))
  }, [])

  const update = (i, patch) => setItems((a) => a.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const add = () => setItems((a) => [...a, { slug: '', label: '', hidden: false }])
  const remove = (i) => setItems((a) => a.filter((_, j) => j !== i))
  const move = (i, dir) => setItems((a) => { const b = [...a]; const j = i + dir; if (j < 0 || j >= b.length) return a;[b[i], b[j]] = [b[j], b[i]]; return b })

  async function save() {
    setBusy(true); setMsg('')
    try {
      const clean = items
        .map((c) => ({ label: (c.label || '').trim(), slug: (c.slug || slugify(c.label) || '').trim(), hidden: !!c.hidden }))
        .filter((c) => c.label && c.slug)
      await saveCategories(clean)
      await refresh()
      setMsg('저장되었습니다. WORK 필터에 반영됩니다.')
    } catch (e) { setMsg('저장 실패: ' + e.message) }
    finally { setBusy(false) }
  }

  if (items === null) return <div className="adm-card adm-card-gap"><p className="adm-muted">분야 불러오는 중…</p></div>

  return (
    <div className="adm-card adm-card-gap">
      <h2 className="adm-h2">WORK 분야(카테고리) 관리</h2>
      <p className="adm-muted">WORK 페이지 상단 필터 탭입니다. 숨기면 필터에서 사라지지만 기존 프로젝트는 유지됩니다. (‘전체’는 자동)</p>
      {items.map((c, i) => (
        <div className="adm-block" key={i}>
          <div className="adm-block-head">
            <span className="adm-block-lead"><strong>{i + 1}</strong></span>
            <span className="adm-block-actions">
              <button type="button" className="adm-btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="adm-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              <button type="button" className="adm-btn adm-btn-danger" onClick={() => remove(i)}>삭제</button>
            </span>
          </div>
          <div className="adm-grid2">
            <label>표시명<input value={c.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="MEDIA ART" /></label>
            <label>식별자(slug)<input value={c.slug} onChange={(e) => update(i, { slug: e.target.value })} placeholder={slugify(c.label) || 'media-art'} /></label>
          </div>
          <label className="adm-check">
            <input type="checkbox" checked={!!c.hidden} onChange={(e) => update(i, { hidden: e.target.checked })} />
            <span>숨기기 (WORK 필터에서 감춤)</span>
          </label>
        </div>
      ))}
      <div className="adm-block-add"><button type="button" className="adm-btn" onClick={add}>+ 분야 추가</button></div>
      {msg && <p className={msg.includes('실패') ? 'adm-err' : 'adm-muted'}>{msg}</p>}
      <div className="adm-form-actions">
        <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>{busy ? '저장 중…' : '분야 저장'}</button>
      </div>
    </div>
  )
}

/* ---------- WHAT WE DO 관리 (WORK와 무관, 항목별 페이지 링크) ---------- */
function WhatWeDoManager() {
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getWhatWeDo()
      .then((v) => setItems((v && v.length ? v : WWD_DEFAULT).map((x) => ({ ...x }))))
      .catch(() => setItems(WWD_DEFAULT.map((x) => ({ ...x }))))
  }, [])

  const update = (i, patch) => setItems((a) => a.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const add = () => setItems((a) => [...a, { label: '', desc: '', link: '', hidden: false }])
  const remove = (i) => setItems((a) => a.filter((_, j) => j !== i))
  const move = (i, dir) => setItems((a) => { const b = [...a]; const j = i + dir; if (j < 0 || j >= b.length) return a;[b[i], b[j]] = [b[j], b[i]]; return b })

  async function save() {
    setBusy(true); setMsg('')
    try {
      const clean = items
        .map((s) => ({ label: (s.label || '').trim(), desc: (s.desc || '').trim(), link: (s.link || '').trim(), hidden: !!s.hidden }))
        .filter((s) => s.label)
      await saveWhatWeDo(clean)
      setMsg('저장되었습니다. 메인 WHAT WE DO에 반영됩니다.')
    } catch (e) { setMsg('저장 실패: ' + e.message) }
    finally { setBusy(false) }
  }

  if (items === null) return <div className="adm-card"><p className="adm-muted">WHAT WE DO 불러오는 중…</p></div>

  return (
    <div className="adm-card">
      <h2 className="adm-h2">WHAT WE DO (메인)</h2>
      <p className="adm-muted">메인 WHAT WE DO 목록입니다. WORK 분야와 무관하게 자유롭게 추가하고, 링크에 이동할 페이지를 넣으세요. (예: <code>/work#media-art</code>, <code>/contact</code>, <code>https://…</code> · 비우면 클릭 불가)</p>
      {items.map((s, i) => (
        <div className="adm-block" key={i}>
          <div className="adm-block-head">
            <span className="adm-block-lead"><strong>{String(i + 1).padStart(2, '0')}</strong></span>
            <span className="adm-block-actions">
              <button type="button" className="adm-btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="adm-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              <button type="button" className="adm-btn adm-btn-danger" onClick={() => remove(i)}>삭제</button>
            </span>
          </div>
          <input placeholder="제목 (예: MEDIA ART)" value={s.label} onChange={(e) => update(i, { label: e.target.value })} />
          <input placeholder="설명" value={s.desc} onChange={(e) => update(i, { desc: e.target.value })} />
          <input placeholder="링크 (예: /work#media-art · /contact · https://… · 비우면 링크 없음)" value={s.link} onChange={(e) => update(i, { link: e.target.value })} />
          <label className="adm-check">
            <input type="checkbox" checked={!!s.hidden} onChange={(e) => update(i, { hidden: e.target.checked })} />
            <span>숨기기</span>
          </label>
        </div>
      ))}
      <div className="adm-block-add"><button type="button" className="adm-btn" onClick={add}>+ 항목 추가</button></div>
      {msg && <p className={msg.includes('실패') ? 'adm-err' : 'adm-muted'}>{msg}</p>}
      <div className="adm-form-actions">
        <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>{busy ? '저장 중…' : 'WHAT WE DO 저장'}</button>
      </div>
    </div>
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
