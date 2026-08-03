# VIREN 웹사이트 — 작업 인수인계 (Handoff)

> 새 채팅/새 계정에서 이 파일을 먼저 읽으면 작업을 바로 이어받을 수 있습니다.
> 마지막 업데이트: 2026-08-03

---

## 1. 프로젝트 개요

- **VIREN** — 한국 콘텐츠 프로덕션 스튜디오 웹사이트 (한국어).
- **스택**: React + Vite, framer-motion, react-router-dom v7, react-dom `createPortal`(모달), Supabase(콘텐츠 DB).
- **로컬 경로**: `C:\Users\c\Documents\클로드\viren-react`
  - ⚠️ OneDrive 백업(Known Folder Move)을 켜면 경로가 `C:\Users\c\OneDrive\문서\클로드`로 이동해 도구/git이 깨집니다. **OneDrive 폴더 백업은 꺼둔 상태 유지.**
- **셸**: Windows PowerShell 기본 + Bash(POSIX) 병행. 경로에 한글(`클로드`) 포함.

## 2. 배포 흐름 (중요)

```
로컬 코드 수정 → npm run build → git commit → git push origin main
   → GitHub(virenmotion/viren) → Vercel 자동 배포 → 라이브 반영
```

- **라이브 URL**: https://viren.kr → **https://www.viren.kr 로 308 리다이렉트** (curl 확인 시 `-L` 필수).
- 배포 확인법: 로컬 `dist/assets/index-*.js`(또는 `.css`) 해시와 라이브 HTML의 번들 해시가 일치하면 반영 완료.
  ```bash
  cd viren-react && ls dist/assets/index-*.js | xargs -n1 basename          # 로컬 해시
  curl -sL --compressed https://www.viren.kr/ | grep -o 'index-[A-Za-z0-9_]*\.js' | head -1   # 라이브 해시
  ```
- 사용자에게 확인 요청 시 **Ctrl+Shift+R(강력 새로고침)** 안내(브라우저 캐시 때문).

## 3. 커밋/푸시 규칙

- 커밋 메시지 마지막 줄: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **대용량 미디어 커밋 금지**: 쇼릴 영상 등은 `.gitignore`로 제외되어 있음(`/public/assets/showreel*`, `/public/assets/background/` 등). `git add -A` 전에 대용량 파일이 스테이징되는지 확인. GitHub은 100MB 초과 파일 거부.
- 사용자가 명시적으로 요청할 때만 commit/push.

## 4. Supabase (콘텐츠 CMS)

- publishable 키는 커밋된 `.env`에 있음. 키 없거나 실패 시 **시드(seed) 폴백**으로 렌더.
- **테이블**
  - `projects` — WORK 프로젝트.
  - `jobs` — 채용 공고. 컬럼: `pinned`(상단 고정/공지), `cat`(**NOT NULL** → 저장 시 `cat: j.cat || 'general'` 처리됨).
  - `site_settings` — jsonb key/value. 키: `work_conditions`, `work_categories`, `what_we_do`.
- **RLS**: public read / authenticated write.
- **관리자 페이지**: `/admin` — 5탭 구조 `WHAT WE DO / WORK / PROJECT / CAREER / CONDITIONS`.
  - `/admin`은 인트로 프리로더를 건너뜀(`App.jsx`의 `Boot`에서 처리).

## 5. 반응형 브레이크포인트

- 모바일 ≤760px(자유 스크롤), 태블릿 761–1024px, 데스크톱 >1024(JS 풀페이지 `useFullpage.js`).
- work 그리드: ≤860 → 2열, ≤520 → 1열 / footer ≤820 → 1열 / meaning ≤900 → 2열.
- 태블릿 전용 수정은 반드시 `@media(min-width:761px) and (max-width:1024px)`로 스코프.
  - ⚠️ 과거에 태블릿 수정을 전역에 잘못 적용한 사고 있었음. "태블릿만" 요청은 반드시 태블릿 미디어쿼리로.
- 한글 줄바꿈: `word-break:keep-all`, `white-space:pre-line`.

## 6. 핵심 파일 지도

