-- ShopNear BD — business logic that must be atomic lives in the database.
-- Error messages raised here are stable codes mapped to user-facing text in
-- src/lib/errors.ts.

-- ---------------------------------------------------------------------------
-- Settings helpers
-- ---------------------------------------------------------------------------
create or replace function public.setting(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.site_settings where key = p_key
$$;

-- Resolve the delivery zone and fee for a district. Mirrors src/lib/shipping.ts.
create or replace function public.shipping_quote(p_district text, p_zone_hint text, p_subtotal numeric)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb := coalesce(public.setting('shipping'), '{}'::jsonb);
  v_zone text;
  v_allowed jsonb;
  v_fee numeric;
  v_free numeric := nullif(cfg ->> 'free_shipping_threshold', '')::numeric;
  z jsonb;
begin
  if p_district is null or length(trim(p_district)) = 0 then
    raise exception 'DISTRICT_REQUIRED';
  end if;
  -- Districts can allow several zones (e.g. Dhaka: city or suburbs).
  v_allowed := cfg -> 'district_zones' -> p_district;
  if v_allowed is not null and jsonb_typeof(v_allowed) = 'array' and jsonb_array_length(v_allowed) > 0 then
    if p_zone_hint is not null and v_allowed ? p_zone_hint then
      v_zone := p_zone_hint;
    else
      v_zone := v_allowed ->> 0;
    end if;
  else
    v_zone := coalesce(cfg ->> 'default_zone', 'outside_dhaka');
  end if;

  select e into z from jsonb_array_elements(coalesce(cfg -> 'zones', '[]'::jsonb)) e where e ->> 'id' = v_zone limit 1;
  if z is null then
    raise exception 'ZONE_NOT_CONFIGURED';
  end if;
  v_fee := (z ->> 'fee')::numeric;
  if v_free is not null and p_subtotal >= v_free then
    v_fee := 0;
  end if;
  return jsonb_build_object('zone', v_zone, 'fee', v_fee, 'label', z ->> 'label', 'eta', z ->> 'eta');
end $$;

-- ---------------------------------------------------------------------------
-- Coupon evaluation (read-only; place_order re-checks under lock)
-- ---------------------------------------------------------------------------
create or replace function public.coupon_discount(c public.coupons, p_subtotal numeric, p_phone text)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  d numeric;
  used_by_phone int;
begin
  if not c.is_active then raise exception 'COUPON_INVALID'; end if;
  if c.starts_at is not null and now() < c.starts_at then raise exception 'COUPON_NOT_STARTED'; end if;
  if c.ends_at is not null and now() > c.ends_at then raise exception 'COUPON_EXPIRED'; end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then raise exception 'COUPON_EXHAUSTED'; end if;
  if p_subtotal < c.min_subtotal then raise exception 'COUPON_MIN_SUBTOTAL'; end if;
  if c.per_phone_limit is not null and p_phone is not null then
    select count(*) into used_by_phone from public.coupon_redemptions r where r.coupon_id = c.id and r.phone = p_phone;
    if used_by_phone >= c.per_phone_limit then raise exception 'COUPON_PHONE_LIMIT'; end if;
  end if;
  if c.type = 'percent' then
    d := round(p_subtotal * c.value / 100.0, 0);
  else
    d := c.value;
  end if;
  if c.max_discount is not null then d := least(d, c.max_discount); end if;
  return least(d, p_subtotal);
end $$;

-- Preview used by the checkout page. Prices come from the database, never the browser.
create or replace function public.quote_cart(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_items jsonb := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_coupon public.coupons;
  v_ship jsonb;
  v_issues jsonb := '[]'::jsonb;
  r record;
begin
  if jsonb_array_length(v_items) > 30 then raise exception 'TOO_MANY_ITEMS'; end if;
  for r in
    select v.id as variant_id, v.name as variant_name, v.stock, v.is_active, p.id as product_id, p.slug, p.name,
           p.status, public.variant_unit_price(p, v) as unit_price, (i ->> 'quantity')::int as qty,
           (select url from public.product_images im where im.product_id = p.id order by sort_order limit 1) as image_url
    from jsonb_array_elements(v_items) i
    join public.product_variants v on v.id = (i ->> 'variant_id')::uuid
    join public.products p on p.id = v.product_id
  loop
    if r.status <> 'published' or not r.is_active then
      v_issues := v_issues || jsonb_build_object('variant_id', r.variant_id, 'issue', 'unavailable');
      continue;
    end if;
    if r.stock < r.qty then
      v_issues := v_issues || jsonb_build_object('variant_id', r.variant_id, 'issue', 'insufficient_stock', 'available', r.stock);
    end if;
    v_lines := v_lines || jsonb_build_object(
      'variant_id', r.variant_id, 'product_id', r.product_id, 'slug', r.slug, 'name', r.name,
      'variant_name', r.variant_name, 'unit_price', r.unit_price, 'quantity', r.qty,
      'line_total', r.unit_price * r.qty, 'stock', r.stock, 'image_url', r.image_url);
    v_subtotal := v_subtotal + r.unit_price * least(r.qty, greatest(r.stock, 0));
  end loop;

  if nullif(trim(p_payload ->> 'coupon_code'), '') is not null then
    select * into v_coupon from public.coupons where code = upper(trim(p_payload ->> 'coupon_code'));
    if not found then
      v_issues := v_issues || jsonb_build_object('issue', 'COUPON_INVALID');
    else
      begin
        v_discount := public.coupon_discount(v_coupon, v_subtotal, nullif(p_payload ->> 'phone', ''));
      exception when others then
        v_issues := v_issues || jsonb_build_object('issue', sqlerrm);
        v_discount := 0;
      end;
    end if;
  end if;

  if nullif(p_payload ->> 'district', '') is not null then
    v_ship := public.shipping_quote(p_payload ->> 'district', p_payload ->> 'zone', v_subtotal - v_discount);
  end if;

  return jsonb_build_object(
    'lines', v_lines, 'subtotal', v_subtotal, 'discount', v_discount,
    'shipping', v_ship, 'total', v_subtotal - v_discount + coalesce((v_ship ->> 'fee')::numeric, 0),
    'issues', v_issues);
end $$;

-- ---------------------------------------------------------------------------
-- Internal: order state machine. Not callable by API roles directly.
-- ---------------------------------------------------------------------------
create or replace function public.order_transition_allowed(p_from public.order_status, p_to public.order_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'pending'   then p_to in ('confirmed', 'cancelled')
    when 'confirmed' then p_to in ('packed', 'shipped', 'cancelled')
    when 'packed'    then p_to in ('shipped', 'cancelled')
    when 'shipped'   then p_to in ('delivered', 'returned')
    when 'delivered' then p_to in ('returned')
    else false
  end
$$;

create or replace function public._restock_order(p_order_id uuid, p_reason public.inventory_reason, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record;
  v_after int;
begin
  for it in
    select oi.variant_id, oi.product_id, oi.quantity from public.order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    order by oi.variant_id
  loop
    update public.product_variants set stock = stock + it.quantity where id = it.variant_id returning stock into v_after;
    if found then
      insert into public.inventory_movements (variant_id, delta, stock_after, reason, order_id, actor_id)
      values (it.variant_id, it.quantity, v_after, p_reason, p_order_id, p_actor);
    end if;
    update public.products set sold_count = greatest(sold_count - it.quantity, 0) where id = it.product_id;
  end loop;
end $$;

create or replace function public._transition_order(
  p_order_id uuid, p_to public.order_status, p_note text, p_actor uuid, p_actor_label text, p_restock boolean default true)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_from public.order_status;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status = p_to then return o; end if; -- idempotent (webhooks may repeat)
  v_from := o.status;
  if not public.order_transition_allowed(o.status, p_to) then
    raise exception 'INVALID_TRANSITION' using detail = o.status || ' -> ' || p_to;
  end if;

  if p_to in ('cancelled', 'returned') and p_restock then
    perform public._restock_order(o.id, case when p_to = 'cancelled' then 'cancel' else 'return' end::public.inventory_reason, p_actor);
  end if;

  update public.orders set
    status = p_to,
    confirmed_at = case when p_to = 'confirmed' then now() else confirmed_at end,
    shipped_at   = case when p_to = 'shipped' then now() else shipped_at end,
    delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
    cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end,
    cancel_reason = case when p_to = 'cancelled' then p_note else cancel_reason end
  where id = o.id
  returning * into o;

  -- Release the coupon use if a pending/confirmed order is cancelled.
  if p_to = 'cancelled' and o.coupon_id is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where id = o.coupon_id;
    delete from public.coupon_redemptions where order_id = o.id;
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, note, actor_id, actor_label)
  values (o.id, v_from, p_to, p_note, p_actor, p_actor_label);
  return o;
end $$;

-- ---------------------------------------------------------------------------
-- Checkout: one transaction creates order, items, payment record, stock moves.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  c jsonb := p_payload -> 'customer';
  pay jsonb := coalesce(p_payload -> 'payment', '{}'::jsonb);
  v_items jsonb := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_key text := p_payload ->> 'idempotency_key';
  v_method public.payment_method;
  v_pay_cfg jsonb := coalesce(public.setting('payments'), '{}'::jsonb);
  v_existing public.orders;
  v_order public.orders;
  v_coupon public.coupons;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_ship jsonb;
  v_phone text := c ->> 'phone';
  v_txid text := nullif(upper(trim(pay ->> 'transaction_id')), '');
  v_number text;
  v_constraint text;
  v_after int;
  r record;
  v_count int;
begin
  -- Basic shape checks (the app validates with zod first; this is the trust boundary).
  if v_key is null or length(v_key) < 16 or length(v_key) > 100 then raise exception 'BAD_REQUEST' using detail = 'idempotency_key'; end if;
  if coalesce(length(p_payload ->> 'access_token_hash'), 0) <> 64 then raise exception 'BAD_REQUEST' using detail = 'access_token_hash'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'CART_EMPTY'; end if;
  if jsonb_array_length(v_items) > 30 then raise exception 'TOO_MANY_ITEMS'; end if;
  if v_phone is null or v_phone !~ '^01[3-9][0-9]{8}$' then raise exception 'INVALID_PHONE'; end if;

  -- Duplicate submission: return the order created by the first attempt.
  select * into v_existing from public.orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
                              'total', v_existing.total, 'duplicate', true);
  end if;

  begin
    v_method := (pay ->> 'method')::public.payment_method;
  exception when others then
    raise exception 'PAYMENT_METHOD_UNAVAILABLE';
  end;
  if coalesce((v_pay_cfg -> v_method::text ->> 'enabled')::boolean, false) is not true then
    raise exception 'PAYMENT_METHOD_UNAVAILABLE';
  end if;
  if v_method in ('bkash_manual', 'nagad_manual') and v_txid is not null then
    if v_txid !~ '^[A-Z0-9]{6,20}$' then raise exception 'INVALID_TXID'; end if;
    if (pay ->> 'sender_number') is null or (pay ->> 'sender_number') !~ '^01[3-9][0-9]{8}$' then raise exception 'INVALID_SENDER'; end if;
  end if;

  -- Reject duplicated variant lines and bad quantities.
  select count(*) - count(distinct i ->> 'variant_id') into v_count from jsonb_array_elements(v_items) i;
  if v_count > 0 then raise exception 'BAD_REQUEST' using detail = 'duplicate_lines'; end if;
  if exists (select 1 from jsonb_array_elements(v_items) i
             where coalesce((i ->> 'quantity')::int, 0) not between 1 and 20) then
    raise exception 'INVALID_QUANTITY';
  end if;

  -- Lock every variant row in a stable order (prevents deadlocks and overselling).
  create temporary table _lines on commit drop as
  select v.id as variant_id, p.id as product_id, p.name as product_name, v.name as variant_name, v.sku,
         public.variant_unit_price(p, v) as unit_price, (i ->> 'quantity')::int as quantity,
         v.stock, v.is_active, p.status,
         (select url from public.product_images im where im.product_id = p.id order by im.sort_order limit 1) as image_url
  from jsonb_array_elements(v_items) i
  join public.product_variants v on v.id = (i ->> 'variant_id')::uuid
  join public.products p on p.id = v.product_id
  order by v.id;

  if (select count(*) from _lines) <> jsonb_array_length(v_items) then raise exception 'PRODUCT_UNAVAILABLE'; end if;

  perform 1 from public.product_variants where id in (select variant_id from _lines) order by id for update;

  -- Re-read stock after the lock is held.
  update _lines l set stock = v.stock, is_active = v.is_active
  from public.product_variants v where v.id = l.variant_id;

  for r in select * from _lines loop
    if r.status <> 'published' or not r.is_active then
      raise exception 'PRODUCT_UNAVAILABLE' using detail = r.sku;
    end if;
    if r.stock < r.quantity then
      raise exception 'OUT_OF_STOCK' using detail = r.sku;
    end if;
    v_subtotal := v_subtotal + r.unit_price * r.quantity;
  end loop;

  if nullif(trim(p_payload ->> 'coupon_code'), '') is not null then
    select * into v_coupon from public.coupons where code = upper(trim(p_payload ->> 'coupon_code')) for update;
    if not found then raise exception 'COUPON_INVALID'; end if;
    v_discount := public.coupon_discount(v_coupon, v_subtotal, v_phone);
  end if;

  v_ship := public.shipping_quote(c ->> 'district', c ->> 'zone', v_subtotal - v_discount);

  v_number := 'SN' || to_char(now() at time zone 'Asia/Dhaka', 'YYMMDD') || lpad((nextval('public.order_number_seq') % 100000)::text, 5, '0');

  begin
    insert into public.orders (
      order_number, access_token_hash, idempotency_key, customer_id, customer_name, phone, email,
      address, district, area, zone, delivery_note, subtotal, discount_total, shipping_fee, total,
      coupon_id, coupon_code, payment_method, payment_status, ip_hash)
    values (
      v_number, p_payload ->> 'access_token_hash', v_key, auth.uid(), trim(c ->> 'name'), v_phone,
      nullif(trim(c ->> 'email'), ''), trim(c ->> 'address'), c ->> 'district', nullif(trim(c ->> 'area'), ''),
      v_ship ->> 'zone', nullif(trim(c ->> 'note'), ''), v_subtotal, v_discount, (v_ship ->> 'fee')::numeric,
      v_subtotal - v_discount + (v_ship ->> 'fee')::numeric,
      v_coupon.id, v_coupon.code, v_method,
      case when v_method = 'cod' then 'unpaid'
           when v_txid is not null then 'pending_verification'
           else 'unpaid' end::public.payment_status,
      p_payload ->> 'ip_hash')
    returning * into v_order;

    if v_method <> 'cod' and v_txid is not null then
      insert into public.payments (order_id, method, status, amount, sender_number, transaction_id, proof_path)
      values (v_order.id, v_method, 'pending', v_order.total, pay ->> 'sender_number', v_txid, nullif(pay ->> 'proof_path', ''));
    end if;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'orders_idempotency_key_key' then
      select * into v_existing from public.orders where idempotency_key = v_key;
      return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
                                'total', v_existing.total, 'duplicate', true);
    elsif v_constraint = 'payments_txid_unique' then
      raise exception 'TXID_USED';
    end if;
    raise;
  end;

  for r in select * from _lines loop
    update public.product_variants set stock = stock - r.quantity
    where id = r.variant_id and stock >= r.quantity
    returning stock into v_after;
    if not found then raise exception 'OUT_OF_STOCK' using detail = r.sku; end if;
    insert into public.inventory_movements (variant_id, delta, stock_after, reason, order_id)
    values (r.variant_id, -r.quantity, v_after, 'order', v_order.id);
    insert into public.order_items (order_id, product_id, variant_id, product_name, variant_name, sku, image_url, unit_price, quantity, line_total)
    values (v_order.id, r.product_id, r.variant_id, r.product_name, r.variant_name, r.sku, r.image_url, r.unit_price, r.quantity, r.unit_price * r.quantity);
    update public.products set sold_count = sold_count + r.quantity where id = r.product_id;
  end loop;

  if v_coupon.id is not null then
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
    insert into public.coupon_redemptions (coupon_id, order_id, phone, amount) values (v_coupon.id, v_order.id, v_phone, v_discount);
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, note, actor_label)
  values (v_order.id, null, 'pending', 'Order placed', 'customer');

  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'total', v_order.total, 'duplicate', false);
