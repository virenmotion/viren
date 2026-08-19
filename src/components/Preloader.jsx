import { useEffect, useRef, useState } from 'react'

/* 프리로더: VIREN 로고 드로잉 애니메이션(iframe) + 커튼 리빌.
   완료되면 onDone()을 호출하고 커튼이 걷히며 자기 자신을 언마운트. */
/* 로고 드로잉 애니메이션 재생 속도. 원본은 2.24초에 끝나는데, 그만큼 기다리면
   전체 로딩이 3초를 넘는다. 1.6배로 돌리면 1.4초에 끝난다(실측). */
const ANIM_RATE = 1.6

/* 공개 상한 — 마운트 기준이 아니라 **내비게이션 시작 기준**이다.
   회선·캐시에 따라 프리로더 마운트가 0.3~0.9초로 크게 흔들려서(실측),
   마운트에 고정 지연을 더하면 총 시간이 들쭉날쭉해진다.
   실제로는 애니메이션이 끝나는 즉시 공개하고, 이 값은 늦어질 때의 뚜껑 역할만 한다. */
const REVEAL_AT = 2600
/* 아주 빠른 캐시 로딩에서도 최소한 이만큼은 보여준다(로고가 번쩍이고 사라지는 것 방지) */
const MIN_SHOW = 1500

export default function Preloader({ onDone, onGone }) {
  const [done, setDone] = useState(false)
  const [gone, setGone] = useState(false)
  const finishedRef = useRef(false)
  const finishRef = useRef(null) // onFrameLoad에서 조기 종료를 호출하려면 필요

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    const finish = () => {
      if (finishedRef.current) return
      finishedRef.current = true
      setDone(true)
      document.body.classList.remove('is-loading')
      document.body.classList.add('loaded')
      /* 공개 시각 기록 — 프리로더는 수명이 짧아 자동화 브라우저로 실시간 캡처가 안 된다.
         로딩 시간을 재려면: performance.getEntriesByName('viren:reveal')[0].startTime */
      performance.mark?.('viren:reveal')
      onDone?.()
      // 종료 전환(줌 .85s + 페이드) 재생 후 자기 자신을 언마운트
      setTimeout(() => { setGone(true); onGone?.() }, 1250)
    }

    /* 남은 시간만 기다린다 → 로딩이 빨랐든 느렸든 총 시간이 REVEAL_AT로 수렴한다.
       모션 최소화 설정이면 즉시 넘어간다. */
    const wait = reduced ? 300 : Math.max(MIN_SHOW, REVEAL_AT - performance.now())
    finishRef.current = finish
    const t = setTimeout(finish, wait)
    return () => clearTimeout(t)
  }, [onDone])

  /* 번들 애니메이션의 로딩/에러 인디케이터 숨김 + 재생 가속 (same-origin) */
  const onFrameLoad = (e) => {
    try {
      const doc = e.currentTarget.contentDocument
      if (!doc) return
      const s = doc.createElement('style')
      s.textContent = '#__bundler_loading,#__bundler_err{display:none!important}'
      doc.head?.appendChild(s)
      /* 번들에 speed prop이 있지만 밖에서 넘길 방법이 없다(URL 파라미터 미지원).
         이미 만들어진 애니메이션의 playbackRate를 올려 같은 효과를 낸다.

         ⚠️ iframe의 load 시점에는 애니메이션이 아직 없다. 번들 컴포넌트가 마운트된
         뒤에야 생기기 때문. load에서 바로 getAnimations()를 부르면 빈 배열이 와서
         가속도 조기 종료도 걸리지 않는다(실측: 공개가 3.5초로 늘어남). 그래서 폴링한다. */
      let tries = 0
      const hook = () => {
        const anims = doc.getAnimations?.() ?? []
        if (!anims.length) {
          if (++tries < 30) setTimeout(hook, 50) // 최대 1.5초까지 기다린다
          return
        }
        anims.forEach((a) => { a.playbackRate = ANIM_RATE })
        /* 로고가 완성되는 즉시 공개한다. 회선이 빠르면 1.5초대에 끝나는데
           상한까지 기다리면 완성된 로고를 1초 동안 멍하니 보여주게 된다.
           useEffect의 상한 타이머는 그대로 살아 있어 둘 중 먼저 오는 쪽이 이긴다. */
        Promise.all(anims.map((a) => a.finished))
          .then(() => setTimeout(() => finishRef.current?.(),
            Math.max(0, MIN_SHOW - performance.now())))
          .catch(() => { /* 루프 재시작으로 취소되면 상한 타이머가 처리한다 */ })
      }
      hook()
    } catch { /* cross-origin 등 무시 */ }
  }

  if (gone) return null

  return (
    <div id="loader" className={done ? 'done' : ''}>
      <div className="curtains">
        <div className="curtain" /><div className="curtain" /><div className="curtain" />
        <div className="curtain" /><div className="curtain" />
      </div>
      <div className="inner">
        <iframe
          className="loader-anim"
          src="/viren-draw-animation.html"
          title="VIREN"
          tabIndex={-1}
          aria-hidden="true"
          scrolling="no"
          onLoad={onFrameLoad}
        />
      </div>
    </div>
  )
}
