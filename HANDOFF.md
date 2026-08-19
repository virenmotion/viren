# VIREN 웹사이트 — 작업 인수인계 (Handoff)

> 새 채팅/새 계정에서 이 파일을 먼저 읽으면 작업을 바로 이어받을 수 있습니다.
> 마지막 업데이트: 2026-08-18

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

- 커밋 메시지 마지막 줄: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  - 실제 사용 중인 모델명으로 적는다(모델을 바꿨으면 그 이름으로).
- **대용량 미디어 커밋 금지**: 쇼릴 영상 등은 `.gitignore`로 제외되어 있음(`/public/assets/showreel*`, `/public/assets/background/` 등). `git add -A` 전에 대용량 파일이 스테이징되는지 확인. GitHub은 100MB 초과 파일 거부.
- 사용자가 명시적으로 요청할 때만 commit/push.

## 4. Supabase (콘텐츠 CMS)

- publishable 키는 커밋된 `.env`에 있음. 키 없거나 실패 시 **시드(seed) 폴백**으로 렌더.
- **테이블**
  - `projects` — WORK 프로젝트.
  - `jobs` — 채용 공고. 컬럼: `pinned`(상단 고정/공지), `cat`(**NOT NULL** → 저장 시 `cat: j.cat || 'general'` 처리됨).
  - `site_settings` — jsonb key/value. 키: `work_conditions`, `work_categories`, `what_we_do`, `band_words`(홈 하단 마퀴 문구, 문자열 배열).
- **RLS**: public read / authenticated write.
- **관리자 페이지**: `/admin` — 6탭 `MARQUEE / WHAT WE DO / WORK / PROJECT / CAREER / CONDITIONS`.
  - `/admin`은 인트로 프리로더를 건너뜀(`App.jsx`의 `Boot`에서 처리).
  - `MARQUEE` = 홈 PHILOSOPHY 아래 흐르는 문구(`Band.jsx`). 짝수번째 항목은 자동으로 외곽선(SVG path) 스타일 — 기존 8개 문구가 아닌 새 문구는 외곽선 그래픽이 없어 일반 글자로 폴백(필요 시 `node scripts/genOutlines.cjs` 재실행, 5절 참고).
  - `WORK` = WORK 분야(카테고리) 관리. **WORK 상세 페이지 상단에 뜨는 분야명이 여기서 나온다.**
  - **편집 화면은 라우트가 아니라 `editing` 상태로만 전환된다.** 그래서 뒤로가기가 홈으로
    나가던 문제가 있었고, `useBackToList(open, onBack)` 훅으로 히스토리 항목을 쌓아 해결했다
    (PROJECT·CAREER 두 폼에 적용). 편집 폼을 새로 만들면 이 훅도 함께 붙일 것.
    ⚠️ StrictMode 이중 실행 대비로 `pushed` ref 가드가 들어 있다. 훅을 수정할 땐
    "뒤로가기로 닫기"와 "취소 버튼으로 닫기" 두 경우 모두 히스토리가 원위치인지 확인할 것.
  - 계정 추가는 코드에 없음 → **Supabase 대시보드 → Authentication → Users → Add user**로 생성.

## 5. 반응형 브레이크포인트

- 모바일 ≤760px(자유 스크롤), 태블릿 761–1024px, 데스크톱 >1024(JS 풀페이지 `useFullpage.js`).
- work 그리드: ≤860 → 2열, ≤520 → 1열 / footer ≤820 → 1열 / meaning ≤900 → 2열.
- 태블릿 전용 수정은 반드시 `@media(min-width:761px) and (max-width:1024px)`로 스코프.
  - ⚠️ 과거에 태블릿 수정을 전역에 잘못 적용한 사고 있었음. "태블릿만" 요청은 반드시 태블릿 미디어쿼리로.
- 한글 줄바꿈: `word-break:keep-all`, `white-space:pre-line`.

## 6. 핵심 파일 지도

| 파일 | 역할 |
|---|---|
| `index.html` | 프리렌더 **템플릿**. 메타/OG/JSON-LD + **검색엔진 소유확인 태그(삭제 금지, 10절)** + noscript 본문 |
| `src/lib/seoRoutes.js` | 라우트별 title/description/h1 **단일 출처**. 앱과 빌드 스크립트가 공유(react import 금지) |
| `scripts/prerender.mjs` | 빌드 후 라우트별 정적 HTML 13쪽 + `sitemap.xml` 생성(10-3절) |
| `public/robots.txt` | 검색엔진용. `sitemap.xml`은 빌드가 생성하므로 `public/`에 두지 않는다 |
| `src/App.jsx` | 라우팅 + `Boot`(인트로 프리로더 게이트, /admin 건너뜀) |
| `src/components/Backdrop.jsx` | 홈 고정 배경. **APEC 영상 + 어둠막**, 화면 폭에 따라 소스 선택, 스크롤 페이드(7절 (3)) |
| `src/components/Scene3D.jsx` | 이전 3D 회전 로고. **현재 미사용**(import 제거) — 복원 대비로 남겨둠 |
| `public/assets/hero-bg.mp4` · `hero-bg-mobile.mp4` | 히어로 배경 영상. 1920×1080 9.7MB / 608×1080 4.0MB(≤760px) |
| `src/components/Preloader.jsx` | 인트로 로더 — `/viren-draw-animation.html` iframe + 종료 줌 전환. **공개 최대 2.6초**(11-1절) |
| `public/viren-draw-animation.html` | 로더용 VIREN 로고 드로잉 애니메이션(자체 완결 번들, ~113KB) |
| `src/index.css` | 전역 스타일. 로더/줌 전환은 `#loader`~`#loader.done` 규칙(약 24–52행) |
| `src/components/Contact.jsx` | CONTACT. 전화 02-3144-1222, 이메일 virenmotion@viren.kr, SEOUL+MAP, 문의하기 모달, 소셜 위 로고 모션 밴드 |
| `src/socials.jsx` | 소셜 링크 4개 + 아이콘 **단일 소스**(Contact·Footer 공용). 배열 순서 = 표시 순서 |
| `public/assets/viren-logo-motion.mp4` | CONTACT 로고 모션 배포본(1920×400, 0.19MB). 마스터는 `public/VIREN_motion_wide.mp4`(gitignore) |
| `src/components/ContactModal.jsx` | 문의 모달(portal 렌더) |
| `src/components/Career.jsx` | CAREER. 공지(pinned)/공고 아코디언, 지원 팝업, 지원서 양식 다운로드 |
| `src/components/ApplyModal.jsx` | 지원 팝업(portal). 이름*/이메일*/전화/다중 파일 첨부/동의 |
| `src/components/Admin.jsx` | 관리자 6탭 + 각 Manager 컴포넌트 |
| `src/components/Band.jsx` | 홈 PHILOSOPHY 아래 마퀴 문구(`site_settings.band_words`, 관리자 MARQUEE 탭 연동) |
| `src/components/WhatWeDo.jsx` | ABOUT의 WHAT WE DO (CMS 연동, 항목별 페이지 링크) |
| `src/lib/projectStore.js` | projects/categories/whatwedo CRUD + 업로드 |
| `src/lib/mediaCompress.js` | **업로드 전 이미지 자동 압축**(WebP·2400px) + 영상 비트레이트 검사(11절) |
| `src/lib/careerStore.js` | jobs/work_conditions CRUD |
| `src/ProjectsContext.jsx` | projects+categories 전역 제공, **`catLabel`(카테고리 라벨은 반드시 이걸 쓸 것)** |
| `src/lib/useSeo.js` | 라우트별 title/description/canonical 갱신 (10절 함정 주의) |
| `src/components/WorkDetail.jsx` | WORK 상세. 상단 = 카테고리(accent, 좌) + 로케이션(우) 한 줄 |
| `public/assets/viren_application_form.pdf` | 지원서 양식 원본(CAREER 지원 팝업에서 다운로드) |
| `public/assets/viren_company_profile.pdf` | 회사소개서(푸터 `회사소개서 DOWNLOAD`). 27p·12.7MB, 압축본은 화질 저하로 반려됨 |

## 6-1. WORK 상세 콘텐츠 블록 (관리자 → PROJECT → 콘텐츠 블록)

