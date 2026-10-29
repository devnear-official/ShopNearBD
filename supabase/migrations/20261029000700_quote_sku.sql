-- Include the variant SKU in cart quotes (used as the ad-platform content ID).
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
    select v.id as variant_id, v.name as variant_name, v.sku, v.stock, v.is_active, p.id as product_id, p.slug, p.name,
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
      'variant_name', r.variant_name, 'sku', r.sku, 'unit_price', r.unit_price, 'quantity', r.qty,
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
