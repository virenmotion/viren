do $$ begin create role anon nologin; exception when others then null; end $$; do $$ begin create role authenticated nologin; exception when others then null; end $$;
create schema auth; create schema storage;
grant usage on schema public, auth, storage to anon, authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert on storage.objects to authenticated;
-- supabase default: tables granted to anon/authenticated
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
