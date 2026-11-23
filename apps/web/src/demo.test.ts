import assert from "node:assert/strict";
import test from "node:test";
import type { AccountAgent, AccountMandate, MandateCreation, MandatePaymentResult, PaymentChatState, PaymentEntry, PaymentWorkspace } from "@mandate/shared";
import { createDemo, DEMO_LOGIN, DEMO_PAYMENT, DemoError } from "./demo.ts";

function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  let now = Date.parse("2026-11-22T12:00:00Z");
  const demo = createDemo(storage, () => now);
  const request = <T>(path: string, method = "GET", body?: Record<string, unknown>) => demo.request(path, method, body) as T;
  const login = () => request("/auth/login", "POST", DEMO_LOGIN);
  const workspace = () => request<PaymentWorkspace>("/workspace");
  const grant = (extra: Record<string, unknown> = {}) => request<MandateCreation>("/mandates", "POST", { name: "Demo allowance", limit: "2", period: "day", recipientType: "agent", expiresAt: "2027-01-01T00:00:00Z", sellerIds: [101], requestId: "grant", ...extra });
  return { storage, demo, request, login, workspace, grant, advance: (ms: number) => { now += ms; } };
}
const declined = (work: () => unknown, status: number) => assert.throws(work, error => error instanceof DemoError && error.status === status);

test("only the fixed demo credentials open TUser; signup is unavailable", () => {
  const f = fixture();
  declined(() => f.workspace(), 401);
  declined(() => f.request("/auth/register", "POST", { ...DEMO_LOGIN, email: "someone@example.com" }), 403);
  declined(() => f.request("/auth/login", "POST", { ...DEMO_LOGIN, password: "wrong-password" }), 401);
  f.login();
  const workspace = f.workspace();
  assert.equal(workspace.customer.name, "TUser");
  assert.equal(workspace.customer.email, DEMO_LOGIN.email);
  assert.equal(workspace.accounts.length, 4);
  assert.equal(workspace.mandates.length, 4);
  assert.equal(workspace.activity.filter(entry => entry.kind === "payment").length, 6);
  assert.equal(workspace.declines.length, 2);
  assert.equal(workspace.accounts[0]!.balance, "4784");
  assert.ok(workspace.activity.every(entry => !entry.txHash && !entry.explorerUrl));
});

test("funding is exact, persistent, idempotent and remains protected after logout", () => {
  const f = fixture(); f.login();
  const input = { amount: "0.10", method: "testnet", requestId: "fund" };
  const first = f.request<PaymentEntry>("/accounts/demo-main/funding", "POST", input);
  const repeated = f.request<PaymentEntry>("/accounts/demo-main/funding", "POST", input);
  assert.equal(first.id, repeated.id);
  assert.equal(f.workspace().accounts[0]!.balance, "4784.1");
  const restored = createDemo(f.storage, () => Date.parse("2026-11-22T12:00:00Z"));
  assert.equal((restored.request("/workspace") as PaymentWorkspace).accounts[0]!.balance, "4784.1");
  declined(() => f.request("/accounts/demo-main/funding", "POST", { ...input, amount: "1" }), 409);
  f.request("/auth/logout", "POST");
  declined(() => f.request("/accounts/demo-main/funding", "POST", input), 401);
  declined(() => f.workspace(), 401);
});

test("funding rejects fractional cents, negative amounts and oversized requests", () => {
  const f = fixture(); f.login();
  for (const value of ["0.001", "-1", "0", "NaN", "1000001"]) declined(() => f.request("/accounts/demo-main/funding", "POST", { amount: value, requestId: value }), 400);
  assert.equal(f.workspace().accounts[0]!.balance, "4784");
});

test("payments transfer exact balances to demo vendors and reject real or unknown addresses", () => {
  const f = fixture(); f.login();
  const input = { accountId: "demo-main", destination: DEMO_PAYMENT.sellerAddress, amount: "0.0000001", reference: "Smallest demo payment", requestId: "pay" };
  f.request("/payments", "POST", input);
  f.request("/payments", "POST", input);
  assert.equal(f.workspace().accounts[0]!.balance, "4783.9999999");
  assert.equal(f.workspace().accounts[1]!.balance, "84.0000001");
  declined(() => f.request("/payments", "POST", { ...input, requestId: "unknown", destination: "C_REAL_OR_UNLISTED_ACCOUNT" }), 400);
  declined(() => f.request("/payments", "POST", { ...input, requestId: "self", destination: f.workspace().accounts[0]!.address }), 400);
  declined(() => f.request("/payments", "POST", { ...input, requestId: "excess", amount: "9999999" }), 400);
});

