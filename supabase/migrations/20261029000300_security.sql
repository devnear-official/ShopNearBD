-- ShopNear BD — Row Level Security, grants, storage, default settings.
-- Principle: API roles (anon/authenticated) can read the public catalogue;
-- everything else is admin-only through RLS, or goes through SECURITY DEFINER
-- functions that validate input (checkout, order lookup).

-- ---------------------------------------------------------------------------
-- Start from zero privileges for API roles, then grant explicitly.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Catalogue: read for everyone (RLS limits rows), write for admins via RLS.
grant select on public.categories, public.products, public.product_variants, public.product_images,
               public.reviews, public.support_faqs, public.site_settings to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_variants, public.product_images,
               public.reviews, public.support_faqs, public.site_settings, public.coupons to authenticated;

-- Operational tables: authenticated only; RLS restricts to admins (or owners).
grant select on public.orders, public.order_items, public.order_status_history, public.order_notes, public.payments,
               public.shipments, public.courier_events, public.coupons, public.coupon_redemptions, public.inventory_movements,
               public.chat_conversations, public.chat_messages, public.ai_usage, public.audit_logs, public.profiles,
               public.user_roles, public.carts, public.cart_items, public.wishlists to authenticated;
grant update on public.orders, public.shipments, public.chat_conversations, public.profiles to authenticated;
grant insert on public.order_notes, public.shipments, public.chat_messages, public.audit_logs, public.courier_events to authenticated;
grant insert, update, delete on public.carts, public.cart_items, public.wishlists to authenticated;
grant usage on all sequences in schema public to authenticated;

-- Functions callable through the API.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.text_array_join(text[]) to anon, authenticated;
grant execute on function public.variant_unit_price(public.products, public.product_variants) to anon, authenticated;
grant execute on function public.shipping_quote(text, text, numeric) to anon, authenticated;
grant execute on function public.quote_cart(jsonb) to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.get_order_public(text, text) to anon, authenticated;
grant execute on function public.submit_payment_proof(text, text, text, text, text) to anon, authenticated;
grant execute on function public.require_admin() to authenticated;
grant execute on function public.admin_transition_order(uuid, public.order_status, text, boolean) to authenticated;
grant execute on function public.admin_verify_payment(uuid, boolean, text) to authenticated;
grant execute on function public.admin_record_cod(uuid, numeric, text) to authenticated;
grant execute on function public.admin_record_refund(uuid, numeric, text) to authenticated;
grant execute on function public.admin_adjust_stock(uuid, int, public.inventory_reason, text) to authenticated;
grant execute on function public.admin_dashboard(timestamptz, timestamptz) to authenticated;
grant execute on function public.order_transition_allowed(public.order_status, public.order_status) to authenticated;
-- Not granted (server/system role only): _transition_order, _restock_order, _record_cod_collection,
-- system_transition_order, system_record_cod, rate_limit_hit, setting, coupon_discount, touch_updated_at, handle_new_user.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','categories','products','product_variants','product_images','inventory_movements',
    'carts','cart_items','wishlists','coupons','orders','order_items','order_status_history','order_notes',
    'coupon_redemptions','payments','shipments','courier_events','reviews','chat_conversations','chat_messages',
    'support_faqs','ai_usage','site_settings','audit_logs','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Catalogue
create policy categories_public_read on public.categories for select using (is_active or public.is_admin());
create policy categories_admin_write on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy products_public_read on public.products for select using (status = 'published' or public.is_admin());
create policy products_admin_write on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy variants_public_read on public.product_variants for select using (
  public.is_admin() or (is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'published')));
