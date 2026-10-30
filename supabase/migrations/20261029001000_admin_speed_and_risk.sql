-- Admin speed + customer risk check.
--  * customer_stats: one row per phone, kept current by a trigger, so the Customers page and the
--    repeat-customer metric no longer aggregate every order on each request.
--  * trigram indexes so searching orders by number / phone stays fast as orders grow.
--  * customer_risk(): the admin's per-phone history (orders, results, per-courier outcomes).

create table public.customer_stats (
  phone text primary key,
  name text not null,
  district text not null,
  orders int not null default 0,
  delivered int not null default 0,
  cancelled int not null default 0,
  spent numeric(12,2) not null default 0,
  last_order timestamptz not null
);
create index customer_stats_last_idx on public.customer_stats (last_order desc);
create index customer_stats_name_trgm_idx on public.customer_stats using gin (name extensions.gin_trgm_ops);
create index customer_stats_phone_trgm_idx on public.customer_stats using gin (phone extensions.gin_trgm_ops);

create or replace function public.refresh_customer_stats(p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Serialise per phone so two orders placed at once both end up counted.
  perform pg_advisory_xact_lock(hashtext('customer_stats:' || p_phone));
  insert into public.customer_stats (phone, name, district, orders, delivered, cancelled, spent, last_order)
  select phone,
    (array_agg(customer_name order by created_at desc))[1],
    (array_agg(district order by created_at desc))[1],
    count(*), count(*) filter (where status = 'delivered'), count(*) filter (where status in ('cancelled', 'returned')),
    coalesce(sum(total) filter (where status = 'delivered'), 0), max(created_at)
  from public.orders where phone = p_phone group by phone
  on conflict (phone) do update set name = excluded.name, district = excluded.district, orders = excluded.orders,
    delivered = excluded.delivered, cancelled = excluded.cancelled, spent = excluded.spent, last_order = excluded.last_order;
  delete from public.customer_stats s where s.phone = p_phone and not exists (select 1 from public.orders o where o.phone = p_phone);
end $$;

create or replace function public.orders_customer_stats_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and (tg_op = 'DELETE' or old.phone is distinct from new.phone) then
    perform public.refresh_customer_stats(old.phone);
  end if;
  if tg_op <> 'DELETE' then perform public.refresh_customer_stats(new.phone); end if;
  return null;
end $$;

create trigger orders_customer_stats
after insert or delete or update of status, total, customer_name, district, phone on public.orders
for each row execute function public.orders_customer_stats_trg();

insert into public.customer_stats (phone, name, district, orders, delivered, cancelled, spent, last_order)
select phone, (array_agg(customer_name order by created_at desc))[1], (array_agg(district order by created_at desc))[1],
  count(*), count(*) filter (where status = 'delivered'), count(*) filter (where status in ('cancelled', 'returned')),
  coalesce(sum(total) filter (where status = 'delivered'), 0), max(created_at)
from public.orders group by phone;

alter table public.customer_stats enable row level security;
grant select on public.customer_stats to authenticated;
create policy customer_stats_admin on public.customer_stats for select to authenticated using (public.is_admin());

create index orders_number_trgm_idx on public.orders using gin (order_number extensions.gin_trgm_ops);
create index orders_phone_trgm_idx on public.orders using gin (phone extensions.gin_trgm_ops);
create index shipments_order_idx on public.shipments (order_id);

-- Everything the admin needs to judge a phone number before confirming or booking a parcel.
create or replace function public.customer_risk(p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  base jsonb;
  couriers jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'orders', count(*),
    'delivered', count(*) filter (where status = 'delivered'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'returned', count(*) filter (where status = 'returned'),
    'open', count(*) filter (where status in ('pending', 'confirmed', 'packed', 'shipped')),
    'first_order', min(created_at),
    'last_order', max(created_at),
    'last_24h', count(*) filter (where created_at > now() - interval '24 hours'),
    'addresses', count(distinct lower(btrim(address))),
    'names', count(distinct lower(btrim(customer_name))),
    'avg_total', coalesce(round(avg(total)), 0)
  ) into base from public.orders where phone = p_phone;

  select coalesce(jsonb_agg(c order by (c ->> 'total')::int desc), '[]'::jsonb) into couriers from (
    select jsonb_build_object(
      'provider', s.provider,
      'total', count(*),
      'delivered', count(*) filter (where s.status in ('delivered', 'partial_delivered')),
      'returned', count(*) filter (where s.status = 'returned'),
      'failed', count(*) filter (where s.status in ('failed', 'cancelled')),
      'in_flight', count(*) filter (where s.status in ('pending', 'created', 'picked_up', 'in_transit'))
    ) as c
    from public.shipments s join public.orders o on o.id = s.order_id
    where o.phone = p_phone and not s.is_sandbox
    group by s.provider
  ) x;

  return base || jsonb_build_object('couriers', couriers);
end $$;
grant execute on function public.customer_risk(text) to authenticated;
