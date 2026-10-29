-- Reviews can only be written by the holder of a delivered order's access token,
-- for a product in that order. They are held for moderation.
create or replace function public.submit_review(p_order_number text, p_token_hash text, p_product_id uuid,
  p_author text, p_rating int, p_body text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where order_number = p_order_number;
  if not found or o.access_token_hash <> p_token_hash then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status <> 'delivered' then raise exception 'REVIEW_NOT_ALLOWED'; end if;
  if not exists (select 1 from public.order_items i where i.order_id = o.id and i.product_id = p_product_id) then
    raise exception 'REVIEW_NOT_ALLOWED';
  end if;
  if p_rating not between 1 and 5 then raise exception 'BAD_REQUEST'; end if;
  insert into public.reviews (product_id, order_id, author_name, rating, body)
  values (p_product_id, o.id, left(trim(p_author), 60), p_rating, nullif(left(trim(coalesce(p_body, '')), 1500), ''))
  on conflict (order_id, product_id) do update set rating = excluded.rating, body = excluded.body,
    author_name = excluded.author_name, status = 'pending', created_at = now();
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.submit_review(text, text, uuid, text, int, text) from public;
grant execute on function public.submit_review(text, text, uuid, text, int, text) to anon, authenticated;

-- Which products in a delivered order the customer has already reviewed.
create or replace function public.order_reviews(p_order_number text, p_token_hash text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('product_id', r.product_id, 'rating', r.rating, 'status', r.status)), '[]'::jsonb)
  from public.orders o join public.reviews r on r.order_id = o.id
  where o.order_number = p_order_number and o.access_token_hash = p_token_hash
$$;
revoke execute on function public.order_reviews(text, text) from public;
grant execute on function public.order_reviews(text, text) to anon, authenticated;
