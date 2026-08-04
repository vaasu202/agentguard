import { expect, test } from "@playwright/test";

test("auto-runs the injection fixture and blocks execution", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".verdict-lockup strong")).toHaveText("BLOCK", { timeout: 12_000 });
  await expect(page.getByText("The protected MCP executor was never invoked.", { exact: true })).toBeVisible();
  await expect(page.locator(".decision-panel")).toContainText("AG-101");
});

test("production rollback reaches a human checkpoint", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".verdict-lockup strong")).toHaveText("BLOCK", { timeout: 12_000 });
  await page.getByRole("button", { name: /Production rollback/ }).click();
  await page.getByRole("button", { name: /RUN ATTACK/ }).click();
  await expect(page.getByText("HUMAN CHECKPOINT", { exact: true })).toBeVisible({ timeout: 12_000 });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Approved and released.", { exact: true })).toBeVisible();
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

