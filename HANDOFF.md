# VIREN 웹사이트 — 작업 인수인계 (Handoff)

> 새 채팅/새 계정에서 이 파일을 먼저 읽으면 작업을 바로 이어받을 수 있습니다.
> 마지막 업데이트: 2026-08-11

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
| `index.html` | 메타/OG/JSON-LD + **검색엔진 소유확인 태그(삭제 금지, 10절)** + noscript 본문 |
| `public/robots.txt` · `public/sitemap.xml` | 검색엔진용. 프로젝트 추가 시 sitemap 갱신 필요(10절) |
| `src/App.jsx` | 라우팅 + `Boot`(인트로 프리로더 게이트, /admin 건너뜀) |
| `src/components/Preloader.jsx` | 인트로 로더 — `/viren-draw-animation.html` iframe + 종료 줌 전환 |
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
| `src/lib/projectStore.js` | projects/categories/whatwedo CRUD |
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
| `image` / `video` | 이미지 / 영상 | media, caption | |
| `divider` | 구분선 | — | 이 지점에서 스크롤 효과 구역이 나뉨 |

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

## 7. 가장 최근 작업 (이번 세션) ✅ 완료·배포됨

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
1. **'바이렌' 검색 결과 재확인 (2026-08-13~14경)** — 유튜브 세팅을 8/11에 마쳤으므로
   반영에 2~3일 필요. 8/10 기준으로는 상위 8건에 채널 카드가 없고 '바이에른 뮌헨'으로
   오인식되던 상태였다. 구글 웹검색 색인 현황(10절)도 함께 확인.
2. **대천해수욕장 유튜브 영상 설명문 1건 수정** — 최종 스펙 표에서 해상도가
   `1584×672` → **`3072×1536`**으로 바뀌었다. 원고 파일은 이미 반영됨, 유튜브 쪽만 미반영.
3. **사이트 WORK 산출물 수량** — 최종 표와 8건 불일치(벚꽃콘텐츠만 일치).
   대조표는 `VIREN_유튜브_설명문.md` 맨 아래 참고. 사이트는 요약/유튜브는 전체 내역이라
   **똑같이 맞출 필요는 없다**는 데 사용자와 합의됨. 총 개수만 어긋나지 않으면 됨.
4. 신규 프로젝트(몬순·벚꽃콘텐츠) 구글 색인 요청 미완료.

### 상태
- 2026-08-11 커밋 4건 전부 배포·라이브 검증 완료. sitemap 13 URL(DB 9개 프로젝트와 일치).
- 작업 트리 깨끗(`showreel-build/`만 untracked).
- 위 5건 모두 배포·라이브 검증 완료(번들 해시 일치 + 실측).
- 미해결 이슈 없음. 다만 (4)의 "창 세로 ~1100px 미만에서 WHAT WE DO 6개가 한 화면에 안 들어감"은 남아 있음 — 사용자 화면(1263)에서는 문제 없어 보류 중.
- (7) 로고 밴드의 로고 크기는 데스크톱에서 콘텐츠 폭의 38%. 원본 영상 좌우 검은 여백 때문인데, 더 키우려면 `aspect-ratio`를 높이면 됨(대신 밴드가 세로로 커져 아래가 밀림). 사용자 확인 후 현재 값으로 확정.
- **SEO 설정 완료(10절)** — 네이버·구글 등록, 페이지별 title/canonical/h1까지 완료. 색인 반영 대기 중. 유튜브 채널 노출은 10-1절.
- **git 저장소 밖 산출물** (커밋 대상 아님):
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
- 프리로더는 수명이 ~6s로 짧고 자동화 브라우저 지연 때문에 **실시간 캡처가 잘 안 됨**. 필요 시 로더 지속시간을 임시로 크게 늘리고 `#loader`에 `done` 클래스를 직접 부여해 `.inner`의 computed transform/opacity를 측정하는 방식이 확실함. **측정 후 지속시간 4200으로 반드시 복구.**
- 영상 프레임 분석: ffmpeg 설치됨(`winget Gyan.FFmpeg`). `ffmpeg -i in.mp4 -vf "fps=12,scale=360:-1,tile=6x4" out.jpg`로 콘택트시트 생성 후 Read로 확인.
- 영상 위에 얹은 요소가 잘리는지 확인할 땐 **캔버스 픽셀 측정**이 확실하다. `drawImage`로 여러 시점(예: 1·2.5·4·5·6.5·8·9.5초)을 그려 비검정 픽셀의 최대 경계를 구하고, `object-fit:cover`가 보여주는 소스 영역과 비교. 한 프레임만 보면 최대 범위를 놓친다(로고 실측이 121~262 → 109~286으로 커졌음).

## 10. 검색 노출(SEO) — 네이버·구글 (2026-08-06 설정 완료)

### ⚠️ 건드리면 안 되는 것
- `index.html`의 소유확인 메타 태그 **2줄을 지우면 검색엔진 등록이 해제된다.**
  ```html
  <meta name="naver-site-verification" content="9a0eb5b4..." />
  <meta name="google-site-verification" content="0nMFnQ34r-..." />
  ```
- `public/robots.txt`, `public/sitemap.xml` 삭제 금지.

### 설정 내용
| 파일 | 내용 |
|---|---|
| `index.html` | 기본 title/description, canonical, OG 태그, JSON-LD(Organization: 상호·주소·전화·소셜 4개), `<noscript>` 본문, 소유확인 2줄 |
| `public/robots.txt` | 전체 허용 + `/admin` 제외, Yeti 명시, Sitemap 경로 |
| `public/sitemap.xml` | 메인 4개 + 프로젝트 상세 8개 = 12 URL |
| `src/lib/useSeo.js` | **라우트별** title/description/canonical/og 갱신 |
| `src/App.jsx` | `SEO`·`H1` 상수 + 페이지별 `<h1 className="sr-only">` |

