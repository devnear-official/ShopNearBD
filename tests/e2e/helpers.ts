import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? "admin@shopnear.test", password: process.env.E2E_ADMIN_PASSWORD ?? "ShopNear-Admin-2026!" };

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return errors;
}

export const ADMIN_STATE = "test-results/.auth/admin.json";

/**
 * Streamed sections (Suspense) arrive in a hidden copy that React swaps in a few hundred ms after
 * `load`; during that window the same text exists twice and strict locators fail. Wait for the swap.
 */
export async function streamed(page: Page) {
  await page.waitForFunction(() => !document.querySelector('[hidden][id^="S:"], template[id^="B:"]'), undefined, { timeout: 10_000 }).catch(() => {});
}

/** Navigate, wait for streamed content to settle, and give client components a moment to hydrate. */
export async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  await streamed(page);
  await page.waitForTimeout(400);
}