`projects.blocks`(jsonb 배열)에 `{type, ...}` 형태로 저장. 렌더는 `WorkDetail.jsx`의 `BlockBody`,
편집 UI는 `Admin.jsx`. 블록을 추가할 땐 **두 파일 + `index.css` 세 곳**을 함께 손봐야 한다.

| type | 화면 이름 | 입력 | 비고 |
|---|---|---|---|
| `text` | 텍스트 | heading, body | body에 `\|` → 줄 분리 |
| `center` | **제목 + 좌/우 텍스트** | heading, body(왼쪽), bodyEn(오른쪽) | 아래 설명 참고 |
| `label` | 라벨(Concept 등) | text | 자간 자동 축소 |
| `features` | 특징 카드 | body | 한 줄 = `한글 \| 영문`, 칸 안 줄바꿈 `/` |
| `specs` | **상세 항목(라벨/한/영)** | body | 한 줄 = `라벨 \| 한글 \| 영문`, 칸 안 줄바꿈 `/` |
| `image` | 이미지 | media, caption | 업로드 시 **WebP·2400px으로 자동 압축**(11절) |
| `video` | 영상 | media, caption, loop | **유튜브 / mp4 직접 업로드 둘 다 가능** — 아래 설명 |
| `divider` | 구분선 | — | 이 지점에서 스크롤 효과 구역이 나뉨 |

### video — 유튜브 / 직접 업로드 (2026-08-11 확장)
- `media`가 `.mp4/.webm/.mov/.m4v`로 끝나면 `<video>`, 아니면 유튜브 ID로 보고 iframe.
  **자동 판별**이라 기존 유튜브 데이터는 그대로 동작한다.
- `loop: true` → `muted+loop+autoplay`, 컨트롤 숨김(짧은 파노라마 클립용).
  `false` → `controls` 표시(`controlsList="nodownload"`).
- 업로드는 `uploadVideo()` — `work-thumbs` 버킷, **20MB 상한**(`MAX_VIDEO_MB`, mediaCompress.js).
  4Mbps를 넘으면 업로드는 되지만 관리자 화면에 ffmpeg 압축 명령이 뜬다(11절).
- ⚠️ Supabase 무료 플랜은 저장 1GB·대역폭 월 5GB 수준. **긴 영상은 유튜브를 쓸 것.**
  2026-08-18에 실제로 한도를 넘겼다 — 원인과 대응은 11절.

### 이미지 보호 (2026-08-11)
- `.wb-figure img`에 `draggable=false` + `onContextMenu` preventDefault + CSS
  `-webkit-user-drag:none`, `-webkit-touch-callout:none`.
- WORK 목록 썸네일은 `background-image`라 원래부터 우클릭 저장 불가.
- ⚠️ **완전 차단은 원리상 불가.** 개발자도구 Network 탭·이미지 URL 직접 접근·스크린샷은
  못 막는다. 사용자와 "이미지만 막기(가벼운 마찰)" 수준으로 합의함. 페이지 전체 우클릭
  차단은 방문자 불편이 커서 선택하지 않음.

### specs (2026-08-11 신설)
- `라벨 | 한글 | 영문` 3열 표. Object / Tone & Manner / Story 같은 항목별 설명용.
- 입력 규칙을 `features`와 동일하게 맞춰 학습비용을 없앰(`|` 필드, `/` 줄바꿈).
- `dl/dt/dd` 구조 + `.wb-spec-body{display:contents}`로 한글·영문을 2·3열에 직접 배치.
- 행마다 `border-top`, 컨테이너에 `border-bottom`. 860px 이하 1열.

### center (2026-08-11 개편)
- 원래 "중앙 텍스트(한/영)"였으나 **실사용에서 '영문' 칸에 한글을 넣고 있어** 언어 기준 구분을
  버리고 위치 기준(왼쪽/오른쪽)으로 바꿈.
- 레이아웃: 제목(좌측정렬, 장식선 없음) + 아래에 **왼쪽 라벨 1칸 + 오른쪽 문단 N칸을 균등 분할**.
  `style={{'--cols': 1 + 문단수}}` → `grid-template-columns:repeat(var(--cols),1fr)`.
  `.wb-c-right{display:contents}`라 문단들이 그리드에 직접 배치돼 라벨과 같은 폭을 갖는다.
- **오른쪽 문단은 빈 줄(`\n\n`)로 구분** → 가로로 나열. 단일 개행은 문단 안 줄바꿈으로 유지.
- 왼쪽 라벨은 `var(--accent)` + `font-weight:700`. 문단 안 글은 좌측정렬, 문단 그룹은 우측 끝 정렬.
- 760px 이하 세로 적층.
- ⚠️ `repeat(var(--cols),1fr)` 패턴은 `.wb-features`에서도 쓰던 방식(인라인 CSS 변수 + 미디어쿼리로
  변수만 덮어쓰기). 인라인으로 `grid-template-columns`를 직접 넣으면 미디어쿼리가 못 이긴다.

## 7. 가장 최근 작업 (2026-08-18) ✅ 완료·라이브 검증됨

**(1) 라우트별 정적 HTML 프리렌더 — 네이버 색인 병목 해소** (커밋 `1ef675f`, `1797240`)

- 네이버 `수집 현황`이 **2건에서 멈춰** 있었다. 서버는 정상(Yeti UA로 200, 수집 제한 0건)이었고,
  원인은 **13개 주소가 전부 canonical을 홈으로 선언**하고 있었던 것. 진단·구조·검증법은 **10-3절**.
- `scripts/prerender.mjs`가 빌드 후 라우트별 HTML 13쪽과 `sitemap.xml`을 DB에서 생성한다.
- `src/lib/seoRoutes.js`가 문구의 단일 출처. 앱과 빌드가 같이 쓴다.
- **부수 효과**: 프로젝트를 추가해도 사이트맵을 손으로 고칠 필요가 없어졌다. 홈 noscript의
  프로젝트 목록(8개로 굳어 있었음)과 제작 분야도 DB에서 생성된다.
- ⚠️ **관리자에서 글만 쓰고 배포를 안 하면 크롤러용 HTML은 옛날 것이다.** 화면·구글은 바로
  반영되지만(런타임에 DB를 읽으므로) 네이버용 정적 HTML은 빌드 산출물이다. Vercel `Redeploy` 필요.
- 후속 수정(`1797240`): `text` 블록은 화면에 `heading`·`body`만 렌더되는데 프리렌더가 `bodyEn`까지
  넣고 있었다 → **크롤러만 보는 텍스트 = 클로킹**이라 제외. `center`는 둘 다 렌더되므로 유지.

**(2) 없는 주소 soft-404 차단** (커밋 `1ef675f`에 포함)

- `App.jsx`에 `path="*"` → `NotFoundPage`(noindex). SPA라 서버가 어떤 경로든 200을 줘서
  빈 화면이 색인될 수 있었다.
- ⚠️ **`/about`은 존재하지 않는 주소다.** ABOUT은 홈의 한 구간(`fp-panel`)이라 라우트가 없다.
  실제로 네이버 수집 요청에 잘못 제출한 적 있음. 유효한 주소는 사이트맵 13개가 전부.

**(3) 홈 히어로 배경: 3D 로고 → APEC 레퍼런스 영상** (커밋 `0a3fcfc`, `43f6fcd`)

- `Backdrop`의 내용물을 `Scene3D`(three.js 3D 회전 로고)에서 `<video>`로 교체.
  스크롤 페이드(hero 1 → about 0.2 → whatwedo 0)는 그대로 동작한다.
- **화면별 소스** — `matchMedia('(max-width:760px)')`로 **마운트 시 한 번만** 고른다.

  | 화면 | 파일 | 해상도 | 용량 | 가로 잘림 |
  |---|---|---|---|---|
  | 모바일 ≤760 | `hero-bg-mobile.mp4` | 608×1080 | 4.0MB | 18% |
  | 태블릿·데스크톱 | `hero-bg.mp4` | 1920×1080 | 9.7MB | 59% / — |

  16:9를 세로 화면에 `cover`로 깔면 **가로가 74% 잘려**(1920 중 가운데 499px) 좌우로 펼쳐지는
  미디어파사드 구도가 사라진다. 가운데를 9:16으로 잘라낸 별도 인코딩으로 해결.
  태블릿은 59%로도 구도가 버텨서 원본을 쓴다.
