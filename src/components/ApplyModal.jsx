import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sendMail, fitsUpload } from '../lib/sendForm'
import MailFallback from './MailFallback'

const APPLY_EMAIL = 'viren@viren.kr'

const EMPTY = { name: '', email: '', phone: '', agree: false }

/* 채용 지원 팝업 — CONTACT 모달과 동일한 구조/스타일. job=지원 대상 공고 */
export default function ApplyModal({ open, job, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [files, setFiles] = useState([]) // 여러 파일 첨부
  const [status, setStatus] = useState('idle') // idle | sending | success | mailto | error
  const [errMsg, setErrMsg] = useState('')
  const fileRef = useRef(null)

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    if (picked.length) setFiles((prev) => [...prev, ...picked])
    e.target.value = '' // 같은 파일 다시 선택 가능
  }
  const removeFile = (i) => setFiles((prev) => prev.filter((_, j) => j !== i))

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === 'agree' ? e.target.checked : e.target.value }))

  useEffect(() => {
    if (!open) return
    setForm(EMPTY); setFiles([]); setStatus('idle'); setErrMsg('')
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

    /* 메일 앱으로 보내기 — 파일은 붙일 수 없어 파일명만 알려준다 */
    const sendByMail = () => {
      const fileNote = files.length ? `\n첨부파일: ${files.map((f) => f.name).join(', ')} (메일에 직접 첨부해 주세요)` : ''
      const body =
        `[지원 포지션] ${position}\n\n이름: ${form.name}\n이메일: ${form.email}\n연락처: ${form.phone}${fileNote}`
      window.location.href =
        `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent(`[VIREN 지원] ${position} - ${form.name}`)}&body=${encodeURIComponent(body)}`
      setStatus('mailto')
    }

    /* 첨부 합계가 서버 한도(4.5MB)를 넘으면 보내봐야 실패한다 → 바로 메일 앱으로 */
    if (files.length && !fitsUpload(files)) { sendByMail(); return }

    setStatus('sending')
    const ok = await sendMail({
      subject: `[VIREN 지원] ${position} - ${form.name}`,
      title: `${position} 지원`,
      replyTo: form.email,
      fields: {
        '지원 포지션': position,
        이름: form.name, 이메일: form.email, 연락처: form.phone,
        첨부: files.map((f) => f.name).join(', '),
      },
      files,
    })
    /* 발송 실패(설정 전·네트워크 오류 등) — 지원이 사라지지 않게 메일 앱으로 넘긴다 */
    if (ok) setStatus('success'); else sendByMail()
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
            <label className="mf-field"><span>연락처</span>
              <input value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" /></label>

            <div className="mf-field"><span>지원서 · 포트폴리오 첨부</span>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.hwp,.ppt,.pptx,.key,.zip,image/*"
                style={{ display: 'none' }}
                onChange={addFiles}
              />
              {files.length > 0 && (
                <ul className="mf-filelist">
                  {files.map((f, i) => (
                    <li key={i}><span>{f.name}</span>
                      <button type="button" onClick={() => removeFile(i)} aria-label="제거">✕</button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="mf-addfile" onClick={() => fileRef.current?.click()}>
                <span aria-hidden="true">+</span> 파일 추가
              </button>
              <span className="mf-hint">지원서 양식 · 포트폴리오 (PDF · 문서 · 이미지 · ZIP) — 여러 개 첨부 가능</span>
            </div>

            <label className="mf-consent">
              <input type="checkbox" checked={form.agree} onChange={set('agree')} />
              <span>개인정보 수집·이용(채용 전형 목적)에 동의합니다.</span>
            </label>
            {/* 동의를 받을 때 알려야 하는 것들 — 항목·목적·기간·거부할 권리.
                CAREER 페이지 아래에도 적혀 있지만, 이 창이 페이지를 덮으므로
                체크하는 자리에서 보이도록 여기에도 둔다. (2026-11-19) */}
            <p className="mf-consent-detail">
              <b>수집 항목</b> 이름 · 이메일 · 연락처 · 첨부 서류(지원서 · 포트폴리오)<br />
              <b>이용 목적</b> 채용 전형 진행과 결과 안내<br />
              <b>보관 기간</b> 등록일로부터 1년, 이후 안전하게 파기<br />
              동의하지 않으셔도 되지만, 그 경우 지원 접수가 어렵습니다.
            </p>

            {status === 'error' && <p className="mf-msg mf-err">{errMsg}</p>}
            {status === 'mailto' && <MailFallback email={APPLY_EMAIL} />}

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
