-- ─── Run this in your Supabase SQL editor ────────────────────────────────────
-- Go to: supabase.com → your project → SQL Editor → New query

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Users table (extends Supabase auth.users) ────────────────────────────────
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  plan text not null default 'free' check (plan in ('free', 'pro', 'agency')),
  reports_this_month integer not null default 0,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users can only read/update their own row
create policy "users: read own" on public.users
  for select using (auth.uid() = id);

create policy "users: update own" on public.users
  for update using (auth.uid() = id);

-- Service role can upsert (from webhooks/API)
create policy "users: service upsert" on public.users
  for all using (true) with check (true);

-- ─── Reports table ────────────────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  user_id uuid references public.users(id) on delete set null,
  url text not null,
  platform text not null,
  product_name text not null,
  report_json jsonb not null,
  is_public boolean not null default true
);

alter table public.reports enable row level security;

-- Anyone can read public reports
create policy "reports: read public" on public.reports
  for select using (is_public = true);

-- Users can read their own (including private)
create policy "reports: read own" on public.reports
  for select using (auth.uid() = user_id);

-- Service role can insert (from API routes)
create policy "reports: service insert" on public.reports
  for insert with check (true);

-- ─── RPC: increment monthly report count ─────────────────────────────────────
create or replace function increment_reports(user_id uuid)
returns void as $$
begin
  update public.users
  set reports_this_month = reports_this_month + 1
  where id = user_id;
end;
$$ language plpgsql security definer;

-- ─── Reset report counts on 1st of each month (via pg_cron) ──────────────────
-- Enable pg_cron extension first: Database → Extensions → pg_cron
select cron.schedule(
  'reset-monthly-counts',
  '0 0 1 * *',  -- midnight on 1st of every month
  $$update public.users set reports_this_month = 0$$
);

-- ─── Trigger: auto-create user row when someone signs up ─────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
