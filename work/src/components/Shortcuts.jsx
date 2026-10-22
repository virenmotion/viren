/* 홈 맨 위의 바로가기 줄 (지은님 2026-10-21).
   바이렌 바깥 페이지로 나가는 길목이라 전부 새 탭으로 연다.

   ⚠️ 회사소개서는 **홈페이지 파일을 그대로 가리킨다.** 여기로 복사해 두면
   홈페이지만 새로 올렸을 때 사내 플랫폼 것만 옛날 판으로 남는다.
   주소가 같으니 홈페이지 PDF 를 바꾸면 여기도 같이 바뀐다.
   (다른 사이트 파일이라 브라우저가 '바로 저장' 대신 PDF 를 열어 준다.
    거기서 내려받으면 된다 — 이건 브라우저 규칙이라 우리가 못 바꾼다.) */

const SITE = 'https://viren.kr'
export const PROFILE_PDF = `${SITE}/assets/viren_company_profile.pdf`

const LINKS = [
  {
    // 카카오워크 메일. 각자 자기 계정으로 들어간다.
    label: '메일', url: 'https://mail.kakaowork.com/mail/list.do',
    icon: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m3.5 7 8.5 6 8.5-6" fill="none" stroke="currentColor" strokeWidth="1.8" /></>,
  },
  {
    label: '홈페이지', url: SITE,
    icon: <path fill="currentColor" d="M12 3 2 11h3v10h6v-6h2v6h6V11h3z" />,
  },
  {
    label: 'YouTube', url: 'https://www.youtube.com/@VIREN_motion',
    icon: <path fill="currentColor" d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.4A3 3 0 0 0 .5 6.5 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1C4.5 20 12 20 12 20s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.5zM9.6 15.6V8.4l6.2 3.6z" />,
  },
  {
    label: 'Instagram', url: 'https://www.instagram.com/viren_creative/',
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1.15" fill="currentColor" />
      </>
    ),
  },
  {
    label: 'Behance', url: 'https://www.behance.net/viren2',
    icon: <path fill="currentColor" d="M6.7 8.4c.7 0 1.3.06 1.85.2.53.13.98.35 1.34.65.36.3.63.68.82 1.15.18.47.27.99.27 1.6 0 .66-.15 1.21-.45 1.65-.3.45-.75.81-1.35 1.09.82.24 1.44.65 1.85 1.24.4.58.6 1.29.6 2.11 0 .66-.13 1.24-.38 1.72-.26.49-.6.88-1.03 1.19-.43.31-.93.53-1.48.67-.55.14-1.12.21-1.7.21H0V8.4h6.7zm-.4 4.72c.54 0 .98-.13 1.32-.38.34-.26.51-.67.51-1.24 0-.32-.06-.57-.17-.77-.11-.2-.27-.35-.46-.46-.19-.11-.42-.19-.67-.23-.25-.05-.51-.07-.78-.07H2.9v3.15h3.4zm.19 4.96c.3 0 .58-.03.84-.09.26-.06.49-.16.68-.3.19-.14.34-.32.46-.55.11-.23.17-.52.17-.87 0-.68-.19-1.17-.58-1.47-.38-.29-.89-.44-1.53-.44H2.9v3.72h3.79zM17.9 17.4c.39.38.96.57 1.7.57.53 0 .99-.13 1.37-.4.38-.27.61-.55.7-.85h2.2c-.35 1.1-.89 1.88-1.62 2.36-.73.47-1.61.71-2.65.71-.72 0-1.37-.12-1.95-.35-.58-.23-1.07-.56-1.47-.99-.4-.43-.71-.94-.92-1.54-.21-.6-.32-1.26-.32-1.98 0-.7.11-1.35.33-1.95.22-.6.53-1.11.94-1.55.41-.43.9-.77 1.46-1.02.57-.24 1.2-.37 1.88-.37.77 0 1.44.15 2.02.45.58.3 1.05.7 1.42 1.2.37.5.63 1.08.8 1.72.16.64.22 1.32.18 2.02h-7.05c0 .74.25 1.35.64 1.73zm2.96-4.68c-.31-.34-.83-.53-1.44-.53-.4 0-.73.07-.99.2-.26.14-.47.31-.63.51-.16.2-.27.42-.33.65-.06.22-.1.42-.11.6h4.36c-.06-.68-.28-1.19-.6-1.53zM16.5 9.2h5.44v1.32H16.5z" />,
  },
]

const DOC_ICON = <path fill="currentColor" d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zm-1 7V3.5L18.5 9zM12 12v5.2l2.1-2.1 1.4 1.4L11 21l-4.5-4.5 1.4-1.4L10 17.2V12z" />

export default function Shortcuts() {
  return (
    <nav className="shortcuts" aria-label="바로가기">
      {LINKS.map((s) => (
        <a key={s.label} className="sc" href={s.url} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true">{s.icon}</svg>
          <span>{s.label}</span>
        </a>
      ))}
      <a className="sc sc-pdf" href={PROFILE_PDF} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true">{DOC_ICON}</svg>
        <span>회사소개서</span>
      </a>
    </nav>
  )
}
