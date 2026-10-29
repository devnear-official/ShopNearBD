import fs from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { ADMIN } from "./helpers";

setup("sign in as admin once", async ({ page }) => {
  fs.mkdirSync("test-results/.auth", { recursive: true });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page, "If this fails with 'Too many attempts', wait 15 minutes or clear public.rate_limits in the dev DB").toHaveURL(/\/admin\/dashboard/);
  await page.context().storageState({ path: "test-results/.auth/admin.json" });
});
