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
  -- 직책(CEO·Director·leader·PM). 직급은 위 position. 고를 값은 src/lib/labels.js
  duty           text not null default '',
  -- 직원 목록에 나올 순서. 관리 → 직원에서 줄을 끌어 정한다.
  sort           int not null default 0,
  role           text not null default 'member' check (role in ('admin', 'member')),
  hire_date      date,
  -- 연차 일수를 직접 정할 때만 넣는다. 비어 있으면 입사일 기준으로 자동 계산.
  leave_override numeric(4,1) check (leave_override is null or leave_override >= 0),
  -- 이전 사용 연차와 **그 숫자를 적어 넣은 날짜**. 날짜가 지금 연차 기간 밖이면
  -- 계산에서 저절로 빠진다(1년마다 사람이 0 으로 되돌릴 필요 없음).
  leave_used_before numeric(4,1) not null default 0 check (leave_used_before >= 0),
  leave_used_before_at date,
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
  -- 직원 목록에서 부서가 나올 순서. 여기 없는 부서는 뒤에 가나다순으로 붙는다.
  dept_order        text[] not null default '{}',
  -- 대화에 붙인 사진·파일을 며칠 두고 지울지. 0 보다 커야 지운다.
  chat_file_days    int not null default 60,
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
create table public.doc_forms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  guide      text not null default '',
  fields     jsonb not null default '[]'::jsonb,
  default_approvers uuid[] not null default '{}',
  -- 이 양식이 최종 승인되면 대체휴무가 생긴다(휴일근무신청서 등).
  -- comp_field = 며칠인지가 들어 있는 칸(날짜 여러 개)의 key.
  grants_comp boolean not null default false,
  comp_field  text,
  sort       int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doc_forms_fields_is_array check (jsonb_typeof(fields) = 'array')
);

alter table public.doc_forms enable row level security;

create policy "양식은 재직자 누구나 본다" on public.doc_forms
  for select to authenticated using (public.is_active_employee());
create policy "양식은 관리자만 만든다" on public.doc_forms
  for insert to authenticated with check (public.is_admin());
create policy "양식은 관리자만 고친다" on public.doc_forms
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "양식은 관리자만 지운다" on public.doc_forms
  for delete to authenticated using (public.is_admin());

revoke all on public.doc_forms from anon;

