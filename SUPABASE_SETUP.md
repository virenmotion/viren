# VIREN — Supabase(WORK 게시판) 연결 가이드

관리자 화면(`/admin`)에서 글을 쓰고 저장하려면 Supabase 프로젝트 1개가 필요합니다.
아래 5단계면 끝납니다. (무료 티어로 충분)

---

## 1. Supabase 프로젝트 생성
1. https://supabase.com → 로그인 → **New project**
2. 이름/DB 비밀번호(임의) 입력, 리전은 **Northeast Asia (Seoul)** 권장 → 생성 (1~2분 소요)

## 2. 테이블·보안·스토리지 생성 (SQL 한 번 실행)
좌측 메뉴 **SQL Editor → New query** 에 아래를 붙여넣고 **Run**:

```sql
-- WORK 프로젝트 테이블
create table if not exists public.projects (
  slug        text primary key,
  cat         text not null,
  kind        text,
  client      text,           -- 발주처명 (카드 좌상단)
  year        text,           -- 사업연도 (카드 우상단)
  title_en    text,           -- 영문 프로젝트명 (선택)
  title_ko    text not null,  -- 한글 프로젝트명 (필수)
  youtube     text,
  location    text,           -- 장소
  deliverables text,          -- 산출물/제공 내역
  blocks      jsonb default '[]'::jsonb, -- 본문 하단 콘텐츠 블록(글·이미지·영상)
  thumb       text,
  description  text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

-- 행 수준 보안: 누구나 읽기, 로그인 사용자만 쓰기
alter table public.projects enable row level security;

create policy "public read"        on public.projects for select using (true);
create policy "auth insert"        on public.projects for insert to authenticated with check (true);
create policy "auth update"        on public.projects for update to authenticated using (true) with check (true);
create policy "auth delete"        on public.projects for delete to authenticated using (true);

-- 썸네일 이미지 저장용 버킷(공개)
insert into storage.buckets (id, name, public)
values ('work-thumbs', 'work-thumbs', true)
on conflict (id) do nothing;

create policy "thumbs public read"  on storage.objects for select using (bucket_id = 'work-thumbs');
create policy "thumbs auth upload"  on storage.objects for insert to authenticated with check (bucket_id = 'work-thumbs');
create policy "thumbs auth delete"  on storage.objects for delete to authenticated using (bucket_id = 'work-thumbs');

-- CAREER 채용 공고 테이블
create table if not exists public.jobs (
  id              text primary key,   -- 식별자
  cat             text not null,      -- 카테고리 (media-art / motion / cgi / tech / design / pm / talent)
  title_en        text not null,      -- 영문 직무명
  title_ko        text,               -- 한글 직무명
  type            text,               -- 고용형태 · 경력
  description      text,              -- 소개(본문)
  headcount       text,               -- 모집인원
  responsibilities text,              -- 담당업무 (줄바꿈 = 항목)
  qualifications  text,               -- 자격요건 (줄바꿈 = 항목)
  preferred       text,               -- 우대사항 (줄바꿈 = 항목)
  sort            int  not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.jobs enable row level security;

create policy "jobs public read"  on public.jobs for select using (true);
create policy "jobs auth insert"  on public.jobs for insert to authenticated with check (true);
create policy "jobs auth update"  on public.jobs for update to authenticated using (true) with check (true);
create policy "jobs auth delete"  on public.jobs for delete to authenticated using (true);

-- 사이트 설정(근무조건 등) 단일 문서 테이블
create table if not exists public.site_settings (
  key   text primary key,   -- 'work_conditions' 등
  value jsonb not null default '[]'::jsonb
);

alter table public.site_settings enable row level security;

create policy "settings public read" on public.site_settings for select using (true);
create policy "settings auth insert" on public.site_settings for insert to authenticated with check (true);
create policy "settings auth update" on public.site_settings for update to authenticated using (true) with check (true);
```

### (선택) 기존 예시 6개 글 넣기
비워두고 관리자 화면에서 직접 써도 됩니다. 예시를 미리 채우려면 아래도 Run:

