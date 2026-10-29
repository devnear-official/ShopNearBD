# Performance — measured, not assumed

These numbers were measured on the **development machine** (2 vCPU, 7 GB RAM container; Next.js production build via `next start`, PostgreSQL 16 on the same machine, no CDN). They show where the costs are. They are **not** a statement that production will handle a given load — run `perf/k6-shop.js` against staging (Vercel + Supabase with your real plan sizes) before launch.

Measured 29 Oct 2026.

## HTTP (autocannon, 50 concurrent connections, 10–15 s each)

| Route | Rendering | req/s | p50 | p90 | p99 | Errors |
|---|---|---:|---:|---:|---:|---:|
| `/help` | static | 859 | 55 ms | 69 ms | 109 ms | 0 |
| `/category/audio` | static (ISR) | 696 | 68 ms | 85 ms | 127 ms | 0 |
| `/api/search?q=fan` | dynamic, cached query | 602 | 79 ms | 96 ms | 129 ms | 0 |
| `/shop/pulse-anc-earbuds-pro` | static (ISR) | 589 | 80 ms | 101 ms | 166 ms | 0 |
| `/` (homepage) | static (ISR) | 398 | 118 ms | 152 ms | 238 ms | 0 |
| `/shop?category=audio&sort=price_asc` | partial prerender + dynamic grid | 40 | 44 ms | 3,519 ms | 4,006 ms | 0 |
| `/shop` | partial prerender + dynamic grid | 34 | 50 ms | 4,341 ms | 5,309 ms | 0 |

**Finding — filtered shop listings are CPU-bound.** At one connection `/shop` takes ~18 ms and serves ~52 req/s; at 5 connections p90 is 178 ms; at 20, 1.3 s. The database is not the bottleneck: a 10-second run of 610 requests caused **2** database transactions, because catalogue queries are served from the `use cache` layer. The cost is server-rendering the 12-card grid for each request (the URL's search parameters make it per-request). One Node process therefore saturates around 50–55 req/s for these pages and additional concurrency only queues.

What this means and what to do:
- On Vercel each instance handles its own share and instances scale out, so total capacity grows with traffic — but each instance's ~50 req/s ceiling for `/shop?…` is real. Budget function concurrency/instances accordingly and confirm with the staging k6 run.
- Most entry traffic (home, product pages, category landing pages `/category/[slug]`, help) is prerendered and an order of magnitude cheaper. Link ads and social posts to product and category pages rather than to filtered `/shop` URLs.
- If filtered listing traffic is high, the next optimisation is rendering the grid as a cached server component keyed by the parsed query (so repeated filter combinations skip the render), or moving filtering to the client over the cached `/api/search`-style endpoint.

## Checkout transaction (pgbench, real `place_order()` as the `anon` role)

16 concurrent clients, 20 s each, on a fresh copy of the seeded database:

| Scenario | Orders/s | Avg latency | Failed |
|---|---:|---:|---:|
| Everyone buys the **same** variant (worst-case row lock) | 193 | 83 ms | 0 |
| Orders spread over 4 variants | 259 | 62 ms | 0 |

After both runs: 9,074 orders, 9,074 matching `inventory_movements`, and the hot variant's stock had dropped by exactly the number of orders for it. Concurrent overselling is additionally covered by an integration test (12 buyers racing for 3 units → exactly 3 orders, stock 0).

Database constraints to keep in mind:
- The Supabase connection limit depends on the plan. Use the **transaction pooler** (port 6543) for `DATABASE_URL` on Vercel and keep `DB_POOL_MAX` small (default 5 per instance).
- Flash sales on a single product serialise on that variant's row lock; ~190 orders/s on this box is far above typical demand, but measure on your Supabase compute size.
- `rate_limits` is an `UNLOGGED` table cleaned daily by the cron route.

## Not measured here

- **AI chat throughput**: dominated by Gemini latency (bounded by a 12 s timeout) and the per-IP / per-conversation limits in settings. Measure with a real key on staging; watch `ai_usage` for latency and failures.
- **Courier APIs**: depend on the providers.
- **Real-device rendering**: layouts were tested in Chromium at 10 widths from 320 to 1920 px (`tests/e2e/responsive.spec.ts`), with reduced motion, and with a touch-target check — not on physical Android hardware. Test on a low-end Android phone over 3G/4G before launch.

## How to reproduce

```bash
npm run build && npm run start -- -p 3100
npx autocannon -c 50 -d 15 "http://localhost:3100/shop?category=audio"

./scripts/db-reset-dev.sh shopnear_perf
psql … -c "update product_variants set stock = 1000000"
pgbench -n -f perf/pgbench-checkout.sql -D vid=<variant uuid> -c 16 -j 2 -T 20 shopnear_perf

k6 run -e BASE=https://staging.example.com perf/k6-shop.js
```
