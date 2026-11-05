# 복구 연습 — 실행안

> 2026-11-06. **아직 아무것도 설치·실행하지 않았습니다.** 이 문서는 "이렇게 하면 된다"가
> 아니라 **"이렇게 할 참이니 승인해 달라"** 는 계획서입니다.
>
> 목적 하나: **되살리기가 실제로 되는지 한 번 해 보는 것.** 지금은 코드와 절차만
> 준비돼 있고 **단 한 번도 복구해 본 적이 없습니다**(`BACKUP.md` 9번).
>
> 🔴 **이 연습에는 회사 자료를 쓰지 않습니다.** 가짜 자료로 합니다.
> 진짜 자료로 하는 것은 연습이 끝난 뒤 따로 승인받습니다.

---

## 0. 지금 이 컴퓨터에 있는 것 / 없는 것

| | 있나 |
|---|---|
| Node · npm | ✅ |
| **Docker** | ❌ 없음 |
| **WSL** | ❌ 없음 (`wsl --list` 가 미설치라고 답함) |
| **Supabase CLI** | ❌ 없음 |
| **psql · pg_dump** | ❌ 없음 |
| **7-Zip** | ❌ 없음 |
| C 드라이브 여유 | 약 505 GiB |

**넷을 설치해야 시작할 수 있습니다.** 아래 1번이 그 목록입니다.

운영 정보 (바꾸지 않습니다)

| | |
|---|---|
| 프로젝트 | `viren-work` · ref `mappjgurhsvymamkohoo` |
| Postgres | 17.11.0.003 |

---

## 1. 설치할 것 — 출처·버전·범위

> 🔴 **아직 설치하지 마세요.** 아래를 지은님이 보고 승인한 뒤에 합니다.
> 특히 ①은 **라이선스와 재부팅**이 걸려 있습니다.

### ① Docker Desktop + WSL 2 — **이것만 따로 봐야 합니다**

| | |
|---|---|
| 왜 | 로컬 Supabase 는 **Docker 위에서** 돕니다. 이게 없으면 ③이 소용없습니다 |
| 출처 | https://www.docker.com/products/docker-desktop/ |
| 범위 | **이 컴퓨터 전체.** 윈도 기능(WSL 2·가상화)을 켭니다 |
| **재부팅** | 🔴 **필요합니다.** WSL 을 켜면 다시 시작해야 합니다 |
| 디스크 | 이미지·볼륨까지 넉넉히 **10~20GB** 정도 봅니다 (505GiB 중) |

**🔴 라이선스 — 공짜가 아닐 수 있습니다**

Docker Desktop 은 **아래 둘을 **모두** 만족해야 무료**입니다.

- 직원 **250명 미만** **그리고**
- 연매출 **1천만 달러 미만**

> 바이렌은 둘 다 넉넉히 만족할 것으로 보이지만, **회사 명의로 쓰는 일**이니
> 지은님이 확인하고 판단해 주세요. 조건을 넘으면 **유료 구독**이 필요합니다.
> 출처: https://docs.docker.com/subscription-billing/desktop-license/

> Docker 를 깔고 싶지 않다면 ③의 **B안(새 Supabase 프로젝트)** 뿐인데,
> 그쪽은 **무료 프로젝트 둘이 이미 차 있어** 돈이 들 수 있습니다(3번).

### ② 나머지 도구 — 라이선스 걸림 없음

| 무엇 | 출처 | 범위 | 비용 |
|---|---|---|---|
| **Supabase CLI** | `npm i --save-dev supabase@<버전 고정>` | **이 저장소 안에만** | 없음 |
| **psql** (PostgreSQL 클라이언트) | https://www.postgresql.org/download/windows/ (EDB 설치 프로그램에서 **Command Line Tools 만** 선택) | 컴퓨터 전체 | 없음 |
| **7-Zip** | https://www.7-zip.org/ | 컴퓨터 전체 | 없음 (무료) |

> 🔴 **버전은 "지금 최신"이 아니라 "깔아서 확인한 그 버전"으로 고정합니다.**
> CLI 를 깐 **직후** 아래를 돌려서, 우리 문서의 명령이 그 판에서 맞는지 봅니다.
>
> ```bash
> npx supabase --version
> ```
> ```bash
> npx supabase db dump --help
> ```
>
> `--remote` · `--role-only` · `--data-only` · `--use-copy` · `--exclude` 가
> **그 판에 있는지** 확인하고, 없거나 이름이 다르면 **BACKUP.md 를 그 판에 맞춰 고칩니다.**
> 확인한 버전 번호를 `package.json` 에 고정해 적습니다.