```sql
insert into public.projects (slug, cat, kind, client, year, title_en, title_ko, youtube, description, sort) values
('seoul-station-kakao-friends','media-art','MEDIA FACADE','KAKAO','2025.12','SEOUL STATION KAKAO FRIENDS','서울역 플랫폼111 산타프렌즈','aqz-KE-bpKQ','서울역 플랫폼111에 카카오프렌즈 산타프렌즈 IP를 활용한 시즌 미디어 파사드를 선보였습니다.',1),
('glorry-lights','media-art','PROJECTION MAPPING','롯데월드 어드벤처 부산','2025.09','GLORRY LIGHTS','롯데월드 어드벤처 부산 미디어 쇼','aqz-KE-bpKQ','로리캐슬에 멀티미디어 쇼 및 프로젝션 맵핑 콘텐츠 ‘GLorry Lights’를 선보였습니다.',2),
('sensory-garden','immersive','EXHIBITION','VIREN','2025.07','SENSORY GARDEN','몰입형 인터랙티브 전시','aqz-KE-bpKQ','관객의 움직임에 실시간으로 반응하는 오감 자극형 인터랙티브 전시 공간을 설계했습니다.',3),
('brand-origin','brand-film','BRAND FILM','ORIGIN','2025.03','ORIGIN','브랜드 필름','aqz-KE-bpKQ','브랜드의 철학과 가치를 공간과 연결해 오래 기억되는 브랜드 경험을 담은 필름입니다.',4),
('unreal-city','cgi','CGI','VIREN','2025.02','UNREAL CITY','CGI 비주얼','aqz-KE-bpKQ','현실을 넘어선 상상의 도시를 가장 정교한 CGI 비주얼로 구현했습니다.',5),
('flow-motion','motion-graphics','MOTION GRAPHICS','VIREN','2025.01','FLOW','모션 그래픽 시리즈','aqz-KE-bpKQ','직관적인 모션과 그래픽으로 복잡한 정보를 명확하게 전달하는 모션 그래픽 시리즈입니다.',6)
on conflict (slug) do nothing;
```

### (선택) 예시 채용 공고 넣기
```sql
insert into public.jobs (id, cat, title_en, title_ko, type, description, sort) values
('media-art-director','media-art','MEDIA ART DIRECTOR','미디어아트 디렉터','정규직 · 경력 5년 이상','미디어아트·프로젝션 맵핑 프로젝트의 비주얼 방향을 총괄할 디렉터를 찾습니다.',1),
('media-artist','media-art','MEDIA ARTIST','미디어아트 콘텐츠 제작','정규직 · 경력 2년 이상','몰입형 미디어아트 콘텐츠를 기획·제작할 아티스트를 찾습니다.',2),
('motion-designer','motion','MOTION GRAPHIC DESIGNER','모션그래픽 디자이너','정규직 · 경력 무관','브랜드 필름·모션 그래픽을 디자인하고 애니메이팅할 디자이너를 찾습니다.',3),
('3d-generalist','cgi','3D GENERALIST','3D · CGI 아티스트','정규직 · 경력 3년 이상','모델링·룩뎁·라이팅·렌더링 전반을 아우르는 3D 제너럴리스트를 찾습니다.',4),
('creative-technologist','tech','CREATIVE TECHNOLOGIST','인터랙티브 개발자','정규직 · 경력 무관','관객과 실시간으로 반응하는 인터랙티브 콘텐츠를 구현할 개발자를 찾습니다.',5),
('experience-designer','design','EXPERIENCE DESIGNER','공간 · 경험 디자이너','정규직 · 경력 2년 이상','전시·공간 단위의 몰입형 경험을 설계할 디자이너를 찾습니다.',6),
('project-manager','pm','PROJECT MANAGER','프로젝트 매니저','정규직 · 경력 3년 이상','프로젝트의 일정·예산·커뮤니케이션을 총괄할 매니저를 찾습니다.',7),
('talent-pool','talent','TALENT POOL','인재풀 (상시 지원)','상시 모집','열린 공고에 맞는 자리가 없어도 언제든 지원해 주세요.',99)
on conflict (id) do nothing;
```

## 3. 관리자 계정 만들기
1. 좌측 **Authentication → Users → Add user → Create new user**
2. 관리자 **이메일 / 비밀번호** 입력, **Auto Confirm User 체크** → 생성
3. (권장) **Authentication → Sign In / Providers**(또는 Settings)에서
   **Allow new users to sign up** 를 **끄기** → 아무나 가입 못 하게

## 4. 키를 `.env.local` 에 입력
1. 좌측 **Project Settings → API**
2. 두 값을 복사해 프로젝트 루트 `viren-react/.env.local` 에 붙여넣기:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```
> anon 키는 프론트엔드에 노출돼도 안전한 공개 키입니다(쓰기는 위 RLS 정책이 막습니다).

## 5. dev 서버 재시작
```bash
npm --prefix viren-react run dev
```
브라우저에서 **`/admin`** 접속 → 3단계 계정으로 로그인 → 글쓰기/수정/삭제.
작성한 글은 즉시 **WORK 페이지**에 반영됩니다.

---

### 참고
- **글쓰기 흐름**: `/admin` 로그인 → `+ 새 프로젝트` → 제목·카테고리·YouTube ID·본문·썸네일 입력 → 저장
- **URL**: 슬러그로 자동 생성 → `/work/슬러그`
- 키가 비어 있으면 사이트는 코드의 시드 6개로 표시되고, `/admin` 은 안내문을 띄웁니다(사이트는 정상 동작).
