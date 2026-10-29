import path from "node:path";
import { expect, test } from "@playwright/test";
import { ADMIN, ADMIN_STATE } from "./helpers";

test("admin pages and APIs refuse anonymous access", async ({ page, request }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);
  const csv = await request.get("/admin/export/orders", { maxRedirects: 0 });
  expect([307, 403]).toContain(csv.status());
  if (csv.status() === 307) expect(csv.headers()["location"]).toContain("/admin/login");
  const robots = await request.get("/admin/login");
  expect(robots.headers()["x-robots-tag"]).toContain("noindex");
});

test("wrong password is rejected without revealing which part was wrong", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
});

test.describe("signed in", () => {
  test.use({ storageState: ADMIN_STATE });

  test("dashboard shows defined metrics", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Orders placed, excluding cancelled. Not revenue.")).toBeVisible();
  });

test("admin creates a product with an uploaded image and publishes it", async ({ page }) => {
  const slug = `e2e-lamp-${Date.now()}`;
  await page.goto("/admin/products/new");
  await page.getByLabel("Name", { exact: true }).fill("E2E Travel Lamp");
  await page.getByLabel(/URL slug/).fill(slug);
  await page.getByLabel("Product SKU").fill(`E2E-${Date.now()}`);
  await page.getByRole("textbox", { name: "Price (৳)", exact: true }).fill("1290");
  await page.locator('input[type="file"]').setInputFiles(path.resolve("public/seed/glow-led-desk-lamp-1.webp"));
  await expect(page.getByRole("textbox", { name: /Alt text for image 1/ })).toBeVisible({ timeout: 20000 });
  await page.getByLabel("Stock", { exact: true }).fill("7");
  await page.getByLabel("Status").selectOption("published");
  await page.getByRole("button", { name: "Save product" }).click();
  await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/, { timeout: 20000 });
  await page.goto(`/shop/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Travel Lamp");
  await expect(page.getByText("৳1,290").first()).toBeVisible();
});
});
