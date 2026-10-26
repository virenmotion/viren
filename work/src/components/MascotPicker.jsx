import { useEffect, useRef, useState } from 'react'
import { mascotAssets } from '../lib/mascot'
import './mascot.css'

/* 바이렌 마스코트 스티커 고르기. (2026-10-26)
   글 쓰는 칸 왼쪽의 웃는 얼굴을 누르면 입력칸 **위로** 판이 뜬다. */

export function MascotImage({ asset, preview = false }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [asset.id])
  // 그림을 못 불러와도 무슨 스티커였는지는 글로 남는다
  if (failed) return <span className="mascot-fallback">바이렌 {asset.label}</span>
  return (
    <img
      className={`mascot-image${preview ? ' preview' : ''}`}
      src={asset.src} alt={`바이렌 스티커: ${asset.label}`} title={asset.label}
      loading="lazy" decoding="async" onError={() => setFailed(true)}
    />
  )
}

export default function MascotPicker({ busy, onSend }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef(null)
  const panel = useRef(null)

  const close = () => { setOpen(false); trigger.current?.focus() }
  useEffect(() => { if (open) panel.current?.focus() }, [open])

  /* 판 밖을 누르면 닫는다 */
  useEffect(() => {
    if (!open) return
    const away = (e) => {
      if (panel.current?.contains(e.target) || trigger.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  async function send(asset) {
    if (busy) return
    if (await onSend(asset.id)) close()
  }

  return (
    <>
      <button
        ref={trigger} type="button" className="btn icon-btn" disabled={busy}
        aria-expanded={open} aria-controls="mascot-picker" aria-label="스티커 보내기" title="스티커"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"
          fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
          <path d="M9 9.5v.01M15 9.5v.01" />
        </svg>
      </button>

      {open && (
        <section
          id="mascot-picker" ref={panel} tabIndex={-1} className="mascot-picker"
          aria-label="바이렌 스티커 고르기"
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}
        >
          <div className="mascot-heading">
            <strong>바이렌 스티커</strong>
            <button type="button" className="btn small-btn" onClick={close}>닫기</button>
          </div>
          <div className="mascot-grid">
            {mascotAssets.map((a) => (
              <button
                key={a.id} type="button" className="mascot-choice" disabled={busy}
                aria-label={`${a.label} 보내기`} onClick={() => send(a)}
              >
                <MascotImage asset={a} preview />
                <span>{a.label}</span>
              </button>
            ))}
          </div>
          <p className="hint">누르면 바로 보내요.</p>
        </section>
      )}
    </>
  )
}