end $$;

-- ---------------------------------------------------------------------------
-- Customer order access: requires the secret token issued at checkout.
-- ---------------------------------------------------------------------------
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
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'product_name', i.product_name, 'variant_name', i.variant_name, 'quantity', i.quantity,
                'unit_price', i.unit_price, 'line_total', i.line_total, 'image_url', i.image_url,
                'slug', (select slug from public.products p where p.id = i.product_id)) order by i.product_name), '[]'::jsonb)
              from public.order_items i where i.order_id = o.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at) order by h.id), '[]'::jsonb)
                from public.order_status_history h where h.order_id = o.id),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('method', p.method, 'status', p.status, 'amount', p.amount,
                   'transaction_id', p.transaction_id, 'at', p.created_at) order by p.created_at), '[]'::jsonb)
                 from public.payments p where p.order_id = o.id and p.status <> 'refund'),
    'shipment', (select jsonb_build_object('provider', s.provider, 'status', s.status, 'tracking_code', s.tracking_code,
                   'tracking_url', s.tracking_url, 'consignment_id', s.consignment_id)
                 from public.shipments s where s.order_id = o.id and s.status not in ('failed', 'cancelled')
                 order by s.created_at desc limit 1)
  );
end $$;

-- A customer who chose bKash/Nagad but paid later can submit the transaction.
create or replace function public.submit_payment_proof(p_order_number text, p_token_hash text, p_sender text, p_txid text, p_proof_path text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  o public.orders;
  v_txid text := upper(trim(p_txid));
  v_constraint text;
begin
  select * into o from public.orders where order_number = p_order_number for update;
  if not found or o.access_token_hash <> p_token_hash then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.payment_method = 'cod' then raise exception 'PAYMENT_METHOD_UNAVAILABLE'; end if;
  if o.status in ('cancelled', 'returned') then raise exception 'ORDER_CLOSED'; end if;
  if o.payment_status not in ('unpaid', 'failed') then raise exception 'PAYMENT_ALREADY_SUBMITTED'; end if;
  if v_txid !~ '^[A-Z0-9]{6,20}$' then raise exception 'INVALID_TXID'; end if;
  if p_sender !~ '^01[3-9][0-9]{8}$' then raise exception 'INVALID_SENDER'; end if;
  begin
    insert into public.payments (order_id, method, status, amount, sender_number, transaction_id, proof_path)
    values (o.id, o.payment_method, 'pending', o.total, p_sender, v_txid, nullif(p_proof_path, ''));
  exception when unique_violation then
    raise exception 'TXID_USED';
  end;
  update public.orders set payment_status = 'pending_verification' where id = o.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Admin operations (each checks is_admin(); RLS also protects direct writes)
-- ---------------------------------------------------------------------------
create or replace function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return auth.uid();
end $$;

create or replace function public.admin_transition_order(p_order_id uuid, p_to public.order_status, p_note text, p_restock boolean default true)
returns public.orders language plpgsql volatile security definer set search_path = public as $$
declare
  v_actor uuid := public.require_admin();
  o public.orders;
begin
  o := public._transition_order(p_order_id, p_to, p_note, v_actor, coalesce(auth.jwt() ->> 'email', 'admin'), p_restock);
  insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data)
  values (v_actor, coalesce(auth.jwt() ->> 'email', 'admin'), 'order.status', 'order', o.id::text,
          jsonb_build_object('to', p_to, 'note', p_note, 'restock', p_restock));
  return o;
