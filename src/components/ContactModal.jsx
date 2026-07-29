import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const EMAIL = 'virenmotion@viren.kr'
const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT || ''

/* 문의 유형 — 세부선택 단계 없이 선택 즉시 내용 작성으로 */
const TYPES = [
  { key: 'business', title: '신규 비즈니스', desc: '새로운 프로젝트 · 협업 문의' },
  { key: 'etc', title: '기타 문의', desc: '채용 · 입사문의 · 기타 일반 문의' },
]

const EMPTY = { name: '', email: '', phone: '', company: '', message: '', agree: false }

export default function ContactModal({ open, onClose }) {
  const [type, setType] = useState(null)          // 선택된 유형 (null=유형 선택 단계)
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)          // 첨부파일 (신규 비즈니스 전용)
  const [status, setStatus] = useState('idle')    // idle | sending | success | mailto | error
  const [errMsg, setErrMsg] = useState('')

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === 'agree' ? e.target.checked : e.target.value }))

  /* 열림/닫힘 시 초기화 + 바디 스크롤 잠금 + Esc 닫기 */
  useEffect(() => {
    if (!open) return
    setType(null); setForm(EMPTY); setFile(null); setStatus('idle'); setErrMsg('')
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus('error'); setErrMsg('필수 항목(이름·이메일·문의 내용)을 확인해 주세요.'); return
    }
    if (!form.agree) {
      setStatus('error'); setErrMsg('개인정보 수집·이용에 동의해 주세요.'); return
    }

    const hasFile = type.key === 'business' && file
    if (FORMSPREE_ENDPOINT) {
      setStatus('sending')
      try {
        let res
        if (hasFile) {
          // 파일 포함 — multipart/form-data (Content-Type 자동 설정)
          const fd = new FormData()
          fd.append('문의유형', type.title)
          Object.entries(form).forEach(([k, v]) => { if (k !== 'agree') fd.append(k, v) })
          fd.append('attachment', file)
          res = await fetch(FORMSPREE_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: fd })
        } else {
          res = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ 문의유형: type.title, ...form }),
          })
        }
        if (!res.ok) throw new Error()
        setStatus('success')
      } catch {
        setStatus('error'); setErrMsg('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } else {
      // 메일 앱 폴백 — 파일은 첨부 불가하므로 파일명만 안내
      const fileNote = hasFile ? `\n첨부파일: ${file.name} (메일에 직접 첨부해 주세요)` : ''
      const body =
        `[문의 유형] ${type.title}\n\n이름: ${form.name}\n이메일: ${form.email}\n연락처: ${form.phone}\n회사/단체: ${form.company}${fileNote}\n\n${form.message}`
      window.location.href =
        `mailto:${EMAIL}?subject=${encodeURIComponent(`[VIREN 문의] ${type.title} - ${form.name}`)}&body=${encodeURIComponent(body)}`
      setStatus('mailto')
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>

        {/* 1단계 — 유형 선택 */}
        {!type && (
          <>
            <h2 className="modal-title">문의하기</h2>
            <p className="modal-sub">문의 유형을 선택해 주세요.</p>
            <div className="type-list">
              {TYPES.map((t) => (
                <button key={t.key} className="type-card" onClick={() => { setType(t); if (t.key !== 'business') setFile(null) }}>
                  <span className="type-title">{t.title}</span>
                  <span className="type-desc">{t.desc}</span>
                  <span className="type-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* 2단계 — 내용 작성 */}
        {type && status === 'success' && (
          <div className="modal-done">
            <p className="modal-done-title">문의가 접수되었습니다.</p>
            <p className="modal-done-sub">확인 후 빠르게 연락드리겠습니다. 감사합니다.</p>
            <button type="button" className="btn" onClick={onClose}>닫기</button>
          </div>
        )}

        {type && status !== 'success' && (
          <form className="modal-form" onSubmit={submit} noValidate>
            <button type="button" className="modal-back" onClick={() => setType(null)}>← 유형 다시 선택</button>
            <p className="modal-badge">{type.title}</p>

            <div className="mf-row">
              <label className="mf-field"><span>이름 <em>*</em></span>
                <input value={form.name} onChange={set('name')} required /></label>
              <label className="mf-field"><span>이메일 <em>*</em></span>
                <input type="email" value={form.email} onChange={set('email')} required /></label>
            </div>
            <div className="mf-row">
              <label className="mf-field"><span>연락처</span>
                <input value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" /></label>
              <label className="mf-field"><span>회사 / 단체</span>
                <input value={form.company} onChange={set('company')} /></label>
            </div>
            {type.key === 'business' && (
              <label className="mf-field"><span>첨부파일</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.key,.zip,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file
                  ? <span className="mf-file">{file.name}
                      <button type="button" onClick={() => setFile(null)}>제거</button>
                    </span>
                  : <span className="mf-hint">PDF · 문서 · 이미지 · ZIP (제안서·레퍼런스 등)</span>}
              </label>
            )}

            <label className="mf-field"><span>문의 내용 <em>*</em></span>
              <textarea rows={6} value={form.message} onChange={set('message')} required /></label>

            <label className="mf-consent">
              <input type="checkbox" checked={form.agree} onChange={set('agree')} />
              <span>개인정보 수집·이용(문의 응대 목적)에 동의합니다.</span>
            </label>

            {status === 'error' && <p className="mf-msg mf-err">{errMsg}</p>}
            {status === 'mailto' && <p className="mf-msg">메일 앱이 열립니다. 내용을 확인하고 보내주세요.</p>}

            <button className="btn mf-submit" disabled={status === 'sending'}>
              {status === 'sending' ? '보내는 중…' : '문의 보내기'}
              <span className="btn-arrow" aria-hidden="true">↗</span>
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
