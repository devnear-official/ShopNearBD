-- Defence in depth: Supabase grants new public tables to anon by default. Tracking updates and the SMS log are
-- admin-only (RLS already returns no rows to anon); also remove the table privileges themselves.
revoke all on public.order_updates, public.order_sms from anon;
revoke insert, update, delete, truncate on public.hero_banners, public.ticker_items from anon;
