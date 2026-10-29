-- Include item SKUs in the customer's order view (thank-you page Purchase event content IDs).
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
                'product_id', i.product_id, 'sku', i.sku, 'product_name', i.product_name, 'variant_name', i.variant_name, 'quantity', i.quantity,
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