| 파일 | 역할 |
|---|---|
| `src/App.jsx` | 라우팅 + `Boot`(인트로 프리로더 게이트, /admin 건너뜀) |
| `src/components/Preloader.jsx` | 인트로 로더 — `/viren-draw-animation.html` iframe + 종료 줌 전환 |
| `public/viren-draw-animation.html` | 로더용 VIREN 로고 드로잉 애니메이션(자체 완결 번들, ~113KB) |
| `src/index.css` | 전역 스타일. 로더/줌 전환은 `#loader`~`#loader.done` 규칙(약 24–52행) |
| `src/components/Contact.jsx` | CONTACT. 전화 010-7770-1614, 이메일 virenmotion@viren.kr, SEOUL+MAP, 문의하기 모달 |
| `src/components/ContactModal.jsx` | 문의 모달(portal 렌더) |
| `src/components/Career.jsx` | CAREER. 공지(pinned)/공고 아코디언, 지원 팝업, 지원서 양식 다운로드 |
| `src/components/ApplyModal.jsx` | 지원 팝업(portal). 이름*/이메일*/전화/다중 파일 첨부/동의 |
| `src/components/Admin.jsx` | 관리자 5탭 + 각 Manager 컴포넌트 |
| `src/components/WhatWeDo.jsx` | ABOUT의 WHAT WE DO (CMS 연동, 항목별 페이지 링크) |
| `src/lib/projectStore.js` | projects/categories/whatwedo CRUD |
| `src/lib/careerStore.js` | jobs/work_conditions CRUD |
| `src/ProjectsContext.jsx` | projects+categories 전역 제공, `catLabel` |
| `public/assets/viren_application_form.pdf` | 지원서 양식 원본(다운로드 대상) |

## 7. 가장 최근 작업 (이번 세션) ✅ 완료·배포됨

**로딩 종료 시 "로고 속으로 빨려들어가는" 줌인+페이드 전환**

- 증상: 로더가 줌 없이 컷으로 사라짐(사용자 녹화로 확인).
- **근본 원인**: `App.jsx`의 `Boot`이 `if (ready) return null` 구조여서, 프리로더가 `onDone()`으로 `ready=true`를 켜는 순간 **부모가 프리로더를 즉시 언마운트** → `#loader.done` 종료 전환이 렌더될 틈이 없었음.
- **수정**:
  - `Boot`을 `ready` 대신 자체 `mounted` 상태로 제어. `onDone`은 사이트만 공개, 프리로더는 마운트를 유지하며 종료 전환을 재생한 뒤 `onGone`에서 언마운트.
  - `Preloader.jsx`: `onGone` prop 추가, `setTimeout(() => { setGone(true); onGone?.() }, 1900)`. 로더 지속시간 `4200ms`(프로덕션 값 — 디버그로 20000/30000 넣지 말 것).
  - `index.css`: `#loader.done .inner { transform:scale(15); transition:transform 1.15s cubic-bezier(.45,0,.6,.32); }` + 페이드 0.6s 지연(줌이 충분히 커진 뒤 사라지게). `.inner`에 `will-change:transform,opacity`.
- **검증**: dev에서 `done` 부여 시 `scale 1→15, opacity 1→0` 실측, 중간 줌 스크린샷으로 로고 확대 확인.
- 관련 커밋: `7062a55`(언마운트 타이밍 수정, 최종), 앞서 `732ccb9`(타이밍/이징), `5f9367e`(초기 줌 도입).

## 8. 현재 상태 / 다음 확인

- 위 줌 전환 배포 완료. **사용자가 Ctrl+Shift+R 후 재녹화로 최종 확인 예정.** 줌 세기(scale 15)나 속도가 과/약하면 `index.css`의 `#loader.done .inner` 수치만 조정.
- 미해결 이슈 없음(위 확인 대기만 남음).

## 9. 검증 팁 (이 프로젝트 특성)

- dev 서버는 **Browser 프리뷰 탭(localhost:5173)**으로 확인. `preview_start`/`navigate`/`javascript_tool`.
- 프리로더는 수명이 ~6s로 짧고 자동화 브라우저 지연 때문에 **실시간 캡처가 잘 안 됨**. 필요 시 로더 지속시간을 임시로 크게 늘리고 `#loader`에 `done` 클래스를 직접 부여해 `.inner`의 computed transform/opacity를 측정하는 방식이 확실함. **측정 후 지속시간 4200으로 반드시 복구.**
- 영상 프레임 분석: ffmpeg 설치됨(`winget Gyan.FFmpeg`). `ffmpeg -i in.mp4 -vf "fps=12,scale=360:-1,tile=6x4" out.jpg`로 콘택트시트 생성 후 Read로 확인.

## 10. 과거에 반영된 주요 작업 (참고)

WORK 콘텐츠 블록(라벨/중앙/특징카드/텍스트, 드래그 재정렬), 특징카드 수량별 중앙정렬·균등 구분선, CONTACT 재배치, footer 소셜 가로1열·여백 축소, Philosophy 폰트 로테이션·프레임·간격, Outro 배경영상(4K→1080p 다운스케일), CAREER 공지 고정·지원 팝업·지원서 PDF 연동, WORK 분야/WHAT WE DO CMS(독립 관리+페이지 링크), 태블릿 전용 8개 수정, 모바일 footer 이메일 SplitText 글리치 수정(will-change 제거), CONTACT 모달 portal화.

---

### 새 채팅 시작 시 첫 메시지 예시
> "VIREN 웹사이트 작업 이어서 할게. `viren-react/HANDOFF.md` 읽고 시작해줘. (경로: C:\Users\c\Documents\클로드\viren-react)"