end $$;

create or replace function public.admin_verify_payment(p_payment_id uuid, p_approve boolean, p_note text)
returns public.payments language plpgsql volatile security definer set search_path = public as $$
declare
  v_actor uuid := public.require_admin();
  p public.payments;
begin
  select * into p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_REVIEWED'; end if;
  update public.payments set status = case when p_approve then 'verified' else 'rejected' end::public.payment_record_status,
    verified_by = v_actor, verified_at = now(), note = p_note
  where id = p.id returning * into p;
  update public.orders set payment_status = case when p_approve then 'paid' else 'failed' end::public.payment_status
  where id = p.order_id;
  insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data)
  values (v_actor, coalesce(auth.jwt() ->> 'email', 'admin'), case when p_approve then 'payment.verify' else 'payment.reject' end,
          'payment', p.id::text, jsonb_build_object('order_id', p.order_id, 'amount', p.amount, 'transaction_id', p.transaction_id, 'note', p_note));
  return p;
end $$;

-- Record cash collected for a COD order (manual reconciliation or courier report).
create or replace function public._record_cod_collection(p_order_id uuid, p_amount numeric, p_note text, p_actor uuid, p_label text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.payment_method <> 'cod' then raise exception 'NOT_COD'; end if;
  if o.payment_status = 'paid' then return; end if;
  insert into public.payments (order_id, method, status, amount, note, verified_by, verified_at)
  values (o.id, 'cod', 'verified', p_amount, p_note, p_actor, now());
  update public.orders set payment_status = case when p_amount >= o.total then 'paid' else 'partially_refunded' end::public.payment_status
  where id = o.id;
  insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data)
  values (p_actor, p_label, 'payment.cod_collected', 'order', o.id::text, jsonb_build_object('amount', p_amount, 'note', p_note));
