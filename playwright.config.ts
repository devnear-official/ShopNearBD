import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a production build:  npm run build && npm run start -- -p 3100
 * (or set E2E_BASE_URL). Requires the local Supabase-compatible stack with seed data.
 * Set PW_CHROMIUM_PATH to use a preinstalled Chromium.
 * The admin signs in once (setup project) and the session is reused, so the
 * login rate limit (8 attempts / 15 min) isn't hit.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const chromium = { ...devices["Desktop Chrome"], launchOptions: { executablePath } };
export const ADMIN_STATE = "test-results/.auth/admin.json";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: chromium },
    { name: "responsive", testMatch: /responsive\.spec\.ts/, use: chromium, dependencies: ["setup"] },
    { name: "mobile", testMatch: /(storefront|admin)\.spec\.ts/, use: { ...chromium, viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true }, dependencies: ["setup"] },
    { name: "desktop", testMatch: /(storefront|admin)\.spec\.ts/, use: { ...chromium, viewport: { width: 1280, height: 860 } }, dependencies: ["setup"] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start -- -p 3100", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
