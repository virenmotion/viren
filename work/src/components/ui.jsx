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