end $$;

create or replace function public.admin_record_cod(p_order_id uuid, p_amount numeric, p_note text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_actor uuid := public.require_admin();
begin
  perform public._record_cod_collection(p_order_id, p_amount, p_note, v_actor, coalesce(auth.jwt() ->> 'email', 'admin'));
end $$;

create or replace function public.admin_record_refund(p_order_id uuid, p_amount numeric, p_note text)
returns public.payments language plpgsql volatile security definer set search_path = public as $$
declare
  v_actor uuid := public.require_admin();
  o public.orders;
  v_paid numeric;
  v_refunded numeric;
  p public.payments;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_note is null or length(trim(p_note)) < 3 then raise exception 'NOTE_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select coalesce(sum(amount) filter (where status = 'verified'), 0), coalesce(-sum(amount) filter (where status = 'refund'), 0)
    into v_paid, v_refunded from public.payments where order_id = o.id;
  if p_amount > v_paid - v_refunded then raise exception 'REFUND_EXCEEDS_PAID'; end if;
  insert into public.payments (order_id, method, status, amount, note, verified_by, verified_at)
  values (o.id, o.payment_method, 'refund', -p_amount, p_note, v_actor, now()) returning * into p;
  update public.orders set payment_status = case when v_refunded + p_amount >= v_paid then 'refunded' else 'partially_refunded' end::public.payment_status
  where id = o.id;
  insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data)
  values (v_actor, coalesce(auth.jwt() ->> 'email', 'admin'), 'payment.refund', 'order', o.id::text, jsonb_build_object('amount', p_amount, 'note', p_note));
  return p;
