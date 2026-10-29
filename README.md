# ShopNear BD

A complete e-commerce platform for a Bangladesh-based shop: an art-directed storefront, a secure admin back office, a Gemini-powered support assistant that answers from live store data, and a courier layer for Steadfast, Pathao and RedX.

**Stack:** Next.js 16 (App Router, Cache Components, Partial Prefetching) · TypeScript (strict) · Tailwind CSS 4 · Motion for React · Supabase (Postgres, Auth, Storage) · Google Gemini (`@google/genai`) · Zod · React Hook Form · Vitest · Playwright.

---

## What's in it

**Storefront**
- "Speed Lane" design system built from the logo: speed streaks, the swoosh, and shopping-tag product cards (punched eyelet, tangerine price flag). Bricolage Grotesque display type, Figtree body, Hind Siliguri for Bangla.
- Homepage: a "radar" hero (featured product at the centre of 2 km / Dhaka / 64-district rings), ticker, category lanes, spotlight product with quick-add, new/popular tabs, an editorial collection story, and delivery/payment/returns information pulled from settings. All copy and the hero product are editable in Admin → Settings → Homepage.
- `/shop`: server-side search (Postgres full-text + trigram), category/price/stock filters, sorting, pagination, all in the URL. Crawlable category pages at `/category/[slug]`.
- `/shop/[slug]`: gallery (scroll-through on desktop, swipe on phones) with full-screen zoom, option selectors with live price/stock, quantity, Add to bag / Buy now, a delivery estimator by district, specs, policies, verified-buyer reviews, related and recently viewed products, sticky purchase bar on phones, Product + Breadcrumb JSON-LD. `/shop/<uuid>` redirects to the slug.
- Cart drawer, 3-step checkout (delivery → payment → review) with server-side pricing, coupon codes, Dhaka/suburbs/outside-Dhaka zones and 64 districts, Cash on Delivery, and manual bKash/Nagad (pay now with TrxID/screenshot, or pay later from the order page).
- Private order pages (`/order/SN…?t=<secret>`) with a status timeline, payment status, courier tracking and review forms after delivery.
- Guest wishlist (♡ on cards and product pages, `/wishlist`), kept on the device; prices shown are live.
- Floating support chat (Bangla, Banglish, English) with human hand-off.
- Mobile-first, keyboard accessible, `prefers-reduced-motion` respected, no horizontal overflow from 320 px to 1920 px.

**Admin (`/admin`)**
- Supabase Auth sign-in with a server-verified `admin` role; rate-limited and audited.
- Dashboard: orders today, awaiting confirmation, payments to verify, awaiting shipment, with courier, booked value (not revenue), delivered sales, cash collected minus refunds, cancellations, daily chart, status distribution, top sellers, low stock, recent orders and messages.
- Orders: search by number/phone/name, filters (status, payment, method, dates), CSV export, full detail, confirm/reject/pack/ship/deliver/return with enforced transitions, payment verification, COD collection, refunds, internal notes, editable delivery details before dispatch, status history, printable invoice and packing slip.
- Products: create/edit/publish/unpublish/archive, multiple image upload (auto-resized to WebP) with alt text, ordering and variant linking, variants with price/stock overrides, specs, tags, collections, featured flag, low-stock threshold, cost price, SEO and social image, preview of drafts.
- Categories, inventory (adjust with reason, full movement log), coupons, customers (grouped by phone with delivery success), couriers (setup status, shipments, COD reconciliation, webhook events), chat inbox (reply, take over/hand back, resolve), FAQ editor, AI usage and failures, analytics, settings (store, delivery zones and fees, payment methods, policies, homepage, AI), password change and the audit log.

---

## Quick start (local)

Requirements: Node 20.9+ (22 recommended), and either the Supabase CLI with Docker, or a local PostgreSQL 15+.

```bash
npm install
cp .env.example .env.local      # fill in as described below
```

### Option A — Supabase CLI (recommended)

```bash
supabase start                  # prints API URL, anon key, service_role key, DB URL
supabase db reset               # applies supabase/migrations
npm run db:seed                 # sample catalogue, FAQs, WELCOME10 coupon
npm run admin:bootstrap         # creates ADMIN_EMAIL and grants the admin role
npm run dev
```

Put the printed values in `.env.local`:
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

### Option B — no Docker

For machines without Docker (this is how the project was developed and tested), a small dev-only stand-in implements the subset of Supabase Auth and Storage the app uses:

```bash
./scripts/dev-services.sh       # Postgres on :54322 + auth/storage stand-in on :54321
./scripts/db-reset-dev.sh       # creates DB "shopnear", applies dev shim + migrations + seed
npm run devstack                # prints the dev anon/service keys (also in .devstack.log)
npm run admin:bootstrap
npm run dev
```

`scripts/devstack/` and `supabase/dev/` are **development only** — never deploy them or run the shim on a real project.