- ⚠️ **재생 중 `src`를 바꾸면 영상이 처음부터 다시 시작한다.** 그래서 resize에 반응시키지 않고
  마운트 시점에 고정한다. `<source media="…">`는 브라우저 지원이 미덥지 않아 쓰지 않았다.
- `.backdrop-veil` 추가 — 영상 위 어둠막(위 .45 / 중간 .28 / 아래 .78). 3D 로고는 어두운
  오브젝트라 필요 없었는데 이 영상은 밝은 구간이 있어 hero 대문구 둘째 줄이 묻혔다.
  Outro의 `.outro-veil`과 같은 처리.
- **인코딩**: 원본 184MB·25Mbps → CRF 33·무음.
  ```bash
  # 데스크톱
  ffmpeg -i 원본.mp4 -an -c:v libx264 -crf 33 -preset slow -pix_fmt yuv420p \
    -profile:v high -movflags +faststart public/assets/hero-bg.mp4
  # 모바일 (가운데 9:16 크롭 — 1920 중 656~1264px 구간)
  ffmpeg -i 원본.mp4 -an -vf "crop=608:1080:656:0" -c:v libx264 -crf 33 -preset slow \
    -pix_fmt yuv420p -profile:v high -movflags +faststart public/assets/hero-bg-mobile.mp4
  ```
- ⚠️ **원본(184MB)을 `public/`에 두지 말 것.** 그대로 배포에 딸려가고 GitHub 100MB 제한에도 걸린다.
  원본은 `클로드\VIREN_영상원본\` 으로 옮겼다.
- **three.js가 번들에서 빠져 JS가 1,248KB → 685KB**(gzip 348 → 205KB)로 줄었다.
- **되돌리려면**: `Scene3D.jsx`는 지우지 않았다. `Backdrop.jsx`에서 `<video>`를 `<Scene3D />`로
  바꾸면 끝. 절차는 `클로드\VIREN_3D로고_백업\복원방법.md`. 되돌리면 번들도 다시 늘어난다.
- `.stage` CSS 규칙(`@media(max-height:800px) and (min-width:761px)`)은 3D용이라 지금은 죽은
  규칙이다. 복원 대비로 남겨뒀다.

**(4) 제주목 관아 본문 보강** (사용자 직접 작성 · DB)

- 3블록 → **19블록**(텍스트 약 1,534자). 프리렌더가 읽는 본문이 603자에서 늘어 색인 확률이 올라간다.
- 발견: `text` 블록에 화면에 안 나오는 `bodyEn`이 한 건 남아 있다(블록 종류를 바꿀 때 남은 데이터
  — `text` 편집기엔 영문 칸이 없다). 보이게 하려면 그 블록을 `중앙 텍스트`로 바꾸면 된다. 9개 중 1건.

## 7-1. 지난 세션 작업 (2026-08-11) ✅ 배포됨

**(1) 관리자 MARQUEE 탭 — 홈 하단 마퀴 문구 CMS화** (커밋 `ad0668d`)

- `site_settings.band_words`(문자열 배열) 신규 키. `projectStore.js`에 `getBandWords`/`saveBandWords`.
- `Band.jsx`가 DB 값을 읽고, 없으면 `DEFAULT_BAND_WORDS` 폴백. Admin에 `BandManager`(추가/삭제/순서변경).
- ⚠️ 짝수 인덱스는 아웃라인 SVG로 렌더 → **기존 8개 외 새 단어는 아웃라인 패스가 없어 일반 텍스트 폴백**. 필요 시 `node scripts/genOutlines.cjs` 재실행(5절 참고).

**(2) Outro 배경영상 복구** (커밋 `d9a789e`)

- 증상: Beyond 패널 배경영상이 안 나옴.
- **근본 원인**: `public/assets/outro-bg.mp4`(2.14MB)가 `ed07f5e`(관리자 CMS 작업, 7/31)에서 **영상과 무관하게 실수로 삭제**됨. `Outro.jsx`의 `<source>` 참조는 그대로여서 조용히 깨져 있었음.
- **수정**: `git checkout dde99b6 -- public/assets/outro-bg.mp4`로 복구. 라이브 200/`video/mp4` 확인.
- 교훈: 이 파일은 `.gitignore` 대상이 **아님**(대용량 목록에 없음). `git add -A` 시 미디어 삭제가 딸려가지 않는지 `git status` 확인할 것.

**(3) WHAT WE DO 세로 여백 균등화** (커밋 `d9a789e`)

- 증상: 라벨↔대문구↔목록↔하단 세 여백이 제각각(실측 105/115/121px).
- **근본 원인**: 세 여백이 서로 다른 값에서 나옴 — 섹션 `padding-top`+절대배치 `.sec-label`, 대문구 `margin-bottom`, 섹션 `padding-bottom`.
- **수정**(`index.css`의 `#whatwedo`): flex column + `--wwd-gap` 하나로 통일. `.sec-label`을 `position:static`으로 흐름에 넣고 원래 위치는 `padding-top`으로 유지. 대문구가 flex 아이템이 되며 자체 BFC → `.line`의 음수 마진이 부모로 새지 않아 박스가 글자 줄에 딱 맞음.
- 태블릿은 미디어쿼리 안에서 `--wwd-gap`만 재정의(기존 `.sec-statement` margin 오버라이드 대체).

**(4) WHAT WE DO 여백 2차 — 남는 높이를 균등 분배** (커밋 `2faac7e`)

- (3)으로 수치는 같아졌는데 사용자는 계속 "안 고쳐졌다"고 함. 원인은 **고정 vh 여백이라 섹션이 100vh를 넘겨(2532×1263에서 1392px) 하단 여백 155px 중 26px만 보이고 잘린 것**. 값이 아니라 가시성 문제였음.
- **수정**: `min-height:100vh` + `justify-content:space-between` + 하단 여백용 빈 `::after`. `--wwd-gap`은 고정값이 아니라 **최소값(7vh)** 역할로 바뀌고, 남는 높이를 세 여백이 똑같이 나눠 갖는다. 항목 수가 늘어도 자동으로 균등.
- **검증**: 2532×1263에서 섹션 1263px(화면에 딱 맞음), 여백 112.2/111.6/111.0, 마지막 줄 아래 보이는 여백 26px→111px.
- ⚠️ 남는 제약: **창 세로 ~1100px 미만이면 항목 6개가 한 화면에 안 들어감**(여백은 균등하나 하단이 잘림). 해결하려면 `.svc-row`의 상하 padding(36px)을 화면 높이에 따라 줄여야 함.

**(5) WORK 상세 — 카테고리 라벨 버그 / 로케이션 / 태그** (커밋 `c2cf185`, `6835043`)

- **카테고리가 슬러그로 표시되던 버그**(`led`, `media-facade`, `commercial`): `catLabel`이 **두 벌** 있었음 — `workProjects.js`의 정적 버전은 하드코딩된 기본 5개만 알아서 관리자에서 추가한 분야는 라벨을 못 찾고 슬러그를 그대로 노출. `WorkDetail.jsx`와 `Admin.jsx` 프로젝트 목록이 정적 버전을 쓰고 있어 **`ProjectsContext`의 동적 버전으로 교체**.
  - ⚠️ 앞으로 카테고리 라벨이 필요하면 **반드시 `useProjects()`의 `catLabel`**을 쓸 것. `workProjects.js`의 export는 하위호환용 잔재.
- **태그(구분/`kind`) 제거**: 프로젝트 8개 중 7개가 비어 있고 나머지 1개도 카테고리와 중복이라 상세 표시·관리자 입력칸을 삭제. `projectStore.js`의 `toRow`에서 `kind`를 빼서 **저장해도 기존 DB 값이 보존**된다(되살리려면 `toRow`에 `kind` 복구 + Admin 입력칸 + WorkDetail 렌더 3곳).
- **레이아웃**: 두 줄이던 `.wd-breadcrumb`(카테고리) / `.wd-tagrow`(로케이션)를 한 줄로 병합(`.wd-tagrow` 제거). `align-items:baseline` + `.wd-loc{margin-left:auto}` → 글자 크기가 달라도 밑선이 맞고 로케이션은 항상 우측 고정. 카테고리는 `var(--accent)` 포인트컬러, hover는 `opacity:.7`.

