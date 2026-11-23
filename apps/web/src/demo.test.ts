import assert from "node:assert/strict";
import test from "node:test";
import { StrKey } from "@stellar/stellar-sdk";
import { createDemo, DEMO_LOGIN, DemoError, TESTNET_SNAPSHOT } from "./demo.ts";
import { SNAPSHOT_LIMITS, validateSnapshot } from "./testnet-snapshot-types.ts";

function fixture() {
  return { demo: createDemo() };
}
const denied = (work: () => unknown, status: number) => assert.throws(work, error => error instanceof DemoError && error.status === status);

test("the snapshot contains real-format Testnet contracts, signer keys, and confirmed transfer hashes", () => {
  assert.equal(TESTNET_SNAPSHOT.network, "stellar:testnet");
  assert.equal(TESTNET_SNAPSHOT.accounts.length, 2);
  assert.equal(TESTNET_SNAPSHOT.mandates.length, 2);
  assert.equal(TESTNET_SNAPSHOT.transactions.length, 3);
  for (const account of TESTNET_SNAPSHOT.accounts) assert.equal(StrKey.isValidContract(account.address), true);
  for (const mandate of TESTNET_SNAPSHOT.mandates) for (const signer of mandate.signerPublicKeys) assert.equal(StrKey.isValidEd25519PublicKey(signer), true);
  assert.deepEqual(TESTNET_SNAPSHOT.transactions.map(tx => tx.amount), ["15", "12", "1"]);
  for (const tx of TESTNET_SNAPSHOT.transactions) {
    assert.match(tx.hash, /^[a-f0-9]{64}$/);
    assert.equal(tx.successful, true);
    assert.ok(tx.ledger <= TESTNET_SNAPSHOT.ledger);
  }
  assert.equal(TESTNET_SNAPSHOT.accounts[0]!.balance, "72");
});

test("the public view opens without login; signup and authentication actions are disabled", () => {
  const f = fixture();
  assert.deepEqual(f.demo.request("/snapshot"), TESTNET_SNAPSHOT);
  denied(() => f.demo.request("/auth/register", "POST", DEMO_LOGIN), 403);
  denied(() => f.demo.request("/auth/login", "POST", DEMO_LOGIN), 405);
  denied(() => f.demo.request("/auth/logout", "POST"), 405);
});

test("a fresh public view needs no session state", () => {
  assert.deepEqual(createDemo().request("/snapshot"), TESTNET_SNAPSHOT);
});

test("snapshot results cannot mutate the immutable embedded records", () => {
  const f = fixture();
  const copy = f.demo.request("/snapshot") as typeof TESTNET_SNAPSHOT;
  copy.accounts[0]!.balance = "999999";
  copy.transactions.length = 0;
  assert.deepEqual(f.demo.request("/snapshot"), TESTNET_SNAPSHOT);
  assert.equal(Object.isFrozen(TESTNET_SNAPSHOT), true);
  assert.equal(Object.isFrozen(TESTNET_SNAPSHOT.accounts), true);
  assert.equal(Object.isFrozen(TESTNET_SNAPSHOT.accounts[0]), true);
});

test("mutation attempts never create account, mandate, transaction, request, agent or chat collections", () => {
  const f = fixture();
  const paths = ["/accounts/open", "/accounts/test/funding", "/mandates", "/agents", "/workflows", "/payments", "/pay", "/chat/sessions", "/chat/sessions/x/messages"];
  const unsupported = { requestId: "malicious-request", amount: "1000000", name: "Attempted creation" };
  for (let i = 0; i < 100; i++) for (const path of paths) denied(() => f.demo.request(path, "POST", unsupported), 405);
  denied(() => f.demo.request("/profile", "PATCH", unsupported), 405);
  denied(() => f.demo.request("/mandates/example", "DELETE"), 405);
  denied(() => f.demo.request("/accounts", "GET"), 404);
  assert.deepEqual(f.demo.request("/snapshot"), TESTNET_SNAPSHOT);
});

test("the public snapshot refuses more than five accounts per user", () => {
  const snapshot = structuredClone(TESTNET_SNAPSHOT);
  while (snapshot.accounts.length < 6) snapshot.accounts.push({ ...snapshot.accounts[0]!, address: StrKey.encodeContract(Buffer.alloc(32, snapshot.accounts.length)) });
  assert.throws(() => validateSnapshot(snapshot), /Maximum 5 accounts per user/);
  snapshot.accounts.pop();
  assert.equal(validateSnapshot(snapshot).accounts.length, SNAPSHOT_LIMITS.accounts);
});

test("the public snapshot refuses more than five mandates per user", () => {
  const snapshot = structuredClone(TESTNET_SNAPSHOT);
  while (snapshot.mandates.length < 6) snapshot.mandates.push({ ...snapshot.mandates[0]!, ruleId: 100 + snapshot.mandates.length });
  assert.throws(() => validateSnapshot(snapshot), /Maximum 5 mandates per user/);
  snapshot.mandates.pop();
  assert.equal(validateSnapshot(snapshot).mandates.length, SNAPSHOT_LIMITS.mandates);
});

test("the fifth transaction is allowed and the sixth is refused for both source and recipient", () => {
  const snapshot = structuredClone(TESTNET_SNAPSHOT);
  while (snapshot.transactions.length < 5) snapshot.transactions.push({ ...snapshot.transactions[0]!, hash: snapshot.transactions.length.toString(16).padStart(64, "0") });
  assert.equal(validateSnapshot(snapshot).transactions.length, 5);
  snapshot.transactions.push({ ...snapshot.transactions[0]!, hash: "f".repeat(64) });
  assert.throws(() => validateSnapshot(snapshot), /Maximum 5 transactions per account/);
});

test("incoming transfers cannot exceed the recipient's cap by using several source accounts", () => {
  const snapshot = structuredClone(TESTNET_SNAPSHOT);
  const other = StrKey.encodeContract(Buffer.alloc(32, 9));
  snapshot.accounts.push({ ...snapshot.accounts[0]!, address: other });
  snapshot.mandates.push({ ...snapshot.mandates[1]!, account: other });
  for (let i = 0; i < 3; i++) snapshot.transactions.push({ ...snapshot.transactions[0]!, from: other, hash: (10 + i).toString(16).padStart(64, "0") });
  assert.throws(() => validateSnapshot(snapshot), /Maximum 5 transactions per account/);
});

test("failed, duplicate, foreign-network and oversized snapshot records fail closed", () => {
  const failed = structuredClone(TESTNET_SNAPSHOT);
  (failed.transactions[0] as unknown as { successful: boolean }).successful = false;
  assert.throws(() => validateSnapshot(failed), /Only confirmed/);
  const duplicate = structuredClone(TESTNET_SNAPSHOT);
  duplicate.transactions.push({ ...duplicate.transactions[0]! });
  assert.throws(() => validateSnapshot(duplicate), /Unique transaction hashes/);
  const mainnet = { ...structuredClone(TESTNET_SNAPSHOT), network: "stellar:pubnet" } as unknown as typeof TESTNET_SNAPSHOT;
  assert.throws(() => validateSnapshot(mainnet), /Only Stellar Testnet/);
  const oversized = structuredClone(TESTNET_SNAPSHOT);
  oversized.accounts[0]!.label = "x".repeat(70_000);
  assert.throws(() => validateSnapshot(oversized), /64 KB/);
  oversized.accounts[0]!.label = "€".repeat(25_000);
  assert.throws(() => validateSnapshot(oversized), /64 KB/);
});
