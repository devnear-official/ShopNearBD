-- Customer-visible tracking updates, manual courier details, and order SMS history.

-- Customer-facing messages posted by the team ("Processing", "Out for delivery", or a plain note).
-- Append-only: rows are never updated or deleted, so the history stays complete.
-- Separate from order_notes (internal) and order_status_history (state machine).
create table public.order_updates (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  stage text not null check (stage in ('processing', 'out_for_delivery', 'info')),
  message text check (message is null or length(message) <= 300),
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null default 'system',
  created_at timestamptz not null default now()
);
create index order_updates_order_idx on public.order_updates (order_id, created_at);
alter table public.order_updates enable row level security;
grant select, insert on public.order_updates to authenticated;
grant usage on all sequences in schema public to authenticated;
create policy order_updates_admin_read on public.order_updates for select to authenticated using (public.is_admin());
create policy order_updates_admin_insert on public.order_updates for insert to authenticated with check (public.is_admin());

-- Courier name shown to the customer; lets staff record a courier booked outside the API integrations.
alter table public.shipments add column courier_name text check (courier_name is null or length(courier_name) <= 60);

-- One row per (order, event): the unique key is what prevents duplicate SMS for the same event.
create table public.order_sms (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  event text not null check (event in ('placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider text,
  detail text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (order_id, event)
);
create index order_sms_status_idx on public.order_sms (status, created_at desc);
alter table public.order_sms enable row level security;
grant select on public.order_sms to authenticated;
create policy order_sms_admin_read on public.order_sms for select to authenticated using (public.is_admin());

-- Customer's order view: adds posted updates, courier name and the time of the latest change.
create or replace function public.get_order_public(p_order_number text, p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where order_number = p_order_number;
  -- Same response for "not found" and "wrong token" so numbers cannot be probed.
  if not found or o.access_token_hash <> p_token_hash then
    return null;
  end if;
  return jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'customer_name', o.customer_name,
    'phone_masked', left(o.phone, 3) || '*****' || right(o.phone, 3),
    'address', o.address, 'district', o.district, 'area', o.area, 'zone', o.zone,
    'subtotal', o.subtotal, 'discount_total', o.discount_total, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'coupon_code', o.coupon_code,
    'created_at', o.created_at, 'delivered_at', o.delivered_at,
    'updated_at', greatest(o.updated_at,
        coalesce((select max(h.created_at) from public.order_status_history h where h.order_id = o.id), o.created_at),
        coalesce((select max(u.created_at) from public.order_updates u where u.order_id = o.id), o.created_at),
        coalesce((select max(s.updated_at) from public.shipments s where s.order_id = o.id), o.created_at)),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'product_id', i.product_id, 'sku', i.sku, 'product_name', i.product_name, 'variant_name', i.variant_name, 'quantity', i.quantity,
                'unit_price', i.unit_price, 'line_total', i.line_total, 'image_url', i.image_url,
                'slug', (select slug from public.products p where p.id = i.product_id)) order by i.product_name), '[]'::jsonb)
              from public.order_items i where i.order_id = o.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at) order by h.id), '[]'::jsonb)
                from public.order_status_history h where h.order_id = o.id),
    'updates', (select coalesce(jsonb_agg(jsonb_build_object('stage', u.stage, 'message', u.message, 'at', u.created_at) order by u.id), '[]'::jsonb)
                from public.order_updates u where u.order_id = o.id),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('method', p.method, 'status', p.status, 'amount', p.amount,
                   'transaction_id', p.transaction_id, 'at', p.created_at) order by p.created_at), '[]'::jsonb)
                 from public.payments p where p.order_id = o.id and p.status <> 'refund'),
    'shipment', (select jsonb_build_object('provider', s.provider, 'courier_name', s.courier_name, 'status', s.status, 'tracking_code', s.tracking_code,
                   'tracking_url', s.tracking_url, 'consignment_id', s.consignment_id)
                 from public.shipments s where s.order_id = o.id and s.status not in ('failed', 'cancelled')
                 order by s.created_at desc limit 1)
  );
end $$;
