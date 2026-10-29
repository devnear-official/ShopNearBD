import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { ADMIN_STATE, noHorizontalOverflow, visit } from "./helpers";

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const PAGES = ["/", "/shop", "/shop/pulse-anc-earbuds-pro", "/checkout", "/help", "/order", "/admin/login"];
const ADMIN_PAGES = ["/admin/dashboard", "/admin/orders", "/admin/products", "/admin/settings"];
const out = "test-results/screens";
fs.mkdirSync(out, { recursive: true });

for (const width of WIDTHS) {
  test(`storefront at ${width}px: no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await visit(page, "/shop/kiki-type-c-earphones");
    await page.getByRole("button", { name: /Add to bag/ }).first().click(); // so /checkout has content
    for (const path of PAGES) {
      await visit(page, path);
      await noHorizontalOverflow(page);
      await page.screenshot({ path: `${out}/${width}${path.replace(/\//g, "_") || "_home"}.png`, fullPage: false });
    }
  });

  test(`admin at ${width}px: no horizontal overflow`, async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    for (const path of ADMIN_PAGES) {
      await visit(page, path);
      await noHorizontalOverflow(page);
      await page.screenshot({ path: `${out}/${width}${path.replace(/\//g, "_")}.png` });
    }
    await ctx.close();
  });
}

test("touch targets on the phone product page are at least 40px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await visit(page, "/shop/pulse-anc-earbuds-pro");
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("main button, main a, main select, main input"))
      .filter((el) => el.offsetParent !== null && !el.closest("nav[aria-label=Breadcrumb]") && !el.matches(".sr-only"))
      // A radio/checkbox inside a big clickable label: the label is the touch target.
      .filter((el) => !(el.matches("input[type=radio], input[type=checkbox]") && (el.closest("label")?.getBoundingClientRect().height ?? 0) >= 40))
      .map((el) => ({ el: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30), ...el.getBoundingClientRect().toJSON() }))
      .filter((r) => r.height < 40 && r.width < 200 && r.height > 0));
  expect(small, JSON.stringify(small)).toEqual([]);
});

test("reduced motion: the store still works and nothing animates indefinitely", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity && a.playState === "running").length);
  expect(running).toBe(0);
  await ctx.close();
});