### ⚠️ 공식 문서가 2026-11-02 에 바뀌었습니다 — 우리 명령도 손봐야 합니다

| 바뀐 것 | 우리 BACKUP.md |
|---|---|
| 명령에 **`--remote`** 를 붙입니다 | 지금 없습니다 → **고쳐야 함** |
| data dump 에서 `storage.buckets_vectors` · `storage.vector_indexes` 를 **뺍니다** (안 빼면 되살릴 때 권한 오류) | 지금 없습니다 → **고쳐야 함** |
| **migration history**(`supabase_migrations` 스키마)를 따로 뜹니다 | 지금 없습니다 → **고쳐야 함** |
| Vault·컬럼 암호화를 쓰면 **열쇠가 DB 밖**에 있어 따로 챙겨야 합니다 | 우리는 Vault 를 안 씁니다(확인 필요) |
| `auth`·`storage` 의 **커스텀 구조·권한**은 따로 확보합니다 | 5번 시험 기준에 넣었습니다 |

> 🔴 이 수정은 **CLI 를 깔아 `--help` 로 확인한 뒤** 하는 것이 맞습니다.
> 지금 고치면 또 추측이 됩니다. **①②를 설치한 날 같이 합니다.**

> 🔴 공식 문서 예시에는 **운영 DB 비밀번호를 리셋하는 단계**가 있습니다.
> **그 단계는 따라 하지 않습니다.** 우리는 리셋 없이 `link` 로 붙습니다.

---

## 2. 암호 — 노출하지 않는 절차

### 묶는 법 (AES-256 · 파일 이름까지 숨김)

```bash
7z a -t7z -m0=lzma2 -mx=9 -mhe=on -p viren-work-2026-11.7z roles.sql schema.sql data.sql
```

| 토막 | 뜻 |
|---|---|
| `-t7z` | 7z 형식 (zip 은 파일 이름을 못 숨깁니다) |
| `-mhe=on` | **파일 이름까지 암호화.** 이게 없으면 목록이 그대로 보입니다 |
| `-p` | 암호를 **묻게** 합니다 — 🔴 `-p암호` 처럼 **붙여 쓰지 마세요** |

> 🔴 **`-p` 뒤에 암호를 붙여 쓰면 명령 기록에 남습니다.** PowerShell 기록
> (`ConsoleHost_history.txt`)에 평문으로 저장됩니다. **반드시 물어보게** 하세요.
> 같은 이유로 암호를 **메모장·채팅·커밋·파일 이름**에 적지 않습니다.

### 열려서 성한지 보기 (지우기 전에)

```bash
7z t -p viren-work-2026-11.7z
```

### 두 사람이 나눠 갖기

| 누가 | 어디에 |
|---|---|
| 대표님 | 회사 비밀번호 관리함(본인 계정) |
| 지은님 | 회사 비밀번호 관리함(본인 계정) |

- **같은 암호**를 둘이 각자 보관합니다. 한쪽이 못 열어도 다른 쪽이 엽니다.
- 암호를 **바꾸면 둘 다 바꿉니다.** 한쪽만 바꾸면 옛 묶음을 못 엽니다.
- **잃으면 끝입니다.** 백업이 있어도 못 엽니다 — 7z 암호는 복구 수단이 없습니다.
- 묶음마다 암호를 달리하지 마세요. 섞이면 어느 것이 어느 암호인지 모르게 됩니다.

> 🔴 이 문서·채팅·커밋 어디에도 **암호 자체를 적지 않습니다.**

---

## 3. 어디서 연습하나 — 세 길과 비용

| | 비용 | 할 수 있는 것 | 못 하는 것 |
|---|---|---|---|
| **A. 내 컴퓨터**(Docker + `supabase start`) | Docker 라이선스 조건만 맞으면 **추가 비용 없음** | roles·schema·data 복구, psql 차례, 방아쇠 끄기, 건수·권한 확인 | Storage 파일·메일·푸시는 실제와 다릅니다 |
| **B. 새 Supabase 프로젝트** | 🔴 **무료 둘(`viren`·`viren-work`)이 이미 찼습니다.** 공짜라고 단정 금지 — **확인 후 승인** | 실제와 가장 가까움 | 돈이 들 수 있음 |
| C. 다른 Postgres | 없음 | SQL 문법 확인 정도 | `auth`·`storage` 가 없어 **제대로 안 됩니다** |

