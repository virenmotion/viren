# VIREN WORK 인수인계 (AI 에이전트용)

> 이 파일을 먼저 읽으면 바로 이어서 작업할 수 있다. 마지막 업데이트: 2026-10-20 (주소 활성화 확인분 반영)
> 홈페이지 전체 인수인계는 저장소 루트의 `HANDOFF.md`. 설치·운영 안내(사람용)는 `work/README.md`.

---

## 0. 사용자와 일하는 방법 (가장 중요)

- 사용자는 **박지은님**(jieunp711@viren.kr, VIREN 경영지원·디자인). **개발 초보**다.
- 2026-10-20 지은님 요청: **"너무 어려워. 초보자가 본다 생각하고, 내가 해야 할 일만."**
  - 전문용어 쓰지 않기(push, branch, RLS, CNAME 같은 말은 풀어서 쓰거나 빼기).
  - 지은님이 할 일만, **번호 매긴 단계로 짧게**. 어디를 누르는지 버튼 이름 그대로.
  - 외부 화면(Supabase, Cloudflare, cafe24, GitHub)은 **한 단계씩 안내 → 지은님이 캡처를 보내면 확인 → 다음 단계**로 진행했다. 이 방식이 잘 통했다.
  - 위험한 버튼(DNS 이전, 기존 DNS 줄 삭제, secret/service_role 키)은 미리 "누르지 마세요"라고 짚어 준다.
- 한국어로 대화한다. 존댓말, 친근한 톤("~해 주세요", "~예요").
- 커밋·배포는 지은님이 요청하거나 승인한 범위에서 한다. main 반영은 2026-10-20 지은님이 승인("옮겨줘")했고, 이후 화면 개편도 main으로 배포했다.

## 1. 무엇을 만들었나

**카카오워크를 대체할 바이렌 전용 사내 플랫폼.** 1단계 = 전자결재 + 근태관리.
메일은 2단계. **적응 기간에는 카카오워크를 그대로 함께 쓴다**(지은님 결정).

| 기능 | 내용 |
|---|---|
| 전자결재 | 품의서 · 휴가신청서 · 지출결의서. 순차 결재선 + 참조자, 첨부(Storage), 승인/반려(사유 필수)/회수, 인쇄 |
| 근태 | 출근/퇴근 버튼(DB 서버 시각), 사무실 IP 확인(선택), 월별 표, CSV, 관리자 보정 |
| 연차 | 입사일 기준 근로기준법 방식 자동 계산(`src/lib/leave.js`), 직원별 직접 지정 가능. 휴가신청서 최종 승인 시 자동 차감·근태표 표시 |
| 관리 | 직원 정보·권한·재직, 사무실 IP, 전체 백업 JSON 내려받기 |

직원 수: 현재 **3명**, 최대 6명 예상. 상시 5인 미만이라 법정 연차 미적용 → '연차 직접 지정' 기능을 둔 이유.

## 2. 구성과 실제 설치 현황 (2026-10-20 완료)

```
GitHub virenmotion/viren (public!) ── main ──┬─> Vercel      : 홈페이지 (저장소 루트)
                                             └─> Cloudflare Pages : VIREN WORK (work/ 폴더)
                                                     │
                                                     └─> Supabase 프로젝트 viren-work (서울, 무료)
```

