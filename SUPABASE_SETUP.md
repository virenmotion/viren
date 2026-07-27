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
  title_en    text not null,  -- 영문 프로젝트명
  title_ko    text,           -- 한글 프로젝트명
  youtube     text,
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
