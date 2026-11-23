import { expect, test, type Page } from "@playwright/test";
import type { AccountMandate, PaymentNetwork, PaymentWorkspace, SpendingAccount } from "@mandate/shared";

const agentId = "agt_browser_buyer";
const mandateId = "mnd_browser_test_secret_0123456789abcdefghijklmnop";
const mandate: AccountMandate = { reference: "owner-record-reference", accountId: "bank", name: "Purchasing", recipientType: "agent", recipient: "Purchaser", limit: "10", spent: "0", period: "day", expiresAt: "2099-12-31T23:59:59Z", status: "active", createdAt: "2026-11-14T12:00:00Z", currency: "USD", enforcement: "on-chain", ruleId: 2, verifiedRecipientsOnly: true };
const account: SpendingAccount = { id: "bank", ownerId: "owner", name: "Operations", rail: "traditional", type: "traditional", currency: "USD", balance: "100", address: "C_DEMO_SOURCE", verified: true, createdAt: "2026-11-14T12:00:00Z" };
const network: PaymentNetwork = { id: "stellar:testnet", name: "Stellar testnet", currency: "XLM", rpcUrl: "https://rpc.example", horizonUrl: "https://horizon.example", explorerUrl: "https://explorer.example", tokenContract: "C_TEST_TOKEN", smartAccounts: true, verifiedSmartAccounts: true, mandates: true, agentVerification: true, faucet: true };
const workspace: PaymentWorkspace = { mode: "stellar-testnet", network, customer: { id: "owner", name: "Owner", email: "owner@example.com" }, accounts: [account], agents: [], mandates: [mandate], shared: [], activity: [], declines: [], vendors: [] };

async function mockClipboard(page: Page, fail = false) {
  await page.addInitScript(({ fail }) => {
    const writes: string[] = [];
    Object.defineProperty(window, "clipboardWrites", { value: writes });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value: string) => {
        if (fail) throw new Error("Clipboard permission denied");
        writes.push(value);
      },
    } });
  }, { fail });
}

async function copiedValues(page: Page) {
  return page.evaluate(() => Reflect.get(window, "clipboardWrites") as string[]);
}

async function mockWorkspace(page: Page) {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/network") await route.fulfill({ json: { mode: "stellar-testnet", network } });
    else if (path === "/api/workspace") await route.fulfill({ json: workspace });
    else await route.fulfill({ status: 404, json: { error: "Unexpected test request" } });
  });
}