end $$;

create or replace function public.admin_adjust_stock(p_variant_id uuid, p_delta int, p_reason public.inventory_reason, p_note text)
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  v_actor uuid := public.require_admin();
  v_after int;
begin
  if p_delta = 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_reason not in ('restock', 'adjustment', 'return', 'initial') then raise exception 'BAD_REQUEST'; end if;
  update public.product_variants set stock = stock + p_delta where id = p_variant_id and stock + p_delta >= 0
  returning stock into v_after;
  if not found then raise exception 'STOCK_NEGATIVE'; end if;
  insert into public.inventory_movements (variant_id, delta, stock_after, reason, note, actor_id)
  values (p_variant_id, p_delta, v_after, p_reason, p_note, v_actor);
  return v_after;
end $$;

-- Dashboard metrics. Definitions are shown next to each figure in the admin UI.
create or replace function public.admin_dashboard(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka';
  result jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'orders_today', (select count(*) from orders where created_at >= v_today_start),
    'awaiting_confirmation', (select count(*) from orders where status = 'pending'),
    'awaiting_shipment', (select count(*) from orders where status in ('confirmed', 'packed')),
    'in_transit', (select count(*) from orders where status = 'shipped'),
    'payments_to_verify', (select count(*) from payments where status = 'pending'),
    'delivered_in_range', (select count(*) from orders where status = 'delivered' and delivered_at between p_from and p_to),
    'cancelled_in_range', (select count(*) from orders where status = 'cancelled' and cancelled_at between p_from and p_to),
    'orders_in_range', (select count(*) from orders where created_at between p_from and p_to),
    'booked_value', (select coalesce(sum(total), 0) from orders where created_at between p_from and p_to and status not in ('cancelled')),
    'delivered_value', (select coalesce(sum(total), 0) from orders where status in ('delivered') and delivered_at between p_from and p_to),
    'collected', (select coalesce(sum(amount) filter (where status = 'verified'), 0) from payments where verified_at between p_from and p_to),
    'refunded', (select coalesce(-sum(amount), 0) from payments where status = 'refund' and verified_at between p_from and p_to),
    'status_distribution', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                            from (select status, count(*) n from orders where created_at between p_from and p_to group by status) s),
    'top_products', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                       select i.product_id, i.product_name as name, sum(i.quantity)::int as quantity, sum(i.line_total) as value
                       from order_items i join orders o on o.id = i.order_id
                       where o.created_at between p_from and p_to and o.status not in ('cancelled', 'returned')
                       group by i.product_id, i.product_name order by sum(i.quantity) desc limit 6) t),
    'low_stock', (select coalesce(jsonb_agg(l), '[]'::jsonb) from (
                    select p.id as product_id, p.name, v.id as variant_id, v.name as variant_name, v.sku, v.stock, p.low_stock_threshold
                    from product_variants v join products p on p.id = v.product_id
                    where p.status = 'published' and v.is_active and v.stock <= p.low_stock_threshold
                    order by v.stock asc limit 10) l),
    'daily', (select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) from (
                select to_char(date_trunc('day', created_at at time zone 'Asia/Dhaka'), 'YYYY-MM-DD') as day,
                       count(*)::int as orders, coalesce(sum(total) filter (where status <> 'cancelled'), 0) as value
                from orders where created_at between p_from and p_to group by 1) d)
  ) into result;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Rate limiting shared across server instances (fixed window)
-- ---------------------------------------------------------------------------
create or replace function public.rate_limit_hit(p_bucket text, p_window_seconds int, p_max int)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limits (bucket, window_start, count) values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_max;
end $$;

-- Courier/webhook side effects run as the server (system) role only.
create or replace function public.system_transition_order(p_order_id uuid, p_to public.order_status, p_note text)
returns public.orders language sql volatile security definer set search_path = public as $$
  select public._transition_order(p_order_id, p_to, p_note, null, 'courier', true)
$$;

create or replace function public.system_record_cod(p_order_id uuid, p_amount numeric, p_note text)
returns void language sql volatile security definer set search_path = public as $$
  select public._record_cod_collection(p_order_id, p_amount, p_note, null, 'courier')
$$;
