# ShopNear BD

A complete e-commerce platform for a Bangladesh-based shop: an art-directed storefront, a secure admin back office, a Gemini-powered support assistant that answers from live store data, and a courier layer for Steadfast, Pathao and RedX.

**Stack:** Next.js 16 (App Router, Cache Components, Partial Prefetching) · TypeScript (strict) · Tailwind CSS 4 · Motion for React · Supabase (Postgres, Auth, Storage) · Google Gemini (`@google/genai`) · Zod · React Hook Form · Vitest · Playwright.

---

## What's in it

**Storefront**
- "Speed Lane" design system built from the logo: speed streaks, the swoosh, and shopping-tag product cards (punched eyelet, tangerine price flag). Bricolage Grotesque display type, Figtree body, Hind Siliguri for Bangla.
- Homepage: a "radar" hero (featured product at the centre of 2 km / Dhaka / 64-district rings), ticker, category lanes, spotlight product with quick-add, new/popular tabs, an editorial collection story, and delivery/payment/returns information pulled from settings. All copy and the hero product are editable in Admin → Settings → Homepage.
- `/shop`: server-side search (Postgres full-text + trigram), category/price/stock filters, sorting, pagination, all in the URL. Crawlable category pages at `/category/[slug]`.
- `/shop/[slug]`: gallery (scroll-through on desktop, swipe on phones) with full-screen zoom, option selectors with live price/stock, quantity, Add to bag, **Buy now → a single-page order form on the product page itself** (name, phone, district/zone, address, COD/bKash/Nagad, coupon, live server-priced total — no cart, no other page), a delivery estimator by district, specs, policies, verified-buyer reviews, related and recently viewed products, sticky purchase bar on phones, Product + Breadcrumb JSON-LD. `/shop/<uuid>` redirects to the slug.
- Cart drawer, 3-step checkout (delivery → payment → review) with server-side pricing, coupon codes, Dhaka/suburbs/outside-Dhaka zones and 64 districts, Cash on Delivery, and manual bKash/Nagad (pay now with TrxID/screenshot, or pay later from the order page).
- Thank-you page after every order (`/order/SN…/thank-you?t=<secret>`): order number, total, payment instructions, what happens next, items, and a **Track your order** button.
- **Voice search** (mic button in search; বাংলা or English) and **photo search** (camera button: snap or upload a picture) — see "Voice & photo search".
- **Facebook (Meta) and TikTok pixels + server-side events** — see "Ads tracking".
- Private order pages (`/order/SN…?t=<secret>`) with a status timeline, payment status, courier tracking and review forms after delivery.
- **Customer accounts** (`/account`): every phone number that orders gets an account automatically; customers log in with a 6-digit SMS code (no password) and see all orders on their number, status, totals and their details, open any of their orders without the private link, and get checkout pre-filled. See "Customer login (SMS)".
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
| `SMS_PROVIDER` + `BULKSMSBD_API_KEY`, `BULKSMSBD_SENDER_ID` **or** `SSL_SMS_API_TOKEN`, `SSL_SMS_SID` | **server only** | SMS gateway for customer login codes (BulkSMSBD or SSL Wireless). Without it, customer login is off. |
| `ALLOW_DEV_SMS` | server | `1` allows `SMS_PROVIDER=console` (writes codes to `dev_sms_outbox`, sends nothing) in a production build — staging/tests only. |
| `META_PIXEL_ID`, `TIKTOK_PIXEL_ID` | build + server | Optional. Override the pixel IDs saved in Admin → Settings → Ads tracking. Storefront pages are prerendered, so set them **before building**; the admin setting needs no rebuild. |
| `META_CAPI_ACCESS_TOKEN`, `TIKTOK_EVENTS_ACCESS_TOKEN` | **server only** | Optional. Override the tokens saved in the admin. |
| `META_TEST_EVENT_CODE`, `TIKTOK_TEST_EVENT_CODE` | server | Optional, for testing only. Remove before going live. |

`.env.local` is git-ignored. Only `.env.example` (empty values) is committed.

---

## Database

See [docs/database.md](docs/database.md) for the schema diagram, the security model and the reasoning behind checkout, privacy and the order state machine.

Apply **all** migrations to the target database before deploying, with the Supabase CLI (`supabase link` then `supabase db push`) or with `DATABASE_URL=… npm run db:migrate` (records applied files in `app_meta.migrations`). Storefront routes query the database during `next build`, so an unapplied migration can fail the Vercel build. Seed only development/staging databases.

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

