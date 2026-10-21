# VIREN WORK — 사내 전자결재 · 근태관리

바이렌 직원용 사내 플랫폼. 홈페이지(저장소 루트)와 같은 저장소에 있지만 **완전히 따로 돌아가는 앱**이다.

| | 홈페이지 | VIREN WORK |
|---|---|---|
| 폴더 | 저장소 루트 | `work/` |
| 서버(화면) | Vercel | Cloudflare Pages (무료) |
| 데이터베이스 | Supabase 프로젝트 ① | Supabase 프로젝트 ② (무료, **새로 만든다**) |
| 주소 | www.viren.kr | work.viren.kr (예정) |

## 기능 (1단계)

- **전자결재**: 품의서 · 휴가신청서 · 지출결의서. 결재선(순차 결재) + 참조자, 첨부파일, 승인 · 반려(사유 필수) · 회수, 인쇄
- **근태**: 달력으로 한눈에(동그라미가 가득 차면 8시간) + 표 보기. 출근 · 퇴근 버튼(서버 시각 기준), 사무실 인터넷 주소 확인(선택), 월별 기록, 엑셀(CSV) 내려받기, 관리자 보정
- **연차**: 입사일 기준 자동 계산(근로기준법 방식). 휴가신청서가 최종 승인되면 자동으로 차감되고 근태표에 표시
- **양식 만들기**: 관리자가 결재 양식을 직접 만듭니다. 칸(글·날짜·금액·고르기·표 등)을
  넣고 순서와 필수 여부를 정하면 새 문서 화면에 탭으로 나타납니다
- **캘린더**: 회사 공용 달력. 재직자 누구나 일정을 올리고(올린 사람과 관리자가 수정·삭제),
  승인된 휴가와 공휴일이 자동으로 함께 표시됩니다
- **관리**: 직원 정보 · 권한 · 재직 여부, 연차 직접 지정, 사무실 주소, 전체 백업 내려받기

메일은 2단계. 적응 기간에는 카카오워크를 그대로 함께 쓴다.

## 처음 설치하기 (한 번만)

### ① Supabase 프로젝트 만들기

1. supabase.com → **New project**. 이름 `viren-work`, 지역 **Northeast Asia (Seoul)**, DB 비밀번호는 안전한 곳에 보관.
   무료 요금제는 계정당 프로젝트 2개까지 켜 둘 수 있다(홈페이지가 1개 사용 중).
2. 왼쪽 **SQL Editor** → New query → `work/supabase/schema.sql` 내용을 **전부** 붙여넣고 **Run**.
   `Success. No rows returned`가 나오면 끝. 두 번 실행하지 말 것.
3. **Authentication → Sign In / Providers → Email**에서
   **Allow new users to sign up을 끈다.** (직원 계정은 관리자만 만든다)
4. **Authentication → Users → Add user → Create new user**
   지은님 회사 이메일 + 비밀번호, **Auto Confirm User 켜기** → Create.
   **처음 만든 계정이 자동으로 관리자가 된다.**
5. **Project Settings → API**에서 두 값을 복사해 둔다.
   - Project URL → `VITE_SUPABASE_URL`
   - anon public key → `VITE_SUPABASE_ANON_KEY`

### ② Cloudflare Pages에 올리기

1. dash.cloudflare.com 가입 → **Workers & Pages → Create → Pages → Connect to Git**
2. GitHub 연결 후 `virenmotion/viren` 선택
3. 설정
   | 항목 | 값 |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `Vite` (또는 None) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory (Advanced) | `work` |
   | Environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (①-5 값), `NODE_VERSION` = `22` |
4. **Save and Deploy** → 1~2분 뒤 `xxxx.pages.dev` 주소로 열린다.
5. (권장) 프로젝트 **Settings → Builds → Build watch paths**의 Include에 `work/*`를 넣으면
   홈페이지만 고쳤을 때는 이쪽이 다시 빌드되지 않는다.

### ③ work.viren.kr 주소 연결

1. Cloudflare Pages 프로젝트 → **Custom domains → Set up a custom domain** → `work.viren.kr`
2. cafe24 → 도메인 → DNS 관리 → **CNAME** 추가: 호스트 `work`, 값 `xxxx.pages.dev` (②-4 주소)
3. 수십 분~몇 시간 뒤 Cloudflare 화면에 Active가 뜨면 완료. HTTPS도 자동.

### ④ 직원 등록

1. Supabase → Authentication → Users → Add user (Auto Confirm 켜기)로 직원 계정 생성
2. VIREN WORK → **관리 → 직원**에 **재직 꺼진 상태**로 나타난다.
   이름 · 부서 · 직급 · 직책 · 입사일을 넣고 **재직을 켠 뒤 저장**해야 로그인할 수 있다.
   (회원가입이 실수로 열려 있어도 외부인이 들어오지 못하게 하는 이중 잠금)
3. 직원에게 임시 비밀번호를 알려 주고, 첫 로그인 후 **이름 클릭 → 비밀번호 변경**을 안내.

### ⑤ 사무실 출근 확인 (선택)

사무실 와이파이에 연결한 상태로 **관리 → 출근 설정 → 목록에 추가 → 저장**.
이후 다른 곳에서 찍은 출근은 '외부'로 표시된다. '사무실 밖에서는 출근을 못 찍게 하기'를 켜면 아예 막힌다.

## 운영 수칙

- **매달 한 번 백업**: 관리 → 백업 → 전체 백업 내려받기 → 회사 Dropbox에 보관.
  무료 서버에는 자동 백업이 없다. 첨부파일은 Supabase → Storage → approval-files에서 따로 받는다.
- **퇴사자**: 계정을 지우지 말고 관리 화면에서 **재직 끄기**. 결재 기록은 남고 로그인만 막힌다.
- **비밀번호 분실**: Supabase → Authentication → Users → 해당 직원 → Send password recovery 또는 새 비밀번호 지정.
- **연차**: 상시 5인 미만 사업장은 근로기준법 연차 규정 적용 대상이 아니다. 회사 규정이 따로 있으면
  관리 → 직원 → '연차 직접 지정'에 일수를 넣는다(그 값이 우선).
- **무료 한도**: DB 500MB, 파일 1GB. 첨부가 1GB에 가까워지면 Supabase Pro(월 $25)로 올린다.
  7일 동안 아무도 접속하지 않으면 Supabase가 프로젝트를 멈춘다(대시보드에서 Restore로 다시 켬, 데이터는 그대로).

## 보안 구조 (고칠 때 꼭 알아둘 것)

- 결재 문서 · 결재선은 테이블에 직접 쓸 수 없다. `submit_doc` · `act_on_doc` · `withdraw_doc` 함수로만 바뀐다.
  그래서 결재가 끝난 문서는 관리자도 고칠 수 없다.
- 출퇴근은 `check_in` · `check_out` 함수로만 찍고, 시각은 DB 서버 시계를 쓴다. 관리자만 보정할 수 있다.
- 문서는 기안자 · 결재선 · 참조자 · 관리자만 볼 수 있다(RLS `can_view_doc`). 근태는 본인과 관리자만.
- 저장소는 **공개(public)** 다. 코드에는 비밀이 없고(anon key는 원래 공개용), 데이터는 위 규칙으로 막힌다.
  **service_role 키나 DB 비밀번호는 절대 코드에 넣지 말 것.**

## 개발

```bash
cd work
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

DB 구조를 바꿀 때는 `supabase/schema.sql`을 고치고, **이미 운영 중인 DB에는 바뀐 부분만**
SQL Editor에서 따로 실행한다(파일 전체를 다시 실행하면 오류가 난다).
