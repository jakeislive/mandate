import { expect, test, type Page } from "@playwright/test";
import { snapshotData } from "../src/testnet-snapshot-data.ts";

async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("region", { name: "Testnet accounts", exact: true })).toBeVisible();
}

test("one-click login displays fixed real Testnet records without API calls, databases or signup", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api")) requests.push(request.url()); });
  await page.addInitScript(() => { localStorage.setItem("mandate.static-demo.v1", "untrusted old simulation".repeat(10_000)); });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /create account/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.locator(".owner-name")).toHaveText("TUser");
  await expect(page.getByRole("region", { name: "Snapshot verification" })).toContainText("2 accounts · 2 mandates · 3 distinct transactions");
  await expect(page.getByRole("region", { name: "Testnet accounts" })).toContainText("72 USD");
  await expect(page.getByRole("region", { name: "Testnet accounts" }).getByRole("link", { name: /View account on Stellar/ })).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem("mandate.static-demo.v1"))).toBeNull();
  expect(await page.evaluate(() => Object.entries(sessionStorage))).toEqual([["mandate.testnet-snapshot.session", "1"]]);
  await page.screenshot({ path: test.info().outputPath("testnet-accounts.png"), fullPage: true });
  await page.reload();
  await expect(page.locator(".owner-name")).toHaveText("TUser");
  expect(requests).toEqual([]);
});

test("real mandate limits and expiry ledgers are shown without mutation controls", async ({ page }) => {
  await login(page);
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
  await login(page);
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
  await login(page);
  for (const button of await page.getByRole("button", { name: /Add funds|Make payment/ }).all()) await expect(button).toBeDisabled();
  await expect(page.getByLabel("Test network warning").first()).toContainText("Do not add real funds or connect real accounts");
  await expect(page.getByLabel("Test network warning").first()).toContainText("real Stellar Testnet records");
  for (const path of ["/pay", "/chat"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Read-only Testnet snapshot", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Make payment|Send message/ })).toHaveCount(0);
  }
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Snapshot verification" })).toContainText("2 accounts · 2 mandates · 3 distinct transactions");
});

test("bounded Testnet records remain usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByLabel("Test network warning").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: test.info().outputPath("mobile-testnet-accounts.png"), fullPage: true });
});
