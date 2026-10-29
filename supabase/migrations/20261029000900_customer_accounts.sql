-- Customer accounts: phone number + SMS one-time code. No passwords.
-- An account is created (unverified) when someone orders; logging in with a
-- code sent to that phone proves ownership and shows every order on the number.
-- All tables are server-only: RLS on, no policies for anon/authenticated.

create table public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^01[3-9][0-9]{8}$'),
  name text check (name is null or length(name) <= 80),
  email text check (email is null or length(email) <= 120),
  created_via text not null default 'order' check (created_via in ('order', 'login')),
  verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.customer_otps (
  id bigint generated always as identity primary key,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index customer_otps_phone_idx on public.customer_otps (phone, created_at desc);

create table public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index customer_sessions_account_idx on public.customer_sessions (account_id);

-- Delivery log for every SMS (the message body is never stored: it contains the code).
create table public.sms_log (
  id bigint generated always as identity primary key,
  phone_masked text not null,
  purpose text not null,
  provider text not null,
  status text not null check (status in ('sent', 'failed')),
  detail text,
  created_at timestamptz not null default now()
);
create index sms_log_created_idx on public.sms_log (created_at desc);

-- Development/test only: the "console" SMS provider writes messages here instead of sending them.
create table public.dev_sms_outbox (
  id bigint generated always as identity primary key,
  phone text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.customer_accounts enable row level security;
alter table public.customer_otps enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.sms_log enable row level security;
alter table public.dev_sms_outbox enable row level security;

-- Admins can see accounts (customers page) and the SMS log; nothing else is exposed.
grant select on public.customer_accounts, public.sms_log to authenticated;
create policy customer_accounts_admin on public.customer_accounts for select to authenticated using (public.is_admin());
create policy sms_log_admin on public.sms_log for select to authenticated using (public.is_admin());

-- Every phone that has ordered already has an (unverified) account.
insert into public.customer_accounts (phone, name, created_via, created_at)
select distinct on (phone) phone, customer_name, 'order', min(created_at) over (partition by phone)
from public.orders where phone ~ '^01[3-9][0-9]{8}$'
order by phone, created_at desc
on conflict (phone) do nothing;
