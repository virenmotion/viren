/* 본문 편집기에서 들어온 HTML 을 걸러낸다.
 *
 * 왜 필요한가
 *   본문은 HTML 로 저장되고, 문서를 보는 쪽에서 그대로 그린다. 거르지 않으면
 *   누군가 붙여넣기 한 줄로 **다른 직원 화면에서 스크립트를 돌릴 수 있다**(XSS).
 *   재직자만 글을 쓸 수 있다고 해도, 한 명만 실수로 이상한 걸 붙여넣으면 끝이다.
 *
 * 원칙
 *   · **허용 목록 방식.** 아는 태그만 남기고 나머지는 전부 버린다.
 *   · **속성은 거의 다 버린다.** 표 병합(colspan·rowspan)과 가운데/오른쪽 정렬만 남긴다.
 *     그래서 href·src·style·on* 같은 건 아예 들어올 수 없다. 링크와 이미지도 안 된다
 *     (필요하면 파일첨부를 쓴다).
 *   · **저장할 때와 보여줄 때 두 번 거른다.** 예전에 저장된 글이 있어도 안전하도록.
 */

const KEEP = new Set([
  'p', 'br', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'h3', 'h4', 'blockquote', 'hr',
])

/* 통째로 버리는 것 — 속을 펼치지도 않는다 */
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'noscript', 'template'])

const ALIGN = /^(left|center|right)$/

function cleanEl(el) {
  const tag = el.tagName.toLowerCase()

  if (DROP.has(tag)) { el.remove(); return }

  if (!KEEP.has(tag)) {
    /* 모르는 태그는 껍데기만 벗기고 안의 글은 살린다 */
    const parent = el.parentNode
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    el.remove()
    return
  }

  /* 속성 털기 — 남길 것만 다시 붙인다 */
  const colspan = (tag === 'td' || tag === 'th') ? el.getAttribute('colspan') : null
  const rowspan = (tag === 'td' || tag === 'th') ? el.getAttribute('rowspan') : null
  const align = (el.getAttribute('style') || '').match(/text-align:\s*([a-z]+)/i)?.[1]
  for (const name of [...el.getAttributeNames()]) el.removeAttribute(name)

  const num = (v) => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n > 1 && n <= 30 ? String(n) : null
  }
  if (colspan && num(colspan)) el.setAttribute('colspan', num(colspan))
  if (rowspan && num(rowspan)) el.setAttribute('rowspan', num(rowspan))
  if (align && ALIGN.test(align)) el.setAttribute('style', `text-align:${align.toLowerCase()}`)
}

/* HTML 문자열 → 걸러낸 HTML 문자열 */
export function cleanHtml(html) {
  if (!html || typeof html !== 'string') return ''
  if (typeof DOMParser === 'undefined') return '' // 서버에서 부를 일은 없지만 방어
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

  /* 뒤에서부터 훑는다. 중간에 지우거나 펼쳐도 순서가 꼬이지 않게. */
  const all = [...doc.body.querySelectorAll('*')]
  for (let i = all.length - 1; i >= 0; i--) {
    const el = all[i]
    if (el.isConnected) cleanEl(el)
  }

  /* 주석 제거 */
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT)
  const comments = []
  while (walker.nextNode()) comments.push(walker.currentNode)
  comments.forEach((c) => c.remove())

  return doc.body.innerHTML.trim()
}

/* 내용이 실제로 있는지 (빈 <p><br></p> 같은 건 비어 있는 것으로 본다) */
export function htmlIsEmpty(html) {
  if (!html) return true
  if (/<(table|img|hr)\b/i.test(html)) return false
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}

/* 목록·검색에 쓸 민글자 */
export function htmlToText(html, max = 200) {
  const t = String(html || '').replace(/<\/(p|div|tr|li|h3|h4)>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}