create policy variants_admin_write on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy images_public_read on public.product_images for select using (
  public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy images_admin_write on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy reviews_public_read on public.reviews for select using (status = 'approved' or public.is_admin());
create policy reviews_admin_write on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy faqs_public_read on public.support_faqs for select using (is_active or public.is_admin());
create policy faqs_admin_write on public.support_faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy settings_public_read on public.site_settings for select using (is_public or public.is_admin());
create policy settings_admin_write on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Identity
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy user_roles_self_read on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- No insert/update/delete policy on user_roles: roles are granted only by the bootstrap script (service role).

-- Customer-owned
create policy carts_owner on public.carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_owner on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy wishlists_owner on public.wishlists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Orders: admins see all; signed-in customers see their own. Guests use get_order_public().
create policy orders_read on public.orders for select to authenticated using (public.is_admin() or customer_id = auth.uid());
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_read on public.order_items for select to authenticated using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy order_history_read on public.order_status_history for select to authenticated using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Admin-only operational data
create policy order_notes_admin on public.order_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payments_admin_read on public.payments for select to authenticated using (public.is_admin());
create policy shipments_admin on public.shipments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy courier_events_admin on public.courier_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coupons_admin on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coupon_redemptions_admin on public.coupon_redemptions for select to authenticated using (public.is_admin());
create policy inventory_admin on public.inventory_movements for select to authenticated using (public.is_admin());
create policy chat_conversations_admin on public.chat_conversations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy chat_messages_admin on public.chat_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ai_usage_admin on public.ai_usage for select to authenticated using (public.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());
create policy audit_admin_insert on public.audit_logs for insert to authenticated with check (public.is_admin() and actor_id = auth.uid());
-- rate_limits: no policies — only the server role touches it.

-- ---------------------------------------------------------------------------
-- Storage buckets. Uploads are performed by trusted server code (service role)
-- after an admin/customer check, so no INSERT policies are granted to API roles.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('payment-proofs', 'payment-proofs', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Default settings. DEVELOPMENT DEFAULTS — review every value in
-- /admin/settings before launch (marked with "dev_default": true).
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value, is_public) values
('store', jsonb_build_object(
  'dev_default', true,
  'name', 'ShopNear BD',
  'tagline', 'Everything you need, nearer than you think.',
  'tagline_bn', 'যা দরকার, সব কাছেই।',
  'phone', '+880 1XXX-XXXXXX',
  'whatsapp', '',
  'email', 'support@shopnear.example',
  'address', 'Dhaka, Bangladesh',
  'hours', 'Sat–Thu, 10am–8pm',
  'social', jsonb_build_object('facebook', '', 'instagram', '', 'tiktok', '', 'youtube', '')
), true),
('shipping', jsonb_build_object(
  'dev_default', true,
  'zones', jsonb_build_array(
    jsonb_build_object('id', 'inside_dhaka', 'label', 'Inside Dhaka City', 'label_bn', 'ঢাকা সিটির ভিতরে', 'fee', 70, 'eta', '1–2 days'),
    jsonb_build_object('id', 'dhaka_suburbs', 'label', 'Dhaka Suburbs', 'label_bn', 'ঢাকার আশেপাশে', 'fee', 100, 'eta', '2–3 days'),
    jsonb_build_object('id', 'outside_dhaka', 'label', 'Outside Dhaka', 'label_bn', 'ঢাকার বাইরে', 'fee', 130, 'eta', '3–5 days')),
  'district_zones', jsonb_build_object(
    'Dhaka', jsonb_build_array('inside_dhaka', 'dhaka_suburbs'),
    'Gazipur', jsonb_build_array('dhaka_suburbs'),
    'Narayanganj', jsonb_build_array('dhaka_suburbs')),
  'default_zone', 'outside_dhaka',
  'free_shipping_threshold', 5000
), true),
('payments', jsonb_build_object(
  'dev_default', true,
  'cod', jsonb_build_object('enabled', true, 'note', 'Pay the delivery person in cash when you receive the parcel.'),
  'bkash_manual', jsonb_build_object('enabled', true, 'number', '01XXXXXXXXX', 'account_type', 'Personal',
     'instructions', 'Open bKash → Send Money → enter our number and the exact order total → note the Transaction ID (TrxID).'),
  'nagad_manual', jsonb_build_object('enabled', true, 'number', '01XXXXXXXXX', 'account_type', 'Personal',
     'instructions', 'Open Nagad → Send Money → enter our number and the exact order total → note the Transaction ID.')
), true),
('policies', jsonb_build_object(
  'dev_default', true,
  'returns', 'Unused items in original packaging can be returned within 7 days of delivery. Tell us within 24 hours if an item arrives damaged or incorrect and we will replace it at no cost.',
  'refunds', 'Approved refunds are sent to your bKash/Nagad number or bank within 3–7 working days. Delivery charges are refundable only when we made a mistake.',
  'cancellation', 'You can cancel any order before it is handed to the courier. Call or message us with your order number.',
  'warranty', 'Electronics carry the warranty stated on the product page. Keep the box and invoice for warranty claims.'
), true),
('homepage', jsonb_build_object(
  'hero_eyebrow', 'Dhaka · Chattogram · all 64 districts',
  'hero_title', 'Shop near.',
  'hero_title_accent', 'Get it faster.',
  'hero_subtitle', 'Curated gadgets, home and lifestyle picks — packed in Dhaka and on its way the same day you order.',
  'hero_product_slug', null,
  'campaign_title', 'The Commute Kit',
  'campaign_body', 'Three things that make a Dhaka commute quieter, cooler and charged. Built around what people actually carry on the bus, the bike and the CNG.',
  'campaign_collection', 'commute-kit',
  'marquee', jsonb_build_array('Cash on Delivery everywhere', 'bKash & Nagad accepted', '7-day easy returns', 'Same-day dispatch in Dhaka')
), true),
('ai', jsonb_build_object(
  'enabled', true,
  'model', 'gemini-2.5-flash',
  'temperature', 0.3,
  'max_output_tokens', 600,
  'per_ip_per_minute', 8,
  'per_conversation_per_hour', 60,
  'retention_days', 90,
  'greeting', 'Hi! আমি ShopNear-এর সহকারী। Product, delivery বা order নিয়ে জিজ্ঞেস করুন।'
), false),
('couriers', jsonb_build_object(
  'default_provider', 'sandbox',
  'pickup_note', 'Handle with care',
  'enabled', jsonb_build_array('sandbox', 'steadfast', 'pathao', 'redx')
), false)
on conflict (key) do nothing;
