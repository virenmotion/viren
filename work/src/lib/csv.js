/* 엑셀에서 한글이 깨지지 않도록 BOM 을 붙인 CSV 로 내려받는다. */
export function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  const text = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
  downloadBlob(filename, new Blob([text], { type: 'text/csv;charset=utf-8' }))
}

export function downloadBlob(filename, blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
