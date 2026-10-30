# Going live — checklist for whoever deploys this

This app is a Next.js 16 server (Node 20.9 or newer) that needs **Supabase** for the database, Auth and Storage. A plain Postgres database is not enough: the code uses `auth.users`, Supabase Auth sessions and Storage buckets.

Where it runs is your choice: **Vercel** (the README's default), or your own **VPS** (`next start` behind Caddy/nginx). Both are covered below. Details behind each step are in [README.md](../README.md) and [database.md](database.md).

## 1. Database (Supabase)

1. Create a Supabase project.
2. Apply **every** migration in `supabase/migrations/`, in filename order (there are 11 as of this writing):
   ```bash
   supabase link --project-ref <ref> && supabase db push
   # or, without the CLI:
   DATABASE_URL='postgresql://…' npm run db:migrate
   ```
   - The last two (`20261029001000_admin_speed_and_risk.sql`, `20261029001100_rls_initplan.sql`) are additive and safe on a live database. Without them the admin Orders, Customers and Analytics pages fail.
   - The migrations also create the Storage buckets `product-images` (public) and `payment-proofs` (private). Check they exist under Storage.
3. **Do not run `npm run db:seed`** on production. It inserts demo products and development defaults.
4. Supabase → Authentication:
   - turn **off** public sign-ups (only admins sign in with a password);
   - Site URL = `https://shopnear.shop`; add `https://shopnear.shop/admin/settings` to the redirect URLs;
   - configure SMTP so the "forgot password" email can be sent.
5. Never run `supabase/dev/` or `scripts/devstack/` against a real project. They are local test stand-ins.

## 2. Environment variables

Set these for the **Production** environment of the host (copy `.env.example` for the full list).

| Variable | Needed | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes | `https://shopnear.shop`, no trailing slash |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server only — never expose it |
| `DATABASE_URL` | yes | Supabase → Database → connection string. On Vercel/serverless use the **transaction pooler (port 6543)** |
| `APP_SECRET` | yes | 32+ random characters (`openssl rand -hex 32`). The app throws without it in production |
| `CRON_SECRET` | yes | protects `/api/cron/cleanup` |
| `SMS_PROVIDER` + gateway keys | for customer login | `bulksmsbd` (`BULKSMSBD_API_KEY`, `BULKSMSBD_SENDER_ID`) or `sslwireless` (`SSL_SMS_API_TOKEN`, `SSL_SMS_SID`). Without it, customers cannot log in (ordering still works) |
| `GEMINI_API_KEY` | optional | AI chat replies |
| `META_PIXEL_ID`, `TIKTOK_PIXEL_ID` | optional | read at **build** time |
| `STEADFAST_*`, `PATHAO_*`, `REDX_*` | per courier | see README → Couriers |

**`NEXT_PUBLIC_*` values and pixel IDs are baked in at build time — set them before `npm run build`, and rebuild if you change them.**
Leave `ALLOW_DEV_SMS` and `ALLOW_SANDBOX_COURIER` unset in production.

## 3. Build and run

```bash
npm ci
npm run build
npm start            # listens on port 3000 (PORT=… to change)
```

**Vercel:** import the repo, add the variables above, deploy. `vercel.json` already schedules the daily cleanup cron and Vercel sends `CRON_SECRET` itself.

**Own server (VPS):**

- Keep it running with `pm2` or a systemd unit (`npm start`), and restart it after every deploy.
- Put HTTPS in front, for example Caddy:
  ```
  shopnear.shop, www.shopnear.shop {
      reverse_proxy localhost:3000
  }
  ```
- Vercel cron does not exist here. Schedule the cleanup yourself once a day:
  ```
  30 21 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://shopnear.shop/api/cron/cleanup
  ```

## 4. Domain

`shopnear.shop` and `www` must point to the machine that runs **this** app (Vercel's records, or the VPS IP). If DNS points at another server, visitors see whatever that server runs. Check with `nslookup shopnear.shop` and open `/shop`: it should show the ShopNear catalogue, not a 404.

## 5. First admin

Once, with the production variables (including `SUPABASE_SERVICE_ROLE_KEY`) in the environment:

```bash
ADMIN_EMAIL=you@shop.com ADMIN_PASS='a-long-unique-password' npm run admin:bootstrap
```

Then unset `ADMIN_PASS`, sign in at `/admin/login`, and change the password under Admin → Settings → Account.

## 6. Fill in the business details (Admin → Settings)

The admin shows a banner until each section has been saved.

- Store name, phone, email, address, hours, **WhatsApp number** (the "Order on WhatsApp" button on product pages and the "Confirm on WhatsApp" button on orders stay hidden until a valid Bangladeshi number is saved).
- Delivery zones and fees, bKash/Nagad merchant numbers, return/refund/warranty policies.
- Categories and products with real photos.
- Couriers: add credentials, register the webhook URLs shown in Admin → Couriers, book one real test parcel per courier. The courier adapters have not been exercised against live APIs yet.
- Ads tracking (pixel IDs and server tokens) if you run ads.

## 7. Smoke test after every deploy

1. Home, a category, a product page and `/shop` load (not 404).
2. Add a product to the bag, check out with Cash on Delivery, reach the thank-you page.
3. `/admin/login` works; Dashboard, Orders (open one — the Customer check card should show), Customers, Inventory and Analytics load without an error screen.
4. The new order appears in Admin → Orders; confirm it, and try "Confirm on WhatsApp".
5. Optional, from a checkout of the repo: `npm run typecheck && npm run lint && npm test`.

## Performance notes

Measured numbers and what was optimised are in [performance.md](performance.md). In short: storefront pages are prerendered and cached; admin analytics refreshes once a minute; filtered `/shop?…` URLs are rendered per request, so link ads to product and category pages.
