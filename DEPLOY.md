# VIREN 배포 가이드 — cafe24 도메인 + Vercel + Supabase

최종 구성: **도메인(cafe24) → 프론트(Vercel, 무료) → DB(Supabase, 무료)**. 전부 무료.

순서: ① Supabase(DB) → ② Vercel(배포) → ③ cafe24 도메인 연결

---

## ① Supabase 준비 (DB)
[SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 5단계를 먼저 완료하세요.
끝나면 아래 두 값을 손에 들고 있어야 합니다 (Project Settings → API):
- `VITE_SUPABASE_URL`  (예: https://xxxx.supabase.co)
- `VITE_SUPABASE_ANON_KEY`  (anon public key)

> 이 두 값은 ②단계 Vercel에도 넣습니다. `.env.local` 은 배포에 안 올라가므로(비밀 보호) Vercel에 따로 등록해야 합니다.

---

## ② Vercel 배포

### 2-1. 코드를 GitHub에 올리기 (권장 · 자동 재배포)
`viren-react` 폴더를 저장소로 만듭니다. (PowerShell, `viren-react` 폴더 안에서)
```bash
git init
git add .
git commit -m "VIREN site"
```
그다음 github.com에서 새 저장소(New repository) 생성 → 안내에 나오는 명령으로 push:
```bash
git remote add origin https://github.com/<본인계정>/viren.git
git branch -M main
git push -u origin main
```
> `.gitignore` 가 `node_modules`, `dist`, `.env.local`(비밀키)을 자동 제외하므로 안전합니다.

### 2-2. Vercel에서 가져오기
1. vercel.com 가입(GitHub 계정으로 로그인하면 편함) → **Add New… → Project**
2. 방금 만든 저장소 **Import**
3. 설정 화면에서:
   - **Framework Preset**: Vite (자동 감지)
   - **Root Directory**: 저장소를 `viren-react` 자체로 올렸다면 그대로 `./`,
     상위 폴더째 올렸다면 `viren-react` 로 지정
   - **Environment Variables** 에 2개 추가:
     | Name | Value |
     |---|---|
     | `VITE_SUPABASE_URL` | ①의 Project URL |
     | `VITE_SUPABASE_ANON_KEY` | ①의 anon key |
4. **Deploy** 클릭 → 1~2분 후 `xxx.vercel.app` 주소로 사이트가 뜹니다.

> 이후엔 `git push` 만 하면 Vercel이 자동으로 다시 배포합니다.

*(GitHub 없이 하려면: `npm i -g vercel` 후 `viren-react` 폴더에서 `vercel` 실행 → 로그인 →
 안내 따라 배포. 단, 수정 때마다 `vercel --prod` 를 직접 실행해야 함.)*

---

## ③ cafe24 도메인 연결

### 3-1. Vercel에 도메인 등록
Vercel 프로젝트 → **Settings → Domains** → 도메인 입력(예: `viren.kr`) → Add.
그러면 Vercel이 **설정해야 할 DNS 레코드 값**을 보여줍니다. (아래는 일반적인 값이며, **실제는 Vercel 화면에 표시된 값을 따르세요.**)

| 대상 | 타입 | 값(호스트/레코드) |
|---|---|---|
| 루트 `viren.kr` | **A** | `76.76.21.21` |
| `www.viren.kr` | **CNAME** | `cname.vercel-dns.com` |

### 3-2. cafe24에서 DNS 레코드 입력
1. cafe24 로그인 → **나의 서비스 관리 → 도메인 → DNS 관리**(또는 DNS 정보 변경)
2. 위 표대로 레코드 추가:
   - **A 레코드**: 호스트 `@`(또는 비움) → IP `76.76.21.21`
   - **CNAME**: 호스트 `www` → 값 `cname.vercel-dns.com`
3. 저장.

> cafe24에서 "네임서버를 다른 곳으로 지정" 방식(Vercel 네임서버로 변경)도 가능하지만,
> **위처럼 A/CNAME 레코드만 추가하는 방식이 간단**하고 도메인은 계속 cafe24 소유로 둡니다.

### 3-3. 반영 대기
DNS 전파에 보통 **10분~수 시간**(최대 48시간) 걸립니다.
Vercel Domains 화면에 **Valid Configuration**(초록 체크)이 뜨면 완료 — HTTPS 인증서도 Vercel이 자동 발급합니다.

---

## 완료 후
- `viren.kr` 접속 → 사이트, `viren.kr/admin` → 관리자 로그인·글쓰기
- 콘텐츠 수정: `/admin` 에서 (코드 재배포 불필요)
- 디자인·기능 수정: 코드 고치고 `git push` → 자동 재배포

## 자주 겪는 점검
- **/admin 이 "미연결"로 뜸** → Vercel 환경변수 2개가 안 들어갔거나 오타. 넣고 **Redeploy**.
- **/work/xxx 새로고침 404** → `vercel.json`(이미 포함됨)이 배포에 포함됐는지 확인.
- **도메인이 안 뜸** → DNS 전파 대기 중이거나 레코드 값 오타. Vercel Domains 화면의 진단 메시지 확인.
