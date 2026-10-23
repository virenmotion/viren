import { hoursText } from '../lib/dates'
import { FULL_MIN, workStat, workTone } from '../lib/worktime'

/* 하루 근무량을 **연속형 가로 막대** 하나로. (지은님이 고른 A안, 2026-10-22)

   ⚠️ 9칸 분절·도넛·막대 안 숫자·굵은 그림자는 쓰지 않는다(가이드).
   ⚠️ 트랙이 100% 에서 멈춰도 **실제 값과 초과분을 숨기지 않는다** —
      넘긴 만큼은 쓰는 쪽에서 글자로 적는다.
   ⚠️ 색만으로 뜻을 전하지 않는다. aria-label 과 옆 글자를 늘 같이 둔다.
   ⚠️ 기록이 없는 날에는 **아예 그리지 않는다**(쓰는 쪽에서 판단). 빈 막대를 줄줄이
      늘어놓으면 미기록이 '0시간 미달'처럼 보인다. */

export default function WorkBar({ minutes, height = 8, working = false }) {
  const s = workStat(minutes)
  const tone = workTone(s.min, working)
  /* ⚠️ 세 가지를 갈라야 한다. 예전에는 '딱 채움' 도 부족 쪽으로 가서
     9시간 00분·100% 인데 낭독기가 "·  부족" 이라고 읽었다(2026-10-23 검토). */
  const tail = working ? ''
    : s.over > 0 ? ` · ${hoursText(s.over)} 초과`
      : s.left > 0 ? ` · ${hoursText(s.left)} 부족`
        : ' · 채움'
  const label = `9시간 중 ${hoursText(s.min) || '0분'} · ${s.pct}%${tail}`

  return (
    <span className="wbar" style={{ height: `${height}px` }} role="img" aria-label={label}>
      <span
        className={`wbar-fill t-${tone}`}
        style={{ width: `${Math.min(100, s.ratio * 100)}%` }}
      />
    </span>
  )
}

export { FULL_MIN }
