# 복구 연습 — 실행안

> 2026-11-05. **아직 아무것도 설치·실행하지 않았습니다.** 이 문서는 "이렇게 하면 된다"가
> 아니라 **"이렇게 할 참이니 승인해 달라"** 는 계획서입니다.
>
> 목적 하나: **되살리기가 실제로 되는지 한 번 해 보는 것.** 지금은 코드와 절차만
> 준비돼 있고 **단 한 번도 복구해 본 적이 없습니다**(`BACKUP.md` 9번).
>
> 🔴 **이 연습에는 회사 자료를 쓰지 않습니다.** 가짜 자료로 합니다.

---

## 0. 지금 있는 것 / 없는 것

### 도구 — 일부는 **이미 내려받아 두었습니다**

| 무엇 | 상태 | 어디에 |
|---|---|---|
| Node · npm | ✅ | 컴퓨터 |
| **7-Zip 26.05** (portable) | ✅ **받아서 돌려 봤습니다** | `C:\Users\c\Documents\Codex\2026-11-05\task\backup-prep-tools\7zip-26.05\x64\7za.exe` |
| **Supabase CLI 3.0.0** (portable) | ⚠️ 받았지만 **`--help` 를 못 봤습니다** | 같은 폴더 `supabase-3.0.0\supabase.exe` |
| **PostgreSQL 17 클라이언트**(psql) | ❌ 없음 | — |
| **그릇(컨테이너)** — Docker·Rancher·Podman 중 하나 | ❌ 없음 | — |
| WSL | ❌ 없음 | — |

> 7-Zip·CLI 는 **공식 GitHub 배포본을 받아 해시까지 맞춰** 풀어 둔 것입니다.
> 컴퓨터 전체에 설치한 것이 아니라 **그 폴더에만** 있습니다.
> 저장소의 `package.json` 도 건드리지 않았습니다 — **npm 의존성을 더할 필요가 없습니다.**

**🔴 CLI 가 막혀 있습니다 — 승인 하나가 필요합니다**

`supabase.exe --version` 이 **`C:\Users\c\.supabase` 를 만들려다 막혔습니다**(EPERM).
권한을 우회하지 않았습니다. 그 폴더를 만들어도 되는지 승인이 필요합니다(5번 결정 ①).

### 운영 쪽 — 읽기만 한 현황 (2026-11-05)

| | |
|---|---|
| 프로젝트 | `viren-work` · ref `mappjgurhsvymamkohoo` · Postgres 17.11.0.003 |
| public 표 | **21개 모두 RLS 켜짐** (켜졌다는 것만 확인. 규칙이 적절한지는 **미검증**) |
| 로그인 계정 | `auth.users` **3명** |
| 저장소 | **private 3개 버킷 · 객체 57개** (파일 본체는 받지 않았습니다) |
| Vault | **확장은 깔려 있고 secret 은 0개** |
| 예약 작업 | **cron 3개 모두 돌고 있음** |

> 🔴 **cron 3개가 돌고 있습니다.** 되살릴 때 이것들이 같이 살아나면 메일을 읽고
> 알림을 쏩니다. 3번의 격리에서 다룹니다.
>
> 🔴 **Vault 는 지금 비어 있지만 확장이 깔려 있습니다.** 나중에 Vault 를 쓰기
> 시작하면 **푸는 열쇠가 DB 밖에** 있어 dump 만으로는 못 되살립니다. 쓰기 시작할 때
> 이 문서를 고쳐야 합니다.

---

## 1. 더 깔아야 하는 것

### ① 그릇(컨테이너) — **이게 가장 큰 결정입니다**

로컬 Supabase 는 그릇 위에서 돕니다. 공식 CLI 문서는 **셋 중 하나**면 된다고 합니다.

