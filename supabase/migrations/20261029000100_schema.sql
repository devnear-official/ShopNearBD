-- ShopNear BD — core schema
-- Money is stored as numeric(12,2) in BDT. All timestamps are timestamptz.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned');
create type public.payment_method as enum ('cod', 'bkash_manual', 'nagad_manual');
create type public.payment_status as enum ('unpaid', 'pending_verification', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.payment_record_status as enum ('pending', 'verified', 'rejected', 'refund');
create type public.shipment_status as enum ('pending', 'created', 'picked_up', 'in_transit', 'delivered', 'partial_delivered', 'returned', 'cancelled', 'failed');
create type public.inventory_reason as enum ('order', 'cancel', 'return', 'restock', 'adjustment', 'initial');
create type public.chat_status as enum ('open', 'pending', 'resolved');
create type public.chat_mode as enum ('ai', 'human');
create type public.chat_role as enum ('user', 'assistant', 'admin', 'system');
create type public.coupon_type as enum ('percent', 'fixed');
create type public.review_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- array_to_string() is only STABLE; generated search columns need IMMUTABLE.
create or replace function public.text_array_join(arr text[]) returns text
language sql immutable parallel safe as $$ select array_to_string(arr, ' ') $$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', null))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 80),
  name_bn text,
  description text,
  image_url text,
  accent text, -- optional hex colour used by the category tile
  parent_id uuid references public.categories(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sku text not null unique,
  name text not null check (length(name) between 2 and 140),
  name_bn text,
  short_description text,
  description text,
  specifications jsonb not null default '[]'::jsonb check (jsonb_typeof(specifications) = 'array'),
  category_id uuid references public.categories(id) on delete set null,
  tags text[] not null default '{}',
  collections text[] not null default '{}',
  price numeric(12,2) not null check (price >= 0),
  sale_price numeric(12,2) check (sale_price is null or (sale_price >= 0 and sale_price <= price)),
  cost_price numeric(12,2) check (cost_price is null or cost_price >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  option_names text[] not null default '{}', -- e.g. {Color,Size}
  seo_title text,
  seo_description text,
  og_image_url text,
  sold_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(name_bn, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(public.text_array_join(tags), '') || ' ' || coalesce(sku, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(short_description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'D')
  ) stored
);
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create index products_status_created_idx on public.products (status, created_at desc);
create index products_category_idx on public.products (category_id) where status = 'published';
create index products_featured_idx on public.products (is_featured) where status = 'published';
create index products_sold_idx on public.products (sold_count desc) where status = 'published';
create index products_search_idx on public.products using gin (search_vector);
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index products_tags_idx on public.products using gin (tags);
create index products_collections_idx on public.products using gin (collections);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null default 'Default',
  sku text not null unique,
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  price numeric(12,2) check (price is null or price >= 0),          -- null = use product price
  sale_price numeric(12,2) check (sale_price is null or sale_price >= 0),
  stock int not null default 0 check (stock >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sale_price is null or price is null or sale_price <= price)
);
create trigger variants_touch before update on public.product_variants for each row execute function public.touch_updated_at();
create index variants_product_idx on public.product_variants (product_id, sort_order);
create unique index variants_one_default_idx on public.product_variants (product_id) where is_default;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  storage_path text,
  url text not null,
  alt text not null default '',
  width int,
  height int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- The price a customer pays for one unit of a variant. Mirrors src/lib/pricing.
create or replace function public.variant_unit_price(p public.products, v public.product_variants)
returns numeric language sql immutable as $$
  select case
    when v.price is not null then coalesce(v.sale_price, v.price)
    else coalesce(v.sale_price, p.sale_price, p.price)
  end
$$;

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta int not null check (delta <> 0),
  stock_after int not null,
  reason public.inventory_reason not null,
  order_id uuid,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Customers: carts and wishlists (authenticated customers only; guests keep
-- their cart in the browser and it is merged on sign-in)
-- ---------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity between 1 and 20),
  added_at timestamptz not null default now(),
  primary key (cart_id, variant_id)
);

