import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { noHorizontalOverflow, visit } from "./helpers";

// The e2e server runs with SMS_PROVIDER=console, which writes SMS to dev_sms_outbox instead of sending.
const db = postgres(process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54322/shopnear", { max: 1 });
test.afterAll(() => db.end());

async function codeFor(phone: string) {
  for (let i = 0; i < 20; i++) {
    const [row] = await db<{ body: string }[]>`select body from public.dev_sms_outbox where phone = ${phone} order by id desc limit 1`;
    const m = row?.body.match(/\b(\d{6})\b/);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no SMS in dev outbox — is the server running with SMS_PROVIDER=console ALLOW_DEV_SMS=1?");
}

test("order → account is created → log in with SMS code → see all orders, totals and open an order without its link", async ({ page, browser, isMobile }) => {
  const phone = isMobile ? "01633100201" : "01633100202";
  await db`delete from public.customer_otps where phone = ${phone}`;
  await db`delete from public.dev_sms_outbox where phone = ${phone}`;
  await db`delete from public.rate_limits where bucket like 'otp:%' or bucket like 'checkout:%'`;

  // Place an order from the product page.
  await visit(page, "/shop/steel-water-bottle-750");
  await page.getByRole("button", { name: /Buy now/ }).first().click();
  const form = page.locator("#order-now");
  await form.getByLabel("Your name").fill("Account Tester");
  await form.getByLabel(/Mobile number/).fill(phone);
  await form.getByLabel("District").selectOption("Khulna");
  await form.getByLabel(/Full address/).fill("House 4, KDA Avenue, Khulna");
  await form.getByRole("button", { name: /Confirm order · ৳/ }).click();
  await page.waitForURL(/thank-you/);
  const number = new URL(page.url()).pathname.split("/")[2];
  await expect(page.getByText("Your account is ready")).toBeVisible();

  // A fresh device: no saved links, logs in with the phone.
  const ctx = await browser.newContext({ viewport: page.viewportSize()! });
  const p = await ctx.newPage();
  await visit(p, `/order/${number}`);
  await expect(p.getByRole("heading", { name: "Private order link needed" })).toBeVisible();
  await p.getByRole("link", { name: "Log in with your phone" }).click();
  await p.getByLabel("Mobile number").fill(phone);
  await p.getByRole("button", { name: "Send login code" }).click();
  await expect(p.getByText(/We sent a code to/)).toBeVisible();
  await p.getByLabel("6-digit code").fill("000000".replace(/0/g, "9"));
  await expect(p.getByText(/isn't right|expired/)).toBeVisible();
  await p.getByLabel("6-digit code").fill(await codeFor(phone));
  // Lands back on the order it asked for, without the private link.
  await p.waitForURL(new RegExp(`/order/${number}$`));
  await expect(p.getByRole("heading", { name: /Order received/ })).toBeVisible();

  await visit(p, "/account");
  await expect(p.getByRole("heading", { name: "Hi, Account" })).toBeVisible();
  await expect(p.getByText(number)).toBeVisible();
  await expect(p.getByText("Total ordered")).toBeVisible();
  await noHorizontalOverflow(p);

  // Checkout is pre-filled from the account.
  await visit(p, "/shop/airloop-neck-fan");
  await expect(p.locator("#order-now").getByLabel("Your name")).toHaveValue("Account Tester");
  await expect(p.locator("#order-now").getByLabel(/Full address/)).toHaveValue("House 4, KDA Avenue, Khulna");

  // Session cookie is httpOnly.
  const cookie = (await ctx.cookies()).find((c) => c.name === "sn_session");
  expect(cookie?.httpOnly).toBe(true);

  await visit(p, "/account");
  await p.getByRole("button", { name: "Log out" }).click();
  await p.waitForURL(/\/account\/login/);
  await visit(p, `/order/${number}`);
  await expect(p.getByRole("heading", { name: "Private order link needed" })).toBeVisible();
  await ctx.close();
});

test("someone else's phone cannot open an order", async ({ browser }) => {
  await db`delete from public.rate_limits where bucket like 'otp:%'`;
  await db`delete from public.customer_otps where phone = '01633100999'`;
  await db`delete from public.dev_sms_outbox where phone = '01633100999'`;
  const [o] = await db<{ order_number: string; phone: string }[]>`select order_number, phone from public.orders where phone <> '01633100999' order by created_at desc limit 1`;
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await visit(p, "/account/login");
  await p.getByLabel("Mobile number").fill("01633100999");
  await p.getByRole("button", { name: "Send login code" }).click();
  await p.getByLabel("6-digit code").fill(await codeFor("01633100999"));
  await p.waitForURL(/\/account$/);
  await expect(p.getByText("No orders on this number yet.")).toBeVisible();
  await visit(p, `/order/${o.order_number}`);
  await expect(p.getByRole("heading", { name: "Private order link needed" })).toBeVisible();
  await ctx.close();
});