## Ads tracking (Meta Pixel + Conversions API, TikTok Pixel + Events API)

Set it up in **Admin → Settings → Ads tracking**:

1. **Meta:** Events Manager → *Connect data sources → Web* → create a pixel and copy its **Pixel ID**. Then *Settings → Conversions API → Generate access token* and paste the token. Verify your domain in Business Settings → Brand safety → Domains and, under *Aggregated event measurement*, prioritise **Purchase**.
2. **TikTok:** Ads Manager → *Tools → Events → Web events → Set up web events → Manually set up* → copy the **Pixel ID** (letters + digits), then *Settings → Generate access token*.
3. Save, open the store in another browser, and use **Send test event** (with a test event code from each Events Manager's *Test events* tab). Remove the test codes when done.

What happens:

- Both pixels load on every storefront page (never in the admin) with **PageView**, then **ViewContent** (product page), **Search** (typed, voice and photo), **AddToCart**, **AddToWishlist**, **InitiateCheckout** (checkout or product-page form), **AddPaymentInfo** and **Purchase** (thank-you page).
- Every event except PageView is **also sent from the server** (`/api/track` relay; Purchase comes straight from the stored order) with the **same event ID**, so Meta and TikTok de-duplicate them and ad blockers / iOS don't lose sales. Purchase uses the order total from the database, never the browser's numbers, and is sent **once per order** (`orders.purchase_tracked_at`).
- Server events carry hashed (SHA-256) phone in country-code format, email, first/last name, district and country, plus IP, user agent and the `_fbp`/`_fbc`/`_ttp` cookies and `ttclid` for matching. If `fbclid` is in the landing URL and the pixel was blocked, `_fbc` is built from it. The raw IP and user agent are removed from the order as soon as Purchase is sent, and all matching data is purged after 8 days by the cleanup cron.
- **When is it a Purchase?** Default: when the order is placed (best for ad optimisation). For COD stores with many fake orders you can switch to "when our team confirms the order" — the server then sends Purchase on confirmation (the browser pixel doesn't fire it on the thank-you page, so nothing is double-counted).
- Content IDs are **variant SKUs**. The catalogue feed at **`/feeds/products.xml`** (RSS 2.0 / Google product format: one item per variant, `item_group_id` = product SKU, price in BDT, stock status) can be added to Meta Commerce Manager and TikTok Catalog for dynamic product ads.
- Each order stores its source (UTM tags, click IDs, landing page, referrer) — shown on the order page in the admin, and **Analytics → Orders by source** breaks down orders and value by Facebook / TikTok / Google / campaign. Tag your ad URLs with `utm_source`, `utm_medium` and `utm_campaign` (Meta: `utm_source=facebook&utm_campaign={{campaign.name}}`; TikTok: `utm_source=tiktok&utm_campaign=__CAMPAIGN_NAME__`).
- Admin → Settings → Ads tracking shows the last 40 server events with the platform's response, so failures (expired token, wrong pixel ID) are visible.

Verified locally against stand-in Meta/TikTok endpoints (request format, hashing, dedup IDs, once-only Purchase). It has **not** been verified against the live Meta/TikTok APIs from this environment — after setup, confirm events arrive in each Events Manager's *Test events* tab.

---

## Customer login (SMS)

- Placing an order creates an (unverified) account for that phone number; existing customers were backfilled from past orders. Logging in at `/account/login` sends a 6-digit code by SMS; entering it proves the customer owns the number and shows **every order placed with it** — status, items, date, payment method, totals (orders, in progress, delivered, total ordered excluding cancelled/returned) — plus name/email they can edit.
- Signed-in customers can open their own orders at `/order/SN…` without the private link (pay-later TrxID and reviews work too); orders on other numbers stay private. Checkout and the product-page form are pre-filled from the last order.
- Security: codes are 6 digits, stored only as a keyed hash, valid 5 minutes, 5 tries, single use. Limits: 1 code per number per minute, 5 per number and 10 per device per hour, 300 store-wide per hour (stops SMS-cost abuse). Sessions are random 256-bit tokens in an `httpOnly` cookie (stored hashed, 60 days, deleted on log-out). The SMS log in Admin → Settings → Customer login keeps only the masked number and gateway response — never the code.
- **Setup:** open an account with a Bangladeshi SMS gateway, get an approved sender ID, and set `SMS_PROVIDER=bulksmsbd` with `BULKSMSBD_API_KEY` + `BULKSMSBD_SENDER_ID`, or `SMS_PROVIDER=sslwireless` with `SSL_SMS_API_TOKEN` + `SSL_SMS_SID`. Some gateways require whitelisting your server's IP (on Vercel, use a gateway that doesn't, or a static-IP add-on). Then log in yourself once to confirm the SMS arrives.
- The request formats were checked against the gateways' published integrations and tested against local stand-ins; they have **not** been tested against the live gateways from here.

---

## Voice & photo search

- **Voice:** the mic button (search panel and the `/shop` search field) uses the browser's own speech recognition where it exists (Chrome, Edge, Safari), in বাংলা (`bn-BD`) or English. The words are searched directly; if a Bangla sentence finds nothing and Gemini is configured, Gemini maps it to catalogue words (`POST /api/search/voice`). Browsers without speech recognition (e.g. Firefox) record up to 8 seconds and Gemini transcribes it — this needs `GEMINI_API_KEY`. The microphone is only used after the shopper taps the mic (`Permissions-Policy: microphone=(self)`).
- **Photo:** the camera button opens the phone's camera or photo library. The picture is shrunk to ≤1024 px JPEG in the browser (no EXIF/location), sent once to Gemini vision with the store's category/product vocabulary, and the returned search words run through the normal catalogue search (`POST /api/search/image`). Needs `GEMINI_API_KEY`; without it the shopper is asked to type instead.
- Audio and photos are never stored or logged. Both endpoints are rate-limited per IP (voice 20/min, photo 8/min) and check file type and size (photo ≤ 6 MB by magic bytes; audio ≤ 2 MB).

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
PW_CHROMIUM_PATH=/path/to/chrome npm run test:e2e   # Playwright: storefront, product-page order, voice/photo search, feed, admin, responsive
```

Integration tests need the local Postgres (`./scripts/dev-services.sh`) or `TEST_DATABASE_URL` pointing at a disposable database with the Supabase roles. They cover tracking (hashing formats, event mapping, attribution, Meta/TikTok server requests against a local stand-in, once-only Purchase), RLS, server-side pricing, coupons, delivery zones, duplicate submissions, a 12-buyers-for-3-units race, order privacy, admin authorization, status transitions, refunds, courier booking/retry/webhook idempotency, and the chat (fallback, private order lookup, Gemini grounding through the real SDK against a local mock, rate limiting).

The responsive suite visits storefront and admin pages at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 px, asserts no horizontal overflow, and saves screenshots to `test-results/screens/`.

### Performance

`perf/k6-shop.js` is a load plan (browse ramp to 600 VUs, search, chat) with latency thresholds. Run it against **staging** with production-like Supabase and Vercel settings; the numbers measured locally during development are recorded in [docs/performance.md](docs/performance.md) and are not a substitute for that run.

---

## Deployment (Vercel + Supabase)

A step-by-step go-live checklist for whoever deploys (Vercel or your own server) is in [docs/DEPLOY.md](docs/DEPLOY.md).

1. Create a Supabase project. Apply every migration (`supabase db push`) before deploying. Configure Auth (disable public sign-ups if only admins sign in; set SMTP; set the site URL and redirect URLs).
2. Create a Vercel project from this repo. Set every server variable above for Production (and Preview with a separate Supabase project). Use the transaction pooler URL for `DATABASE_URL`.
3. Deploy, then run `npm run admin:bootstrap` locally against the production env once, and remove `ADMIN_PASS`.
4. In Admin → Settings, replace every development default (store contact, bKash/Nagad numbers, delivery fees, policies). The admin shows a banner until each section has been saved.
5. Add courier credentials and register the webhook URLs shown in Admin → Couriers. Book a real test parcel.
6. `vercel.json` schedules `/api/cron/cleanup` daily; set `CRON_SECRET`.
7. Run the k6 plan against staging and adjust `DB_POOL_MAX`, Supabase compute and caching as needed.

Public catalogue pages are prerendered and revalidated (`use cache` with `cacheLife`, invalidated by `updateTag` when admins save products, categories or settings). Cart, checkout, order and admin data are never cached.

---

## Known limitations

- Customer accounts cover orders and details; the cart and wishlist still live in the browser (not synced across devices). Login needs an SMS gateway.
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
- Done
- Done
- Done
- Done
- Done
- Done
