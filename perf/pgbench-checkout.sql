-- pgbench workload: one checkout per transaction through the real place_order()
-- as the anonymous API role. Usage (disposable DB only!):
--   pgbench -n -f perf/pgbench-checkout.sql -D vid=<variant uuid> -c 16 -j 4 -T 30 <db>
\set n random(1, 2000000000)
BEGIN;
SET LOCAL ROLE anon;
SELECT public.place_order(jsonb_build_object(
  'idempotency_key', 'perf-' || :n || '-' || md5(random()::text),
  'access_token_hash', repeat('a', 64),
  'customer', jsonb_build_object('name', 'Perf Test', 'phone', '01712345678', 'address', 'House 1, Road 1, Dhanmondi', 'district', 'Dhaka'),
  'items', jsonb_build_array(jsonb_build_object('variant_id', ':vid', 'quantity', 1)),
  'payment', jsonb_build_object('method', 'cod')));
COMMIT;