create table public.wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  description text,
  type public.coupon_type not null,
  value numeric(12,2) not null check (value > 0),
  min_subtotal numeric(12,2) not null default 0 check (min_subtotal >= 0),
  max_discount numeric(12,2) check (max_discount is null or max_discount > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  per_phone_limit int check (per_phone_limit is null or per_phone_limit > 0),
  used_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'percent' or value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger coupons_touch before update on public.coupons for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  access_token_hash text not null,           -- sha256 of the secret given to the customer
  idempotency_key text not null unique,      -- one per checkout attempt; prevents duplicates
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null check (length(customer_name) between 2 and 80),
  phone text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  email text,
  address text not null check (length(address) between 8 and 300),
  district text not null,
  area text,
  zone text not null,
  delivery_note text check (delivery_note is null or length(delivery_note) <= 300),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  shipping_fee numeric(12,2) not null check (shipping_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  coupon_id uuid references public.coupons(id) on delete set null,
  coupon_code text,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'unpaid',
  status public.order_status not null default 'pending',
  internal_note text,
  cancel_reason text,
  ip_hash text,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total = subtotal - discount_total + shipping_fee)
);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_phone_idx on public.orders (phone);
create index orders_payment_idx on public.orders (payment_status, payment_method);
create index orders_customer_idx on public.orders (customer_id) where customer_id is not null;
create index orders_name_trgm_idx on public.orders using gin (customer_name extensions.gin_trgm_ops);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  -- historical snapshot: later edits to the product never change an order
  product_name text not null,
  variant_name text not null,
  sku text not null,
  image_url text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity between 1 and 20),
  line_total numeric(12,2) not null check (line_total = unit_price * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null default 'system',
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.order_notes (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null,
  created_at timestamptz not null default now()
);
create index order_notes_order_idx on public.order_notes (order_id, created_at);

create table public.coupon_redemptions (
  id bigint generated always as identity primary key,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  phone text not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_phone_idx on public.coupon_redemptions (coupon_id, phone);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  status public.payment_record_status not null default 'pending',
  amount numeric(12,2) not null,             -- negative for refunds
  sender_number text,
  transaction_id text,
  proof_path text,                           -- private storage object (screenshot)
  note text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'refund' or amount >= 0),
  check (status <> 'refund' or amount < 0)
);
create index payments_order_idx on public.payments (order_id, created_at);
-- A mobile-banking transaction ID can only ever be claimed once.
create unique index payments_txid_unique on public.payments (method, upper(transaction_id))
  where transaction_id is not null and status <> 'rejected';

-- ---------------------------------------------------------------------------
-- Shipments / courier
-- ---------------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,                    -- 'steadfast' | 'pathao' | 'redx' | 'sandbox'
  is_sandbox boolean not null default false,
  status public.shipment_status not null default 'pending',
  idempotency_key text not null unique,
  consignment_id text,
  tracking_code text,
  tracking_url text,
  label_url text,
  cod_amount numeric(12,2) not null default 0,
  cod_collected numeric(12,2),
  delivery_fee_charged numeric(12,2),
  recipient jsonb not null,
  request_payload jsonb,
  response_payload jsonb,
  last_error text,
  attempts int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipments_touch before update on public.shipments for each row execute function public.touch_updated_at();
-- Only one live shipment per order (failed / cancelled ones can be retried).
create unique index shipments_one_active_idx on public.shipments (order_id) where status not in ('failed', 'cancelled');
create index shipments_status_idx on public.shipments (status, updated_at desc);
create unique index shipments_consignment_idx on public.shipments (provider, consignment_id) where consignment_id is not null;

create table public.courier_events (
  id bigint generated always as identity primary key,
  shipment_id uuid references public.shipments(id) on delete cascade,
  provider text not null,
  event_type text not null,
  status text,
  payload jsonb not null,
  dedupe_key text unique,
  received_at timestamptz not null default now()
);
create index courier_events_shipment_idx on public.courier_events (shipment_id, received_at desc);

-- ---------------------------------------------------------------------------
-- Reviews (only from delivered orders, moderated)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  author_name text not null check (length(author_name) between 2 and 60),
  rating int not null check (rating between 1 and 5),
  body text check (body is null or length(body) <= 1500),
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);
create index reviews_product_idx on public.reviews (product_id, created_at desc) where status = 'approved';

-- ---------------------------------------------------------------------------
-- Support chat
-- ---------------------------------------------------------------------------
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  status public.chat_status not null default 'open',
  mode public.chat_mode not null default 'ai',
  customer_name text,
  customer_phone text,
  needs_human boolean not null default false,
  admin_unread boolean not null default false,
  ip_hash text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index chat_conversations_recent_idx on public.chat_conversations (last_message_at desc);
create index chat_conversations_status_idx on public.chat_conversations (status, last_message_at desc);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role public.chat_role not null,
  content text not null check (length(content) <= 6000),
  meta jsonb not null default '{}'::jsonb,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, id);

create table public.support_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  tags text[] not null default '{}',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(question, '') || ' ' || coalesce(answer, '') || ' ' || coalesce(public.text_array_join(tags), ''))
  ) stored
);
create trigger faqs_touch before update on public.support_faqs for each row execute function public.touch_updated_at();
create index support_faqs_search_idx on public.support_faqs using gin (search_vector);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  conversation_id uuid references public.chat_conversations(id) on delete set null,
  model text not null,
  intent text,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
create index ai_usage_created_idx on public.ai_usage (created_at desc);

-- ---------------------------------------------------------------------------
-- Settings, audit, rate limiting
-- ---------------------------------------------------------------------------
create table public.site_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null default 'system',
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

-- Fixed-window counters shared by every server instance.
create unlogged table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);