for (const type of ["traditional", "stellar"] as const) {
  for (const method of ["testnet"] as const) {
    test(`${type} account supports ${method} funding and retries with the same request ID`, async ({ page }) => {
      await mockWorkspace(page);
      let funded = false;
      const requests: { amount: string; requestId: string; method: string }[] = [];
      await page.route("**/api/workspace", route => route.fulfill({ json: { ...workspace, accounts: [{ ...account, type, rail: type === "traditional" ? "traditional" : "blockchain", balance: funded ? "112.34" : "100" }] } }));
      await page.route("**/api/accounts/bank/funding", async route => {
        requests.push(route.request().postDataJSON());
        if (requests.length === 1) return route.fulfill({ status: 503, json: { error: "Awaiting testnet confirmation. Retry with the same request ID." } });
        funded = true;
        await route.fulfill({ status: 201, json: { id: "confirmed-tx", kind: "funding", amount: "12.34", currency: "USD", txHash: "confirmed-tx" } });
      });
      await page.goto("/");
      await page.getByRole("button", { name: "Add funds", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Add funds" });
      await expect(dialog.getByRole("radio", { name: /FIAT/ })).toBeChecked();
      if (method === "testnet") await dialog.getByRole("radio", { name: /Testnet/ }).check();
      await dialog.getByLabel("Amount (USD)", { exact: true }).fill("12.34");
      await dialog.getByRole("button", { name: "Add funds", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText("Awaiting testnet confirmation");
      await expect(page.locator(".balance")).toHaveText("100 USD");
      await dialog.getByRole("button", { name: "Add funds", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.locator(".balance")).toHaveText("112.34 USD");
      expect(requests).toHaveLength(2);
      expect(requests[1]).toEqual(requests[0]);
      expect(requests[0]!.amount).toBe("12.34");
      expect(requests[0]!.method).toBe(method);
    });
  }
}

for (const type of ["traditional", "stellar"] as const) {
  test(`${type} FIAT funding opens Stripe sandbox checkout and preserves the retry ID`, async ({ page }) => {
    await mockWorkspace(page);
    const requests: { method: string; amount: string; requestId: string }[] = [];
    await page.route("**/api/workspace", route => route.fulfill({ json: { ...workspace, accounts: [{ ...account, type }] } }));
    await page.route("**/api/accounts/bank/funding", async route => {
      requests.push(route.request().postDataJSON());
      if (requests.length === 1) return route.fulfill({ status: 503, json: { error: "Stripe checkout unavailable. Retry with the same request ID." } });
      await route.fulfill({ status: 201, json: { status: "checkout", provider: "stripe", mode: "test", sessionId: "cs_test_browser", url: "https://checkout.stripe.com/c/pay/cs_test_browser" } });
    });
    await page.route("https://checkout.stripe.com/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Stripe sandbox checkout</h1>" }));
    await page.goto("/");
    await page.getByRole("button", { name: "Add funds", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add funds" });
    await expect(dialog.getByRole("radio", { name: /FIAT/ })).toBeChecked();
    await expect(dialog).toContainText("4242 4242 4242 4242");
    await dialog.getByLabel("Amount (USD)", { exact: true }).fill("12.34");
    await dialog.getByRole("button", { name: "Continue to Stripe", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Stripe checkout unavailable");
    await expect(page.locator(".balance")).toHaveText("100 USD");
    await dialog.getByRole("button", { name: "Continue to Stripe", exact: true }).click();
    await expect(page).toHaveURL("https://checkout.stripe.com/c/pay/cs_test_browser");
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(requests[0]).toMatchObject({ method: "fiat", amount: "12.34" });
  });
}

test("Stripe return waits for confirmed funding before refreshing the balance", async ({ page }) => {
  await mockWorkspace(page);
  let paid = false;
  let funded = false;
  await page.route("**/api/workspace", route => route.fulfill({ json: { ...workspace, accounts: [{ ...account, balance: funded ? "112.34" : "100" }] } }));
  await page.route("**/api/funding/stripe/cs_test_return", async route => {
    if (!paid) return route.fulfill({ json: { status: "pending" } });
    funded = true;
    await route.fulfill({ json: { status: "paid", payment: { id: "funded", kind: "funding", amount: "12.34" } } });
  });
  await page.goto("/activity?funding=success&session_id=cs_test_return");
  await expect(page.getByRole("status")).toContainText("Waiting for Stripe payment confirmation");
  await expect(page.locator(".balance")).toHaveText("100 USD");
  paid = true;
  await expect(page.getByRole("status")).toContainText("Stripe test payment confirmed", { timeout: 10_000 });
  await expect(page.locator(".balance")).toHaveText("112.34 USD");
});

test("Stripe confirmation failures can be retried and cancellation does not credit funds", async ({ page }) => {
  await mockWorkspace(page);
  let calls = 0;
  let unavailable = true;
  await page.route("**/api/funding/stripe/cs_test_retry", async route => {
    calls++;
    if (unavailable) return route.fulfill({ status: 503, json: { error: "Stellar funding confirmation unavailable" } });
    await route.fulfill({ json: { status: "expired" } });
  });
  await page.goto("/activity?funding=success&session_id=cs_test_retry");
  await expect(page.getByRole("alert")).toContainText("Stellar funding confirmation unavailable");
  unavailable = false;
  await page.getByRole("button", { name: "Retry confirmation" }).click();
  await expect(page.getByRole("status")).toContainText("checkout expired");
  const callsBeforeCancel = calls;
  await page.goto("/activity?funding=cancelled");
  await expect(page.getByRole("status")).toContainText("checkout cancelled");
  await expect(page.locator(".balance")).toHaveText("100 USD");
  expect(calls).toBe(callsBeforeCancel);
});

test("dashboard refreshes the main account balance when returning after a payment", async ({ page }) => {
  await mockWorkspace(page);
  let paid = false;
  await page.route("**/api/workspace", async route => {
    await route.fulfill({ json: { ...workspace, accounts: [
      { ...account, id: "source", type: "stellar", rail: "blockchain", name: "Sender", currency: "USD", balance: paid ? "9.5" : "10" },
    ] } });
  });
  await page.goto("/");
  await expect(page.locator(".balance")).toHaveText("10 USD");
  paid = true;
  // The browser focuses the dashboard again when returning from the Pay tab.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".balance")).toHaveText("9.5 USD");
  await expect(page.getByRole("region", { name: "Main account", exact: true })).toHaveCount(1);
});

test("dashboard copies a mandate while masked and clears its field on Hide", async ({ page }) => {
  await mockWorkspace(page);
  await mockClipboard(page);
  let revealRequests = 0;
  await page.route("**/api/mandates/owner-record-reference/reveal", async route => {
    expect(route.request().method()).toBe("POST");
    revealRequests++;
    await route.fulfill({ json: { mandateId } });
  });
  await page.goto("/mandates");
  const idField = page.getByLabel("Mandate ID", { exact: true });
  await expect(idField).toHaveAttribute("type", "password");
  await expect(idField).not.toHaveValue(mandateId);
  await expect(page.getByRole("button", { name: "Copy mandate ID" })).toBeVisible();
  expect(revealRequests).toBe(0);
  await page.getByRole("button", { name: "Copy mandate ID" }).click();
  await expect(page.getByRole("status")).toHaveText("Copied to clipboard.");
  expect(await copiedValues(page)).toEqual([mandateId]);
  expect(revealRequests).toBe(1);
  await expect(idField).toHaveAttribute("type", "password");
  await expect(idField).not.toHaveValue(mandateId);
  const payLink = page.getByRole("link", { name: "Open Pay page" });
  await expect(payLink).toHaveAttribute("href", "/pay");
  await page.getByRole("button", { name: "Show mandate", exact: true }).click();
  await expect(idField).toHaveAttribute("type", "text");
  await expect(idField).toHaveValue(mandateId);
  expect(revealRequests).toBe(2);
  await page.getByRole("button", { name: "Hide mandate", exact: true }).click();
  await expect(idField).toHaveAttribute("type", "password");
  await expect(idField).not.toHaveValue(mandateId);
  await expect(page.getByRole("button", { name: "Copy mandate ID" })).toBeVisible();
  expect(page.url()).not.toContain(mandateId);
});

test("newly created mandate is masked and has no separate payment credential", async ({ page }) => {
  await mockWorkspace(page);
  await mockClipboard(page);
  await page.route("**/api/mandates", async route => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).not.toHaveProperty("currency");
    await route.fulfill({ status: 201, json: { mandate: { ...mandate, reference: "created-record" }, mandateId } });
  });
  await page.goto("/mandates");
  await expect(page.getByLabel("Payment method", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Currency", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "New mandate", exact: true }).click();
  await page.getByLabel("Mandate name", { exact: true }).fill("Purchasing");
  await page.getByLabel("Spending limit (USD)", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Create mandate", exact: true }).click();
  const created = page.locator(".mandate-form-card");
  await expect(created.getByRole("heading", { name: "Mandate created" })).toBeVisible();
  const idField = created.getByLabel("Mandate ID", { exact: true });
  await expect(idField).toHaveAttribute("type", "password");
  await expect(idField).not.toHaveValue(mandateId);
  await expect(page.getByLabel("Payment credential", { exact: true })).toHaveCount(0);
  await expect(created.getByLabel("Payment page link")).toHaveValue("http://127.0.0.1:4030/pay");
  await created.getByRole("button", { name: "Copy mandate ID", exact: true }).click();
  await expect(created.getByRole("status")).toHaveText("Copied to clipboard.");
  expect(await copiedValues(page)).toEqual([mandateId]);
  await expect(idField).toHaveAttribute("type", "password");
  await expect(idField).not.toHaveValue(mandateId);
  const sourceField = created.getByLabel("Source Smart Account address", { exact: true });
  await expect(sourceField).toHaveAttribute("type", "password");
  await expect(sourceField).not.toHaveValue(account.address!);
  await created.getByRole("button", { name: "Copy Smart Account address", exact: true }).click();
  await expect(created.getByRole("status")).toHaveCount(2);
  expect(await copiedValues(page)).toEqual([mandateId, account.address]);
  await expect(sourceField).toHaveAttribute("type", "password");
  await created.getByRole("button", { name: "Show mandate", exact: true }).click();
  await expect(idField).toHaveValue(mandateId);
  await expect(idField).toHaveAttribute("type", "text");
});

test("Pay page keeps the ID password-masked through preview, payment and another payment", async ({ page, context }) => {
  await mockWorkspace(page);
  await context.addCookies([{ name: "mandate_session", value: "owner-session", domain: "127.0.0.1", path: "/api" }]);
  const submitted: string[] = [];
  await page.route("**/api/pay**", async route => {
    const request = route.request();
    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body.mandateId).toBe(mandateId);
    expect(body.agentId).toBe(agentId);
    expect(body).not.toHaveProperty("token");
    expect(body).not.toHaveProperty("rail");
    expect(body).not.toHaveProperty("accountId");
    expect(request.headers()).not.toHaveProperty("authorization");
    expect(request.headers()).not.toHaveProperty("cookie");
    submitted.push(new URL(request.url()).pathname);
    if (request.url().endsWith("/preview")) {
      await route.fulfill({ json: { agent: { id: agentId, name: "Buyer", verified: true }, mandate: { name: "Purchasing", address: account.address, limit: "10", spent: "0", expiresAt: mandate.expiresAt }, seller: { address: "C_DEMO_SELLER", name: "Seller", verified: true }, currency: "USD", balance: "100", checks: [{ label: "Payment is allowed", passed: true }] } });
    } else {
      await route.fulfill({ json: { status: "paid", payment: { id: "receipt", accountId: account.id, source: account.address, destination: "C_DEMO_SELLER", amount: "1", currency: "USD", kind: "payment", mandateReference: mandate.reference, reference: "Invoice", createdAt: "2026-11-14T12:00:00Z", settlement: "stellar-testnet", txHash: "test-tx", explorerUrl: "https://explorer.example/tx/test-tx" } } });
    }
  });
  await page.goto("/pay");
  const idField = page.getByLabel("Mandate ID", { exact: true });
  await expect(idField).toHaveAttribute("type", "password");
  await idField.fill(mandateId);
  await page.getByLabel("Agent identification", { exact: true }).fill(agentId);
  await page.getByLabel("Seller name", { exact: true }).fill("Seller");
  await page.getByLabel("Seller Smart Account address", { exact: true }).fill("C_DEMO_SELLER");
  await page.getByLabel("Amount (USD)", { exact: true }).fill("1");
  await page.getByLabel("Payment reference", { exact: true }).fill("Invoice");
  await expect(page.getByRole("button", { name: /Show mandate|Hide mandate/ })).toHaveCount(0);
  await expect(page.getByLabel("Payment credential", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make payment", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Check mandate & seller" }).click();
  await expect(page.getByText("Payment is allowed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Make payment", exact: true })).toBeEnabled();
  await expect(idField).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Make payment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment succeeded" })).toBeVisible();
  await expect(idField).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Start another payment" }).click();
  await expect(idField).toHaveAttribute("type", "password");
  expect(submitted).toEqual(["/api/pay/preview", "/api/pay"]);
  expect(page.url()).not.toContain(mandateId);
});

test("dashboard exposes only USD and has no currency selector", async ({ page }) => {
  await mockWorkspace(page);
  await page.route("**/api/workspace", async route => {
    await route.fulfill({ json: { ...workspace, accounts: [{ ...account, balances: [{ currency: "USD", balance: "100" }, { currency: "XLM", balance: "2.5" }] }] } });
  });
  await page.goto("/");
  await expect(page.getByLabel("Smart Account address", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Smart Account address", { exact: true })).not.toHaveValue(account.address!);
  await expect(page.getByText(/XLM|Also available/)).toHaveCount(0);
  await expect(page.getByText("Demo account number", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Classic wallet|BANK_DEMO_/)).toHaveCount(0);
  await page.getByRole("button", { name: "Make payment", exact: true }).click();
  await expect(page.getByLabel("Recipient Smart Account address", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Currency", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Amount (USD)", { exact: true })).toBeVisible();
});

for (const type of ["traditional", "stellar"] as const) {
  test(`${type} Smart Account main account address copies while masked and resets after navigation`, async ({ page }) => {
    await mockWorkspace(page);
    await mockClipboard(page);
    const secondAddress = "C_SECOND_ACCOUNT";
    await page.route("**/api/workspace", async route => {
      await route.fulfill({ json: { ...workspace, accounts: [
        { ...account, type, rail: type === "traditional" ? "traditional" : "blockchain" },
        { ...account, id: "second", type, name: "Second", address: secondAddress },
      ] } });
    });
    await page.goto("/");
    const addressField = page.getByLabel("Smart Account address", { exact: true });
    await expect(addressField).toHaveAttribute("type", "password");
    await expect(addressField).not.toHaveValue(account.address!);
    await page.getByRole("button", { name: "Copy Smart Account address", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Copied to clipboard.");
    expect(await copiedValues(page)).toEqual([account.address]);
    await expect(addressField).toHaveAttribute("type", "password");
    await expect(addressField).not.toHaveValue(account.address!);
    await page.getByRole("button", { name: "Show Smart Account address", exact: true }).click();
    await expect(addressField).toHaveAttribute("type", "text");
    await expect(addressField).toHaveValue(account.address!);
    await page.getByRole("button", { name: "Hide Smart Account address", exact: true }).click();
    await expect(addressField).toHaveAttribute("type", "password");
    await expect(addressField).not.toHaveValue(account.address!);
    await page.getByRole("button", { name: "Show Smart Account address", exact: true }).click();
    await expect(page.getByRole("button", { name: /Second USD account/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Spending", exact: true }).click();
    await expect(addressField).toHaveAttribute("type", "password");
    await expect(addressField).not.toHaveValue(account.address!);
    await page.getByRole("button", { name: "Copy Smart Account address", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Copied to clipboard.");
    expect(await copiedValues(page)).toEqual([account.address]);

  });
}

test("failed clipboard access never reveals a mandate ID", async ({ page }) => {
  await mockWorkspace(page);
  await mockClipboard(page, true);
  await page.route("**/api/mandates/owner-record-reference/reveal", async route => {
    await route.fulfill({ json: { mandateId } });
  });
  await page.goto("/mandates");
  await page.getByRole("button", { name: "Copy mandate ID", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Clipboard permission denied");
  const idField = page.getByLabel("Mandate ID", { exact: true });
  await expect(idField).toHaveAttribute("type", "password");
  await expect(idField).not.toHaveValue(mandateId);
  expect(await copiedValues(page)).toEqual([]);
});

test("one-click demo login leads directly to the main account with mandates and activity", async ({ page }) => {
  let signedIn = false;
  let openingRequests = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/network") return route.fulfill({ json: { network } });
    if (path === "/api/auth/login") {
      expect(route.request().postDataJSON()).toEqual({ email: "test@testing.com", password: "testing1234567890" });
      signedIn = true;
      return route.fulfill({ status: 201, json: workspace.customer });
    }
    if (path === "/api/workspace") return route.fulfill(signedIn ? { json: workspace } : { status: 401, json: { error: "Please sign in" } });
    if (path === "/api/accounts/open") openingRequests++;
    return route.fulfill({ status: 404, json: { error: "Unexpected request" } });
  });
  await page.goto("/");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  const summary = page.getByRole("region", { name: "Main account", exact: true });
  await expect(summary).toContainText("100 USD");
  await expect(summary.getByRole("button", { name: "Add funds", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspace" }).getByRole("link")).toHaveText(["Workflows 0", "Agents 0", "Mandates 1", "Spending"]);
  await expect(page.getByRole("heading", { name: "Purchasing workflows", exact: true })).toBeVisible();
  await expect(page.getByLabel("Source account", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Open account|Accounts/ })).toHaveCount(0);
  expect(openingRequests).toBe(0);
  await page.getByRole("link", { name: "Spending", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Spending", exact: true })).toBeVisible();
  await expect(summary).toBeVisible();
});

for (const path of ["/accounts", "/accounts/new"]) {
  test(`legacy route ${path} shows the main account dashboard`, async ({ page }) => {
    await mockWorkspace(page);
    await page.goto(path);
    await expect(page.getByRole("region", { name: "Main account", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Purchasing workflows", exact: true })).toBeVisible();
    await expect(page.getByLabel("Account name", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open account", exact: true })).toHaveCount(0);
  });
}

test("seller IDs are entered as numbers and saved with a mandate", async ({ page }) => {
  await mockWorkspace(page);
  let requests = 0;
  await page.route("**/api/mandates", async route => {
    requests++;
    const input = route.request().postDataJSON();
    expect(input.sellerIds).toEqual([101, 202, 303]);
    expect(input).not.toHaveProperty("accountId");
    await route.fulfill({ status: 201, json: { mandate: { ...mandate, reference: "restricted", sellerIds: input.sellerIds }, mandateId } });
  });
  await page.goto("/mandates");
  await page.getByRole("button", { name: "New mandate", exact: true }).click();
  const sellerIds = page.getByLabel("Seller IDs (optional)", { exact: true });
  await expect(sellerIds).toHaveAttribute("type", "text");
  await expect(page.getByRole("combobox", { name: /Seller/ })).toHaveCount(0);
  await page.getByLabel("Mandate name", { exact: true }).fill("Restricted purchasing");
  await page.getByLabel("Spending limit (USD)", { exact: true }).fill("10");
  for (const invalid of ["seller", "1.5", "-1", "101,,202"]) {
    await sellerIds.fill(invalid);
    await page.getByRole("button", { name: "Create mandate", exact: true }).click();
    expect(await sellerIds.evaluate((input: HTMLInputElement) => input.validity.patternMismatch)).toBe(true);
    expect(requests).toBe(0);
  }
  await sellerIds.fill(" 101, 202 303 ");
  await page.getByRole("button", { name: "Create mandate", exact: true }).click();
  const created = page.locator(".mandate-form-card");
  await expect(created.getByText("Allowed seller IDs: 101, 202, 303", { exact: true })).toBeVisible();
  expect(requests).toBe(1);
  await created.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "New mandate", exact: true }).click();
  await expect(page.getByLabel("Seller IDs (optional)", { exact: true })).toHaveValue("");
});

test("accounts hide internal seller IDs and saved mandate restrictions remain visible", async ({ page }) => {
  await mockWorkspace(page);
  await page.route("**/api/workspace", route => route.fulfill({ json: { ...workspace, accounts: [{ ...account, sellerId: 101 }], mandates: [{ ...mandate, sellerIds: [202, 303] }] } }));
  await page.goto("/");
  await expect(page.getByLabel("Seller ID", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Main account", exact: true }).getByText(/seller ID/i)).toHaveCount(0);
  await page.goto("/mandates");
  await expect(page.getByText("Allowed seller IDs: 202, 303", { exact: true })).toBeVisible();
});

for (const selected of [false, true]) {
  test(`mandate user dropdown ${selected ? "uses an account agent" : "can be left empty"}`, async ({ page }) => {
    await mockWorkspace(page);
    const agents = [
      { id: "agt_chat", accountId: account.id, name: "Chat agent", verified: true, verificationTxHash: "chat-registration", createdAt: account.createdAt },
      { id: "agt_travel", accountId: account.id, name: "Travel booker", verified: true, verificationTxHash: "travel-registration", createdAt: account.createdAt },
    ];
    await page.route("**/api/workspace", route => route.fulfill({ json: { ...workspace, agents } }));
    await page.route("**/api/mandates", async route => {
      const body = route.request().postDataJSON();
      if (selected) expect(body.recipient).toBe("agt_travel");
      else expect(body).not.toHaveProperty("recipient");
      await route.fulfill({ status: 201, json: { mandate: { ...mandate, recipient: selected ? "agt_travel" : "Any registered agent" }, mandateId } });
    });
    await page.goto("/mandates");
    await page.getByRole("button", { name: "New mandate", exact: true }).click();
    const owner = page.getByRole("combobox", { name: "Mandate user (optional)", exact: true });
    await expect(owner).not.toHaveAttribute("required");
    await expect(owner.locator("option")).toHaveText(["Any registered agent", "Chat agent", "Travel booker"]);
    if (selected) await owner.selectOption("agt_travel");
    await page.getByLabel("Mandate name", { exact: true }).fill("Purchasing");
    await page.getByLabel("Spending limit (USD)", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Create mandate", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mandate created", exact: true })).toBeVisible();
  });
}

test("Agents lists account identities and registers new agents without spending settings", async ({ page }) => {
  await mockWorkspace(page);
  await mockClipboard(page);
  const agent = { id: agentId, accountId: account.id, name: "Travel booker", verified: true, verificationTxHash: "registration", createdAt: "2026-11-15T12:00:00Z", explorerUrl: "https://explorer.example/tx/registration" };
  let registered = false;
  await page.route("**/api/workspace", route => route.fulfill({ json: { ...workspace, agents: registered ? [agent] : [] } }));
  await page.route("**/api/agents", async route => {
    expect(route.request().postDataJSON()).toMatchObject({ name: "Travel booker" });
    expect(route.request().postDataJSON()).not.toHaveProperty("limit");
    expect(route.request().postDataJSON()).not.toHaveProperty("connect");
    registered = true;
    await route.fulfill({ status: 201, json: agent });
  });
  await page.goto("/agents");
  await expect(page.getByRole("region", { name: "Main account", exact: true })).toBeVisible();
  await expect(page.getByText("No agents yet. Set up a purchasing workflow, or add an agent to connect an assistant like Claude.")).toBeVisible();
  await page.getByRole("button", { name: "Add agent", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add agent", exact: true });
  await expect(dialog.getByLabel(/Spending limit|Expires|Rolling window/)).toHaveCount(0);
  await dialog.getByLabel("Agent name", { exact: true }).fill("Travel booker");
  // An agent's own key is the default; sharing a mandate ID is one of the other ways.
  await expect(dialog.getByRole("radio", { name: /With a mandate ID/ })).toBeHidden();
  await dialog.getByText("Other ways to connect", { exact: true }).click();
  await dialog.getByRole("radio", { name: /With a mandate ID/ }).check();
  await dialog.getByRole("button", { name: "Add agent", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Travel booker", exact: true })).toBeVisible();
  await expect(page.getByLabel("Agent identification", { exact: true })).toHaveValue(agentId);
  await expect(page.getByText("Verified on chain", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Copy identification", exact: true }).click();
  expect(await copiedValues(page)).toEqual([agentId]);
});


test("main's theme toggle persists and mandate cards use the merged wording", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/mandates");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("img", { name: "100% of the mandate limit remaining", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "New mandate", exact: true })).toBeVisible();
  await expect(page.getByText(/shopper/i)).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("dashboard.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("an agent with its own key connects with a one-time code and its mandate has no secret ID", async ({ page }) => {
  await mockWorkspace(page);
  await mockClipboard(page);
  const waiting = { id: "agt_claude", accountId: account.id, name: "Claude", verified: false, status: "waiting", createdAt: "2026-11-15T12:00:00Z", pairing: { code: "K7Q4-92XD", expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } };
  const connected = { ...waiting, status: "connected", verified: true, pairing: undefined, publicKey: "GCF6WOEY735RPTS6EESGXC4KDLK2SHPGBULTSVLXRUY6HPWYRZ6LNFJW", verificationTxHash: "registration", explorerUrl: "https://explorer.example/tx/registration" };
  let agents: unknown[] = [];
  await page.route("**/api/workspace", route => route.fulfill({ json: { ...workspace, agents } }));
  await page.route("**/api/agents", async route => {
    expect(route.request().postDataJSON()).toMatchObject({ name: "Claude", connect: true });
    agents = [waiting];
    await route.fulfill({ status: 201, json: waiting });
  });
  await page.goto("/agents");
  await page.getByRole("button", { name: "Add agent", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add agent", exact: true });
  await dialog.getByLabel("Agent name", { exact: true }).fill("Claude");
  await expect(dialog.getByText(/The agent makes its own key and connects with a one-time code/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add agent", exact: true }).click();
  const connect = page.getByRole("dialog", { name: "Connect Claude", exact: true });
  await connect.getByRole("button", { name: "Connection code K7Q4-92XD, copy", exact: true }).click();
  expect(await copiedValues(page)).toEqual(["K7Q4-92XD"]);
  await expect(connect.getByText(/Connect to Mandate with code K7Q4-92XD/)).toBeVisible();
  await connect.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("Waiting to connect", { exact: true })).toBeVisible();

  agents = [connected];
  await page.route("**/api/mandates", async route => {
    expect(route.request().postDataJSON()).toMatchObject({ recipient: "agt_claude" });
    await route.fulfill({ status: 201, json: { mandate: { ...mandate, reference: "claude-groceries", recipient: "agt_claude", agentId: "agt_claude" } } });
  });
  await page.goto("/agents");
  await expect(page.getByText("Connected · own key, verified on chain", { exact: true })).toBeVisible();
  await page.goto("/mandates");
  await page.getByRole("button", { name: "New mandate", exact: true }).click();
  await page.getByRole("combobox", { name: "Mandate user (optional)", exact: true }).selectOption("agt_claude");
  await page.getByLabel("Mandate name", { exact: true }).fill("Groceries");
  await page.getByLabel("Spending limit (USD)", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Create mandate", exact: true }).click();
  const created = page.locator(".mandate-form-card");
  await expect(created.getByRole("heading", { name: "Mandate created" })).toBeVisible();
  await expect(created.getByText(/Only Claude's own key can sign for this mandate/)).toBeVisible();
  await expect(created.getByLabel("Mandate ID", { exact: true })).toHaveCount(0);
});
