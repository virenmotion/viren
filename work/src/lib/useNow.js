import { useEffect, useState } from 'react'

/* 화면에 띄워 둔 동안 시계·근무시간이 흘러가도록 다시 그린다.
   ⚠️ 매초 바꾸지 않는다 — 화면 낭독기가 초마다 읽어 버린다(접근성 가이드). */
export function useNow(ms = 20000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
