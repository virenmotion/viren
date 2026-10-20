-- =====================================================================
-- VIREN WORK — 사내 플랫폼(전자결재 · 근태) 데이터베이스
--
-- 홈페이지와는 다른 **새 Supabase 프로젝트**에서 실행한다.
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하도록 만들지는 않았다. 처음 한 번만 실행할 것.
--
-- 보안 원칙
--   · 결재 문서·결재선은 테이블에 직접 쓸 수 없다. 기안·승인·반려·회수는
--     전부 아래 함수(submit_doc / act_on_doc / withdraw_doc)로만 한다.
--     그래서 결재가 끝난 문서는 아무도(관리자 포함) 고칠 수 없다.
--   · 출퇴근도 함수(check_in / check_out)로만 찍는다. 시각은 서버 시계를 쓴다.
--   · 로그인하지 않은 사람(anon)은 아무것도 못 본다.
--   · 퇴사자는 active=false 로 바꾼다. 계정을 지우면 결재 기록이 깨지므로
--     지우지 말 것(지우려 해도 외래키 때문에 실패한다).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 직원
-- ---------------------------------------------------------------------
create table public.employees (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  name           text not null default '',
  dept           text not null default '',
  position       text not null default '',
  role           text not null default 'member' check (role in ('admin', 'member')),
  hire_date      date,
  -- 연차 일수를 직접 정할 때만 넣는다. 비어 있으면 입사일 기준으로 자동 계산.
  leave_override numeric(4,1) check (leave_override is null or leave_override >= 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Supabase 대시보드에서 계정을 만들면 직원 행이 자동으로 생긴다.
-- 맨 처음 만든 계정은 관리자가 되고 바로 쓸 수 있다.
-- 그다음부터 만든 계정은 '재직' 꺼진 상태로 생긴다. 관리자가 관리 화면에서 켜야 쓸 수 있다.
-- (Supabase 회원가입이 실수로 열려 있어도 외부인이 들어오지 못하게 하는 이중 잠금)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first boolean := not exists (select 1 from public.employees);
begin
  insert into public.employees (id, email, name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    split_part(coalesce(new.email, ''), '@', 1),
    case when v_first then 'admin' else 'member' end,
    v_first
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_active_employee() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where id = auth.uid() and active)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where id = auth.uid() and active and role = 'admin')
$$;

alter table public.employees enable row level security;

create policy "직원 목록은 재직자 누구나 본다" on public.employees
  for select to authenticated using (public.is_active_employee());

create policy "직원 정보는 관리자만 고친다" on public.employees
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 관리자가 자기 자신의 관리자 권한을 빼거나 퇴사 처리해서
-- 관리자가 아무도 없게 되는 것을 막는다.
create function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from employees where role = 'admin' and active) then
    raise exception '관리자가 최소 한 명은 있어야 합니다.';
  end if;
  return null;
end $$;

create trigger keep_one_admin
  after update on public.employees
  for each statement execute function public.keep_one_admin();

-- ---------------------------------------------------------------------
-- 회사 설정 (한 줄짜리)
-- ---------------------------------------------------------------------
create table public.settings (
  id                int primary key default 1 check (id = 1),
  -- 사무실 인터넷 주소. 예: {"211.234.10.5", "211.234.10.0/24"}
  office_ips        cidr[] not null default '{}',
  -- true 면 사무실 밖에서는 출근을 못 찍는다. false 면 찍히되 '외부'로 표시.
  require_office_ip boolean not null default false,
  updated_at        timestamptz not null default now()
);
insert into public.settings (id) values (1);

alter table public.settings enable row level security;

create policy "설정은 재직자 누구나 본다" on public.settings
  for select to authenticated using (public.is_active_employee());

create policy "설정은 관리자만 고친다" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 지금 요청이 들어온 인터넷 주소. 관리자 화면에서 '현재 주소 추가'에 쓴다.
create function public.request_ip() returns inet
language plpgsql stable set search_path = public as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  v text;
begin
  if h is null then return null; end if;
  v := coalesce(
    h->>'cf-connecting-ip',
    h->>'x-real-ip',
    trim(split_part(h->>'x-forwarded-for', ',', 1))
  );
  return nullif(v, '')::inet;
exception when others then
  return null;
end $$;

create function public.my_ip() returns text
language sql stable set search_path = public as $$
  select host(public.request_ip())
$$;