**A 를 권합니다.** 단 Docker 라이선스(1-①)를 먼저 확인해 주세요.

### A 로 할 때의 격리 — 운영과 섞이지 않게

| 무엇 | 어떻게 |
|---|---|
| **이름** | `project_id` 를 **`viren-work-drill`** 로. 운영과 다릅니다 |
| **자리** | Docker 볼륨이 이름마다 따로 생깁니다 — 운영과 섞이지 않습니다 |
| **문** | `127.0.0.1` 에만 엽니다. 바깥에서 못 들어옵니다 |
| **메일** | 로컬 Supabase 는 메일을 **가로채서 안 보냅니다**. 바깥으로 안 나갑니다 |
| **cron** | 로컬에는 `pg_cron` 이 없습니다 |
| **알림·웹훅** | 🔴 **복구 직후 첫 SQL 로 끕니다**(아래) |
| **앱 연결** | 연습용에는 **앱도 Cloudflare 도 붙이지 않습니다** |

**🔴 복구 직후 — 가장 먼저 돌릴 SQL (연습용 DB 에서만)**

`data.sql` 이 `push_config` 를 **되살립니다.** 그대로 두면 연습하는 동안
실제 알림 서버를 두드립니다.

```sql
update public.push_config set url = null, cleanup_url = null, mail_url = null, secret = null where id = 1;
delete from public.push_subs;
update public.user_mail set on_off = false, secret = null;
```

> 🔴 이 SQL 은 **연습용 DB 전용**입니다. 운영에서 돌리면 알림과 메일이 멈춥니다.
> 돌리기 전에 **4번의 문지기**로 대상을 확인하세요.

---

## 4. 문지기 — 대상을 잘못 짚지 않게

되살리기는 **덮어쓰는 일**입니다. 한 번 잘못 짚으면 운영 자료가 사라집니다.

```bash
node scripts/restore-guard.mjs --target "<연결 주소>"
```

- 운영(`mappjgurhsvymamkohoo`)이면 **무조건 멈춥니다**
- `127.0.0.1` · `localhost` 가 아니면 멈춥니다
- `*.supabase.co` · `pooler.*` 면 멈춥니다
- **비밀번호를 화면에 찍지 않습니다**(`***` 로 가립니다)
- **아무것도 실행하지 않습니다.** 글자만 봅니다

통과했을 때만 복구 명령을 **만들어 보여 줍니다**(돌리지는 않습니다).

```bash
node scripts/restore-guard.mjs --target "<연결 주소>" --print-command roles.sql schema.sql data.sql
```

> 시험 28가지로 확인했습니다 — 운영 차단, 비밀번호 비노출, 멈췄을 때 명령을
> 만들지 않는 것까지(`supabase/tests/guardtest.mjs`).

---

## 5. 무엇을 보고 "됐다" 하나 — 시험 기준

### ① 대상

- [ ] `restore-guard` 가 **통과**했다 (운영이 아니다)
- [ ] `project_id` 가 `viren-work-drill` 이다

### ② 건수

- [ ] 표 **21개**가 다 있다 — `node supabase/tests/schematest.mjs` 가 통과
- [ ] 표별 건수가 넣은 것과 같다

```sql
select 'employees' t, count(*) from public.employees
union all select 'approval_docs', count(*) from public.approval_docs
union all select 'attendance', count(*) from public.attendance
union all select 'messages', count(*) from public.messages
union all select 'rooms', count(*) from public.rooms
order by 1;
```

- [ ] **로그인 계정**이 들어갔다

```sql
select count(*) from auth.users;
```

### ③ 파일 해시

- [ ] `node scripts/check-files.mjs --manifest 목록.json --files 폴더` 가 **통과**
- [ ] 안 받은 파일 0 · 크기 다른 것 0 · **속 바뀐 것 0**

### ④ 🔴 권한 — 관리자와 직원이 **다르게** 보여야 합니다

가장 놓치기 쉬운 곳입니다. 자료가 다 들어가도 **권한이 안 살아나면**
직원이 남의 인사 기록을 보게 됩니다.

