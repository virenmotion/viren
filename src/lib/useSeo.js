import { useEffect } from 'react'

const SITE = 'https://www.viren.kr'
export const BRAND = 'VIREN 바이렌'

/* 페이지별 title / description / canonical 갱신.
   SPA라 모든 라우트가 index.html의 태그 하나를 공유했고, canonical이 전부 홈(/)으로
   고정돼 있었다. 구글 입장에선 /work·/contact·프로젝트 상세가 전부 '홈의 중복'이라
   색인에서 제외된다. 이 훅으로 라우트마다 고유값을 부여한다.

   ⚠️ 새 태그를 만들지 않고 index.html의 기존 태그를 '덮어쓴다'.
   태그를 추가하면 head에 title/canonical이 둘씩 생기고, 그 경우 크롤러는 보통
   앞의 것(=정적 홈 값)을 채택해 수정이 무의미해진다.

   ⚠️ 이건 JS 실행 후에만 반영된다. 구글은 렌더링하므로 문제없지만 네이버 Yeti는
   원본 HTML만 읽으므로 index.html의 기본값을 계속 본다(그쪽은 noscript가 담당). */
export default function useSeo({ title, description, path }) {
  useEffect(() => {
    const set = (selector, attr, value) => {
      if (!value) return
      const el = document.head.querySelector(selector)
      if (el) el.setAttribute(attr, value)
    }

    if (title) {
      document.title = title
      set('meta[property="og:title"]', 'content', title)
    }
    if (description) {
      set('meta[name="description"]', 'content', description)
      set('meta[property="og:description"]', 'content', description)
    }
    if (path) {
      const url = SITE + path
      set('link[rel="canonical"]', 'href', url)
      set('meta[property="og:url"]', 'content', url)
    }
  }, [title, description, path])
}
