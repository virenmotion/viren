/* 하루 근무량을 동그란 그래프로.
 * **100% = 9시간** — 출근해서 퇴근할 때까지 머문 시간 기준이고,
 * 점심 1시간이 그 안에 들어 있다(= 실제 근무 8시간). 지은님 2026-10-21.
 * 회사 기준이 바뀌면 아래 FULL_MIN 한 줄만 고치면 된다.
 *   · 다 채우면 초록, 모자라면 노랑. 넘으면 초록 가득 + 실제 퍼센트를 글자로.
 *   · 가운데에는 퍼센트만. 시각은 바깥에 따로 적는다(칸이 좁아 둘 다 넣으면 읽기 힘들다).
 */

/* ⚠️ 기준은 lib/worktime.js 한 곳에만 둔다. 여기서 다시 정하지 않는다. */
export { FULL_MIN } from '../lib/worktime'
import { FULL_MIN } from '../lib/worktime'

export default function WorkRing({ minutes = 0, size = 54 }) {
  const pct = Math.round((minutes / FULL_MIN) * 100)
  const r = 22
  const c = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(1, minutes / FULL_MIN))
  const done = minutes >= FULL_MIN

  return (
    <svg className="ring" viewBox="0 0 56 56" width={size} height={size} role="img" aria-label={`근무 ${pct}%`}>
      <circle className="ring-bg" cx="28" cy="28" r={r} />
      {minutes > 0 && (
        <circle
          className={`ring-fg${done ? ' done' : ''}`}
          cx="28" cy="28" r={r}
          strokeDasharray={`${(c * filled).toFixed(2)} ${c.toFixed(2)}`}
          transform="rotate(-90 28 28)"
        />
      )}
      <text className={`ring-txt${done ? ' done' : ''}`} x="28" y="28" textAnchor="middle" dominantBaseline="central">
        {minutes > 0 ? `${pct}%` : ''}
      </text>
    </svg>
  )
}