| | 라이선스 | 메모 |
|---|---|---|
| **Docker Desktop** | 🔴 **조건부 무료** — 직원 250명 미만 **그리고** 매출 1천만 달러 미만 | 가장 많이 쓰입니다. 조건은 **지은님이 확인**해 주세요 |
| **Rancher Desktop** | 오픈소스(Apache 2.0) | Docker 대신 쓸 수 있습니다 |
| **Podman Desktop** | 오픈소스(Apache 2.0) | 마찬가지 |

> 바이렌이 Docker 무료 조건에 드는지 **제가 단정하지 않겠습니다.** 지은님이 보고 정해 주세요.
> 조건이 걸리면 Rancher·Podman 쪽이 깔끔합니다.
>
> 셋 중 무엇이든 **WSL 2 와 가상화를 켜야 하고, 재부팅이 필요합니다.**
> 디스크는 넉넉히 **10~20GB** 봅니다(505GiB 중).

출처: https://docs.docker.com/subscription-billing/desktop-license/ ·
https://supabase.com/docs/guides/local-development/cli/getting-started

### ② psql (PostgreSQL 17 클라이언트)

- 출처: https://www.postgresql.org/download/windows/
- 설치할 때 **Command Line Tools 만** 고릅니다(서버는 필요 없습니다)
- 비용 없음 · 컴퓨터 전체에 깔립니다
- 운영이 17.11 이므로 **17 계열**을 고릅니다

### ③ CLI 도움말 확인 — 깐 뒤 **가장 먼저**

```
supabase.exe --version
```
```
supabase.exe db dump --help
```