### ⚠️ useSeo의 두 가지 함정 (2026-08-10 추가)
- **태그를 새로 만들지 말고 index.html의 기존 태그를 덮어쓸 것.** 추가 방식이면 head에
  `title`·`canonical`이 둘씩 생기고, 크롤러는 보통 앞의 것(=정적 홈 값)을 채택해 수정이 무의미해진다.
  검증법: `document.head.querySelectorAll('title').length === 1`.
- **JS 실행 후에만 반영된다.** 구글은 렌더링하므로 OK, 네이버 Yeti는 원본 HTML만 읽으므로
  `index.html`의 기본값을 계속 본다(네이버 쪽은 `<noscript>` 본문이 담당).

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
- **WORK 프로젝트를 추가/삭제하면 `sitemap.xml`도 갱신할 것.** SPA라 크롤러가 `/work`의 링크를 따라가지 못해 사이트맵이 프로젝트 상세의 유일한 발견 경로다.
  DB와 대조하는 스니펫(불일치 즉시 확인):
  ```bash
  # DB 슬러그 목록
  curl -s "$SUPA/rest/v1/projects?select=slug&order=sort.asc" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
  # sitemap 슬러그 목록
  grep -o '/work/[a-z0-9-]*' public/sitemap.xml
  ```
- 페이지 설명은 **80자 이내**(네이버 URL 검사 권장). 넘으면 경고.
- 프로젝트 상세의 title/description은 **DB의 한글 프로젝트명·본문 요약에서 자동 생성**된다(`WorkDetail.jsx`). 관리자에서 프로젝트를 추가하면 sitemap 외에는 손댈 것 없음.
- 페이지를 새로 만들면 `SEO`·`H1` 상수(`App.jsx`)에 항목을 추가하고 `useSeo()` 호출 + `<h1 className="sr-only">`를 넣을 것.
- **삭제된 프로젝트 주소는 자동으로 `noindex` 처리된다**(`WorkDetail.jsx`의 `notFound`). SPA라 없는 slug도 200을 반환해 구글에 소프트 404로 잡히기 때문. 조건이 `!loading && !p`인 이유는 10절 함정 참고.
- ⚠️ **`slugify`는 곡선 따옴표(`“ ” ‘ ’`)를 걸러내지 못한다.** 영문 제목에 따옴표가 있으면 슬러그에 그대로 들어가 URL이 `%E2%80%9C`로 인코딩된다(실제로 한 번 발생). 프로젝트 등록 시 **URL 슬러그 칸을 직접 확인**할 것. 사용자 요청으로 함수는 수정하지 않음.

### 관리 콘솔
- 네이버 서치어드바이저 · 구글 서치 콘솔 모두 소유확인 완료, 색인 요청 완료.
- **사이트맵 제출 경로 형식이 서로 반대다** — 네이버는 전체 URL(`https://www.viren.kr/sitemap.xml`), 구글은 상대 경로(`sitemap.xml`). 네이버에 상대 경로를 넣으면 "올바른 URL 형식으로 입력해주세요" 오류.
- 네이버가 robots.txt를 예전 상태로 캐시하고 있으면 URL 검사가 "접근할 수 없습니다"로 실패한다. **검증 → robots.txt → `수집요청`**으로 캐시를 갱신한 뒤 재검사할 것(실제로 이것 때문에 한 번 막혔음).

### 구글 렌더링은 정상 — prerendering 불필요 (확인됨)
- 구글 서치 콘솔 **실시간 테스트** 결과 "URL을 Google에 등록할 수 있음" + **`동영상 디스커버리: 동영상 감지됨`**.
  원본 HTML에는 `<video>`가 없고 React 렌더 후에만 생기므로, **Googlebot이 JS를 실행했다는 증거**다.
- 색인된 버전 기록에서 "리소스 2/4개 로드하지 못함"(JS·CSS)이 뜨지만 **오탐**이다. 두 URL 모두 Googlebot UA로 200/90ms 응답하고, 본문은 500ms 안에 DOM에 들어온다(실측 1,617자). GSC는 렌더링 서비스가 캐시/할당량 때문에 재요청하지 않은 리소스도 "기타 오류"로 표시한다. **이걸 보고 prerendering을 검토하지 말 것.**
- 단, **네이버 Yeti는 여전히 JS를 실행하지 않으므로 `<noscript>` 본문이 유일한 색인 대상**이다. 네이버 노출을 더 키우려면 그때 prerendering이 실질적인 카드다.

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

## 11. 과거에 반영된 주요 작업 (참고)

WORK 콘텐츠 블록(라벨/중앙/특징카드/텍스트, 드래그 재정렬), 특징카드 수량별 중앙정렬·균등 구분선, CONTACT 재배치, footer 소셜 가로1열·여백 축소, Philosophy 폰트 로테이션·프레임·간격, Outro 배경영상(4K→1080p 다운스케일), CAREER 공지 고정·지원 팝업·지원서 PDF 연동, WORK 분야/WHAT WE DO CMS(독립 관리+페이지 링크), 태블릿 전용 8개 수정, 모바일 footer 이메일 SplitText 글리치 수정(will-change 제거), CONTACT 모달 portal화.

---

### 새 채팅 시작 시 첫 메시지 예시
> "VIREN 웹사이트 작업 이어서 할게. `viren-react/HANDOFF.md` 읽고 시작해줘. (경로: C:\Users\c\Documents\클로드\viren-react)"
