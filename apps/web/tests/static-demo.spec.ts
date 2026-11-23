import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("region", { name: "Main account", exact: true })).toBeVisible();
}

test("one-click login opens seeded accounts without API requests or signup", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api")) requests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /create account/i })).toHaveCount(0);
  await expect(page.getByLabel("Test network warning").first()).toContainText("Do not add real funds or connect real accounts");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.locator(".owner-name")).toHaveText("TUser");
  await expect(page.getByRole("region", { name: "Main account", exact: true })).toContainText("4784 USD");
  await expect(page.getByRole("region", { name: "Demo vendor accounts" }).getByRole("heading", { name: "Seatwise" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("dashboard.png"), fullPage: true });
  await page.getByRole("link", { name: "Spending", exact: true }).click();
  await expect(page.locator(".stat-row")).toContainText("216 USD");
  await expect(page.getByRole("link", { name: /View transaction/ })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".owner-name")).toHaveText("TUser");
  expect(requests).toEqual([]);
});

test("funding and payment warnings remain visible and changes persist after reload", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Add funds", exact: true }).click();
  const funding = page.getByRole("dialog", { name: "Add funds", exact: true });
  await expect(funding.getByLabel("Test network warning")).toBeVisible();
  await funding.getByLabel("Amount (USD)", { exact: true }).fill("10.50");
  await funding.getByRole("button", { name: "Add funds", exact: true }).click();
  await expect(funding).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Main account", exact: true })).toContainText("4794.5 USD");
  await page.getByRole("button", { name: "Make payment", exact: true }).click();
  const payment = page.getByRole("dialog", { name: "Make a payment", exact: true });
  await expect(payment.getByLabel("Test network warning")).toBeVisible();
  await payment.getByRole("combobox", { name: "Recipient Smart Account address", exact: true }).selectOption({ label: "Seatwise" });
  await payment.getByLabel("Payment reference", { exact: true }).fill("Browser demo purchase");
  await payment.getByLabel("Amount (USD)", { exact: true }).fill("1.25");
  await payment.getByRole("button", { name: "Confirm payment", exact: true }).click();
  await expect(payment).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Main account", exact: true })).toContainText("4793.25 USD");
});

test("mandate and workflow creation stay simulated and usable", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: /^Mandates/ }).click();
  await page.getByRole("button", { name: "New mandate", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New mandate", exact: true });
  await expect(dialog.getByLabel("Test network warning")).toBeVisible();
  await dialog.getByLabel("Mandate name", { exact: true }).fill("Browser demo allowance");
  await dialog.getByLabel("Spending limit (USD)", { exact: true }).fill("25");
  await dialog.getByRole("button", { name: "Create mandate", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Mandate created", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser demo allowance", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /^Workflows/ }).click();
  await page.getByRole("button", { name: "New purchasing workflow", exact: true }).click();
  const workflow = page.getByRole("dialog", { name: "New purchasing workflow", exact: true });
  await workflow.getByRole("button", { name: /Office supplies/ }).click();
  await expect(workflow.getByLabel("Test network warning")).toBeVisible();
  await workflow.getByLabel("Workflow name", { exact: true }).fill("Browser supplies");
  await workflow.getByRole("button", { name: "Set up workflow", exact: true }).click();
  await page.getByRole("dialog", { name: "Demo workflow created", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser supplies", exact: true, level: 2 })).toBeVisible();
});

test("public payment and chat work without a backend with explicit demo warnings", async ({ page }) => {
  await login(page);
  await page.goto("/pay");
  const form = page.locator(".pay-form");
  await expect(form.getByLabel("Test network warning")).toBeVisible();
  await page.getByRole("button", { name: "Use demo payment details", exact: true }).click();
  await page.getByRole("button", { name: "Check mandate & seller", exact: true }).click();
  await page.getByRole("button", { name: "Make payment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment succeeded", exact: true })).toBeVisible();
  await page.goto("/chat");
  await page.getByLabel("Message", { exact: true }).fill("Pay 0.20 USD to Seatwise");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment succeeded", exact: true })).toBeVisible();
  await expect(page.locator(".chat-result")).toContainText("0.2 USD");
});

test("demo remains usable on a narrow mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByLabel("Test network warning").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Demo vendor accounts" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: test.info().outputPath("mobile-dashboard.png"), fullPage: true });
});