| 보는 사람 | 무엇을 | 어떻게 돼야 하나 |
|---|---|---|
| **직원** | 남의 근태 | **0줄** |
| **직원** | 남의 인사 기록(`employee_hr`) | **0줄** |
| **직원** | 자기가 안 낀 결재 문서 | **0줄** |
| **직원** | 자기가 안 낀 대화방 글 | **0줄** |
| **관리자** | 위 전부 | **다 보임** |
| **아무나** | `push_config` · `user_mail` | **0줄** (아무도 직접 못 읽습니다) |

연습용 앱을 띄우지 않더라도, **같은 역할로 붙어서** 확인할 수 있습니다.

```sql
-- 직원인 척 (연습용 DB 에서만)
set local role authenticated;
set local request.jwt.claims = '{"sub":"<직원 uuid>","role":"authenticated"}';
select count(*) from public.employee_hr;   -- 본인 것만 나와야 합니다
reset role;
```

- [ ] 정책(RLS)이 표마다 켜져 있다

```sql
select tablename, rowsecurity from pg_tables
 where schemaname = 'public' order by tablename;
```

### ⑤ 기능

- [ ] 대휴 휴가 계산이 된다 (`select public.comp_balance('<uuid>');`)
- [ ] 직원 메일 표(`user_mail`)가 있다
- [ ] 🔴 **알림이 한 통도 안 나갔다** (3번의 끄는 SQL 을 돌렸으니)

---

## 6. 🔴 지은님이 정해 주셔야 하는 것 — 한 목록

| # | 무엇 | 왜 필요한가 |
|---|---|---|
| 1 | **Docker Desktop 을 깔아도 되나** | 컴퓨터 전체 설정을 바꾸고 **재부팅**이 필요합니다 |
| 2 | **Docker 라이선스 조건**(직원 250명 미만 · 매출 1천만 달러 미만)을 만족하나 | 넘으면 **유료 구독**이 필요합니다 |
| 3 | **psql · 7-Zip 을 깔아도 되나** | 컴퓨터 전체에 깝니다(무료) |
| 4 | **Supabase CLI 버전**을 무엇으로 고정하나 | 깔아서 `--version` 으로 확인한 그 번호로 고정합니다 |
| 5 | A(내 컴퓨터) 로 갈까, **B(새 프로젝트)** 로 갈까 | B 는 **돈이 들 수 있습니다** |
| 6 | **묶음 암호**를 누가 정하고 어디에 두나 | 두 분이 각자 보관합니다. 잃으면 못 엽니다 |
| 7 | **운영 dump 를 언제 받나** | 이번 연습은 가짜 자료로 합니다. 진짜는 **따로 승인** |
| 8 | 연습이 끝나면 **연습용을 지울까** | 남겨 두면 자리를 먹습니다 |

> 1·2·3 은 **설치**, 5 는 **비용**, 7 은 **회사 자료**가 걸린 일이라
> 제가 혼자 정하지 않습니다.

---

## 7. 차례 (승인 뒤에)

1. 설치 — Docker(+재부팅) · CLI · psql · 7-Zip
2. `npx supabase db dump --help` 로 **옵션 확인** → `BACKUP.md` 명령 손보기 (1-②)
3. 연습용 띄우기 — `project_id = viren-work-drill`, 127.0.0.1
4. **가짜 자료**를 만들어 넣고 → 받아 보고(dump) → 지우고 → 되살려 보기
5. 5번 기준을 **하나씩** 확인
6. 안 되는 게 나오면 `BACKUP.md` 를 고치고 **다시**
7. 다 되면 — 그때 **진짜 자료로 할지** 지은님께 다시 여쭙기

> 🔴 4번의 "가짜 자료" 는 회사 자료가 아닙니다. 지금 있는 시험용 만들기
> (`supabase/tests/`)와 같은 방식으로 지어냅니다.

---

## 8. 이 문서를 쓴 시점에 하지 않은 것

- 설치 — **하나도 안 했습니다**
- 운영 접근 · dump 받기 · 복구 — **안 했습니다**
- 새 프로젝트 만들기 · 비용 발생 — **없습니다**
- 보안 설정 변경 — **없습니다**
- 회사 자료를 다른 곳으로 보내기 — **없습니다**

**출처**: [백업·복구(CLI)](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) ·
[CLI db dump 설명](https://supabase.com/docs/reference/cli/supabase-db-dump) ·
[자동 백업(GitHub Actions)](https://supabase.com/docs/guides/deployment/ci/backups) ·
[Docker Desktop 라이선스](https://docs.docker.com/subscription-billing/desktop-license/)