create table public.approval_docs (
  id           uuid primary key default gen_random_uuid(),
  doc_no       text not null unique,              -- 2026-0001
  form_type    text not null check (form_type in ('general', 'leave', 'expense', 'custom')),
  -- 직접 만든 양식으로 쓴 문서면 그 양식. 양식을 지워도 문서는 남는다.
  form_id      uuid references public.doc_forms(id) on delete set null,
  title        text not null check (length(trim(title)) > 0),
  content      text not null default '',
  data         jsonb not null default '{}'::jsonb, -- 양식별 항목(휴가 기간, 지출 내역 등)
  drafter_id   uuid not null references public.employees(id),
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  -- 회수한 뒤 고쳐서 다시 올린 횟수. 결재자가 '고쳐서 올린 문서' 임을 알 수 있다.
  resubmit_count int not null default 0
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
  k     text := p->>'kind';
  h     text := nullif(p->>'half', '');
  arr   jsonb := p->'dates';
  s     date;
  e     date;
  d     numeric;
  wd    int;
  n     int;
  uniq  date[];
begin
  -- 옛 화면이 보낸 값도 받아 준다 (half_am → 연차 + 오전 반차)
  if k in ('half_am', 'half_pm') then
    h := right(k, 2);
    k := 'annual';
  end if;

  -- 연차 · 월차 · 공가 · 대휴. 반차 여부는 half 칸이 따로 가진다.
  if k is null or k not in ('annual', 'monthly', 'public', 'comp') then
    raise exception '휴가 종류를 골라 주세요.';
  end if;
  if h is not null and h not in ('am', 'pm') then
    raise exception '반차는 오전·오후 중에서 고르세요.';
  end if;

  if arr is not null and jsonb_typeof(arr) = 'array' and jsonb_array_length(arr) > 0 then
    -- ── 새 방식: 고른 날짜들 ──────────────────────────────────────
    begin
      select array_agg(distinct x::date order by x::date) into uniq
      from jsonb_array_elements_text(arr) x;
    exception when others then
      raise exception '휴가 날짜를 확인해 주세요.';
    end;

    n := coalesce(array_length(uniq, 1), 0);
    if n = 0 then raise exception '휴가 날짜를 골라 주세요.'; end if;
    if n > 60 then raise exception '한 번에 60일까지만 신청할 수 있습니다.'; end if;

    if h is not null then
      if n <> 1 then raise exception '반차는 하루만 고를 수 있습니다.'; end if;
      d := 0.5;
    else
      d := n;
    end if;

    s := uniq[1];
    e := uniq[n];
    return p || jsonb_build_object(
      'kind', k, 'half', h,
      'dates', to_jsonb(uniq),
      'start', s, 'end', e, 'days', d
    );
  end if;

  -- ── 옛 방식: 시작일~종료일 (옛 화면이 보낸 것) ────────────────────
  begin
    s := (p->>'start')::date;
    e := coalesce(nullif(p->>'end', ''), p->>'start')::date;
  exception when others then
    raise exception '휴가 날짜를 확인해 주세요.';
  end;
  if s is null then raise exception '휴가 시작일을 넣어 주세요.'; end if;
  if e < s then raise exception '휴가 종료일이 시작일보다 빠릅니다.'; end if;

  if h is not null then
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

  return p || jsonb_build_object('kind', k, 'half', h, 'start', s, 'end', e, 'days', d);
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

-- 결재선 검사. 기안·재기안이 **같은 함수**를 쓴다(복사해 두면 한쪽만 고치게 된다).
create or replace function public.check_doc_line(p_approvers uuid[], p_refs uuid[])
returns void
language plpgsql stable set search_path = public as $$
begin
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
end $$;

-- 양식별 내용 검사.
create or replace function public.check_doc_payload(p_form_type text, p_data jsonb, p_form_id uuid)
returns jsonb
language plpgsql stable set search_path = public as $$
declare
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_left numeric;
begin
  if p_form_type = 'leave' then
    v_data := public.check_leave_data(v_data);
    -- 대휴는 쌓아 둔 만큼만 쓸 수 있다.
    if v_data->>'kind' = 'comp' then
      v_left := public.comp_balance(auth.uid());
      if (v_data->>'days')::numeric > v_left then
        raise exception '남은 대체휴무가 %일입니다. 그보다 많이 신청할 수 없습니다.', v_left;
      end if;
    end if;
  elsif p_form_type = 'expense' then
    v_data := public.check_expense_data(v_data);
  elsif p_form_type = 'custom' then
    if p_form_id is null then raise exception '양식을 골라 주세요.'; end if;
    if not exists (select 1 from doc_forms f where f.id = p_form_id and f.active) then
      raise exception '지금은 쓸 수 없는 양식입니다.';
    end if;
    if jsonb_typeof(v_data) <> 'object' then raise exception '양식 내용이 올바르지 않습니다.'; end if;
  elsif p_form_type <> 'general' then
    raise exception '알 수 없는 양식입니다.';
  end if;
  return v_data;
end $$;

revoke execute on function public.check_doc_line(uuid[], uuid[]) from anon, public;
revoke execute on function public.check_doc_payload(text, jsonb, uuid) from anon, public;
grant execute on function public.check_doc_line(uuid[], uuid[]) to authenticated;
grant execute on function public.check_doc_payload(text, jsonb, uuid) to authenticated;

-- 기안. 문서·결재선·참조자를 한 번에 만든다.
create function public.submit_doc(
  p_form_type text,
  p_title     text,
  p_content   text,
  p_data      jsonb,
  p_approvers uuid[],
  p_refs      uuid[] default '{}',
  p_form_id   uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_no   text;
  v_year text := to_char(now() at time zone 'Asia/Seoul', 'YYYY');
  v_seq  int;
  v_data jsonb;
  i      int;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception '제목을 넣어 주세요.'; end if;
  perform public.check_doc_line(p_approvers, p_refs);
  v_data := public.check_doc_payload(p_form_type, p_data, p_form_id);

  -- 문서번호: 연도별 일련번호. 동시에 두 건이 올라와도 번호가 겹치지 않게 잠근다.
  perform pg_advisory_xact_lock(hashtext('approval_doc_no'));
  select coalesce(max(split_part(doc_no, '-', 2)::int), 0) + 1 into v_seq
  from approval_docs where doc_no like v_year || '-%';
  v_no := v_year || '-' || lpad(v_seq::text, 4, '0');

  insert into approval_docs (doc_no, form_type, title, content, data, drafter_id, form_id)
  values (v_no, p_form_type, trim(p_title), coalesce(p_content, ''), v_data, auth.uid(),
          case when p_form_type = 'custom' then p_form_id else null end)
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

revoke execute on function public.submit_doc(text, text, text, jsonb, uuid[], uuid[], uuid) from anon, public;
grant execute on function public.submit_doc(text, text, text, jsonb, uuid[], uuid[], uuid) to authenticated;

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

-- 회수한 문서를 고쳐서 다시 올린다. 같은 문서번호를 그대로 쓴다.
create function public.resubmit_doc(
  p_doc       uuid,
  p_title     text,
  p_content   text,
  p_data      jsonb,
  p_approvers uuid[],
  p_refs      uuid[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_doc  approval_docs;
  v_data jsonb;
  i      int;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;

  select * into v_doc from approval_docs where id = p_doc for update;
  if not found or v_doc.drafter_id <> auth.uid() then
    raise exception '권한이 없습니다.';
  end if;
  if v_doc.status <> 'withdrawn' then
    raise exception '회수한 문서만 다시 올릴 수 있습니다.';
  end if;

  if coalesce(trim(p_title), '') = '' then raise exception '제목을 넣어 주세요.'; end if;
  perform public.check_doc_line(p_approvers, p_refs);
  -- 양식은 처음 올릴 때 정해진 것을 그대로 쓴다(바꾸려면 새 문서를 쓴다).
  v_data := public.check_doc_payload(v_doc.form_type, p_data, v_doc.form_id);

  -- 결재선은 통째로 다시 짠다. 예전 결재 기록(반려 사유 등)은 남길 수 없다 —
  -- 같은 (문서, 단계) 자리에 두 벌을 둘 수 없기 때문. 다시 올린 횟수만 남긴다.
  delete from approval_steps where doc_id = p_doc;
  delete from approval_refs  where doc_id = p_doc;

  update approval_docs
     set title = trim(p_title),
         content = coalesce(p_content, ''),
         data = v_data,
         status = 'pending',
         completed_at = null,
         resubmit_count = v_doc.resubmit_count + 1
   where id = p_doc;

  for i in 1 .. array_length(p_approvers, 1) loop
    insert into approval_steps (doc_id, step, approver_id, status)
    values (p_doc, i, p_approvers[i], case when i = 1 then 'pending' else 'waiting' end);
  end loop;

  insert into approval_refs (doc_id, user_id)
  select distinct p_doc, r from unnest(coalesce(p_refs, '{}')) r
  where r <> auth.uid() and r <> all(p_approvers);

  return p_doc;
end $$;

revoke execute on function public.resubmit_doc(uuid, text, text, jsonb, uuid[], uuid[]) from anon, public;
grant execute on function public.resubmit_doc(uuid, text, text, jsonb, uuid[], uuid[]) to authenticated;

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
create table public.event_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  color      text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

alter table public.event_categories enable row level security;

create policy "분류는 재직자 누구나 본다" on public.event_categories
  for select to authenticated using (public.is_active_employee());
create policy "분류는 관리자만 만든다" on public.event_categories
  for insert to authenticated with check (public.is_admin());
create policy "분류는 관리자만 고친다" on public.event_categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "분류는 관리자만 지운다" on public.event_categories
  for delete to authenticated using (public.is_admin());

revoke all on public.event_categories from anon;

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
  -- 분류를 지워도 일정은 남기고 색만 빠지게 한다
  category_id uuid references public.event_categories(id) on delete set null,
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
returns table (user_id uuid, name text, job_title text, kind text, half text,
               start_date date, end_date date, dates jsonb)
language sql stable security definer set search_path = public as $$
  select d.drafter_id,
         e.name,
         e.position,  -- 바깥 이름은 job_title (position 은 SQL 예약어라 피했다)
         -- 옛 문서(병가·경조사·기타)는 종류를 밝히지 않고 '휴가'로 뭉뚱그린다.
         case when d.data->>'kind' in ('annual','monthly','public','comp')
                then d.data->>'kind'
              when d.data->>'kind' in ('half_am','half_pm')
                then 'annual'
              else 'other' end,
         case when d.data->>'kind' = 'half_am' then 'am'
              when d.data->>'kind' = 'half_pm' then 'pm'
              else nullif(d.data->>'half', '') end,
         (d.data->>'start')::date,
         coalesce(nullif(d.data->>'end', ''), d.data->>'start')::date,
         -- 없으면 null. 화면이 null 이면 옛 방식(기간)으로 칠한다.
         case when jsonb_typeof(d.data->'dates') = 'array' then d.data->'dates' else null end
  from approval_docs d
  join employees e on e.id = d.drafter_id
  where public.is_active_employee()
    and d.form_type = 'leave'
    and d.status = 'approved'
    and (d.data->>'start')::date <= p_to
    and coalesce(nullif(d.data->>'end', ''), d.data->>'start')::date >= p_from
$$;

revoke all on public.events from anon;  -- 새 테이블은 schema.sql 끝의 일괄 revoke 에 안 걸린다
revoke execute on function public.leave_days(date, date) from anon, public;
grant execute on function public.leave_days(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 결재 알림 (휴대폰 웹 푸시)
--   DB 는 "이 문서에 알릴 일이 생겼다" 만 알린다. 누구에게 무슨 말을 보낼지는
--   받는 쪽(work.viren.kr/api/notify, work/functions/api/notify.js)이 정한다.
--   ⚠️ 설치 뒤 push_config 에 주소와 암호를 넣어야 실제로 나간다.
-- ---------------------------------------------------------------------
create extension if not exists pg_net;

-- ① 기기 등록 ----------------------------------------------------------
-- 한 사람이 여러 기기(휴대폰·PC)를 쓸 수 있다. endpoint 가 기기 하나.
create table if not exists public.push_subs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.employees(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  label      text,                       -- '아이폰' 처럼 사람이 알아볼 이름
  created_at timestamptz not null default now(),
  failed_at  timestamptz                 -- 보내다 410/404 가 나면 찍는다
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);

alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon;  -- 새 표는 schema.sql 끝의 일괄 revoke 에 안 걸린다

drop policy if exists "내 기기만 본다" on public.push_subs;
create policy "내 기기만 본다" on public.push_subs
  for select to authenticated using (user_id = auth.uid() and public.is_active_employee());

drop policy if exists "내 기기만 등록한다" on public.push_subs;
create policy "내 기기만 등록한다" on public.push_subs
  for insert to authenticated with check (user_id = auth.uid() and public.is_active_employee());

drop policy if exists "내 기기만 고친다" on public.push_subs;
create policy "내 기기만 고친다" on public.push_subs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "내 기기만 지운다" on public.push_subs;
create policy "내 기기만 지운다" on public.push_subs
  for delete to authenticated using (user_id = auth.uid());

-- ② 알림 서버 주소와 암호 ----------------------------------------------
-- ⚠️ settings 표에 두지 않는다. 그 표는 재직자 누구나 읽을 수 있다.
--    이 표는 **정책을 하나도 두지 않는다** → 아무도 직접 못 읽는다.
--    security definer 함수만 들여다본다.
create table if not exists public.push_config (
  id          int primary key default 1 check (id = 1),
  url         text,
  cleanup_url text,
  secret      text
);
insert into public.push_config (id) values (1) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- ③ 알림 보내기(한 줄 던지고 잊는다) -----------------------------------
create or replace function public.notify_push(p_doc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.push_config;
begin
  select * into c from public.push_config where id = 1;
  if c.url is null or c.url = '' then return; end if;
  perform net.http_post(
    url     := c.url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-secret', coalesce(c.secret, '')),
    body    := jsonb_build_object('doc', p_doc),
    timeout_milliseconds := 5000
  );
exception when others then
  null;  -- 알림이 안 가도 결재는 되어야 한다
end $$;

revoke execute on function public.notify_push(uuid) from anon, public, authenticated;

-- ④ 언제 알릴지 --------------------------------------------------------
-- 함수(submit_doc·act_on_doc…)를 고치지 않고 **표의 변화**를 본다.
-- 기안·재기안·승인·반려 어느 길로 와도 빠짐없이 걸린다.
create or replace function public.push_on_step() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform public.notify_push(new.doc_id);
  end if;
  return null;
end $$;

drop trigger if exists push_step on public.approval_steps;
create trigger push_step after insert or update on public.approval_steps
  for each row execute function public.push_on_step();

create or replace function public.push_on_doc() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('approved', 'rejected') and old.status is distinct from new.status then
    perform public.notify_push(new.id);
  end if;
  return null;
end $$;

drop trigger if exists push_doc on public.approval_docs;
create trigger push_doc after update on public.approval_docs
  for each row execute function public.push_on_doc();

-- ---------------------------------------------------------------------
-- 메신저 (사내 대화)
--   방 · 참가자 · 글 셋뿐이다. 읽음은 '읽은 시각' 하나로 센다.
--   ⚠️ in_room() 은 security definer 여야 한다 — 아니면 room_members 정책이
--      room_members 를 다시 보며 무한 재귀에 빠진다.
-- ---------------------------------------------------------------------
-- ① 방 ---------------------------------------------------------------
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'group' check (kind in ('direct', 'group')),
  name       text,                                   -- 단체방 이름. 1:1 은 비운다
  created_by uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now(),     -- 목록 정렬용
  last_text  text                                    -- 목록 미리보기
);
create index if not exists rooms_last_idx on public.rooms (last_at desc);

create table if not exists public.room_members (
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid not null references public.employees(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default 'epoch',
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members (user_id);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  sender_id  uuid not null references public.employees(id),
  text       text not null default '',
  file       jsonb,                                  -- { path, name, size, type }
  created_at timestamptz not null default now()
);
create index if not exists messages_room_idx on public.messages (room_id, created_at);

-- ② 내가 그 방 사람인가 -------------------------------------------------
-- ⚠️ security definer 다. 그래야 room_members 정책 안에서 room_members 를 봐도
--    정책이 자기 자신을 다시 부르는 꼬임(무한 재귀)이 생기지 않는다.
create or replace function public.in_room(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_employee()
     and exists (select 1 from room_members m where m.room_id = p_room and m.user_id = auth.uid())
$$;

-- ③ 누가 무엇을 볼 수 있나 ---------------------------------------------
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.messages     enable row level security;
revoke all on public.rooms, public.room_members, public.messages from anon;

drop policy if exists "내 방만 본다" on public.rooms;
create policy "내 방만 본다" on public.rooms
  for select to authenticated using (public.in_room(id));

drop policy if exists "내 방 사람만 본다" on public.room_members;
create policy "내 방 사람만 본다" on public.room_members
  for select to authenticated using (public.in_room(room_id));

-- 읽은 시각은 자기 줄만 고친다
drop policy if exists "내 읽은 시각만 고친다" on public.room_members;
create policy "내 읽은 시각만 고친다" on public.room_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "내 방 글만 본다" on public.messages;
create policy "내 방 글만 본다" on public.messages
  for select to authenticated using (public.in_room(room_id));

drop policy if exists "내 방에만 쓴다" on public.messages;
create policy "내 방에만 쓴다" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.in_room(room_id));

-- 보낸 사람이 자기 글을 지운다. 남의 글은 못 지운다(관리자도).
drop policy if exists "내 글만 지운다" on public.messages;
create policy "내 글만 지운다" on public.messages
  for delete to authenticated using (sender_id = auth.uid());

-- ④ 방 만들기 ----------------------------------------------------------
-- 남을 방에 넣어야 해서 함수로만 만든다(정책으로는 남의 줄을 못 넣는다).

-- 1:1 — 이미 있으면 그 방을 돌려준다. 같은 사람과 방이 여러 개 생기면 안 된다.
create or replace function public.open_direct(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if p_other = auth.uid() then raise exception '자기 자신과는 대화할 수 없습니다.'; end if;
  if not exists (select 1 from employees where id = p_other and active) then
    raise exception '없는 직원입니다.';
  end if;

  select r.id into v_id
  from rooms r
  where r.kind = 'direct'
    and (select count(*) from room_members m where m.room_id = r.id) = 2
    and exists (select 1 from room_members m where m.room_id = r.id and m.user_id = auth.uid())
    and exists (select 1 from room_members m where m.room_id = r.id and m.user_id = p_other)
  limit 1;
  if found then return v_id; end if;

  insert into rooms (kind, created_by) values ('direct', auth.uid()) returning id into v_id;
  insert into room_members (room_id, user_id) values (v_id, auth.uid()), (v_id, p_other);
  return v_id;
end $$;

-- 단체방
create or replace function public.create_group(p_name text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_active_employee() then raise exception '권한이 없습니다.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception '대화방 이름을 넣어 주세요.'; end if;
  if coalesce(array_length(p_members, 1), 0) = 0 then raise exception '같이 할 사람을 고르세요.'; end if;
  if exists (select 1 from unnest(p_members) u where not exists
             (select 1 from employees e where e.id = u and e.active)) then
    raise exception '퇴사했거나 없는 직원이 있습니다.';
  end if;

  insert into rooms (kind, name, created_by) values ('group', trim(p_name), auth.uid()) returning id into v_id;
  insert into room_members (room_id, user_id)
  select v_id, u from (select distinct unnest(p_members || auth.uid()) u) x;
  return v_id;
end $$;

-- 단체방에 나중에 사람 넣기 (방 사람이면 누구나)
create or replace function public.add_to_room(p_room uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.in_room(p_room) then raise exception '그 방 사람이 아닙니다.'; end if;
  if (select kind from rooms where id = p_room) <> 'group' then
    raise exception '1:1 대화에는 사람을 더할 수 없습니다.';
  end if;
  if not exists (select 1 from employees where id = p_user and active) then
    raise exception '없는 직원입니다.';
  end if;
  insert into room_members (room_id, user_id) values (p_room, p_user) on conflict do nothing;
end $$;

-- 단체방 나가기. 아무도 안 남으면 방과 글이 같이 사라진다.
create or replace function public.leave_room(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.in_room(p_room) then raise exception '그 방 사람이 아닙니다.'; end if;
  if (select kind from rooms where id = p_room) <> 'group' then
    raise exception '1:1 대화는 나갈 수 없습니다.';
  end if;
  delete from room_members where room_id = p_room and user_id = auth.uid();
  delete from rooms r where r.id = p_room
    and not exists (select 1 from room_members m where m.room_id = r.id);
end $$;

-- ⑤ 안 읽은 글 수 ------------------------------------------------------
-- 읽은 시각 뒤에 온, 내가 쓰지 않은 글만 센다.
create or replace function public.unread_counts()
returns table (room_id uuid, n bigint)
language sql stable security definer set search_path = public as $$
  select m.room_id, count(*)
  from messages m
  join room_members rm on rm.room_id = m.room_id and rm.user_id = auth.uid()
  where public.is_active_employee()
    and m.created_at > rm.last_read_at
    and m.sender_id <> auth.uid()
  group by m.room_id
$$;

create or replace function public.mark_read(p_room uuid) returns void
language sql security definer set search_path = public as $$
  update room_members set last_read_at = now()
  where room_id = p_room and user_id = auth.uid()
$$;

-- ⑥ 글이 올라오면: 목록 갱신 + 알림 --------------------------------------
-- 알림 틀(2026-10-21h)에 '무엇에 대한 알림인지'를 더한다.
create or replace function public.notify_push(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.push_config;
begin
  select * into c from public.push_config where id = 1;
  if c.url is null or c.url = '' then return; end if;
  perform net.http_post(
    url     := c.url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-secret', coalesce(c.secret, '')),
    body    := jsonb_build_object('kind', p_kind, 'id', p_id),
    timeout_milliseconds := 5000
  );
exception when others then
  null;  -- 알림이 안 가도 일은 되어야 한다
end $$;

-- 옛 이름은 그대로 두고 새 것으로 넘긴다(결재 쪽 트리거가 쓰고 있다).
create or replace function public.notify_push(p_doc uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_push('doc', p_doc);
end $$;

revoke execute on function public.notify_push(text, uuid) from anon, public, authenticated;
revoke execute on function public.notify_push(uuid) from anon, public, authenticated;

create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update rooms
     set last_at = new.created_at,
         last_text = case when new.file is not null and coalesce(new.text, '') = ''
                          then '사진·파일' else left(new.text, 80) end
   where id = new.room_id;
  -- 보낸 사람은 읽은 것으로 친다
  update room_members set last_read_at = new.created_at
   where room_id = new.room_id and user_id = new.sender_id;
  perform public.notify_push('chat', new.id);
  return null;
end $$;

drop trigger if exists on_message on public.messages;
create trigger on_message after insert on public.messages
  for each row execute function public.on_message();

-- ⑦ 실시간으로 받기 ----------------------------------------------------
-- 이 줄이 있어야 새 글이 화면에 바로 뜬다(없으면 새로고침해야 보인다).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

-- ⑧ 대화에 붙이는 파일 --------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', false)
on conflict (id) do nothing;

-- 경로 첫 칸이 방 id. 결재 첨부와 같은 방식.
create or replace function public.room_id_from_path(p text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end $$;

drop policy if exists "대화 파일 보기" on storage.objects;
create policy "대화 파일 보기" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-files' and public.in_room(public.room_id_from_path(name)));

drop policy if exists "대화 파일 올리기" on storage.objects;
create policy "대화 파일 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-files' and public.in_room(public.room_id_from_path(name)));

-- ---------------------------------------------------------------------
-- 대화 파일 자동 정리
--   저장소 파일은 SQL 로 못 지운다(42501). 반드시 Storage API 를 거쳐야 해서
--   매일 새벽 pg_cron 이 pg_net 으로 work.viren.kr/api/cleanup 을 부른다.
--   ⚠️ 설치 뒤 push_config.cleanup_url 을 채워야 실제로 돈다.
-- ---------------------------------------------------------------------
-- ③ 정리 깨우기 ---------------------------------------------------------
create or replace function public.run_chat_cleanup() returns void
language plpgsql security definer set search_path = public as $$
declare c public.push_config;
begin
  select * into c from public.push_config where id = 1;
  if c.cleanup_url is null or c.cleanup_url = '' then return; end if;
  perform net.http_post(
    url     := c.cleanup_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-secret', coalesce(c.secret, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
exception when others then
  null;  -- 정리가 실패해도 대화는 되어야 한다
end $$;

revoke execute on function public.run_chat_cleanup() from anon, public, authenticated;

-- ④ 저장소 사용량 (관리 화면에 보여 준다) --------------------------------
-- 실제 버킷을 세는 게 아니라 **우리가 적어 둔 크기를 더한다.**
-- storage 표는 직접 못 읽어서다. 올릴 때 size 를 같이 적어 두니 값은 맞는다.
create or replace function public.storage_usage()
returns table (kind text, files bigint, bytes bigint)
language sql stable security definer set search_path = public as $$
  select '대화 파일',
         count(*),
         coalesce(sum((m.file->>'size')::bigint), 0)
  from messages m
  where public.is_admin()
    and m.file ? 'path'
  union all
  select '결재 첨부',
         count(*),
         coalesce(sum(f.size), 0)
  from approval_files f
  where public.is_admin()
$$;

grant execute on function public.storage_usage() to authenticated;

-- ⑤ 매일 새벽 3시(한국) ---------------------------------------------------
-- ⚠️ 예약(pg_cron)은 **설치 맨 끝에 따로** 돌린다. Supabase 쪽 설정에 따라
--    실패할 수 있고, 한 덩어리로 돌리면 앞의 것까지 되돌아간다.
--    supabase/migrations/2026-10-21l-cron.sql 참고.
--      create extension if not exists pg_cron;
--      select cron.schedule('viren-chat-cleanup', '0 18 * * *', $x$select public.run_chat_cleanup()$x$);

-- ---------------------------------------------------------------------
-- 인사기록 · 경력 (노션 직원현황관리·직원경력관리를 옮긴 것)
--   ⚠️ employees 는 "재직자 누구나 본다" 라서 민감한 것을 넣으면 안 된다.
--      그래서 표를 따로 두고 관리자와 본인만 보게 한다.
--   ⚠️ 주민번호 칸은 **일부러 없다**(2026-10-22 결정). 나중에 더하지 말 것.
-- ---------------------------------------------------------------------
-- ① 인사기록 (한 사람당 한 줄) -------------------------------------------
create table if not exists public.employee_hr (
  user_id      uuid primary key references public.employees(id) on delete cascade,
  name_en      text not null default '',   -- 영문명
  name_cn      text not null default '',   -- 한자명
  birth_date   date,
  phone        text not null default '',
  address      text not null default '',
  edu_level    text not null default '',   -- 학력 (고졸·전문학사·학사·석사·박사)
  school       text not null default '',   -- 졸업학교
  major        text not null default '',   -- 학과
  certs        text not null default '',   -- 보유자격증 (여러 개면 줄바꿈)
  tech_grade   text not null default '',   -- 기술자등급
  design_grade text not null default '',   -- 디자이너등급
  -- 등급 자동 제시용. 기준표가 자격 종류·전공 구분으로 갈리고,
  -- 시행령 [별표2] 비고 5 가 "자격·학력을 갖추기 전 경력은 60%" 라서 날짜가 필요하다.
  qual_kind    text not null default '',   -- 기술사·기능장·기사·산업기사·기능사·기능사보
  qual_date    date,                       -- 자격취득일
  edu_date     date,                       -- 졸업일
  major_type   text not null default '',   -- 디자인 전공 / 준 전공 / 비전공
  -- 비고 2: 관련 없는 학과면 학력으로는 등급을 못 받는다.
  -- ⚠️ 어느 학과가 관련 학과인지는 산업통상자원부 고시에 있다 — 기계가 정하지 않는다.
  major_related text not null default ''
                check (major_related in ('', '관련 학과', '관련 없음')),
  note         text not null default '',
  updated_at   timestamptz not null default now()
);

-- ② 경력 (한 사람당 여러 줄) ---------------------------------------------
-- 4대보험 자격취득·상실일 기준. 끝난 날이 비어 있으면 '재직 중'.
create table if not exists public.employee_careers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.employees(id) on delete cascade,
  company    text not null check (length(trim(company)) > 0),
  start_date date not null,
  end_date   date,
  note       text not null default '',
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists employee_careers_user_idx
  on public.employee_careers (user_id, start_date desc);

-- ③ 누가 볼 수 있나 — 관리자와 본인만 ------------------------------------
alter table public.employee_hr      enable row level security;
alter table public.employee_careers enable row level security;
revoke all on public.employee_hr, public.employee_careers from anon;

drop policy if exists "인사기록은 관리자와 본인만 본다" on public.employee_hr;
create policy "인사기록은 관리자와 본인만 본다" on public.employee_hr
  for select to authenticated
  using (public.is_active_employee() and (public.is_admin() or user_id = auth.uid()));

drop policy if exists "인사기록은 관리자만 고친다" on public.employee_hr;
create policy "인사기록은 관리자만 고친다" on public.employee_hr
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "경력은 관리자와 본인만 본다" on public.employee_careers;
create policy "경력은 관리자와 본인만 본다" on public.employee_careers
  for select to authenticated
  using (public.is_active_employee() and (public.is_admin() or user_id = auth.uid()));

drop policy if exists "경력은 관리자만 고친다" on public.employee_careers;
create policy "경력은 관리자만 고친다" on public.employee_careers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ④ 직원을 등록하면 인사기록 줄도 같이 만든다 ----------------------------
-- 없으면 화면에서 '없음' 과 '아직 안 적음' 을 구분하기 번거롭다.
create or replace function public.make_hr_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into employee_hr (user_id) values (new.id) on conflict do nothing;
  return null;
end $$;

drop trigger if exists make_hr_row on public.employees;
create trigger make_hr_row after insert on public.employees
  for each row execute function public.make_hr_row();

-- 이미 있는 직원들 몫
insert into public.employee_hr (user_id)
select e.id from public.employees e
where not exists (select 1 from public.employee_hr h where h.user_id = e.id);


-- 자격증 (한 사람당 여러 줄). 번호·종목명·구분·취득일.
-- ⚠️ 등급에 쓰는 자격은 **국가기술자격만**(시행령 별표2 비고 1). 급은 종목명 끝글자로 읽는다.
create table if not exists public.employee_certs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.employees(id) on delete cascade,
  cert_no    text not null default '',                       -- 자격증 번호
  name       text not null check (length(trim(name)) > 0),    -- 종목명
  kind       text not null default '국가기술자격'
             check (kind in ('국가기술자격', '민간자격')),
  got_date   date,                                            -- 자격취득일
  created_at timestamptz not null default now()
);
create index if not exists employee_certs_user_idx
  on public.employee_certs (user_id, got_date desc);

alter table public.employee_certs enable row level security;
revoke all on public.employee_certs from anon;

drop policy if exists "자격증은 관리자와 본인만 본다" on public.employee_certs;
create policy "자격증은 관리자와 본인만 본다" on public.employee_certs
  for select to authenticated
  using (public.is_active_employee() and (public.is_admin() or user_id = auth.uid()));

drop policy if exists "자격증은 관리자만 고친다" on public.employee_certs;
create policy "자격증은 관리자만 고친다" on public.employee_certs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 권한 정리: 로그인 안 한 사람(anon)은 아무것도 못 한다.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.is_active_employee(), public.is_admin(), public.can_view_doc(uuid),
  public.my_ip(), public.request_ip(), public.submit_doc(text, text, text, jsonb, uuid[], uuid[], uuid),
  public.act_on_doc(uuid, text, text), public.withdraw_doc(uuid),
  public.resubmit_doc(uuid, text, text, jsonb, uuid[], uuid[]),
  public.check_doc_line(uuid[], uuid[]), public.check_doc_payload(text, jsonb, uuid),
  public.check_in(), public.check_out(), public.doc_id_from_path(text),
  public.leave_days(date, date),
  public.in_room(uuid), public.open_direct(uuid), public.create_group(text, uuid[]),
  public.add_to_room(uuid, uuid), public.leave_room(uuid),
  public.unread_counts(), public.mark_read(uuid), public.room_id_from_path(text),
  public.storage_usage()
to authenticated;
