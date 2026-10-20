/* 직접 만든 양식의 '칸' 종류.
 *
 * 양식 한 개 = doc_forms 행 하나. 칸 구성은 fields(jsonb 배열)에 들어간다.
 *   { key, type, label, required, half, max, rows, unit, options, html,
 *     columns: [{ key, label, type, options }], total }
 *
 * key 는 저장된 문서가 칸을 찾는 열쇠다. **한 번 만든 칸의 key 는 바꾸지 않는다.**
 * 바꾸면 이미 올라간 문서에서 그 칸 값이 사라진 것처럼 보인다(값은 DB 에 남아 있다).
 */

export const FIELD_TYPES = {
  text: { label: '한 줄 글', hint: '사업명, 계약명처럼 짧은 글' },
  textarea: { label: '여러 줄 글', hint: '사유, 목적처럼 긴 글' },
  rich: { label: '본문 (편집기)', hint: '굵게·표까지 되는 본문. 기본 문구를 미리 넣어 둘 수 있다' },
  date: { label: '날짜', hint: '' },
  datetime: { label: '날짜 + 시각', hint: '연차휴가원처럼 시각까지 받을 때' },
  number: { label: '숫자', hint: '단위를 붙일 수 있다 (예: 일, 개)' },
  money: { label: '금액', hint: '1,200,000원 처럼 보여 준다' },
  select: { label: '고르기', hint: '정해 둔 것 중에서 하나' },
  member: { label: '직원 고르기', hint: '재직 중인 직원 목록에서' },
  dept: { label: '부서', hint: '직원들이 쓰는 부서 이름 중에서' },
  table: { label: '표 (줄 추가)', hint: '지출 내역처럼 줄을 늘려 쓰는 표. 금액 칸은 합계가 나온다' },
  divider: { label: '구분선 · 소제목', hint: '칸 사이를 나눈다' },
}

/* 표 안에서 쓸 수 있는 칸 종류 */
export const COLUMN_TYPES = {
  text: '글',
  number: '숫자',
  money: '금액',
  date: '날짜',
  select: '고르기',
  member: '직원',
}

export const INPUT_TYPES = Object.keys(FIELD_TYPES).filter((t) => t !== 'divider')

/* 값이 없을 때의 기본값 */
export function emptyValue(f) {
  if (f.type === 'table') return [emptyRow(f)]
  if (f.type === 'rich') return f.html || ''
  if (f.type === 'member' && f.multi) return []
  return ''
}

export const emptyRow = (f) =>
  Object.fromEntries((f.columns || []).map((c) => [c.key, '']))

/* 필수인데 비었는지 */
export function isBlank(f, v) {
  if (f.type === 'table') {
    const rows = Array.isArray(v) ? v : []
    return !rows.some((r) => (f.columns || []).some((c) => String(r?.[c.key] ?? '').trim() !== ''))
  }
  if (f.type === 'rich') {
    return String(v || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '' && !/<(table|hr)\b/i.test(v || '')
  }
  if (Array.isArray(v)) return v.length === 0
  return String(v ?? '').trim() === ''
}

/* 화면에 뜨는 안내문. 저장 전에 화면에서 검사한다(서버는 양식 존재 여부만 본다). */
export function firstMissing(fields, values) {
  for (const f of fields || []) {
    if (f.type === 'divider' || !f.required) continue
    if (isBlank(f, values?.[f.key])) return f
  }
  return null
}

/* 표의 합계 */
export function tableTotal(f, rows) {
  if (!f.total) return null
  return (Array.isArray(rows) ? rows : []).reduce((a, r) => a + (Number(String(r?.[f.total] ?? '').replace(/[^0-9.-]/g, '')) || 0), 0)
}

/* 새 칸 만들 때의 기본 모양 */
export function newField(type, n) {
  const f = { key: `f${Date.now().toString(36)}${n}`, type, label: FIELD_TYPES[type]?.label || '새 칸', required: false }
  if (type === 'select') f.options = ['']
  if (type === 'textarea') f.rows = 4
  if (type === 'rich') f.html = ''
  if (type === 'table') {
    f.columns = [
      { key: 'c1', label: '내용', type: 'text' },
      { key: 'c2', label: '금액', type: 'money' },
    ]
    f.total = 'c2'
  }
  return f
}
