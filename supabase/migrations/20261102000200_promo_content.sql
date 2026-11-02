-- Admin-managed homepage hero banners and the promotional ticker below the hero.
-- Destinations are stored as (link_type, link_target) and turned into URLs in application code,
-- so a renamed route never leaves a stale hard-coded link in the database.

create table public.hero_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  description text check (description is null or length(description) <= 300),
  button_text text check (button_text is null or length(button_text) <= 40),
  image_url text check (image_url is null or length(image_url) <= 600),
  link_type text not null default 'deals' check (link_type in ('product', 'category', 'deals', 'campaign', 'custom')),
  link_target text check (link_target is null or length(link_target) <= 500),
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger hero_banners_touch before update on public.hero_banners for each row execute function public.touch_updated_at();
create index hero_banners_order_idx on public.hero_banners (sort_order, created_at);

create table public.ticker_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'offer' check (kind in ('offer', 'discount', 'flash_deal', 'ad', 'announcement')),
  text text not null check (length(text) between 1 and 140),
  image_url text check (image_url is null or length(image_url) <= 600),
  link_type text not null default 'deals' check (link_type in ('product', 'category', 'deals', 'campaign', 'custom')),
  link_target text check (link_target is null or length(link_target) <= 500),
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger ticker_items_touch before update on public.ticker_items for each row execute function public.touch_updated_at();
create index ticker_items_order_idx on public.ticker_items (sort_order, created_at);

alter table public.hero_banners enable row level security;
alter table public.ticker_items enable row level security;

grant select on public.hero_banners, public.ticker_items to anon, authenticated;
grant insert, update, delete on public.hero_banners, public.ticker_items to authenticated;

-- Visitors see only live items inside their schedule; admins see everything.
create policy hero_banners_public_read on public.hero_banners for select
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or public.is_admin());
create policy hero_banners_admin_write on public.hero_banners for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ticker_items_public_read on public.ticker_items for select
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or public.is_admin());
create policy ticker_items_admin_write on public.ticker_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
