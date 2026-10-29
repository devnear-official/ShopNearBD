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

## Phone load speed (lab, 29 Oct 2026)

`perf/lab.cjs` loads pages like a mid-range phone on a weak connection (Lighthouse "Slow 4G": 1.6 Mbps, 150 ms RTT, 4× CPU slowdown), second visit to a warm server, first visit for the browser. Measured on a local production build, so server time is near zero; real-world times add your hosting's response time.

| Page | Before: LCP / bytes | After: LCP / bytes |
|---|---|---|
| Home | 4.3 s / ~835 KB | 1.3 s / ~420 KB |
| Shop | 1.3 s / ~735 KB | 1.3 s / ~420 KB |
| Product | 1.4 s / ~810 KB | 1.4 s / ~530 KB (order form loads after the page) |
| Checkout | 3.0 s, CLS 0.155 | 2.9 s, CLS 0.027 |

What changed:
- **Fonts 306 KB → 61 KB:** Latin-only variable fonts via `next/font/local` (preloaded, size-matched fallback); Bangla uses the phone's built-in Bengali font instead of downloading Hind Siliguri (3 weights × ~70 KB, pulled in on every page by the ৳ sign).
- **Home hero visible without JavaScript:** entrance animations moved from JS (text started invisible until hydration) to CSS; headline only slides, never fades in.
- **Prefetch on intent:** product links prefetch on hover/touch/focus instead of every link in view.
- **Loaded later:** chat widget (browser idle), search with voice/photo (first open or idle), product-page order form (near view, Buy now, or idle).
- **Favicon 110 KB → 5 KB.** Optimised images cached 30 days.
- **Bug fix:** checkout re-requested a server quote about 4 times a second while open (each quote updated the cart, which triggered the next). Now one quote per real change.

Still to check on the live site: hosting region. If the server functions run far from the database (e.g. US servers with a Singapore/Mumbai database), every uncached page waits several round trips. Put both in the same region (on Vercel: Project → Settings → Functions → Region, matching your Supabase region).

## Admin panel at 60,000 orders (29 Oct 2026)

Synthetic data: 60k orders / ~100k order lines, requests made as the admin (Row Level Security applies), median of 5, local database.

| Page | Before | After |
|---|---:|---:|
| Orders list | 2,256 ms | 117 ms |
| Orders search (phone) | 2,503 ms | 246 ms |
| Customers | 1,869 ms | 118 ms |
| Analytics (30 days = 43k orders) | 9,090 ms | ~1,500 ms |
| Dashboard | 375 ms | ~340 ms |

What it was: the RLS policies called `is_admin()` once **per row** (`select count(*) from orders` took 1.07 s as admin, 7 ms as superuser). Wrapping it as `(select is_admin())` makes Postgres evaluate it once per query (migration `20261029001100_rls_initplan.sql`). On top of that: the Customers page and the repeat-customer metric aggregated every order per request (now the trigger-maintained `customer_stats` table), order search gained trigram indexes on order number and phone, and the analytics query reads order lines once.

Per request, the admin used to ask Supabase Auth three times (proxy, layout, page) plus a transaction for the role check; pages now verify the JWT locally (`getClaims`), the proxy still confirms the session with Supabase Auth, the result is shared across layout/nav/page for the request, and server actions still call Supabase Auth directly. The role-switch inside each query transaction is one statement instead of two.

## Customer check (order page)

`customer_risk(phone)` returns the store's own history for the phone: orders, delivered / cancelled / returned, orders in the last 24 h, distinct names and addresses, and per-courier parcels (delivered, returned, in transit). `lib/risk.ts` turns that into Low / Medium / High with reasons. Couriers do not expose other merchants' delivery history through their public APIs, so this is the store's own data across all of its couriers; the order page also offers one-tap WhatsApp confirmation (a `wa.me` link with the order details pre-filled) and Call.
