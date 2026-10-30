import { expect, test } from "@playwright/test";
import { collectErrors, noHorizontalOverflow, visit } from "./helpers";

test("product page single checkout: Buy now → order form on the same page → thank-you → tracking", async ({ page }) => {
  const errors = collectErrors(page);
  await visit(page, "/shop/airloop-neck-fan?utm_source=facebook&utm_campaign=e2e&fbclid=E2ECLICK");
  await page.getByRole("button", { name: /Buy now/ }).first().click();
  // Stays on the product page.
  await expect(page).toHaveURL(/\/shop\/airloop-neck-fan/);
  const form = page.locator("#order-now");
  await expect(form.getByRole("heading", { name: "Order this now" })).toBeInViewport();
  await expect(page.locator("#qo-name")).toBeFocused();

  await form.getByLabel("Your name").fill("Quick Buyer");
  await form.getByLabel(/Mobile number/).fill("01912-345678");
  await form.getByLabel("District").selectOption("Chattogram");
  await form.getByLabel(/Full address/).fill("House 9, CDA Avenue, Chattogram");
  await form.getByRole("button", { name: "Increase quantity" }).click();
  await expect(form.getByText(/Delivery · Outside Dhaka/)).toBeVisible();
  const confirm = form.getByRole("button", { name: /Confirm order · ৳/ });
  await expect(confirm).toBeVisible();
  await noHorizontalOverflow(page);
  await confirm.click();

  await page.waitForURL(/\/order\/SN\d{11}\/thank-you\?t=/);
  await expect(page.getByRole("heading", { name: "Thank you, Quick!" })).toBeVisible();
  await expect(page.getByText(/2 × ৳/)).toBeVisible();
  // Saved for "Track my order" on this device.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sn_orders") ?? "[]")[0]?.number);
  expect(page.url()).toContain(saved);
  await page.getByRole("link", { name: "Track your order", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Order received/ })).toBeVisible();
  // The cart was not touched by the single-product order.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("sn_cart_v1") ?? '{"items":[]}').items?.length ?? 0)).toBe(0);
  expect(errors).toEqual([]);
});

test("product page order form validates before placing", async ({ page }) => {
  await visit(page, "/shop/steel-water-bottle-750");
  await page.getByRole("button", { name: /Buy now/ }).first().click();
  const form = page.locator("#order-now");
  await form.getByLabel(/Mobile number/).fill("12345");
  await form.getByRole("button", { name: /Confirm order/ }).click();
  await expect(form.getByText("Please enter your name")).toBeVisible();
  await expect(page).toHaveURL(/\/shop\/steel-water-bottle-750/);
});

test("voice search: spoken words become a product search", async ({ page }) => {
  // Stand-in for the browser's speech recognition (no microphone in CI).
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = ""; interimResults = false; continuous = false; maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      start() {
        (window as unknown as { __voiceLang: string }).__voiceLang = this.lang;
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "I need a power bank" }], { isFinal: true })] });
          this.onend?.();
        }, 300);
      }
      stop() {} abort() {}
    }
    for (const k of ["SpeechRecognition", "webkitSpeechRecognition"]) Object.defineProperty(window, k, { value: FakeRecognition, configurable: true, writable: true });
  });
  await visit(page, "/shop");
  await page.getByRole("button", { name: "Search by voice" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect(dialog.getByText("You said")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Power Bank/i }).first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __voiceLang: string }).__voiceLang)).toBe("bn-BD");
  await dialog.getByRole("button", { name: /See all results for “power bank”/ }).click();
  await expect(page).toHaveURL(/\/shop\?q=power(\+|%20)bank/);
});

test("photo search: an uploaded picture finds matching products", async ({ page, request }) => {
  const probe = await request.post("/api/search/image", { multipart: { image: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") } } });
  test.skip(probe.status() === 503, "Gemini is not configured on this server");
  await visit(page, "/");
  await page.getByRole("button", { name: "Search products" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Search" });
  await dialog.locator("[data-image-input]").setInputFiles("public/seed/airloop-neck-fan-1.webp");
  await expect(dialog.getByText("Looks like")).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByRole("link", { name: /Neck Fan/ })).toBeVisible();
});

test("catalogue feed lists every variant with SKU ids for Meta/TikTok", async ({ request }) => {
  const res = await request.get("/feeds/products.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("xml");
  const xml = await res.text();
  expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
  expect(xml).toMatch(/<g:id>PWR-GAN-65-STD<\/g:id>/);
  expect(xml).toMatch(/<g:price>\d+\.00 BDT<\/g:price>/);
  expect(xml).toMatch(/<g:availability>(in stock|out of stock)<\/g:availability>/);
});