> **CLI 3.0.0 은 큰 변화가 있는 판입니다**(https://supabase.com/changelog/supabase-cli-v3).
> 우리 `BACKUP.md` 명령이 그 판에서 그대로 도는지 **아직 모릅니다.**
> 옛 인자가 "되긴 하지만 권하지 않음"일 수도 있습니다.
>
> 확인한 뒤 셋을 갈라 적습니다: **되는 것 / 이름이 바뀐 것 / 아예 안 되는 것.**
> 지금 미리 고치면 또 추측이 됩니다.

**공식 문서(2026-11-02)와 우리 명령이 어긋나는 곳 셋**

| 공식 | 우리 |
|---|---|
| `--remote` 를 붙임 | 없음 |
| data dump 에서 `storage.buckets_vectors` · `storage.vector_indexes` **제외** | 없음 |
| **migration 이력**(`supabase_migrations`)을 따로 뜸 | 없음 |

> 🔴 공식 예시에는 **운영 DB 비밀번호를 리셋하는 단계**가 있습니다.
> **따라 하지 않습니다.**

---

## 2. 암호 — 실제로 돌려 본 결과를 반영했습니다

### 묶기 — 이대로 됩니다 ✅

```
7za.exe a -t7z -m0=lzma2 -mhe=on -p 묶음.7z 담을폴더
```

| 토막 | 뜻 |
|---|---|
| `-t7z` | 7z 형식 (zip 은 파일 이름을 못 숨깁니다) |
| `-m0=lzma2` | 압축 방식 |
| `-mhe=on` | **파일 이름까지 암호화** — 없으면 목록이 그대로 보입니다 |
| `-p` (값 없이) | 암호를 **안 보이게 물어봅니다** ✅ 확인함 |

암호화 방식은 **7zAES(AES-256)** 입니다. 가짜 자료로 묶고 풀어 **SHA256 이 세 파일 모두
일치**하는 것까지 확인했습니다.

### 🔴 풀 때는 `-p` 를 **빼야 합니다** — 문서가 틀렸었습니다

```
7za.exe t 묶음.7z
```
```
7za.exe x 묶음.7z -o풀폴더
```

> 🔴 `t -p 묶음.7z` 는 **암호를 묻지 않고 Wrong password 로 실패합니다.**
> `-p` 를 빼야 제대로 물어봅니다. 실제로 돌려 보고 알았습니다.
>
> 🔴 **파이프로 암호를 밀어 넣는 자동화는 실패했습니다.**
> 암호는 **사람이 콘솔에 직접** 칩니다. 스크립트로 자동화하지 않습니다.
> 명령 인자에도 넣지 않습니다(기록에 남습니다).

### 🔴 무엇을 묶나 — **세 파일이 아니라 꾸러미 전체입니다**

```
그달폴더/
  roles.sql  schema.sql  data.sql        (전체 dump)
  migrations.sql                          (migration 이력)
  업무자료-2026-11.json                   (화면에서 받은 꾸러미)
  파일목록-2026-11.json                   (--write-manifest 로 만든 것)
  files/approval-files/...                (저장소 파일 본체)
  files/chat-files/...
  files/company/...
```

**이 폴더를 통째로** 묶습니다. 하나라도 빠지면 되살릴 수 없습니다.

### 암호 보관 — 묶음마다 다를 수 있습니다

> ⚠️ **모든 백업을 영원히 같은 암호로 묶지 않습니다.** 암호를 바꿔야 할 일이 생기면
> 바꾸되, **옛 묶음의 옛 암호는 그대로 보관**합니다 — 안 그러면 옛 백업을 못 엽니다.

비밀번호 관리함에 **묶음 하나당 한 줄**로 적습니다.

| 적을 것 | 보기 |
|---|---|
| 묶음 이름 | `viren-work-2026-11.7z` |
| 열쇠 번호 | `k1` (암호를 바꾸면 `k2`, `k3`…) |
| 만든 날 | 2026-11-30 |
| 누가 | 지은님 |

- **대표님과 지은님이 각자** 같은 내용을 가집니다. 한쪽이 못 열어도 다른 쪽이 엽니다.
- 열쇠를 바꾸면 **새 번호로 추가**하고, 옛 줄은 **지우지 않습니다.**
- 🔴 **잃으면 끝입니다.** 7z 암호는 복구 수단이 없습니다.

> 🔴 **새 비밀번호 관리 서비스를 쓰거나 계정을 같이 쓰는 것은 승인받지 않았습니다.**
> 지금 회사가 쓰는 곳이 있으면 거기에, 없으면 **어디에 둘지부터** 정해 주세요(5번 ②).

---

## 3. 격리 — 복구 **전에** 막아야 합니다

> 🔴 **"복구 직후 SQL 로 끈다"는 모자랍니다.** `data.sql` 이 들어가는 순간 이미
> `push_config` 가 살아 있고, 그 트랜잭션이 커밋되면 그 뒤로는 무엇이든 돌 수 있습니다.
> **자료를 넣기 전에** 바깥으로 못 나가게 막아야 합니다.

### 복구 **전에** 확인할 것 — 하나라도 안 되면 복구하지 않습니다

- [ ] 그릇이 **127.0.0.1 에만** 열려 있다 (`docker ps` 등으로 포트 바인딩 확인)
- [ ] 그릇이 **바깥으로 못 나간다** (네트워크를 끊거나 내부망만)
- [ ] `pg_cron` 이 **깔려 있는지 확인**했다 — 🔴 **없다고 단정하지 않습니다**

```sql
select extname from pg_extension where extname in ('pg_cron','pg_net','http','vault','supabase_vault');
```

- [ ] 깔려 있으면 **예약 작업을 비웠다**

```sql
select cron.unschedule(jobname) from cron.job;
```

- [ ] `pg_net` 이 깔려 있으면 **바깥 요청이 안 나가는 것**을 확인했다
- [ ] `project_id` 가 연습용(`viren-work-drill`)이고 운영과 다르다
- [ ] 그 그릇의 표가 **비어 있다** (운영 자료가 안 들어 있다)
- [ ] 문지기(4번)를 통과했다

### 자료를 넣는 그 트랜잭션 **안에서** 끕니다

커밋하고 나서 끄면 **그 사이가 열려 있습니다.** 한 덩어리 안에서 처리합니다.

```sql
begin;
set session_replication_role = replica;
\i roles.sql
\i schema.sql
\i data.sql
-- 🔴 커밋하기 전에 끈다
update public.push_config set url = null, cleanup_url = null, mail_url = null, secret = null where id = 1;
delete from public.push_subs;
update public.user_mail set on_off = false, secret = null;
commit;
```

> 🔴 이 SQL 은 **연습용 전용**입니다. 운영에서 돌리면 알림과 메일이 멈춥니다.
>
> ⚠️ **이 차례는 아직 돌려 본 적이 없습니다.** psql 안에서 `\i` 와
> `--single-transaction` 을 어떻게 섞을지는 **실제로 해 보고 확정**합니다.

### 지금 상태: **조건 미충족**

그릇이 없어 위 확인을 **하나도 못 했습니다.** 설치 승인이 나야 시작합니다.

---

## 4. 문지기 — 대상을 잘못 짚지 않게

```bash
node scripts/restore-guard.mjs --target "postgresql://postgres@127.0.0.1:54322/postgres"
```

| 막는 것 | |
|---|---|
| 운영 ref·이름 | 퍼센트로 숨겨도 찾아냅니다 |
| **물음표 뒤**(`?host=` `?options=` `?service=`) | 🔴 거기서 **대상이 바뀝니다.** 무조건 거절 |
| 주소 속 비밀번호 | 거절 — psql 이 따로 물어봅니다 |
| `localhost` | 거절 — 이름은 딴 데를 가리킬 수 있습니다 |
| 다른 문·다른 DB 이름 | 거절 |
| 보이지 않는 글자·겹친 인자·모르는 옵션 | 거절 |

- **받은 주소를 그대로 찍지 않습니다.** 컴퓨터·문·DB 만 따로 보여 줍니다.
- **복구 명령을 만들어 주지 않습니다**(파일 이름이 명령에 섞이는 길을 없앴습니다).
- 시험 **51가지**(`supabase/tests/guardtest.mjs`).

> 🔴 **한계**: 글자만 봅니다. 그 문 뒤에 **정말 연습용 그릇이 떠 있는지는 증명하지
> 못합니다.** 3번의 확인 목록을 사람이 따로 밟아야 합니다.

---

## 5. 🔴 지은님이 정해 주셔야 하는 것

기술 선택(버전 번호 등)은 제가 확인해서 정하겠습니다. **아래만** 정해 주세요.

### ① 설치와 약관 — 이 컴퓨터를 바꾸는 일

- 그릇을 **무엇으로** 할까요? (Docker / Rancher / Podman)
  - Docker 를 고른다면 **무료 조건**(직원 250명 미만 **그리고** 매출 1천만 달러 미만)에
    회사가 드는지 확인해 주세요. 넘으면 유료 구독입니다.
- **WSL 2·가상화를 켜고 재부팅**해도 될까요?
- **psql** 을 컴퓨터에 깔아도 될까요? (무료)
- **`C:\Users\c\.supabase` 폴더**를 만들어도 될까요? (CLI 가 쓰는 자리. 지금 막혀 있습니다)

### ② 암호를 어디에 두고 누가 맡나

- 회사에 **쓰고 있는 비밀번호 관리함**이 있나요? 없으면 어디에 둘까요?
  (새 서비스를 쓰는 것은 아직 승인받지 않았습니다)
- 묶음 암호를 **누가 정하고** 두 분이 어떻게 나눠 가질까요?

### ③ 첫 진짜 백업 — 언제, 누가 자격을 넣나

- 연습이 끝난 뒤 **첫 백업을 언제** 받을까요?
- 그때 **운영 DB 접속 자격**은 누가 넣나요?
  (🔴 **저에게 비밀번호를 알려 주지 마세요.** 지은님이 직접 치시면 됩니다)

---

## 6. 무엇을 보고 "됐다" 하나 — 시험 기준

### ① 대상
- [ ] 문지기 통과 · 3번 확인 목록 통과

### ② 자료
- [ ] **표 21개가 다 있다** — `node supabase/tests/schematest.mjs`
- [ ] 표별 건수가 넣은 것과 같다 (21개 **전부**)
- [ ] `select count(*) from auth.users;` 가 **3** (운영 기준)
- [ ] **migration 이력**(`supabase_migrations.schema_migrations`)이 들어갔다

### ③ 저장소
- [ ] 버킷 **3개**가 다 있고 **전부 private** 이다
- [ ] 객체 수가 맞다 (운영 기준 **57개**)
- [ ] 버킷 **정책**이 들어갔다 — `select * from storage.buckets;` · `pg_policies`
- [ ] 파일 본체 해시가 맞다 — `check-files.mjs --manifest`

### ④ 구조
- [ ] 함수·방아쇠가 다 있다

```sql
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
select count(*) from pg_trigger where not tgisinternal;
```

- [ ] `auth`·`storage` 의 **우리가 더한 것**이 있다면 같이 들어갔다

### ⑤ 🔴 권한 — 관리자와 직원이 **다르게** 보여야 합니다

자료가 다 들어가도 권한이 안 살면 **직원이 남의 인사 기록을 봅니다.**

```sql
-- 🔴 반드시 begin … rollback 으로 감쌉니다. 아무것도 남기지 않습니다.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<직원 uuid>","role":"authenticated"}';
select count(*) from public.employee_hr;    -- 본인 것만
select count(*) from public.attendance;     -- 본인 것만
select count(*) from public.push_config;    -- 0 이어야 함
rollback;
```

| 보는 사람 | 무엇을 | 어떻게 돼야 |
|---|---|---|
| 직원 | 남의 근태·인사 기록 | **0줄** |
| 직원 | 안 낀 결재 문서·대화방 | **0줄** |
| 관리자 | 위 전부 | 다 보임 |
| 아무나 | `push_config` · `user_mail` | **0줄** |

- [ ] 21개 표 **전부** `rowsecurity = true`

```sql
select tablename, rowsecurity from pg_tables where schemaname='public' order by 1;
```

### ⑥ 부작용
- [ ] 🔴 **알림이 한 통도 안 나갔다**
- [ ] 예약 작업이 **하나도 안 돌았다** (`select * from cron.job;` 가 비었거나 꺼짐)

> 🔴 어느 단계에서도 **비밀값을 화면에 찍지 않습니다.** `push_config.secret` ·
> `user_mail.secret` 은 **개수만** 세고 값은 보지 않습니다.

---

## 7. 차례 (승인 뒤에)

1. 승인 — 5번 ①②③
2. 설치 — 그릇(+재부팅) · psql · `.supabase` 폴더 허용
3. `supabase db dump --help` 로 **옵션 확인** → `BACKUP.md` 명령 고치기 (1-③)
4. 연습용 띄우기 → **3번 확인 목록**을 하나씩
5. **가짜 자료**를 지어 넣고 → 받아 보고 → 지우고 → 되살려 보기
6. 6번 기준을 하나씩
7. 안 되는 게 나오면 문서를 고치고 **다시**
8. 다 되면 — **진짜 자료로 할지** 다시 여쭙기

---

## 8. 이 문서를 쓴 시점에 하지 않은 것

- 설치 — **그릇·psql 모두 없습니다**
- CLI 도움말 확인 — **막혀 있습니다**(`.supabase` 폴더)
- 운영 접근 · dump · 복구 — **안 했습니다**
- 새 프로젝트 · 비용 — **없습니다**
- 보안 설정 변경 · 새 자격 만들기 — **없습니다**
- 회사 자료를 다른 곳으로 보내기 — **없습니다**

> 7-Zip 으로 묶고 푼 시험은 **전부 가짜 자료**였습니다.

**출처**: [백업·복구(CLI)](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) ·
[CLI 설치](https://supabase.com/docs/guides/local-development/cli/getting-started) ·
[CLI v3 변경점](https://supabase.com/changelog/supabase-cli-v3) ·
[Docker Desktop 라이선스](https://docs.docker.com/subscription-billing/desktop-license/)