test("mandate payments enforce budget, agent, seller and revocation without mutating balances on refusal", () => {
  const f = fixture(); f.login();
  const created = f.grant();
  const input = { ...DEMO_PAYMENT, mandateId: created.mandateId, amount: "1.25", reference: "Supplies", requestId: "purchase" };
  const paid = f.request<MandatePaymentResult>("/pay", "POST", input);
  assert.equal(paid.status, "paid");
  assert.equal(f.request<MandatePaymentResult>("/pay", "POST", input).status, "paid");
  const after = f.workspace().accounts[0]!.balance;
  for (const change of [
    { amount: "1" },
    { agentId: "agt_unknown" },
    { sellerAddress: "C_DEMO_PAPERLINE_DO_NOT_SEND_REAL_FUNDS" },
  ]) {
    const result = f.request<MandatePaymentResult>("/pay", "POST", { ...input, ...change, requestId: JSON.stringify(change) });
    assert.equal(result.status, "declined");
    assert.equal(f.workspace().accounts[0]!.balance, after);
  }
  f.request(`/mandates/${created.mandate.reference}`, "DELETE");
  assert.equal(f.request<MandatePaymentResult>("/pay", "POST", { ...input, amount: "0.1", requestId: "after-revoke" }).status, "declined");
});

test("rolling windows renew allowances and expired mandates cannot pay", () => {
  const f = fixture(); f.login();
  const grant = f.grant({ limit: "1" });
  const input = { ...DEMO_PAYMENT, mandateId: grant.mandateId, amount: "1", reference: "Daily demo purchase", requestId: "day-one" };
  assert.equal(f.request<MandatePaymentResult>("/pay", "POST", input).status, "paid");
  assert.equal(f.request<MandatePaymentResult>("/pay", "POST", { ...input, requestId: "same-day" }).status, "declined");
  f.advance(86_400_000);
  assert.equal(f.request<MandatePaymentResult>("/pay", "POST", { ...input, requestId: "next-day" }).status, "paid");
  f.advance(90 * 86_400_000);
  assert.equal(f.request<MandatePaymentResult>("/pay", "POST", { ...input, requestId: "expired" }).status, "declined");
  assert.equal(f.workspace().mandates.find(mandate => mandate.reference === grant.mandate.reference)!.status, "expired");
});

test("workflows immediately create simulated agents and mandates; removing the agent revokes access", () => {
  const f = fixture(); f.login();
  const workflow = f.request<AccountAgent>("/workflows", "POST", { name: "Demo workflow", category: "Software", sellerIds: [101], limit: "10", period: "week", expiresAt: "2027-01-01T00:00:00Z", requestId: "workflow" });
  const mandate = f.workspace().mandates.find(candidate => candidate.agentId === workflow.id)!;
  assert.equal(workflow.status, "connected");
  assert.equal(mandate.name, "Demo workflow");
  assert.equal(mandate.enforcement, undefined);
  f.request<AccountMandate>(`/mandates/${mandate.reference}`, "PATCH", { limit: "20", requestId: "limit" });
  assert.equal(f.workspace().mandates.find(candidate => candidate.reference === mandate.reference)!.limit, "20");
  f.request(`/agents/${workflow.id}`, "DELETE");
  assert.equal(f.workspace().mandates.find(candidate => candidate.reference === mandate.reference)!.status, "revoked");
});

test("local chat clarifies payment details and makes at most one simulated payment", () => {
  const f = fixture(); f.login();
  const chat = f.request<PaymentChatState>("/chat/sessions", "POST");
  const path = `/chat/sessions/${chat.sessionId}/messages`;
  assert.equal(f.request<PaymentChatState>(path, "POST", { message: "Pay 0.20 USD" }).paymentAttempted, false);
  const result = f.request<PaymentChatState>(path, "POST", { message: "to Seatwise" });
  assert.equal(result.complete, true);
  assert.equal(result.paymentResult!.status, "paid");
  assert.equal(f.workspace().accounts[0]!.balance, "4783.8");
  declined(() => f.request(path, "POST", { message: "Pay again" }), 409);
});
