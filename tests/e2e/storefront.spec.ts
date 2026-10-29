import { expect, test } from "@playwright/test";
import { collectErrors, noHorizontalOverflow, visit } from "./helpers";

test("home page renders the brand story and real catalogue", async ({ page }) => {
  const errors = collectErrors(page);
  await visit(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Shop near.");
  await expect(page.getByRole("heading", { name: /Shop by category/ })).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("shop filters are shareable URLs and search works", async ({ page }) => {
  await visit(page, "/shop");
  await page.getByRole("group", { name: "Categories" }).getByRole("button", { name: /Audio/ }).click();
  await expect(page).toHaveURL(/category=audio/);
  await expect(page.locator("article h3")).toHaveCount(3);
  await visit(page, "/shop?q=bottle");
  await expect(page.locator("article h3").first()).toContainText("Bottle");
  await visit(page, "/shop?q=zzzznotathing");
  await expect(page.getByText("Nothing matches").filter({ visible: true })).toBeVisible();
});

test("variant selection updates price; add to bag; adjust quantity", async ({ page }) => {
  await visit(page, "/shop/braided-usb-c-cable");
  const twoM = page.getByRole("button", { name: "2 m", exact: true });
  await twoM.click();
  await expect(twoM).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main").getByText("৳450").first()).toBeVisible();
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await page.getByRole("button", { name: /Open cart, 1 item/ }).click();
  const drawer = page.getByRole("dialog", { name: /Your bag/ });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Increase quantity" }).click();
  await expect(drawer.getByText("৳900").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("guest cart checkout with Cash on Delivery creates a private order page", async ({ page, browser }) => {
  await visit(page, "/shop/steel-water-bottle-750");
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await visit(page, "/checkout");
  await page.getByLabel("Full name").fill("E2E Shopper");
  await page.getByLabel(/Mobile number/).fill("01812-345678");
  await page.getByLabel("District").selectOption("Sylhet");
  await page.getByLabel(/Full address/).fill("House 3, Zindabazar Road, Sylhet");
  // One page: delivery and payment together, then a single button.
  await expect(page.getByRole("heading", { name: "How would you like to pay?" })).toBeVisible();
  // The total only appears once the server has priced the order for the chosen district.
  await expect(page.getByRole("button", { name: /Place order/ })).toContainText("৳");
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/order\/SN\d{11}\/thank-you\?t=/);
  await expect(page.getByRole("heading", { name: /Thank you, E2E!/ })).toBeVisible();
  await expect(page.getByText(/we'll call 018\*\*\*\*\*678/i)).toBeVisible();
  await page.getByRole("link", { name: "Track your order", exact: true }).click();
  await page.waitForURL(/\/order\/SN\d{11}\?t=/);
  await expect(page.getByRole("heading", { name: /Order received/ })).toBeVisible();
  const number = new URL(page.url()).pathname.split("/").pop();

  // Another browser without the private token cannot see the order.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await visit(p2, `/order/${number}`);
  await expect(p2.getByRole("heading", { name: "Private order link needed" })).toBeVisible();
  await visit(p2, `/order/${number}?t=${"x".repeat(32)}`);
  await expect(p2.getByRole("heading", { name: /couldn.t open this order/ })).toBeVisible();
  await other.close();
});

test("checkout validates Bangladeshi phone numbers", async ({ page }) => {
  await visit(page, "/shop/city-sling-bag");
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await visit(page, "/checkout");
  await page.getByLabel("Full name").fill("Test");
  await page.getByLabel(/Mobile number/).fill("12345");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText(/valid Bangladeshi mobile number/)).toBeVisible();
});

test("keyboard: search opens with / and closes with Escape", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut is a desktop feature");
  await visit(page, "/");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect.poll(async () => { if (!(await dialog.isVisible())) await page.keyboard.press("/"); return dialog.isVisible(); }).toBe(true);
  await page.keyboard.type("fan");
  await expect(dialog.getByRole("link", { name: /Breeze Rechargeable Desk Fan/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("support chat answers from store data and fits the screen", async ({ page }) => {
  await visit(page, "/help");
  await page.getByRole("button", { name: /Chat with us|Ask ShopNear/ }).click();
  const chat = page.getByRole("dialog", { name: "ShopNear support chat" });
  await expect(chat).toBeVisible();
  await chat.getByRole("button", { name: "Delivery charge koto?" }).click();
  await expect(chat.getByText(/৳70/)).toBeVisible({ timeout: 15000 });
  const box = await chat.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
  await chat.getByRole("button", { name: "Close chat" }).click();
  await expect(chat).toBeHidden();
});

test("guest wishlist saves products on this device", async ({ page }) => {
  await visit(page, "/shop/fit-band-7");
  await page.getByRole("button", { name: /Save Fit Band 7 to wishlist/ }).first().click();
  await visit(page, "/wishlist");
  await expect(page.locator("article h3", { hasText: "Fit Band 7" })).toBeVisible();
  await page.getByRole("button", { name: /Remove Fit Band 7 from wishlist/ }).click();
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});
