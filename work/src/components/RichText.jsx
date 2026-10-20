import { useEffect, useRef, useState } from 'react'
import { cleanHtml } from '../lib/sanitize'

/* 본문 편집기 — 굵게 · 기울임 · 밑줄 · 목록 · 표.
 *
 * ⚠️ `document.execCommand` 는 낡은 방법이라고 표시돼 있지만 **지금도 모든 브라우저에서
 *    동작하고**, 이것 말고 직접 만들려면 편집기 엔진을 통째로 들여야 한다(수백 KB).
 *    3~6명 쓰는 사내 도구에 그만한 무게를 얹지 않기로 했다. 언젠가 브라우저가 정말
 *    빼면 그때 TipTap 같은 걸 붙인다.
 *
 * ⚠️ 붙여넣기는 **반드시 걸러서** 넣는다(sanitize.js). 워드·웹페이지에서 복사하면
 *    스타일과 스크립트가 통째로 딸려 온다.
 */

const cmd = (name, arg) => { document.execCommand(name, false, arg) }

function tableHtml(rows, cols) {
  const td = '<td><br></td>'.repeat(cols)
  const th = '<th><br></th>'.repeat(cols)
  const body = `<tr>${td}</tr>`.repeat(Math.max(0, rows - 1))
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table><p><br></p>`
}

/* 지금 커서가 들어 있는 요소 찾기 */
function closestFromSelection(tag, root) {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  let n = sel.getRangeAt(0).startContainer
  if (n.nodeType === 3) n = n.parentNode
  const el = n.closest?.(tag)
  return el && root.contains(el) ? el : null
}

export default function RichText({ value, onChange, placeholder = '' }) {
  const ref = useRef(null)
  const [tableOpen, setTableOpen] = useState(false)
  const [size, setSize] = useState({ rows: 3, cols: 3 })

  /* 값은 처음 한 번만 넣는다. 글자를 칠 때마다 다시 넣으면 커서가 맨 앞으로 튄다. */
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fire = () => onChange(ref.current?.innerHTML || '')

  function run(fn) {
    ref.current?.focus()
    fn()
    fire()
  }

  function onPaste(e) {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    if (html) cmd('insertHTML', cleanHtml(html))
    else cmd('insertText', text)
    fire()
  }

  function addRow() {
    const tr = closestFromSelection('tr', ref.current)
    if (!tr) return window.alert('표 안에 커서를 두고 눌러 주세요.')
    const copy = tr.cloneNode(true)
    copy.querySelectorAll('td,th').forEach((c) => { c.innerHTML = '<br>' })
    tr.parentNode.insertBefore(copy, tr.nextSibling)
    fire()
  }

  function delRow() {
    const tr = closestFromSelection('tr', ref.current)
    if (!tr) return window.alert('표 안에 커서를 두고 눌러 주세요.')
    const table = tr.closest('table')
    if (table && table.querySelectorAll('tr').length <= 1) table.remove()
    else tr.remove()
    fire()
  }

  const B = ({ on, children, title }) => (
    <button type="button" className="rt-btn" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={on}>{children}</button>
  )

  return (
    <div className="rt">
      <div className="rt-bar">
        <B title="굵게" on={() => run(() => cmd('bold'))}><strong>가</strong></B>
        <B title="기울임" on={() => run(() => cmd('italic'))}><em>가</em></B>
        <B title="밑줄" on={() => run(() => cmd('underline'))}><u>가</u></B>
        <span className="rt-sep" />
        <B title="글머리 기호" on={() => run(() => cmd('insertUnorderedList'))}>• 목록</B>
        <B title="번호 목록" on={() => run(() => cmd('insertOrderedList'))}>1. 목록</B>
        <span className="rt-sep" />
        <B title="왼쪽 정렬" on={() => run(() => cmd('justifyLeft'))}>⟸</B>
        <B title="가운데 정렬" on={() => run(() => cmd('justifyCenter'))}>⟺</B>
        <B title="오른쪽 정렬" on={() => run(() => cmd('justifyRight'))}>⟹</B>
        <span className="rt-sep" />
        <B title="표 넣기" on={() => setTableOpen(!tableOpen)}>표 넣기</B>
        <B title="표에 줄 추가" on={() => run(addRow)}>줄 추가</B>
        <B title="표에서 줄 삭제" on={() => run(delRow)}>줄 삭제</B>
        <span className="rt-sep" />
        <B title="서식 지우기" on={() => run(() => cmd('removeFormat'))}>서식 지우기</B>
      </div>

      {tableOpen && (
        <div className="rt-table-add">
          <label className="field inline"><span>줄</span>
            <input type="number" min="1" max="30" value={size.rows} onChange={(e) => setSize({ ...size, rows: Number(e.target.value) })} /></label>
          <label className="field inline"><span>칸</span>
            <input type="number" min="1" max="10" value={size.cols} onChange={(e) => setSize({ ...size, cols: Number(e.target.value) })} /></label>
          <button type="button" className="btn small-btn primary" onClick={() => {
            run(() => cmd('insertHTML', tableHtml(Math.min(30, Math.max(1, size.rows)), Math.min(10, Math.max(1, size.cols)))))
            setTableOpen(false)
          }}>넣기</button>
          <button type="button" className="btn small-btn" onClick={() => setTableOpen(false)}>취소</button>
        </div>
      )}

      <div
        ref={ref}
        className="rt-body"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="본문"
        data-placeholder={placeholder}
        onInput={fire}
        onBlur={() => { if (ref.current) { ref.current.innerHTML = cleanHtml(ref.current.innerHTML); fire() } }}
        onPaste={onPaste}
      />
    </div>
  )
}

/* 읽기 전용 — 보여줄 때도 한 번 더 거른다 */
export function RichTextView({ html, className = 'rt-view' }) {
  if (!html) return null
  return <div className={className} dangerouslySetInnerHTML={{ __html: cleanHtml(html) }} />
}
