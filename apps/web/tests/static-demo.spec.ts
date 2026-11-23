import { expect, test, type Page } from "@playwright/test";
import { snapshotData } from "../src/testnet-snapshot-data.ts";

async function openDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Testnet accounts", exact: true })).toBeVisible();
}

test("the dashboard opens directly with only the User ID and one warning above the tabs", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api")) requests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Login|Sign out/i })).toHaveCount(0);
  await expect(page.locator("input:not([readonly])")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /create account/i })).toHaveCount(0);
  await expect(page.getByText("User ID: TUser", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Snapshot verification" })).toHaveCount(0);
  await expect(page.getByLabel("Test network warning")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Testnet accounts" })).toContainText("72 USD");
  await expect(page.getByRole("region", { name: "Testnet accounts" }).getByRole("link", { name: /View account on Stellar/ })).toHaveCount(2);
  expect(await page.evaluate(() => Object.entries(sessionStorage))).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("testnet-accounts.png"), fullPage: true });
  await page.reload();
  await expect(page.getByText("User ID: TUser", { exact: true })).toBeVisible();
  expect(requests).toEqual([]);
});

test("accounts navigate to mandates without a document reload, with back and direct-link support", async ({ page }) => {
  await openDashboard(page);
  let documentRequests = 0;
  page.on("request", request => { if (request.isNavigationRequest()) documentRequests++; });
  await page.getByRole("link", { name: "View mandates", exact: true }).click();
  await expect(page).toHaveURL(/\/mandates$/);
  await expect(page.getByRole("region", { name: "Testnet mandates", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mandates 2", exact: true })).toHaveAttribute("aria-current", "page");
  expect(documentRequests).toBe(0);
  await page.goBack();
  await expect(page.getByRole("region", { name: "Testnet accounts", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("region", { name: "Testnet mandates", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Testnet mandates", exact: true })).toBeVisible();
  documentRequests = 0;
  for (const [tab, region, path] of [
    ["Accounts 2", "Testnet accounts", "/"],
    ["Mandates 2", "Testnet mandates", "/mandates"],
    ["Transactions 3", "Confirmed Testnet transactions", "/spending"],
    ["Accounts 2", "Testnet accounts", "/"],
  ]) {
    const link = page.getByRole("link", { name: tab, exact: true });
    await link.click();
    await expect(page).toHaveURL(new URL(path!, "http://127.0.0.1:4031").href);
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("region", { name: region, exact: true })).toBeVisible();
  }
  expect(documentRequests).toBe(0);
});

test("direct mandate links work when session storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage unavailable"); } });
  });
  await page.goto("/mandates");
  await expect(page.getByRole("region", { name: "Testnet mandates", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Login", exact: true })).toHaveCount(0);
});

test("real mandate limits and expiry ledgers are shown without mutation controls", async ({ page }) => {
  await openDashboard(page);
  await page.getByRole("link", { name: "Mandates 2", exact: true }).click();
  const mandates = page.getByRole("region", { name: "Testnet mandates", exact: true });
  for (const mandate of snapshotData.mandates) {
    await expect(mandates.getByRole("heading", { name: mandate.name, exact: true })).toBeVisible();
    await expect(mandates).toContainText(`Rule ${mandate.ruleId}`);
    await expect(mandates).toContainText(`Expires at ledger ${mandate.validUntilLedger}`);
  }
  await expect(page.getByRole("button", { name: /New mandate|Create mandate|Change limit|Revoke/ })).toHaveCount(0);
});

test("each receipt links to its actual confirmed Testnet transaction and CSV retains its hash", async ({ page }) => {
  await openDashboard(page);
  await page.getByRole("link", { name: "Transactions 3", exact: true }).click();
  const transactions = page.getByRole("region", { name: "Confirmed Testnet transactions", exact: true });
  await expect(transactions.getByRole("link", { name: "View confirmed transaction", exact: false })).toHaveCount(3);
  for (const tx of snapshotData.transactions) await expect(transactions.locator(`a[href="${snapshotData.explorerUrl}/tx/${tx.hash}"]`)).toBeVisible();
  await expect(transactions).toContainText("Confirmed on Stellar Testnet");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk.toString();
  for (const tx of snapshotData.transactions) expect(csv).toContain(tx.hash);
  expect(csv).toContain("stellar:testnet");
  expect(csv).not.toContain("simulated");
});

test("creation, funding, payments and chat cannot grow the fixed snapshot", async ({ page }) => {
  await openDashboard(page);
  for (const button of await page.getByRole("button", { name: /Add funds|Make payment/ }).all()) await expect(button).toBeDisabled();
  await expect(page.getByLabel("Test network warning").first()).toContainText("Do not add real funds or connect real accounts");
  await expect(page.getByLabel("Test network warning")).toContainText("Real Stellar Testnet records");
  for (const path of ["/pay", "/chat"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Read-only Testnet snapshot", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Make payment|Send message/ })).toHaveCount(0);
  }
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Testnet accounts" }).getByRole("listitem")).toHaveCount(2);
});

test("bounded Testnet records remain usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDashboard(page);
  await expect(page.getByLabel("Test network warning").first()).toBeVisible();
  await expect(page.getByText("User ID: TUser", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: test.info().outputPath("mobile-testnet-accounts.png"), fullPage: true });
  await page.getByRole("link", { name: "Mandates 2", exact: true }).click();
  await expect(page.getByRole("region", { name: "Testnet mandates", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Transactions 3", exact: true }).click();
  await expect(page.getByRole("region", { name: "Confirmed Testnet transactions", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Accounts 2", exact: true }).click();
  await expect(page.getByRole("region", { name: "Testnet accounts", exact: true })).toBeVisible();
});
