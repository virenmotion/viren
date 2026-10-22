import { DOC_STATUS } from '../lib/labels'

export function StatusPill({ status }) {
  return <span className={`pill st-${status}`}>{DOC_STATUS[status] || status}</span>
}

export function ErrorBox({ children }) {
  if (!children) return null
  return <p className="error" role="alert">{children}</p>
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

/* 목록이 비었을 때 크게 보여 주는 칸.
   ⚠️ **진짜 0건일 때만** 쓴다. 불러오는 중이거나 오류일 때 이걸 띄우면
      문제가 '아무것도 없음' 처럼 보인다(가이드). */
const EMPTY_ICONS = {
  doc: <><path d="M9 4.5h7l4 4V27a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 7 27V6.5a2 2 0 0 1 2-2z" /><path d="M16 4.5V9h4M11 15h8M11 20h5" /></>,
  chat: <><path d="M5 7.5h18a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-9l-5 4v-4H5A1.5 1.5 0 0 1 3.5 19V9A1.5 1.5 0 0 1 5 7.5z" /></>,
  calendar: <><rect x="4.5" y="7" width="19" height="17" rx="2" /><path d="M4.5 12h19M10 4.5v5M18 4.5v5" /></>,
}

export function BigEmpty({ icon = 'doc', title, children }) {
  return (
    <div className="big-empty">
      <span className="be-ico" aria-hidden="true">
        <svg viewBox="0 0 28 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {EMPTY_ICONS[icon]}
        </svg>
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

/* 날짜 칸.
   ⚠️ 브라우저가 주는 기본 날짜 칸은 연도를 **여섯 자리**까지 받는다(002026, 020260 …).
      실수로 한 자리 더 치면 말없이 엉뚱한 해가 저장된다. 연도 칸의 자릿수는
      max 의 연도 자릿수를 따라가므로, max 를 두어 네 자리로 묶는다.
      (지은님 2026-10-22: "기준은 4자리로." 여섯 자리가 필요해지면 그때 바꾼다.)
   쓰는 쪽에서 min·max 를 따로 주면 그게 이긴다. */
export function DateInput({ min = '1900-01-01', max = '9999-12-31', ...rest }) {
  return <input type="date" min={min} max={max} {...rest} />
}
