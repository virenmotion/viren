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

/* 날짜 칸.
   ⚠️ 브라우저가 주는 기본 날짜 칸은 연도를 **여섯 자리**까지 받는다(002026, 020260 …).
      실수로 한 자리 더 치면 말없이 엉뚱한 해가 저장된다. 연도 칸의 자릿수는
      max 의 연도 자릿수를 따라가므로, max 를 두어 네 자리로 묶는다.
      (지은님 2026-10-22: "기준은 4자리로." 여섯 자리가 필요해지면 그때 바꾼다.)
   쓰는 쪽에서 min·max 를 따로 주면 그게 이긴다. */
export function DateInput({ min = '1900-01-01', max = '9999-12-31', ...rest }) {
  return <input type="date" min={min} max={max} {...rest} />
}