-- ---------------------------------------------------------------------
-- 전자결재
-- ---------------------------------------------------------------------
create table public.approval_docs (
  id           uuid primary key default gen_random_uuid(),
  doc_no       text not null unique,              -- 2026-0001
  form_type    text not null check (form_type in ('general', 'leave', 'expense')),
  title        text not null check (length(trim(title)) > 0),
  content      text not null default '',
  data         jsonb not null default '{}'::jsonb, -- 양식별 항목(휴가 기간, 지출 내역 등)
  drafter_id   uuid not null references public.employees(id),
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.approval_docs (drafter_id, created_at desc);
create index on public.approval_docs (form_type, status);

-- 결재선. step 1 부터 차례대로 결재한다.
--   waiting  아직 차례가 아님
--   pending  지금 이 사람 차례
--   approved / rejected  결재함
--   skipped  앞에서 반려·회수돼서 차례가 오지 않음
create table public.approval_steps (
  doc_id      uuid not null references public.approval_docs(id) on delete cascade,
  step        int  not null check (step >= 1),
  approver_id uuid not null references public.employees(id),
  status      text not null default 'waiting'
              check (status in ('waiting', 'pending', 'approved', 'rejected', 'skipped')),
  comment     text,
  acted_at    timestamptz,
  primary key (doc_id, step)
);
create index on public.approval_steps (approver_id, status);

-- 참조자. 문서를 볼 수만 있다.
create table public.approval_refs (
  doc_id  uuid not null references public.approval_docs(id) on delete cascade,
  user_id uuid not null references public.employees(id),
  primary key (doc_id, user_id)
);
create index on public.approval_refs (user_id);

-- 첨부파일 목록. 실제 파일은 Storage 의 approval-files 버킷에 {문서id}/... 로 들어간다.
create table public.approval_files (
  id          uuid primary key default gen_random_uuid(),
  doc_id      uuid not null references public.approval_docs(id) on delete cascade,
  path        text not null unique,
  name        text not null,
  size        bigint not null default 0,
  uploaded_by uuid not null references public.employees(id),
  created_at  timestamptz not null default now()
);
create index on public.approval_files (doc_id);

create function public.can_view_doc(p_doc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_employee() and (
    public.is_admin()
    or exists (select 1 from approval_docs where id = p_doc and drafter_id = auth.uid())
    or exists (select 1 from approval_steps where doc_id = p_doc and approver_id = auth.uid())
    or exists (select 1 from approval_refs  where doc_id = p_doc and user_id = auth.uid())
  )
$$;

alter table public.approval_docs  enable row level security;
alter table public.approval_steps enable row level security;
alter table public.approval_refs  enable row level security;
alter table public.approval_files enable row level security;

create policy "관련자만 문서를 본다" on public.approval_docs
  for select to authenticated using (public.can_view_doc(id));
create policy "관련자만 결재선을 본다" on public.approval_steps
  for select to authenticated using (public.can_view_doc(doc_id));
create policy "관련자만 참조자를 본다" on public.approval_refs
  for select to authenticated using (public.can_view_doc(doc_id));
create policy "관련자만 첨부를 본다" on public.approval_files
  for select to authenticated using (public.can_view_doc(doc_id));

-- 첨부는 기안자가 결재 진행 중인 자기 문서에만 올린다.
create policy "기안자가 첨부를 올린다" on public.approval_files
  for insert to authenticated with check (
    uploaded_by = auth.uid()
    and public.is_active_employee()
    and exists (
      select 1 from public.approval_docs d
      where d.id = doc_id and d.drafter_id = auth.uid() and d.status = 'pending'
    )
  );

-- 휴가 양식 검사. 일수는 주말을 뺀 날수를 넘을 수 없다(공휴일은 기안자가 줄여서 적는다).
create function public.check_leave_data(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  k   text := p->>'kind';
  s   date;
  e   date;
  d   numeric;
  wd  int;
begin
  if k is null or k not in ('annual', 'half_am', 'half_pm', 'sick', 'family', 'other') then
    raise exception '휴가 종류를 골라 주세요.';
  end if;
  begin
    s := (p->>'start')::date;
    e := coalesce(nullif(p->>'end', ''), p->>'start')::date;
  exception when others then
    raise exception '휴가 날짜를 확인해 주세요.';
  end;
  if s is null then raise exception '휴가 시작일을 넣어 주세요.'; end if;
  if e < s then raise exception '휴가 종료일이 시작일보다 빠릅니다.'; end if;

  if k in ('half_am', 'half_pm') then
    if e <> s then raise exception '반차는 하루만 고를 수 있습니다.'; end if;
    d := 0.5;
  else
    select count(*) into wd
    from generate_series(s, e, interval '1 day') g
    where extract(isodow from g) < 6;
    d := coalesce(nullif(p->>'days', '')::numeric, wd);
    if d <= 0 or d > wd or d * 2 <> floor(d * 2) then
      raise exception '휴가 일수를 확인해 주세요. (주말 제외 최대 %일)', wd;
    end if;
  end if;

  return p || jsonb_build_object('kind', k, 'start', s, 'end', e, 'days', d);
end $$;

-- 지출결의 검사. 항목 금액을 더해 합계를 서버에서 다시 계산한다.
create function public.check_expense_data(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  items jsonb := coalesce(p->'items', '[]'::jsonb);
  it    jsonb;
  total numeric := 0;
  amt   numeric;
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception '지출 내역을 한 줄 이상 넣어 주세요.';
  end if;
  for it in select * from jsonb_array_elements(items) loop
    if coalesce(trim(it->>'desc'), '') = '' then
      raise exception '지출 내역의 내용을 넣어 주세요.';
    end if;
    begin
      amt := (it->>'amount')::numeric;
    exception when others then
      raise exception '금액은 숫자로 넣어 주세요.';
    end;
    if amt is null or amt <= 0 then raise exception '금액을 확인해 주세요.'; end if;
    total := total + amt;
  end loop;
  return p || jsonb_build_object('total', total);
end $$;

-- 기안. 문서·결재선·참조자를 한 번에 만든다.
create function public.submit_doc(
  p_form_type text,
  p_title     text,
  p_content   text,
  p_data      jsonb,
  p_approvers uuid[],
  p_refs      uuid[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_no   text;
  v_year text := to_char(now() at time zone 'Asia/Seoul', 'YYYY');
  v_seq  int;
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  i      int;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception '제목을 넣어 주세요.'; end if;
  if coalesce(array_length(p_approvers, 1), 0) = 0 then
    raise exception '결재자를 한 명 이상 지정해 주세요.';
  end if;
  if array_length(p_approvers, 1) <> (select count(distinct a) from unnest(p_approvers) a) then
    raise exception '같은 사람을 결재선에 두 번 넣을 수 없습니다.';
  end if;
  if auth.uid() = any(p_approvers) then
    raise exception '본인은 결재자로 지정할 수 없습니다.';
  end if;
  if exists (
    select 1 from unnest(p_approvers || coalesce(p_refs, '{}')) u
    where not exists (select 1 from employees e where e.id = u and e.active)
  ) then
    raise exception '퇴사했거나 없는 직원이 결재선·참조에 있습니다.';
  end if;

  if p_form_type = 'leave' then
    v_data := public.check_leave_data(v_data);
  elsif p_form_type = 'expense' then
    v_data := public.check_expense_data(v_data);
  elsif p_form_type <> 'general' then
    raise exception '알 수 없는 양식입니다.';
  end if;

  -- 문서번호: 연도별 일련번호. 동시에 두 건이 올라와도 번호가 겹치지 않게 잠근다.
  perform pg_advisory_xact_lock(hashtext('approval_doc_no'));
  select coalesce(max(split_part(doc_no, '-', 2)::int), 0) + 1 into v_seq
  from approval_docs where doc_no like v_year || '-%';
  v_no := v_year || '-' || lpad(v_seq::text, 4, '0');

  insert into approval_docs (doc_no, form_type, title, content, data, drafter_id)
  values (v_no, p_form_type, trim(p_title), coalesce(p_content, ''), v_data, auth.uid())
  returning id into v_id;

  for i in 1 .. array_length(p_approvers, 1) loop
    insert into approval_steps (doc_id, step, approver_id, status)
    values (v_id, i, p_approvers[i], case when i = 1 then 'pending' else 'waiting' end);
  end loop;

  insert into approval_refs (doc_id, user_id)
  select distinct v_id, r from unnest(coalesce(p_refs, '{}')) r
  where r <> auth.uid() and r <> all(p_approvers);

  return v_id;
end $$;

-- 승인·반려. 지금 내 차례인 문서만 가능하다.
create function public.act_on_doc(p_doc uuid, p_decision text, p_comment text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_doc  approval_docs;
  v_step approval_steps;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception '잘못된 요청입니다.'; end if;

  select * into v_doc from approval_docs where id = p_doc for update;
  if not found then raise exception '문서를 찾을 수 없습니다.'; end if;
  if v_doc.status <> 'pending' then raise exception '이미 결재가 끝난 문서입니다.'; end if;

  select * into v_step from approval_steps
  where doc_id = p_doc and status = 'pending' and approver_id = auth.uid();
  if not found then raise exception '지금 결재할 차례가 아닙니다.'; end if;

  if p_decision = 'rejected' and coalesce(trim(p_comment), '') = '' then
    raise exception '반려 사유를 적어 주세요.';
  end if;

  update approval_steps
  set status = p_decision, comment = nullif(trim(p_comment), ''), acted_at = now()
  where doc_id = p_doc and step = v_step.step;

  if p_decision = 'rejected' then
    update approval_steps set status = 'skipped' where doc_id = p_doc and status = 'waiting';
    update approval_docs set status = 'rejected', completed_at = now() where id = p_doc;
  elsif exists (select 1 from approval_steps where doc_id = p_doc and step = v_step.step + 1) then
    update approval_steps set status = 'pending' where doc_id = p_doc and step = v_step.step + 1;
  else
    update approval_docs set status = 'approved', completed_at = now() where id = p_doc;
  end if;
end $$;

-- 회수. 기안자가, 아직 아무도 승인하지 않았을 때만.
create function public.withdraw_doc(p_doc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_doc approval_docs;
begin
  select * into v_doc from approval_docs where id = p_doc for update;
  if not found or v_doc.drafter_id <> auth.uid() or not public.is_active_employee() then
    raise exception '권한이 없습니다.';
  end if;
  if v_doc.status <> 'pending' then raise exception '이미 결재가 끝난 문서입니다.'; end if;
  if exists (select 1 from approval_steps where doc_id = p_doc and status = 'approved') then
    raise exception '이미 승인한 결재자가 있어 회수할 수 없습니다.';
  end if;
  update approval_steps set status = 'skipped' where doc_id = p_doc and status in ('waiting', 'pending');
  update approval_docs set status = 'withdrawn', completed_at = now() where id = p_doc;
end $$;

-- ---------------------------------------------------------------------
-- 근태
-- ---------------------------------------------------------------------
create table public.attendance (
  user_id     uuid not null references public.employees(id),
  work_date   date not null,
  check_in    timestamptz,
  check_out   timestamptz,
  in_ip       text,
  out_ip      text,
  in_office   boolean,       -- 출근을 사무실 주소에서 찍었는지. 사무실 주소 미등록이면 null
  note        text,          -- 관리자 수정 메모
  primary key (user_id, work_date)
);
create index on public.attendance (work_date);

alter table public.attendance enable row level security;

create policy "내 근태는 내가, 전체는 관리자가 본다" on public.attendance
  for select to authenticated
  using (public.is_active_employee() and (user_id = auth.uid() or public.is_admin()));

-- 찍는 것은 함수로만. 관리자는 빠뜨린 기록을 넣거나 고칠 수 있다.
create policy "관리자가 근태를 넣는다" on public.attendance
  for insert to authenticated with check (public.is_admin());
create policy "관리자가 근태를 고친다" on public.attendance
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "관리자가 근태를 지운다" on public.attendance
  for delete to authenticated using (public.is_admin());

create function public.office_check() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  s  settings;
  ip inet := public.request_ip();
begin
  select * into s from settings where id = 1;
  if coalesce(array_length(s.office_ips, 1), 0) = 0 then return null; end if;
  return ip is not null and exists (select 1 from unnest(s.office_ips) c where ip <<= c);
end $$;

create function public.check_in() returns attendance
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_in    boolean := public.office_check();
  v_row   attendance;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if v_in is false and (select require_office_ip from settings where id = 1) then
    raise exception '사무실 인터넷에서만 출근을 찍을 수 있습니다.';
  end if;
  if exists (select 1 from attendance where user_id = auth.uid() and work_date = v_today and check_in is not null) then
    raise exception '오늘은 이미 출근을 찍었습니다.';
  end if;
  insert into attendance (user_id, work_date, check_in, in_ip, in_office)
  values (auth.uid(), v_today, now(), host(public.request_ip()), v_in)
  on conflict (user_id, work_date) do update
    set check_in = excluded.check_in, in_ip = excluded.in_ip, in_office = excluded.in_office
  returning * into v_row;
  return v_row;
end $$;

-- 퇴근은 여러 번 누르면 마지막 시각으로 바뀐다.
create function public.check_out() returns attendance
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_row   attendance;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  update attendance
  set check_out = now(), out_ip = host(public.request_ip())
  where user_id = auth.uid() and work_date = v_today and check_in is not null
  returning * into v_row;
  if not found then raise exception '오늘 출근 기록이 없습니다. 먼저 출근을 찍어 주세요.'; end if;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- 첨부파일 저장소 (Storage)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('approval-files', 'approval-files', false)
on conflict (id) do nothing;

-- 경로 첫 칸이 문서 id. 형식이 틀리면 null.
create function public.doc_id_from_path(p text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create policy "결재 첨부 보기" on storage.objects
  for select to authenticated
  using (bucket_id = 'approval-files' and public.can_view_doc(public.doc_id_from_path(name)));

create policy "결재 첨부 올리기" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'approval-files'
    and public.is_active_employee()
    and exists (
      select 1 from public.approval_docs d
      where d.id = public.doc_id_from_path(name)
        and d.drafter_id = auth.uid() and d.status = 'pending'
    )
  );

-- ---------------------------------------------------------------------
-- 일정(캘린더) — 회사 공용. 재직자 누구나 올리고, 올린 사람과 관리자가 고친다.
--   · 달력의 "누가 언제 쉬는지"는 leave_days() 로 따로 내준다. 결재 문서는 관련자만
--     볼 수 있어서 그대로는 남의 휴가를 띄울 수 없기 때문이다.
--   · 휴가 종류(병가·경조사)는 일부러 내주지 않는다. 달력에는 '휴가'/'반차' 로만 뜬다.
-- ---------------------------------------------------------------------
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) > 0),
  start_date date not null,
  end_date   date not null,
  -- all_day 면 시간 없음. 아니면 start_time 필수.
  all_day    boolean not null default true,
  start_time time,
  end_time   time,
  place      text not null default '',
  memo       text not null default '',
  created_by uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_period check (end_date >= start_date),
  constraint events_time check (
    case when all_day then start_time is null and end_time is null
         else start_time is not null end
  ),
  constraint events_time_order check (
    all_day or start_date <> end_date or end_time is null or end_time >= start_time
  )
);

create index on public.events (start_date, end_date);

alter table public.events enable row level security;

create policy "일정은 재직자 누구나 본다" on public.events
  for select to authenticated using (public.is_active_employee());

create policy "일정은 재직자가 올린다" on public.events
  for insert to authenticated
  with check (public.is_active_employee() and created_by = auth.uid());

create policy "일정은 올린 사람이나 관리자가 고친다" on public.events
  for update to authenticated
  using (public.is_active_employee() and (created_by = auth.uid() or public.is_admin()))
  with check (public.is_active_employee() and (created_by = auth.uid() or public.is_admin()));

create policy "일정은 올린 사람이나 관리자가 지운다" on public.events
  for delete to authenticated
  using (public.is_active_employee() and (created_by = auth.uid() or public.is_admin()));

-- 달력에 띄울 '승인된 휴가'. 이름·기간·반차 여부만 내준다(휴가 종류는 내주지 않는다).
create function public.leave_days(p_from date, p_to date)
returns table (user_id uuid, name text, start_date date, end_date date, half boolean)
language sql stable security definer set search_path = public as $
  select d.drafter_id,
         e.name,
         (d.data->>'start')::date,
         (d.data->>'end')::date,
         (d.data->>'kind') in ('half_am', 'half_pm')
  from approval_docs d
  join employees e on e.id = d.drafter_id
  where public.is_active_employee()
    and d.form_type = 'leave'
    and d.status = 'approved'
    and (d.data->>'start')::date <= p_to
    and (d.data->>'end')::date >= p_from
$;

revoke all on public.events from anon;  -- 새 테이블은 schema.sql 끝의 일괄 revoke 에 안 걸린다
revoke execute on function public.leave_days(date, date) from anon, public;
grant execute on function public.leave_days(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 권한 정리: 로그인 안 한 사람(anon)은 아무것도 못 한다.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.is_active_employee(), public.is_admin(), public.can_view_doc(uuid),
  public.my_ip(), public.request_ip(), public.submit_doc(text, text, text, jsonb, uuid[], uuid[]),
  public.act_on_doc(uuid, text, text), public.withdraw_doc(uuid),
  public.check_in(), public.check_out(), public.doc_id_from_path(text),
  public.leave_days(date, date)
to authenticated;