**(6) 소셜 링크 정비** (커밋 `5c9d88d`)

- Vimeo → **LinkedIn** 교체(라벨·URL·아이콘 SVG). YouTube·Behance가 `url:'#'` 플레이스홀더였어서 실제 주소도 연결.
- 표시 순서: **YouTube → Instagram → Behance → LinkedIn**.
- `socials.jsx`의 `SOCIAL` 배열이 Contact·Footer 공용 단일 소스라 **한 곳만 고치면 모바일·태블릿·데스크톱 전부 반영**된다(데스크톱=텍스트 `.soc-txt`, 모바일=아이콘 `.soc-ic`). 소셜을 늘리려면 배열에 항목 추가 + 24×24 뷰박스 아이콘 path만 넣으면 됨.

**(7) CONTACT 로고 모션 밴드** (커밋 `ff874c1`)

- 위치: 주소 블록 아래 구분선 ↔ 소셜 사이(`.ct-logo`).
- **영상 경량화**: 마스터 3840×800·19.7Mbps·23.5MB → `1920×400 CRF22`로 재인코딩해 **0.19MB(99.2%↓)**. 평면 색상이라 화질 손실 없음. 마스터 `public/VIREN_motion_wide.mp4`는 `.gitignore` 처리(로컬엔 남아 있음).
  ```
  ffmpeg -i public/VIREN_motion_wide.mp4 -vf "scale=1920:400:flags=lanczos" \
    -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -an -movflags +faststart \
    public/assets/viren-logo-motion.mp4
  ```
