-- Ads tracking: Meta Pixel + Conversions API, TikTok Pixel + Events API.

-- Where the order came from (UTM tags, click IDs) and the browser identifiers
-- the ad platforms need for server-side matching. Written by trusted server code.
alter table public.orders
  add column attribution jsonb not null default '{}'::jsonb,
  add column purchase_tracked_at timestamptz;
create index orders_channel_idx on public.orders ((attribution ->> 'channel'), created_at desc);

-- Every server-side event sent to an ad platform, for debugging match quality.
create table public.tracking_events (
  id bigint generated always as identity primary key,
  platform text not null check (platform in ('meta', 'tiktok')),
  event_name text not null,
  event_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  http_status int,
  detail text,
  test_mode boolean not null default false,
  created_at timestamptz not null default now()
);
create index tracking_events_created_idx on public.tracking_events (created_at desc);
alter table public.tracking_events enable row level security;
grant select on public.tracking_events to authenticated;
create policy tracking_events_admin on public.tracking_events for select to authenticated using (public.is_admin());

-- Pixel IDs are public (they appear in page source anyway).
insert into public.site_settings (key, value, is_public) values
('tracking', jsonb_build_object(
  'meta_pixel_id', '',
  'tiktok_pixel_id', '',
  'purchase_trigger', 'placed',          -- 'placed' | 'confirmed'
  'tiktok_purchase_event', 'Purchase',   -- 'Purchase' | 'CompletePayment'
  'server_events', true
), true)
on conflict (key) do nothing;

-- Access tokens are secrets: never public, admin-readable only (env vars override).
insert into public.site_settings (key, value, is_public) values
('tracking_secrets', jsonb_build_object('meta_access_token', '', 'meta_test_event_code', '', 'tiktok_access_token', '', 'tiktok_test_event_code', ''), false)
on conflict (key) do nothing;
