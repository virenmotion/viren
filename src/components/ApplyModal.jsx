import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const APPLY_EMAIL = 'virenmotion@viren.kr'
const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT || ''

const EMPTY = { name: '', email: '', phone: '', portfolio: '', message: '', agree: false }

/* 채용 지원 팝업 — CONTACT 모달과 동일한 구조/스타일. job=지원 대상 공고 */
export default function ApplyModal({ open, job, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | sending | success | mailto | error
  const [errMsg, setErrMsg] = useState('')

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === 'agree' ? e.target.checked : e.target.value }))

  useEffect(() => {
    if (!open) return
    setForm(EMPTY); setFile(null); setStatus('idle'); setErrMsg('')
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null
  const position = job ? (job.titleEn || job.titleKo || '') : ''

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setStatus('error'); setErrMsg('필수 항목(이름·이메일)을 확인해 주세요.'); return
    }
    if (!form.agree) {
      setStatus('error'); setErrMsg('개인정보 수집·이용에 동의해 주세요.'); return
    }

    if (FORMSPREE_ENDPOINT) {
      setStatus('sending')
      try {
        let res
        if (file) {
          const fd = new FormData()
          fd.append('지원포지션', position)
          Object.entries(form).forEach(([k, v]) => { if (k !== 'agree') fd.append(k, v) })
          fd.append('attachment', file)
          res = await fetch(FORMSPREE_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: fd })
        } else {
          res = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ 지원포지션: position, ...form }),
          })
        }
        if (!res.ok) throw new Error()
        setStatus('success')
      } catch {
        setStatus('error'); setErrMsg('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } else {
      const fileNote = file ? `\n첨부파일: ${file.name} (메일에 직접 첨부해 주세요)` : ''
      const body =
        `[지원 포지션] ${position}\n\n이름: ${form.name}\n이메일: ${form.email}\n연락처: ${form.phone}\n포트폴리오: ${form.portfolio}${fileNote}\n\n${form.message}`
      window.location.href =
        `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent(`[VIREN 지원] ${position} - ${form.name}`)}&body=${encodeURIComponent(body)}`
      setStatus('mailto')
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>

        {status === 'success' ? (
          <div className="modal-done">
            <p className="modal-done-title">지원이 접수되었습니다.</p>
            <p className="modal-done-sub">확인 후 빠르게 연락드리겠습니다. 감사합니다.</p>
            <button type="button" className="btn" onClick={onClose}>닫기</button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={submit} noValidate>
            <h2 className="modal-title">지원하기</h2>
            {position && <p className="modal-badge">{position}</p>}

            <div className="mf-row">
              <label className="mf-field"><span>이름 <em>*</em></span>
                <input value={form.name} onChange={set('name')} required /></label>
              <label className="mf-field"><span>이메일 <em>*</em></span>
                <input type="email" value={form.email} onChange={set('email')} required /></label>
            </div>
            <div className="mf-row">
              <label className="mf-field"><span>연락처</span>
                <input value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" /></label>
              <label className="mf-field"><span>포트폴리오 링크</span>
                <input value={form.portfolio} onChange={set('portfolio')} placeholder="https://…" /></label>
            </div>

            <label className="mf-field"><span>지원서 · 포트폴리오 첨부</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.hwp,.ppt,.pptx,.key,.zip,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file
                ? <span className="mf-file">{file.name}
                    <button type="button" onClick={() => setFile(null)}>제거</button>
                  </span>
                : <span className="mf-hint">지원서 양식 · 포트폴리오 (PDF · 문서 · ZIP)</span>}
            </label>

            <label className="mf-field"><span>지원 동기 · 남길 말</span>
              <textarea rows={5} value={form.message} onChange={set('message')} /></label>

            <label className="mf-consent">
              <input type="checkbox" checked={form.agree} onChange={set('agree')} />
              <span>개인정보 수집·이용(채용 전형 목적)에 동의합니다.</span>
            </label>

            {status === 'error' && <p className="mf-msg mf-err">{errMsg}</p>}
            {status === 'mailto' && <p className="mf-msg">메일 앱이 열립니다. 내용을 확인하고 보내주세요.</p>}

            <button className="btn mf-submit" disabled={status === 'sending'}>
              {status === 'sending' ? '보내는 중…' : '지원서 보내기'}
              <span className="btn-arrow" aria-hidden="true">↗</span>
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