- ⚠️ **`.ct-logo`의 `background:var(--bg)`를 지우지 말 것.** 영상 배경이 순검정(#000)이고 페이지는 `#0a0a0a`라 `mix-blend-mode:screen`으로 녹이는데, `main > section`이 `position:relative`+`z-index`로 독립 stacking context를 만들어 **배경을 칠하는 `main`이 그 바깥에 있다** → 블렌드 대상이 없어 검은 사각형이 그대로 보였음. 부모에 같은 배경색을 깔아야 backdrop이 생긴다.
- ⚠️ **높이는 `aspect-ratio`로.** 고정 `height`로 두면 넓은 화면에서 로고 아래가 잘린다(실측 16px). `aspect-ratio:1920/230`이면 잘라내고 보이는 소스 영역이 항상 세로 230px로 고정돼 로고(실측 y 109~286px)가 절대 안 잘린다. `object-position:center 48.5%`는 위아래 여백을 맞춘 값.
- 모바일(≤760)은 같은 비율이면 로고가 132px까지 작아져 `aspect-ratio:5/2`로 별도 처리(세로를 키우면 cover가 좌우를 잘라 로고가 커짐 — 좌우는 어차피 검정 여백).
- **검증**: 2532×1263 로고 886px(폭의 38%), 1440×900 482px(38%), 390×844 253px(72%). 전 구간 잘림 없음.

## 8. 현재 상태 / 다음 확인

### 🔜 다음에 이어서 할 것
1. **네이버 수집 현황 재확인 (2026-08-21~22경)** — 8/18에 프리렌더를 올렸고 사용자가
   수집 요청 5건 + 사이트맵을 재제출했다. 서치어드바이저 `리포트 → 수집 현황`의
   페이지 수가 **2건에서 늘었는지**가 성공 판정 기준. 늘지 않으면 10-3절의 검증 스니펫부터
   돌려 정적 파일이 실제로 나가는지 다시 확인할 것.
2. **청주 서문교 본문 보강** — 사용자가 작성 중. 현재 3블록(label+text+features 5종)뿐이고
   제주목 관아처럼 구역별 `center`+이미지, Location이 없다. 자료(3360×384 / 8.75:1 /
   대기영상 10분 / 체험 15초×9 / 총 16종)는 `VIREN_유튜브_설명문.md` 7번 항목에 있다.
3. **사이트 WORK 산출물 수량** — 최종 표와 8건 불일치(벚꽃콘텐츠만 일치).
   대조표는 `VIREN_유튜브_설명문.md` 맨 아래. 사이트는 요약/유튜브는 전체 내역이라
   **똑같이 맞출 필요는 없다**는 데 사용자와 합의됨. 총 개수만 어긋나지 않으면 됨.
4. **모바일 히어로 크롭 위치** — 현재 가운데(1920 중 656~1264px). 다른 구간이 낫다고
   판단되면 7절 (3)의 `crop` x값만 바꿔 재인코딩하면 된다.
5. ~~APEC 경주 상세 34.1MB~~ → **해결.** 지연 재생으로 초기 다운로드가 약 2MB가 됐다.
   파일 자체는 그대로이므로 전체를 다 보면 여전히 32MB다(11-1절 아래 "남은 것" 참고).
6. **Cached Egress 7.114GB** — 8/27 주기 리셋 전까지 초과 배지가 남아 있을 수 있다.
   다음 주기부터는 페이지 용량이 1/10이라 정상으로 돌아올 것.

### 완료됨 (2026-08-18)
- **프리로더 4.5초 → 2.6초 이내**(빠른 회선 1.5초대). 애니메이션 1.6배 가속 + 공개 기준을
  내비게이션 시작으로 변경 + 리렌더로 타이머가 재시작되던 버그 수정. 상세는 11-1절.
- **WORK 영상 지연 재생** — 화면에 들어올 때만 재생. APEC 상세 초기 다운로드 32MB → 약 2MB.
  화질은 그대로다(재압축은 9MB만 줄고 SSIM이 0.973까지 떨어져 채택하지 않음).
- **미디어 대청소**: 스토리지 1,064MB → 88MB. 고아 29개 삭제, 이미지 64개 WebP화(−97.5%),
  영상 10개 CRF20 재인코딩(−75%). 페이지당 157MB → 12.8MB. 상세는 11절.
- **업로드 자동 압축 기능** 추가(`mediaCompress.js`) — 같은 일이 반복되지 않도록.
- `service_role` 키는 사용 후 폐기 완료(legacy JWT 비활성화 + Revoke). 사이트는 신형
  `sb_publishable_` 키로 동작하므로 영향 없음(번들 실측 확인).
- 네이버: 수집 요청 5건 + 사이트맵 재제출, 스마트플레이스 대표키워드·영업시간 수정.
- 구글: 몬순·벚꽃콘텐츠 색인 요청 완료.
- 유튜브: 대천해수욕장 설명문 해상도 `3072×1536` 반영 완료.
- 제주목 관아 본문 3블록 → 19블록.

### 상태
- **2026-08-18 커밋 4건 전부 배포·라이브 검증 완료.**
  - 프리렌더 13쪽 + 사이트맵 자동 생성, canonical 13개 전부 고유 확인(Yeti UA 실측)
  - 히어로 배경 영상 교체 + 어둠막 + 모바일 전용 인코딩(모바일/태블릿/데스크톱 실측)
- 작업 트리 깨끗(`showreel-build/`만 untracked).
- ⚠️ **`video` 직접 업로드는 실사용 검증 전이다.** 현재 video 블록을 쓰는 프로젝트가 0개라
  회귀 위험은 없으나, 실제 업로드→재생은 사용자가 처음 넣어볼 때 확인이 필요하다.
  (판별 정규식 9케이스·빌드·훅 배치는 검증 완료)
- 미해결: **7-1 (4)** 의 "창 세로 ~1100px 미만에서 WHAT WE DO 6개가 한 화면에 안 들어감" — 사용자 화면(1263)에서는 문제 없어 보류 중.
- **7-1 (7)** 로고 밴드의 로고 크기는 데스크톱에서 콘텐츠 폭의 38%. 원본 영상 좌우 검은 여백 때문인데, 더 키우려면 `aspect-ratio`를 높이면 됨(대신 밴드가 세로로 커져 아래가 밀림). 사용자 확인 후 현재 값으로 확정.
- **SEO 설정 완료(10절)** — 네이버·구글 등록, 페이지별 title/canonical/h1까지 완료. 색인 반영 대기 중. 유튜브 채널 노출은 10-1절.
- **git 저장소 밖 산출물** (커밋 대상 아님):
  - `C:\Users\c\Documents\클로드\VIREN_3D로고_백업\` — 히어로 3D 로고(Scene3D) 사본 + `복원방법.md`. 7절 (3) 참고.
  - `C:\Users\c\Documents\클로드\VIREN_영상원본\` — 히어로 영상 원본 184MB. **저장소에 넣지 말 것**(GitHub 100MB 제한).
  - `C:\Users\c\Documents\클로드\QR\` — 홈페이지 QR 4종(SVG/PNG). 명함 인쇄는 `viren_qr.svg`, 최소 20mm, 흰 여백 유지. 정적 QR이라 만료 없음(도메인만 유지되면 영구).
  - `C:\Users\c\Documents\클로드\VIREN_유튜브_설명문.md` — 유튜브 영상 설명문 원고(10-1절).
- ⚠️ **`public/` 아래 다운로드/정적 파일이 없으면 `vercel.json` 전체 리라이트에 걸려 `index.html`이 200으로 내려간다.** 파일이 없는 게 아니라 "깨진 파일이 받아지는" 형태로 드러나므로 발견이 늦다. robots.txt·sitemap.xml·회사소개서 PDF 모두 이 문제였음. 새 다운로드 파일을 붙일 땐 라이브에서 `Content-Type`을 반드시 확인할 것.
  ```bash
  curl -sI https://www.viren.kr/assets/<파일명> | grep -i content-type
  ```
- 참고: `showreel-build/`는 커밋하지 않은 로컬 작업 폴더(쇼릴 빌드용).
- **WORK 분야는 4종으로 정리됨**: `media-art / led / exhibition / commercial`.
  기존 `media-facade`·`immersive`는 삭제. 4종 모두 `숨김` 상태라 WORK 필터엔 `전체`만 노출된다(의도된 설정).
  `commercial`은 현재 사용하는 프로젝트 없음.
- ⚠️ **카테고리를 삭제할 땐 그 분야를 쓰는 프로젝트를 먼저 옮길 것.** 남겨두면 `catLabel`이 라벨을
  못 찾아 상세 페이지에 **슬러그가 소문자 그대로 노출**된다(`immersive`, `led` 두 번 발생).
  점검: DB의 `projects.cat` 값이 전부 `site_settings.work_categories`의 slug 안에 있는지 대조.

## 9. 검증 팁 (이 프로젝트 특성)

- dev 서버는 **Browser 프리뷰 탭(localhost:5173)**으로 확인. `preview_start`/`navigate`/`javascript_tool`.
- ⚠️ **여백/레이아웃 지적은 사용자 화면 크기부터 맞추고 측정할 것.** 이 사이트는 여백이 vh/vw 기반이라 창 크기가 다르면 값이 완전히 달라진다. 실제로 임의의 크기(1398×1270, 2000×1000)에서 측정해 "이미 고쳤다/캐시 문제다"라고 두 번 잘못 답한 적 있음. 사용자 실제 창은 2532×1263이었고 거기서만 재현됨.
  - 스크린샷에서 창 크기 역산: **`.svc-row` 행 간격은 실제 121px 고정** → 스크린샷의 행 간격과 비교하면 축소 배율이 나오고, 이미지 폭 ÷ 배율 = 실제 창 폭.
  - 측정은 `getBoundingClientRect`보다 **`offsetTop` 누적**이 안전(Reveal/framer-motion의 transform이 rect에 섞여 들어옴).
- 풀페이지 홈은 `body{overflow:clip}` + CSS `scroll-behavior:smooth`라 `window.scrollTo({behavior:'auto'})`가 **비동기로 동작해 직후 읽으면 0이 나온다**. `behavior:'instant'`를 쓸 것.
- Browser 패널이 화면에 표시돼 있지 않으면 **스크린샷이 타임아웃**된다(페이지가 프레임을 합성하지 않음). 시각 확인이 필요하면 사용자에게 패널을 열어달라고 요청.
- **프리로더 로딩 시간은 `performance.mark`로 측정한다.** 수명이 짧아 실시간 캡처가 안 되던 문제를
  마크로 해결했다(2026-08-18). 페이지 로드 후 아무 때나:
  ```javascript
  performance.getEntriesByName('viren:reveal')[0].startTime   // 내비게이션 시작 기준 ms
  ```
  종료 전환의 computed 값을 봐야 할 때만 `#loader`에 `done`을 직접 부여하는 옛 방법을 쓴다.
- ⚠️ **Browser 패널이 숨겨져 있으면(`document.visibilityState === 'hidden'`) 타이머와 CSS
  애니메이션이 억제된다.** 같은 코드로 1540 / 2447 / 3331ms가 나왔다. 시간 측정을 신뢰하려면
  패널이 화면에 보이는 상태여야 한다. 값이 튀면 먼저 `document.hidden`을 확인할 것.
- 영상 프레임 분석: ffmpeg 설치됨(`winget Gyan.FFmpeg`). `ffmpeg -i in.mp4 -vf "fps=12,scale=360:-1,tile=6x4" out.jpg`로 콘택트시트 생성 후 Read로 확인.
- 영상 위에 얹은 요소가 잘리는지 확인할 땐 **캔버스 픽셀 측정**이 확실하다. `drawImage`로 여러 시점(예: 1·2.5·4·5·6.5·8·9.5초)을 그려 비검정 픽셀의 최대 경계를 구하고, `object-fit:cover`가 보여주는 소스 영역과 비교. 한 프레임만 보면 최대 범위를 놓친다(로고 실측이 121~262 → 109~286으로 커졌음).

## 10. 검색 노출(SEO) — 네이버·구글 (2026-08-06 설정 완료)

### ⚠️ 건드리면 안 되는 것
- `index.html`의 소유확인 메타 태그 **2줄을 지우면 검색엔진 등록이 해제된다.**
  ```html
  <meta name="naver-site-verification" content="9a0eb5b4..." />
  <meta name="google-site-verification" content="0nMFnQ34r-..." />
  ```
- `public/robots.txt` 삭제 금지. (`sitemap.xml`은 빌드 산출물이라 `public/`에 없는 게 정상)

### 설정 내용
| 파일 | 내용 |
|---|---|
| `index.html` | 프리렌더 템플릿. 기본 title/description, canonical, OG 태그, JSON-LD(Organization: 상호·주소·전화·소셜 4개), `<noscript>` 본문, 소유확인 2줄 |
| `public/robots.txt` | 전체 허용 + `/admin` 제외, Yeti 명시, Sitemap 경로 |
| `scripts/prerender.mjs` | 라우트별 정적 HTML + `sitemap.xml` 생성(10-3절) |
| `src/lib/seoRoutes.js` | `SEO`·`H1`·프로젝트 제목/설명 규칙 — 앱과 프리렌더의 **단일 출처** |
| `src/lib/useSeo.js` | **라우트별** title/description/canonical/og 갱신(클라이언트 라우팅용) |
| `src/App.jsx` | 페이지별 `<h1 className="sr-only">` + `path="*"` 404(noindex) |

### ⚠️ useSeo의 두 가지 함정 (2026-08-10 추가)
- **태그를 새로 만들지 말고 index.html의 기존 태그를 덮어쓸 것.** 추가 방식이면 head에
  `title`·`canonical`이 둘씩 생기고, 크롤러는 보통 앞의 것(=정적 홈 값)을 채택해 수정이 무의미해진다.
  검증법: `document.head.querySelectorAll('title').length === 1`.
- **JS 실행 후에만 반영된다.** 구글은 렌더링하므로 OK, 네이버 Yeti는 원본 HTML만 읽는다.
  → 2026-08-13부터 `scripts/prerender.mjs`가 라우트별 원본 HTML을 따로 구워 해결(10-3절).
  `useSeo`는 이제 **클라이언트 라우팅 시 갱신**을 담당한다.

### 왜 안 떴었나 (원인 4가지)
1. **사이트 어디에도 '바이렌'이라는 문자열이 없었다** — 해당 키워드로는 매칭 자체가 불가능했음.
2. `robots.txt`·`sitemap.xml`이 실제로 없었다. `vercel.json`의 전체 리라이트가 잡아 HTML을 200으로 반환해 **있는 것처럼 보였을 뿐**. `public/`에 실제 파일을 두면 Vercel 파일시스템 검사가 리라이트보다 먼저 처리한다.
3. CSR SPA라 크롤러가 받는 HTML이 `<div id="root"></div>`로 비어 있었다. **네이버 Yeti는 JS를 실행하지 않아** 색인할 내용이 아예 없었음 → `<noscript>` 본문으로 보완.
4. canonical·OG·구조화 데이터 부재.
5. **(8/10 발견) 12개 URL이 전부 canonical을 홈(`/`)으로 선언하고 있었다.** SPA라 `index.html`
   하나를 공유한 탓. 구글에 "하위 페이지는 모두 홈의 중복이니 색인하지 마라"고 말한 셈 →
   `useSeo`로 라우트별 canonical 부여.
6. **(8/10 발견) `/`·`/work`·`/career`·`/contact`에 `h1`이 아예 없었고, 렌더링 본문에 '바이렌'이
   0회 등장했다.** 보이는 헤딩이 전부 영문 장식 문구(`We Create…`)라서. 제목·메타에만 있고
   본문에 없으면 '바이렌 미디어파사드' 같은 **조합 키워드 매칭이 불가능** → `.sr-only` h1 추가.
   화면 변화 없음(실측 1x1px), 스크린리더 접근성도 함께 개선.

### 유지보수
- ~~프로젝트 추가 시 sitemap 수동 갱신~~ → **불필요.** 사이트맵·프로젝트 목록·홈 noscript가
  전부 빌드 때 DB에서 생성된다(10-3절). **관리자에서 글만 쓰고 재배포하면 끝.**
  (Vercel은 푸시 없이도 `Deployments → Redeploy`로 재빌드 가능 — DB만 바뀌었을 때 이 방법을 쓴다.)
- 페이지 설명은 **80자 이내**(네이버 URL 검사 권장). 넘으면 경고.
- 프로젝트 상세의 title/description은 **DB의 한글 프로젝트명·본문 요약에서 자동 생성**된다
  (`seoRoutes.js`의 `projectTitle`/`projectDescription` — 화면과 프리렌더가 같은 함수를 쓴다).
- 페이지를 새로 만들면 `seoRoutes.js`의 `SEO`·`H1`에 항목을 추가하고, `useSeo()` 호출 +
  `<h1 className="sr-only">` + `prerender.mjs`의 `pages` 배열에 한 줄을 넣을 것.
- **없는 주소는 자동으로 `noindex` 처리된다.** SPA라 서버가 어떤 경로든 200을 반환해 소프트 404가 되기 때문.
  삭제된 프로젝트는 `WorkDetail.jsx`의 `notFound`(조건에 `!loading`이 필요한 이유는 10절 함정 참고),
  그 외 경로는 `App.jsx`의 `path="*"` → `NotFoundPage`가 담당한다.
- ⚠️ **`/about` 주소는 존재하지 않는다.** ABOUT은 홈의 한 구간(`fp-panel`)이라 라우트가 없다.
  검색엔진 수집 요청에 `/about`을 넣지 말 것 — 실제로 한 번 잘못 제출했다. 유효한 주소는 사이트맵 13개가 전부다.
- ⚠️ **`slugify`는 곡선 따옴표(`“ ” ‘ ’`)를 걸러내지 못한다.** 영문 제목에 따옴표가 있으면 슬러그에 그대로 들어가 URL이 `%E2%80%9C`로 인코딩된다(실제로 한 번 발생). 프로젝트 등록 시 **URL 슬러그 칸을 직접 확인**할 것. 사용자 요청으로 함수는 수정하지 않음.

### 관리 콘솔
- 네이버 서치어드바이저 · 구글 서치 콘솔 모두 소유확인 완료, 색인 요청 완료.
- **사이트맵 제출 경로 형식이 서로 반대다** — 네이버는 전체 URL(`https://www.viren.kr/sitemap.xml`), 구글은 상대 경로(`sitemap.xml`). 네이버에 상대 경로를 넣으면 "올바른 URL 형식으로 입력해주세요" 오류.
- 네이버가 robots.txt를 예전 상태로 캐시하고 있으면 URL 검사가 "접근할 수 없습니다"로 실패한다. **검증 → robots.txt → `수집요청`**으로 캐시를 갱신한 뒤 재검사할 것(실제로 이것 때문에 한 번 막혔음).

### 구글 렌더링은 정상 (확인됨)
- 구글 서치 콘솔 **실시간 테스트** 결과 "URL을 Google에 등록할 수 있음" + **`동영상 디스커버리: 동영상 감지됨`**.
  원본 HTML에는 `<video>`가 없고 React 렌더 후에만 생기므로, **Googlebot이 JS를 실행했다는 증거**다.
- 색인된 버전 기록에서 "리소스 2/4개 로드하지 못함"(JS·CSS)이 뜨지만 **오탐**이다. 두 URL 모두 Googlebot UA로 200/90ms 응답하고, 본문은 500ms 안에 DOM에 들어온다(실측 1,617자). GSC는 렌더링 서비스가 캐시/할당량 때문에 재요청하지 않은 리소스도 "기타 오류"로 표시한다. **구글 문제로 오해하지 말 것.**
- 네이버 쪽은 사정이 달라 결국 프리렌더가 필요했다 → 10-3절.

### 색인 현황 (2026-08-10 기준)
- 구글 서치 콘솔 `색인생성 → 페이지`: **색인 1 / 미색인 11**, 사유 `발견됨 - 현재 색인이 생성되지 않음`.
- ⚠️ 이건 **정상 단계다.** "발견됨"은 사이트맵이 작동해 구글이 12개 URL을 모두 알고 있다는 뜻이고,
  크롤링 순서를 기다리는 중이다. `크롤링됨 - 미색인`이나 `중복 페이지`였다면 문제였을 것.
- 위 5·6번 수정이 없었다면 크롤링 시점에 전부 `중복 페이지 — 사용자가 표준으로 지정하지 않음`으로
  탈락했을 상태였다.
- 사용자 완료: 네이버 스마트플레이스 등록, 소셜 프로필(유튜브·인스타·비핸즈·링크드인)에 홈페이지 링크.

## 10-1. 유튜브 채널 노출 (2026-08-10 진단)

- **현황**: 채널명 `VIREN`(영문 단독), 구독자 2명, 채널 설명 비어 있음(`og:description` 공란),
  채널 어디에도 '바이렌' 0회.
- **실측**: 유튜브에서 `바이렌` 검색 시 상위 8건에 **채널 카드가 아예 없고**, 유튜브가 이를
  **'바이에른 뮌헨'으로 오인식**한다. 즉 '바이렌 ↔ 이 채널'을 연결할 근거가 전무한 상태.
- **웹검색과 달리 유튜브는 '바이렌' 경쟁자가 사실상 없어 승산이 크다.** 채널명·설명·키워드·영상
  제목에 '바이렌'을 넣는 것만으로 검색에 잡히기 시작한다(구글 웹색인보다 반영이 빠름).
- 사용자에게 전달한 조치: ① 채널명 `VIREN 바이렌` ② 채널 설명(한/영) ③ 채널 키워드
  ④ 영상 제목·설명에 '바이렌' 포함.
- ⚠️ **스크린샷의 d'strict처럼 최상단 채널 카드가 뜨는 건 구독자 2명으로는 불가**하다.
  그건 유튜브가 "이 검색어 = 이 채널"을 확신할 때 나오며, d'strict는 구독자 3.7만·영상 185개로
  쌓은 결과다. 보유 프로젝트 영상 업로드 → 프로젝트명 검색 유입 → 데이터 축적 순서가 현실적 경로.
### ✅ 2026-08-11 적용 완료
- 채널명 `VIREN 바이렌`, 채널 설명(한/영), 키워드, 링크 3개 등록.
- 영상 9개 전부 제목·설명문 입력 완료(각 1,100~1,900자, '바이렌' 3회씩, 영문판·해시태그 포함).
- 재생목록 3개 생성 — `MEDIA ART | 바이렌 VIREN` / `LED CONTENT | 바이렌 VIREN` /
  `EXHIBITION | 바이렌 VIREN`. 사이트 WORK 분야와 동일 체계.
- 채널 홈 레이아웃 게시(재생목록 3섹션) + 트레일러 `2025 APEC 경주`.
- ⚠️ **재생목록 메뉴는 사이드바가 아니라 `콘텐츠` → 상단 `재생목록` 탭**에 있다(UI 변경됨).
- ⚠️ 재생목록 순서를 직접 정하려면 `세부정보 수정` → **`정렬 기준`을 `수동`으로** 바꿔야 한다.
  안 그러면 드래그해도 되돌아간다.

- **영상 설명문 원고**: `C:\Users\c\Documents\클로드\VIREN_유튜브_설명문.md` (git 저장소 밖).
  프로젝트 9건 × 한/영. 구조는 `개요 → 컨셉 → 콘텐츠 제작(실제 해상도·러닝타임)`.
  - 작성 원칙 두 가지(사용자 지시): **컨셉 카피는 타사 기획물이라 인용 금지**,
    **하드웨어·장치·운영 내용 제외**(바이렌은 콘텐츠 제작 전문).
  - 참고한 동종업계 포맷: d'strict는 `사업분야 / 프로젝트 정식명 / 시기` 3줄 헤더 + 규격·러닝타임
    같은 **구체적 스펙**을 명시한다. 그 방식을 차용함.

### 남은 과제
- 1~2주 뒤 서치 콘솔 `페이지`에서 색인된 페이지 수 증가 확인.
- 신규 등록된 `아시아문화박물관 '몬순으로 열린 세계'`(국립아시아문화전당, 2023) 색인 요청 미완료.
- **`바이렌` 단독 검색 상위는 기술로 해결되지 않는다.** 한국어 위키백과 문서를 가진 중국 반도체
  기업(바이렌 테크놀로지), 두유메이커, Isabel Marant 모카신이 선점한 경쟁 키워드다.
  현실적 목표는 `바이렌 미디어파사드`·`APEC 경주 미디어파사드` 같은 **조합/프로젝트명 키워드**이고,
  프로젝트 상세는 이미 한글 본문(발주처·연도·기획의도)이 충실해 색인만 되면 잡힐 여지가 크다.
  그 위는 보도자료·수주 기사·발주처 사이트 시공사 표기 등 **외부 언급량**이 쌓여야 한다.
- `개선사항: URL에 개선사항이 없습니다` / `향상된 내용이 없습니다`는 정상. Organization 스키마는 리치 결과 유형이 아니라 이 패널에 잡히지 않는다.

## 10-3. 라우트별 프리렌더 (2026-08-18) — 네이버 색인의 실제 병목

### 무엇이 문제였나
네이버 서치어드바이저 `리포트 → 수집 현황`이 **2건에서 멈춰 있었다.** 서버는 멀쩡했다
(Yeti UA로 `/` 200, robots·sitemap 200, 수집 **제한 0건**). 원인은 응답 내용이었다:

```
/         canonical: https://www.viren.kr/   ← 정상
/work     canonical: https://www.viren.kr/   ← 홈을 가리킴
/contact  canonical: https://www.viren.kr/   ← 홈을 가리킴
```

SPA라 모든 주소가 같은 `index.html`을 받고, `useSeo`가 canonical을 고치는 건 **JS 실행 후**다.
구글은 렌더링하므로 4쪽이 색인됐지만, **Yeti는 원본만 읽어 "이 페이지의 원본은 홈"이라는
선언을 그대로 믿고 버렸다.** 수집 요청을 아무리 넣어도 전부 홈 하나로 합쳐지던 상태.

### 해결
`vite build` 뒤 `node scripts/prerender.mjs`가 라우트별 HTML을 `dist`에 굽는다.

- `dist/index.html`(홈) · `dist/work/index.html` · `dist/work/<slug>/index.html` … **13쪽**
- 각 쪽의 `title`·`description`·`canonical`·`og:*`·`<noscript>` 본문을 **덮어쓴다**(추가 아님 — 10절 함정)
- `<noscript>` 본문·프로젝트 목록·`sitemap.xml`을 **DB에서 생성**한다(PostgREST 직접 호출)
- Vercel 라우팅 순서가 `redirects → 파일시스템 → rewrites`라, 정적 파일이 있으면
  `vercel.json`의 전체 리라이트보다 먼저 처리된다. **사용자 동작은 그대로, 크롤러가 받는 원본만 달라진다.**

### 규칙
- **문구는 `src/lib/seoRoutes.js` 한 곳에만.** 앱(`useSeo`/`WorkDetail`)과 프리렌더가 같이 쓴다.
  두 곳에 적으면 반드시 한쪽만 고쳐지고, 화면과 크롤러가 보는 내용이 달라지면 **클로킹**으로 간주된다.
- `seoRoutes.js`에 **react를 import하지 말 것.** Node가 빌드 중에 그대로 불러 쓴다.
- `index.html`은 이제 **템플릿**이다. `<title>`·`<noscript>` 등의 태그 형태를 바꾸면
  프리렌더의 정규식이 못 찾고 **빌드가 실패한다**(조용히 넘어가지 않도록 일부러 그렇게 했다).
- DB에 못 닿으면 시드로 폴백하고 빌드 로그에 경고를 남긴다. 배포 로그에
  `! DB 미연결 → 시드 프로젝트로 폴백`이 보이면 프로젝트 페이지가 누락된 것이니 환경변수를 확인할 것.
- 성공 로그: `✓ 프리렌더 13쪽 + 사이트맵 13건 (프로젝트 9)`

### 검증법
```bash
for p in / /work /contact /work/coastal-multimedia-show; do
  curl -s -A "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)" "https://www.viren.kr$p" \
    | grep -o 'rel="canonical" href="[^"]*"'
done
```
네 줄이 **서로 다르면** 정상. 전부 같으면 정적 파일이 안 나가고 리라이트를 타는 것이다.

## 11. 미디어 용량·대역폭 (2026-08-18 대청소)

### 무슨 일이 있었나
Supabase 무료 플랜 한도를 넘겼다. `EXCEEDING USAGE LIMITS` 배지가 떠 있었고,
원인은 방문자가 많아서가 아니라 **페이지 하나가 157MB**였기 때문이다.

| 항목 | 정리 전 | 정리 후 |
|---|---|---|
| 스토리지 | 1,063.9MB (한도 1GB 초과) | **87.8MB** |
| 이미지 64개 | 536.8MB | 13.4MB (−97.5%) |
| 영상 10개 | 297.4MB | 74.3MB (−75.0%) |
| 고아 파일 29개 | 229.7MB | 0 |
| 청주 서문교 1회 방문 | 157.8MB | 12.8MB |

Cached Egress는 이미 7.114GB로 5GB 한도를 넘긴 상태였다(주기 리셋 8/27).

### 원인
- **이미지를 인쇄용 PNG 원본 그대로 업로드**했다. 최대 7801×2601·36.7MB.
  화면에서 그려지는 폭은 `#work-detail`의 1400px뿐이다.
- **영상이 거의 무손실**이었다. 960×600을 15.7Mbps로 인코딩한 파일이 49.7MB.
  유튜브가 1080p를 4~5Mbps로 내보내는 것과 비교하면 자릿수가 다르다.
- **블록을 교체하며 남은 파일이 지워지지 않는다.** 관리자에서 이미지를 바꿔도
  이전 파일은 스토리지에 남는다(29개·229.7MB가 그렇게 쌓였다).

### 재발 방지 — 업로드 시 자동 압축 (`src/lib/mediaCompress.js`)
- `compressImage`: 긴 변 2400px + WebP q82. `uploadThumb`이 자동으로 거친다.
  - 2400px 근거: 화면 최대 1400px × 레티나 2배 ≈ 2800, 여유 두고 2400.
  - ⚠️ **gif·svg는 건드리지 않는다**(애니메이션·벡터가 깨진다).
  - ⚠️ 결과가 원본보다 크면 원본을 쓴다(작은 이미지에서 실제로 발생).
  - EXIF 회전은 `imageOrientation:'from-image'`로 반영. 빼면 휴대폰 사진이 눕는다.
- `inspectVideo` + `MAX_VIDEO_MB = 20`(기존 50) + `WARN_MBPS = 4`:
  브라우저에서 영상 재인코딩은 비현실적이라(ffmpeg.wasm 수십 MB·매우 느림)
  **막지 않고 알려준다.** 4Mbps를 넘으면 ffmpeg 명령을 화면에 띄운다.
- ⚠️ **이미 올라간 파일에는 소급 적용되지 않는다.** 새 업로드부터만 적용된다.

### 수동 정리가 필요할 때
스토리지 쓰기는 `anon` 키로 안 된다(RLS: public read / authenticated write).
`service_role` 키를 `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY=`로 넣고 스크립트를 돌린 뒤,
**대시보드에서 반드시 폐기**할 것(`API Keys → Legacy 탭 → Disable JWT-based API keys`
→ `JWT Keys → PREVIOUS KEY → Revoke key`. 순서를 지켜야 한다).

- ⚠️ **삭제 API는 권한이 없어도 200을 준다.** 응답 본문이 빈 배열 `[]`이면 아무것도
  안 지워진 것이다. 상태 코드만 보고 성공으로 판단하지 말 것(실제로 속았다).
- ⚠️ **고아 파일 판정은 지우기 직전에 다시 하라.** 사용자가 그 사이 블록을 교체하면
  결과가 달라진다. 실제로 아침에 참조되던 이미지 3장이 오후엔 고아가 되어 있었다.
- 삭제 전 백업은 필수. 원본은 저장소 밖에 있다(8절 목록 참고).

### 압축 기준 (검증된 값)
```bash
# 이미지 — 눈으로 구분 불가, 97% 감소
ffmpeg -i in.png -vf "scale='min(2400,iw)':'min(2400,ih)':force_original_aspect_ratio=decrease:flags=lanczos" \
  -c:v libwebp -quality 82 -compression_level 6 out.webp

# 작품 영상 — SSIM 0.979, 눈으로 구분 불가
ffmpeg -i in.mp4 -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart out.mp4
```
- 히어로 배경(7절)은 CRF 33이지만 **작품 영상에 그 값을 쓰면 안 된다.** 배경은 글자 뒤에
  깔리고 20% 불투명도로 흐려지지만, WORK 영상은 결과물 그 자체다.
- 파일명은 `.png` 그대로인데 내용은 WebP다. **브라우저는 Content-Type을 보므로 정상**이고,
  같은 이름으로 덮어써야 DB의 URL을 안 건드린다.

### 남은 것
- **APEC 경주** — 1600×400 영상 3개(13.3/12.2/6.9MB)가 유독 크다. 가로로 긴 미디어파사드라
  압축이 덜 먹혔다. 원본에서 CRF 23으로 다시 뽑아도 32.4→23.1MB(9MB)뿐이고 SSIM이 0.973까지
  떨어져 **채택하지 않았다.** 대신 지연 재생(11-1절)으로 초기 다운로드를 약 2MB로 줄였다.
  파일 자체는 그대로이므로 끝까지 다 보면 32MB다.
- 자동재생을 끄고 포스터+재생버튼으로 바꾸면 대역폭이 10분의 1 이하가 된다.
  첫인상에서 움직임이 사라지는 게 trade-off. 사용자 판단 대기.

## 11-1. 프리로더 로딩 시간 (2026-08-18)

**사이트 공개까지 최대 2.6초, 빠른 회선에서는 1.5초대.** (이전 4.5초)

### 조절 지점 — `src/components/Preloader.jsx` 상단 3개 값
| 상수 | 값 | 뜻 |
|---|---|---|
| `ANIM_RATE` | 1.6 | 로고 드로잉 재생 배속 |
| `REVEAL_AT` | 2600 | **내비게이션 시작 기준** 공개 상한(ms) |
| `MIN_SHOW` | 1500 | 최소 노출(ms) — 로고가 번쩍이고 사라지는 것 방지 |

공개 시각 = `min(애니메이션 완료, mount + max(MIN_SHOW, REVEAL_AT − mount))`
→ 프리로더 마운트가 1.1초 이내면 **2.6초를 넘지 않는다**(실측 마운트 0.15~0.95초).

길게/짧게 바꾸려면 `REVEAL_AT`만 손대면 된다.

### 왜 4.2초였고, 무엇을 줄였나
원래 `setTimeout(finish, 4200)` 고정이었다. 그런데 로고 애니메이션은 **2.24초에 끝난다**
(실측: vDraw 1636ms → vFillIn 2136ms → vStrokeOut 2236ms). 뒤쪽 2초는 **완성된 로고가
그냥 멈춰 있던 시간**이었다. 애니메이션을 잘라낸 것이 아니다.

### 애니메이션 가속 — playbackRate로 한다
`public/viren-draw-animation.html`은 도구로 내보낸 번들(113KB)이다. 안에 `speed` prop이
있고 `k = 1 / speed`로 모든 타이밍이 스케일되지만, **밖에서 넘길 방법이 없다**
(URL 파라미터·dataset 미지원). 그래서 iframe 안 애니메이션의 `playbackRate`를 올린다.

- ⚠️ **iframe의 `load` 시점에는 애니메이션이 아직 없다.** 번들 컴포넌트가 그 뒤에 마운트되며
  생성한다. `load`에서 바로 `getAnimations()`를 부르면 빈 배열이 와서 가속도 조기 종료도
  걸리지 않는다(실측: 공개가 3.5초로 늘어남). → 50ms 간격으로 최대 1.5초 폴링한다.
- 번들은 `setInterval(play, 5200)`으로 애니메이션을 다시 만든다. 우리는 그 전에 끝나므로
  문제없지만, 재생성된 애니메이션은 배속이 1로 돌아간다는 점만 기억할 것.

### ⚠️ 리렌더로 타이머가 재시작되던 버그
`Boot`이 `<Preloader onDone={() => setReady(true)}>`처럼 **인라인 함수**를 넘긴다.
`useEffect`가 `[onDone]`에 의존해 있어 리렌더마다 effect가 재실행되고 **대기 타이머가
처음부터 다시 시작**했다. 목표 2.6초가 라이브에서 3.24초로 밀렸다.
→ 콜백을 ref에 담고 의존성을 `[]`로 바꿨다. **이 패턴을 되돌리지 말 것.**

### 종료 전환 (`index.css`의 `#loader.done`)
페이드 지연 .6s→**.28s**, 페이드 .55s→**.45s**, 줌 1.15s→**.85s**,
언마운트 1900ms→**1250ms**(`Preloader.jsx`). 네 값은 함께 움직여야 한다 —
언마운트가 전환보다 빠르면 전환이 렌더되지 않고 툭 끊긴다.

`#loader`는 `pointer-events:none`이라 전환 중에도 조작을 막지 않는다.

### 예외
- `prefers-reduced-motion: reduce` → 300ms
- `/admin` → 프리로더 자체를 건너뜀(`App.jsx`의 `Boot`)

## 12. 과거에 반영된 주요 작업 (참고)

WORK 콘텐츠 블록(라벨/중앙/특징카드/텍스트, 드래그 재정렬), 특징카드 수량별 중앙정렬·균등 구분선, CONTACT 재배치, footer 소셜 가로1열·여백 축소, Philosophy 폰트 로테이션·프레임·간격, Outro 배경영상(4K→1080p 다운스케일), CAREER 공지 고정·지원 팝업·지원서 PDF 연동, WORK 분야/WHAT WE DO CMS(독립 관리+페이지 링크), 태블릿 전용 8개 수정, 모바일 footer 이메일 SplitText 글리치 수정(will-change 제거), CONTACT 모달 portal화.

---

### 새 채팅 시작 시 첫 메시지 예시
> "VIREN 웹사이트 작업 이어서 할게. `viren-react/HANDOFF.md` 읽고 시작해줘. (경로: C:\Users\c\Documents\클로드\viren-react)"