Then open http://localhost:3000 and http://localhost:3000/admin.

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URLs, sitemap, webhook URLs shown in admin |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase Auth from the server/proxy (the anon key is safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Storage uploads and the admin bootstrap. Never prefix with `NEXT_PUBLIC_`. |
| `DATABASE_URL` | **server only** | Postgres connection for server code. On Vercel use the Supabase **transaction pooler** (port 6543). |
| `APP_SECRET` | **server only** | 32+ random characters; hashes IPs for rate limiting. Required in production. |
| `GEMINI_API_KEY` | **server only** | Enables AI replies. Without it the chat still answers from FAQs/products/settings and offers a human. |
| `ADMIN_EMAIL`, `ADMIN_PASS` | bootstrap only | Used once by `npm run admin:bootstrap`. Remove `ADMIN_PASS` afterwards. |
| `CRON_SECRET` | server | Protects `/api/cron/cleanup` (chat retention, rate-limit cleanup). Vercel Cron sends it automatically. |
| `ALLOW_SANDBOX_COURIER` | server | `1` lets the sandbox courier be used in a production build (staging). Off by default. |
| `STEADFAST_*`, `PATHAO_*`, `REDX_*` | server | Courier credentials and webhook secrets — see below. |
| `DB_POOL_MAX` | server | Optional pool size per server instance (default 5). |

`.env.local` is git-ignored. Only `.env.example` (empty values) is committed.

---

## Database

See [docs/database.md](docs/database.md) for the schema diagram, the security model and the reasoning behind checkout, privacy and the order state machine.

Apply migrations to a hosted project with the Supabase CLI (`supabase link` then `supabase db push`) or with `DATABASE_URL=… npm run db:migrate` (records applied files in `app_meta.migrations`). Seed only development/staging databases.

### Initial admin

```bash
ADMIN_EMAIL=you@shop.com ADMIN_PASS='a-long-unique-password' npm run admin:bootstrap
```

The script creates the user through the Supabase Auth admin API (Supabase stores only a hash), grants `admin` in `public.user_roles` and logs it in `audit_logs`. It is idempotent and never changes an existing user's password. After that, sign in at `/admin/login`; change the password in Admin → Settings → Account; "Forgot password" sends a Supabase reset email (configure SMTP and the redirect URL `https://your-domain/admin/settings` in Supabase Auth settings).

### Product images

Migrations create two buckets: `product-images` (public, 5 MB, images only) and `payment-proofs` (private, 3 MB). Uploads happen in server actions after an admin (or rate-limited customer) check, using the service role; no storage write policies are granted to API roles. Admin uploads are resized to max 1600 px WebP. Payment screenshots are shown to admins through 5-minute signed URLs.

---

## Payments

- **Cash on Delivery** — the order is unpaid until the courier reports collection (webhook/status sync) or an admin records it.
- **bKash / Nagad (manual Send Money)** — the customer sees only the merchant number and instructions from settings, then submits the sender number and Transaction ID (and optionally a screenshot), or pays later from the order page. The order shows "payment submitted — awaiting verification" until an admin matches it against the merchant statement and clicks **Verify**. A Transaction ID can be used once. The app never asks for a PIN, OTP or password.
- **Automatic gateways** (bKash Tokenized Checkout, Nagad, SSLCommerz) are not included because they require a merchant account. They should be added as a server-side callback that verifies the payment with the gateway's API before calling `admin_verify_payment`-equivalent logic.

---

## Couriers

Book from an order page (confirmed or packed orders). Booking shows the recipient and cash amount for confirmation, uses the order number as the courier invoice, and the database allows only one active shipment per order.

| Provider | Env vars | Webhook URL to register |
|---|---|---|
| Steadfast | `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY`, `STEADFAST_WEBHOOK_TOKEN` (optional `STEADFAST_BASE_URL`) | `/api/couriers/steadfast/webhook` with header `Authorization: Bearer <STEADFAST_WEBHOOK_TOKEN>` |
| Pathao | `PATHAO_BASE_URL` (sandbox or live), `PATHAO_CLIENT_ID`, `PATHAO_CLIENT_SECRET`, `PATHAO_USERNAME`, `PATHAO_PASSWORD`, `PATHAO_STORE_ID`, `PATHAO_WEBHOOK_SECRET` | `/api/couriers/pathao/webhook`, signature header `X-PATHAO-Signature` |
| RedX | `REDX_BASE_URL`, `REDX_API_TOKEN`, `REDX_WEBHOOK_TOKEN` | `/api/couriers/redx/webhook?token=<REDX_WEBHOOK_TOKEN>` |
| Sandbox | none (on in development) | — |

**Status of these integrations:** the adapters follow each courier's published merchant API (field names were cross-checked against public client libraries), but **they have not been run against the live courier APIs** — no credentials were available. Before going live: set the credentials, use each provider's sandbox if offered, book one test parcel, compare endpoint paths and the webhook payload/auth with your merchant panel's documentation, and adjust `src/lib/couriers/<provider>.ts` if they differ. The **Sandbox** adapter exercises the whole flow (booking, retries, status updates, COD reconciliation) without contacting anyone and is clearly labelled "TEST — not a real parcel" everywhere.

Timeouts and 5xx errors are treated as retryable; failed attempts free the slot so the admin can retry, and Steadfast's invoice lookup lets a retry adopt a parcel that was created despite a timeout. "Check status with courier" pulls the latest status on demand.

---

## Support assistant (Gemini)

`POST /api/chat` → classify the question (Bangla/Banglish/English keyword rules) → fetch only the relevant, bounded data through the anonymous DB role (≤ 4 products, ≤ 3 FAQs, delivery/payment/return settings, and orders **only** when the browser presents the order's private token) → send it to Gemini as delimited `<store_data>` with a system instruction that forbids inventing prices, stock, dates, policies or order status and forbids claiming actions → store the reply.

- Model and generation settings, rate limits (per IP per minute, per conversation per hour — stored in Postgres so they hold across instances) and retention are in Admin → Settings → AI.
- If Gemini isn't configured, times out (12 s) or fails, the customer gets a deterministic answer built from the same retrieved data, and the failure is logged in `ai_usage` (visible in Admin → Chat → AI usage).
- "Talk to a person" switches the conversation to human mode; admins reply from `/admin/chat` and the widget polls for replies.
- The assistant cannot confirm orders, verify payments, refund, cancel or book couriers.

---

## Security notes

- Every admin page, server action and route handler re-checks the admin role on the server (`requireAdminPage` / `requireAdmin` / `getAdmin`); the proxy only refreshes sessions.
- RLS is enabled on every table; app queries run as `anon`/`authenticated` with JWT claims so policies apply. Privileged functions verify `is_admin()` themselves.
- Totals, discounts and delivery fees are always computed in the database.
- Rate limits: checkout (per IP and per phone), admin login, password reset, payment proof upload, reviews, chat.
- CSV export neutralises spreadsheet formulas. Admin and order pages send `X-Robots-Tag: noindex`; security headers are set globally.

---

## Testing

```bash
npm run typecheck
npm run lint
npm test                    # Vitest: unit + integration (resets DB "shopnear_test" each run)
npm run build && npm run start -- -p 3100
PW_CHROMIUM_PATH=/path/to/chrome npm run test:e2e   # Playwright: storefront, admin, responsive
```

Integration tests need the local Postgres (`./scripts/dev-services.sh`) or `TEST_DATABASE_URL` pointing at a disposable database with the Supabase roles. They cover RLS, server-side pricing, coupons, delivery zones, duplicate submissions, a 12-buyers-for-3-units race, order privacy, admin authorization, status transitions, refunds, courier booking/retry/webhook idempotency, and the chat (fallback, private order lookup, Gemini grounding through the real SDK against a local mock, rate limiting).

The responsive suite visits storefront and admin pages at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 px, asserts no horizontal overflow, and saves screenshots to `test-results/screens/`.

### Performance

`perf/k6-shop.js` is a load plan (browse ramp to 600 VUs, search, chat) with latency thresholds. Run it against **staging** with production-like Supabase and Vercel settings; the numbers measured locally during development are recorded in [docs/performance.md](docs/performance.md) and are not a substitute for that run.

---

## Deployment (Vercel + Supabase)

1. Create a Supabase project. Run the migrations (`supabase db push`). Configure Auth (disable public sign-ups if only admins sign in; set SMTP; set the site URL and redirect URLs).
2. Create a Vercel project from this repo. Set every server variable above for Production (and Preview with a separate Supabase project). Use the transaction pooler URL for `DATABASE_URL`.
3. Deploy, then run `npm run admin:bootstrap` locally against the production env once, and remove `ADMIN_PASS`.
4. In Admin → Settings, replace every development default (store contact, bKash/Nagad numbers, delivery fees, policies). The admin shows a banner until each section has been saved.
5. Add courier credentials and register the webhook URLs shown in Admin → Couriers. Book a real test parcel.
6. `vercel.json` schedules `/api/cron/cleanup` daily; set `CRON_SECRET`.
7. Run the k6 plan against staging and adjust `DB_POOL_MAX`, Supabase compute and caching as needed.

Public catalogue pages are prerendered and revalidated (`use cache` with `cacheLife`, invalidated by `updateTag` when admins save products, categories or settings). Cart, checkout, order and admin data are never cached.

---

## Known limitations

- **Customer accounts are not built.** Checkout is guest-only (the norm for COD shops in Bangladesh); carts and wishlists live in the browser, and orders are opened with their private link. The database already has `carts`, `cart_items`, `wishlists` and owner-only RLS policies, so sign-in, a server-side cart and cart merging can be added without schema changes.
- Courier adapters are untested against live APIs (see Couriers). Payment gateways are not integrated (manual verification only).
- Filtered `/shop` URLs are render-bound at ~50 req/s per server instance on the test machine — see [docs/performance.md](docs/performance.md).

## Still needed from the business before launch

- Supabase project, Vercel project and a domain.
- `GEMINI_API_KEY`.
- Courier merchant accounts and API credentials (Steadfast, Pathao and/or RedX), then a live test booking per provider.
- The real bKash/Nagad merchant numbers (and, optionally, a payment-gateway merchant account for automatic verification).
- Real store contact details, delivery fees, return/refund/warranty policies.
- Real product photography (the seed images are generated illustrations for development).
- An SMTP provider for Supabase Auth emails (password reset).
