-- Same as pgbench-checkout.sql but orders are spread across four variants (less lock contention).
\set n random(1, 2000000000)
\set pick random(1, 4)
BEGIN;
SET LOCAL ROLE anon;
SELECT public.place_order(jsonb_build_object(
  'idempotency_key', 'perf-' || :n || '-' || md5(random()::text),
  'access_token_hash', repeat('a', 64),
  'customer', jsonb_build_object('name', 'Perf Test', 'phone', '01712345678', 'address', 'House 1, Road 1, Dhanmondi', 'district', 'Dhaka'),
  'items', jsonb_build_array(jsonb_build_object('variant_id', (array[':v1', ':v2', ':v3', ':v4'])[:pick], 'quantity', 1)),
  'payment', jsonb_build_object('method', 'cod')));
COMMIT;