| 항목 | 값 |
|---|---|
| 코드 | 저장소 `work/` 폴더 (Vite + React 19 + react-router 7 + supabase-js) |
| Supabase | 조직 "비렌"(FREE), 프로젝트 `viren-work`, `https://mappjgurhsvymamkohoo.supabase.co` |
| Supabase 설정 | `supabase/schema.sql` 실행 완료. **회원가입(Allow new users to sign up) 꺼짐** |
| 첫 관리자 | jieunp711@viren.kr (박지은, 경영/대표, 입사일 2026-07-13로 입력됨) |
| Cloudflare | 계정 viren@viren.kr (처음에 잘못 만든 virenmotion@... 계정은 비어 있음, 무시) |
| Pages 프로젝트 | `viren-work`, 브랜치 main, Root `work`, build `npm run build`, output `dist` |
| 환경변수 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`(= publishable 키 `sb_publishable_...`), `NODE_VERSION=22` |
| 주소 | https://viren-work.pages.dev (정상) · https://work.viren.kr (**서버는 준비 끝, DNS 한 대 지연 — 2절**) |
| DNS | cafe24 → viren.kr → 별칭(CNAME) `work → viren-work.pages.dev` 추가함. 기존 `*`, `www → cname.vercel-dns.com` 그대로 |

**배포:** main에 push하면 Cloudflare가 자동 빌드(1~3분). 홈페이지(Vercel)도 같이 다시 빌드되지만 루트만 빌드하므로 영향 없음.

⚠️ **클라우드 세션**에서는 프록시 때문에 `*.supabase.co`, `*.pages.dev`에 접속이 안 된다.
**지은님 PC의 데스크톱 세션(홈페이지 담당 창)에서는 접속된다** — 2026-10-20 확인. 실서버 확인이
필요하면 그쪽에서 하는 편이 빠르다(브라우저·curl·DNS 조회 모두 됨). work/ 빌드도 그 PC에서 통과.

### work.viren.kr 이 안 열릴 때 (2026-10-20 진단 완료)

**결론: 서버 설정은 다 끝났다. 남은 건 cafe24 네임서버 한 대의 갱신 지연뿐이다.**

끝난 것 — Cloudflare Pages 쪽은 완전히 준비됐다. work.viren.kr 인증서가 10-20 12:52 에
발급됐고, Cloudflare 주소로 직접 붙으면 HTTP 200 에 로그인 화면이 제대로 나온다.
공개 DNS(구글 8.8.8.8 · Cloudflare 1.1.1.1 · KT 168.126.63.1)도 전부 올바른 값을 준다.

남은 것 — cafe24 는 네임서버가 4대인데 **4대가 동시에 갱신되지 않는다.** 10-20 시점에
ns1.cafe24.com 한 대만 옛 응답(와일드카드 → viren.kr → Vercel 주소 216.198.79.1)을 주고
나머지 3대는 정상이었다. 그래서 **누구는 열리고 누구는 안 열린다.** 설정이 틀린 게
아니므로 기다리면 된다. 하루가 지나도 ns1 이 그대로면 cafe24 고객센터에 문의한다
(네임서버끼리 맞추는 건 cafe24 몫이다).

⚠️ **"설정은 맞는데 내 PC 에서만 안 열린다"가 실제로 일어난다.** 틀린 답을 한 번 받은
공유기·PC 가 그 값을 TTL(30분) 동안 쥐고 있어서다. 10-20 에 지은님 PC 가 그 상태였는데,
같은 PC 안에서도 **브라우저는 열리는데 nslookup 은 옛 주소**를 주는 식으로 캐시 계층마다
값이 달랐다. 그러니 **한 번 조회해 보고 판단하지 말 것.** 급하면 pages.dev 주소를 쓴다.
확인하는 법:

```powershell
foreach ($ns in @("ns1.cafe24.com","ns2.cafe24.com","ns1.cafe24.co.kr","ns2.cafe24.co.kr")) {
  "{0} -> {1}" -f $ns, ((Resolve-DnsName work.viren.kr -Server $ns -Type CNAME).NameHost -join ',')
}
```

4대 모두 `viren-work.pages.dev` 면 정상. 그래도 내 PC만 안 열리면 공유기가 옛 답을 쥐고 있는
것이니 30분쯤 기다린다(`Clear-DnsClientCache` 는 PC 캐시만 지워서 이 경우엔 소용없다).

## 3. 보안 구조 — 고치기 전에 반드시 이해할 것

`supabase/schema.sql`이 전부다.

- **결재 문서·결재선·참조자는 테이블 직접 쓰기 정책이 없다.** `submit_doc` / `act_on_doc` / `withdraw_doc`(security definer) 함수로만 바뀐다. 결재가 끝난 문서는 관리자도 못 고친다.
- 출퇴근은 `check_in` / `check_out` 함수로만. 시각은 `now()`. 관리자만 attendance 직접 insert/update/delete(보정).
- 열람: 문서는 `can_view_doc` = 기안자·결재선·참조자·관리자. 근태는 본인·관리자. 직원 목록은 재직자 전원.
- **새 계정은 `active=false`로 생긴다**(맨 처음 계정만 admin+active). 관리자가 관리 화면에서 '재직'을 켜야 로그인 가능. 회원가입이 실수로 열려도 외부인이 못 들어오게 하는 이중 잠금.
- 퇴사자는 계정 삭제 금지 → `active=false`. (외래키 때문에 삭제도 실패함)
- `keep_one_admin` 트리거: 활성 관리자가 0명이 되는 변경을 막는다(security definer — RLS 아래에서 비활성 사용자가 보면 0명으로 보이던 버그를 고친 것).
- anon 역할은 테이블·함수 권한을 모두 회수했다.
- 사무실 IP: `request_ip()`가 `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for` 첫 값 순으로 읽는다. 관리 화면의 '지금 접속한 주소 → 목록에 추가'가 같은 함수를 쓰므로 실제로 보이는 값으로 등록된다.
- 첨부: Storage 버킷 `approval-files`(비공개), 경로 `{문서id}/{uuid}.{확장자}`(한글 파일명은 `approval_files.name`에만). 업로드는 기안자가 진행 중인 자기 문서에만.
- 저장소가 **public**이다. 코드에 비밀 없음(publishable 키는 공개용). **service_role 키·DB 비밀번호는 절대 커밋 금지.**

### DB를 바꿀 때
- `schema.sql`은 **처음 한 번만 실행하는 파일**이다(재실행하면 오류). 운영 DB에는 **바뀐 부분만** SQL을 따로 만들어 지은님이 SQL Editor에서 실행하도록 안내한다. `schema.sql`도 같이 고쳐 최신 상태 유지.
- 검사: 로컬 Postgres 16에서 `supabase/tests/supabase_stub.sql`(auth·storage·역할 흉내) → `schema.sql` → `supabase/tests/rules_test.sql` 순서로 실행. `OK err` 22개, ERROR 없음이 정상.
  ```bash
  # 예: initdb 후 5499 포트로 띄운 경우
  psql -h /tmp -p 5499 -U postgres -d t -v ON_ERROR_STOP=1 -f work/supabase/tests/supabase_stub.sql
  psql -h /tmp -p 5499 -U postgres -d t -v ON_ERROR_STOP=1 -f work/supabase/schema.sql
  psql -h /tmp -p 5499 -U postgres -d t -f work/supabase/tests/rules_test.sql | grep -E "ERROR|expected|OK err" 
  ```
- 화면 검사: PostgREST 정적 바이너리(v12)를 로컬 DB에 붙이고, vite dev 서버에 `/rest/v1` 프록시를 걸고, HS256 JWT를 직접 만들어 localStorage(`sb-localhost-auth-token`)에 넣어 로그인 상태를 흉내 냈다. Playwright는 전역 설치본(`/opt/node22/lib/node_modules/playwright`) 사용. Storage는 흉내 내지 않았으므로 **첨부 업로드는 실서버에서만 확인 가능**(아직 미확인).

## 4. 화면 (src/)

| 파일 | 역할 |
|---|---|
| `App.jsx` | 라우팅 + 로그인 게이트(직원 행 없음/비활성 → 안내 화면) |
| `lib/session.jsx` | 세션 + 내 직원정보 + 전체 직원 목록(`nameOf`, `empOf`) |
| `lib/dates.js` | 모든 날짜는 **한국시간 'YYYY-MM-DD' 문자열**로. 주말 제외 일수 계산(DB와 같은 규칙) |
| `lib/leave.js` | 연차 계산 |
| `components/Layout.jsx` | 상단바(넓은 화면) + **휴대폰 하단 탭바**, 결재 차례 숫자 배지 |
| `pages/Home.jsx` | 검정 '오늘 근무' 카드(큰 시계, 노란 출근 버튼, 경과시간) + 숫자 카드 3개 + 문서 목록 |
| `pages/Approvals.jsx` | 결재함 탭(결재할/내가 올린/내가 결재한/참조/전체=관리자). 넓으면 표, 휴대폰은 카드 |
| `pages/ApprovalNew.jsx` | 양식 3종 작성, 결재선 순서 편집, 마지막 결재선 localStorage 기억 |
| `pages/ApprovalView.jsx` | 문서(종이 서류 느낌, 결재란), 승인/반려/회수, 첨부 서명URL 다운로드, 인쇄 |
| `pages/Attendance.jsx` | 월별 근태표, 관리자 직원 선택·보정, CSV(BOM 포함) |
| `pages/Admin.jsx` | 직원 / 출근 설정 / 백업 탭 |
| `styles.css` | 디자인 토큰 맨 위. 홈페이지 색(검정 #0a0a0a, 웜화이트, 노랑 #fbc825). 본문 Pretendard(jsDelivr), 로고·숫자 Montserrat(Google Fonts) |

디자인 방향(지은님 선택, 2026-10-20): **밝은 사무용 화면 + 바이렌 브랜드 강조**, 휴대폰 출퇴근 쉽게, 홈 한눈에.
검정은 상단바와 '오늘 근무' 카드에만, 노랑은 지금 눌러야 할 것(출근 버튼·결재 차례·선택 메뉴)에만.

## 5. 남은 일 (우선순위 순)

1. **work.viren.kr 기다리기** — 서버 설정은 끝났고 cafe24 네임서버 ns1 한 대만 옛 값을 준다(2절).
   하루 지나도 그대로면 cafe24 고객센터 문의. 그동안은 https://viren-work.pages.dev 로 쓴다.
2. **직원 등록 안내** — 지은님과 한 단계씩: Supabase → Authentication → Users → Add user(Auto Confirm 체크) → VIREN WORK 관리 → 직원에서 이름·직위·입사일 입력 + **재직 켜고 저장**.
3. **사무실 IP 등록** — 사무실 와이파이에서 관리 → 출근 설정 → 목록에 추가 → 저장.
4. **실서버에서 첨부 업로드 한 번 확인**(로컬에서 검증 못 함).
5. 매달 백업 안내(관리 → 백업 → JSON을 회사 Dropbox에 보관). 무료 플랜은 자동 백업 없음.
6. 2단계 후보: 결재 알림(카카오워크 병행 중이므로 카카오워크 봇/웹훅 알림이 자연스러움, 또는 메일), 메일 이전(Zoho/네이버웍스/Google 중 선택), 공휴일 반영, 양식 추가.

### 끝난 일

- **2026-10-20 "Grace period is over" 경고 — 확인 결과 문제 없음.** 초과가 아니라
  **Supabase 정책 변경 공지**다. 유예 기간이 2026-09-19 에 끝나 이제 공정 사용 정책이
  적용되고, **넘으면** 402 로 막힌다는 안내. 실제 사용량은 전부 한참 아래였다.
  (주기 2026-09-27~10-27, 10-20 시점 · 조직 전체 = 홈페이지 + viren-work 합계)

  | 항목 | 사용 | 한도 | 비율 |
  |---|---|---|---|
  | Cached Egress | 1.104 GB | 5 GB | 22% |
  | Storage Size | 0.199 GB | 1 GB | 20% |
  | Database Size | 0.027 GB | 0.5 GB | 5% |
  | Egress | 0.145 GB | 5 GB | 3% |
  | Monthly Active Users | 1 | 50,000 | <1% |
  | Realtime · Edge Functions · Log | 0 | — | 0% |

  · **돈은 나갈 수 없다** — Spend cap 켜짐 + 등록된 카드 없음 + 지난 청구서 2건 모두 $0.00.
    Spend cap 은 **켠 채로 둔다**(끄면 초과분이 과금된다).
  · 앞으로 볼 것 두 가지. **Storage(1GB)** 는 결재 첨부가 쌓이는 곳이라 늘어난다.
    **Cached Egress(5GB/월)** 는 홈페이지 이미지 트래픽이 올리는 값이다. 둘 다 지금은 여유.
  · 직원 3명이 늘어도 MAU·DB 는 거의 안 움직인다. 무료로 충분하다.

- **2026-10-20 Cloudflare 쪽 준비 완료 확인** — 지은님 PC(홈페이지 담당 창)에서 직접 확인했다.
  인증서 10-20 12:52 발급, Cloudflare 주소로 붙으면 HTTP 200 에 로그인 화면 정상,
  브라우저 오류 0건, 번들에 Supabase 주소·키 제대로 들어감(환경변수 적용 확인).
  **다만 work.viren.kr 은 cafe24 ns1 갱신 지연으로 아직 사람마다 갈린다**(2절). 남은 일 그대로 둠.
  같은 김에 홈페이지 Supabase(별개 프로젝트 `wxggycizpfmwjaeltabg`)도 확인 — 정상, 프로젝트 11건.
  work/ 빌드도 이 PC에서 통과(`npm install` → `npm run build`).
## 6. 비용 결정 기록

- 비교표(지은님 소유 아티팩트): https://claude.ai/artifact/CHUuhGefJ9b4vomAKKdzsB
- 현재 카카오워크: Standard 월간 7,900원 × 3명 = 월 23,700원(부가세 별도, 2026-09 청구서).
- 결론: 3~6명 규모에선 유료 서버(Vercel Pro + Supabase Pro ≈ 월 $45)로 가면 카카오워크보다 비싸다.
  → **무료 서버(Cloudflare Pages + Supabase Free)로 시작, 별로면 없앤다**(지은님 결정).
- GitHub는 Free로 충분(지은님이 "유료 써야 하지 않냐"고 물어서 확인해 줌).
- 참고: 홈페이지는 Vercel **Hobby(비상업 전용 약관)** 위에 있다. 언젠가 짚어 줄 만한 사항.
- 메일을 카카오워크에서 옮기면 홈페이지 문의 폼(`api/send.js`, 카카오워크 SMTP 사용)의 발송 설정도 같이 바꿔야 한다.

## 7. 커밋 규칙

- 한국어 커밋 메시지, 무엇을 왜 바꿨는지. 마지막에 실제 사용 모델 이름으로 `Co-Authored-By: Claude ... <noreply@anthropic.com>`.
- 작업 브랜치 `claude/internal-collaboration-platform-ejdoj5`(main과 같은 지점까지 반영됨).
- GitHub 접근: 2026-10-20에 virenmotion 계정에 Claude GitHub App 설치함(그 전엔 push가 403으로 막혔음).
