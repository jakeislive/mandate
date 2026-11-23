// Read-only, explicit preparation step. No keys, signing, database, or runtime API.
// Writes a public snapshot only after every account, mandate, and receipt verifies.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { Account, Address, Keypair, Networks, Operation, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { formatAmount } from "../packages/shared/src/index.ts";
import { validateSnapshot, type TestnetSnapshot } from "../apps/web/src/testnet-snapshot-types.ts";

const rpcUrl = "https://soroban-testnet.stellar.org";
const horizonUrl = "https://horizon-testnet.stellar.org";
const explorerUrl = "https://stellar.expert/explorer/testnet";
const account = "CAJZQP2GAWMOWBF65MAVZ6VTY65QKENH6MUOISXA6QI3IGFKU6ZAZQ6S";
const seller = "CCS3FRLJ7CX75NJWVNVVZ2TN6CPJTRCTMCD5SEQGP2KXGROFY6M5M5R2";
const token = "CAF5YGTPPQFX3EYSEYTBI46CASCALCNPGQK3HYFQSPCBZVQKETQCMTJQ";
const spendingPolicy = "CAVIDSIO5AX65326A4KEZMAOSJXNRIRLNKKQTSGJU2F4DF43GKKNUOJT";
const recipientPolicy = "CBR4M66YAZTBATCMGPOTYE2T5WAU6MKURKMOGF6VWSFCS757VPX6L2FZ";
const hashes = [
  "10532a2f934551836d42a2be16edf9c148fcd9cceb1d8dc3b2cecac199c09d4c",
  "3ead1926357a75b15cbf0278b137598f95db8f5b9f092749b0af7a523e29fb67",
  "e251996cdcfbcac84195996d71ed5e7c9ef834f7b17f7a4312eea94a3fa0d2d3",
];
const server = new rpc.Server(rpcUrl, { timeout: 20_000 });
async function json(path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${horizonUrl}${path}`, { signal: AbortSignal.timeout(20_000) });
  assert.ok(response.ok, `Horizon request failed (${response.status}): ${path}`);
  return await response.json() as Record<string, unknown>;
}
async function read<T>(contract: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
  // Synthetic public source for an unsigned read-only simulation, never funded.
  const tx = new TransactionBuilder(new Account(Keypair.random().publicKey(), "0"), { fee: "100", networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.invokeContractFunction({ contract, function: method, args })).setTimeout(30).build();
  const simulation = await server.simulateTransaction(tx);
  assert.ok(!rpc.Api.isSimulationError(simulation) && simulation.result, `Cannot read ${method}`);
  return scValToNative(simulation.result.retval) as T;
}
interface Rule { id: number; name: string; context_type: string[]; policies: string[]; signers: [string, string, Buffer][]; valid_until: number | null }
interface Spending { spending_limit: bigint; period_ledgers: number; spending_history: { amount: bigint; ledger_sequence: number }[] }

assert.equal((await server.getNetwork()).passphrase, Networks.TESTNET);
assert.equal((await json("/")).network_passphrase, Networks.TESTNET);
assert.match(await read<string>(token, "symbol"), /^USD(?::|$)/);
assert.equal(await read<number>(token, "decimals"), 7);
const latest = await server.getLatestLedger();
const mandates: TestnetSnapshot["mandates"] = [];
const histories = new Map<number, Spending["spending_history"]>();
let registry: string | undefined;
for (const ruleId of [2, 3]) {
  const rule = await read<Rule>(account, "get_context_rule", [nativeToScVal(ruleId, { type: "u32" })]);
  assert.equal(rule.context_type[0], "CallContract"); assert.equal(rule.context_type[1], token);
  assert.ok(rule.policies.includes(spendingPolicy) && rule.policies.includes(recipientPolicy));
  const spending = await read<Spending>(spendingPolicy, "get_spending_limit_data", [nativeToScVal(ruleId, { type: "u32" }), Address.fromString(account).toScVal()]);
  const key = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
    contract: Address.fromString(recipientPolicy).toScAddress(),
    key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Registry"), Address.fromString(account).toScVal(), nativeToScVal(ruleId, { type: "u32" })]),
    durability: xdr.ContractDataDurability.persistent(),
  }));
  const params = await server.getLedgerEntries(key);
  assert.equal(params.entries.length, 1, "Recipient policy must be installed");
  const recipient = scValToNative(params.entries[0]!.val.contractData().val()) as { registry: string; sellers?: string[] | null };
  registry ??= recipient.registry; assert.equal(registry, recipient.registry);
  const signerPublicKeys = rule.signers.map(signer => {
    const details = scValToNative(xdr.ScVal.fromXDR(signer[2])) as { account: string; public_key: Buffer };
    assert.equal(details.account, account);
    return StrKey.encodeEd25519PublicKey(details.public_key);
  });
  const spent = spending.spending_history.filter(entry => entry.ledger_sequence > latest.sequence - spending.period_ledgers).reduce((sum, entry) => sum + entry.amount, 0n);
  histories.set(ruleId, spending.spending_history);
  mandates.push({ account, ruleId, name: rule.name, limit: formatAmount(spending.spending_limit.toString()), spent: formatAmount(spent.toString()), periodLedgers: spending.period_ledgers, validUntilLedger: rule.valid_until, policies: rule.policies, signerPublicKeys, approvedSellers: recipient.sellers ?? null });
}
assert.ok(registry);
const accounts: TestnetSnapshot["accounts"] = [];
for (const [address, label] of [[account, "Purchasing Smart Account"], [seller, "Recipient Smart Account"]]) {
  await server.getContractInstance(address!);
  const balance = await read<bigint>(token, "balance", [Address.fromString(address!).toScVal()]);
  const verifiedRecipient: boolean = await read<boolean>(registry, "is_verified", [Address.fromString(address!).toScVal()]);
  assert.equal(verifiedRecipient, true, "Snapshot account must be a verified recipient");
  accounts.push({ address: address!, label: label!, balance: formatAmount(balance.toString()), verifiedRecipient });
}
const transactions: TestnetSnapshot["transactions"] = [];
for (const hash of hashes) {
  const receipt = await json(`/transactions/${hash}`);
  assert.equal(receipt.hash, hash); assert.equal(receipt.successful, true);
  const envelope = String(receipt.envelope_xdr);
  assert.equal(TransactionBuilder.fromXDR(envelope, Networks.TESTNET).hash().toString("hex"), hash);
  const decoded = xdr.TransactionEnvelope.fromXDR(envelope, "base64");
  assert.equal(decoded.switch().name, "envelopeTypeTx");
  const operations = decoded.v1().tx().operations(); assert.equal(operations.length, 1);
  assert.equal(operations[0]!.body().switch().name, "invokeHostFunction");
  const host = operations[0]!.body().invokeHostFunctionOp().hostFunction();
  assert.equal(host.switch().name, "hostFunctionTypeInvokeContract");
  const call = host.invokeContract();
  assert.equal(Address.fromScAddress(call.contractAddress()).toString(), token);
  assert.equal(call.functionName().toString(), "transfer"); assert.equal(call.args().length, 3);
  const [from, to, value] = call.args();
  assert.equal(Address.fromScVal(from!).toString(), account); assert.equal(Address.fromScVal(to!).toString(), seller);
  const amount = BigInt(scValToNative(value!) as bigint);
  const ledger = Number(receipt.ledger);
  assert.ok(histories.get(3)!.some(entry => entry.ledger_sequence === ledger && entry.amount === amount), "Transfer must match the mandate's on-chain spending history");
  transactions.push({ hash, from: account, to: seller, amount: formatAmount(amount.toString()), ledger, closedAt: String(receipt.created_at), ruleId: 3, successful: true });
}
const verified = await server.getLatestLedger();
const capturedAt = new Date(Number(verified.closeTime) * 1000).toISOString();
const snapshot = validateSnapshot({ schemaVersion: 1, capturedAt, ledger: verified.sequence, network: "stellar:testnet", rpcUrl, horizonUrl, explorerUrl, asset: { code: "USD", contract: token }, accounts, mandates, transactions: transactions.sort((a, b) => b.ledger - a.ledger) });
const output = new URL("../apps/web/src/testnet-snapshot-data.ts", import.meta.url);
writeFileSync(output, `// Public records verified by scripts/snapshot-testnet.ts. No signing keys.\nimport type { TestnetSnapshot } from "./testnet-snapshot-types.ts";\n\nexport const snapshotData: TestnetSnapshot = ${JSON.stringify(snapshot, null, 2)};\n`);
console.log(`Verified Testnet snapshot: ${accounts.length} accounts, ${mandates.length} mandates, ${transactions.length} successful transfers. Ledger ${verified.sequence}; ${capturedAt}.`);
