export const SNAPSHOT_LIMITS = Object.freeze({ accounts: 5, mandates: 5, transactionsPerAccount: 5 });

export interface TestnetSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  ledger: number;
  network: "stellar:testnet";
  rpcUrl: string;
  horizonUrl: string;
  explorerUrl: string;
  asset: { code: "USD"; contract: string };
  accounts: { address: string; label: string; balance: string; verifiedRecipient: boolean }[];
  mandates: {
    account: string;
    ruleId: number;
    name: string;
    limit: string;
    spent: string;
    periodLedgers: number;
    validUntilLedger: number | null;
    policies: string[];
    signerPublicKeys: string[];
    approvedSellers: string[] | null;
  }[];
  transactions: {
    hash: string;
    from: string;
    to: string;
    amount: string;
    ledger: number;
    closedAt: string;
    ruleId: number;
    successful: true;
  }[];
}

/** Fail closed before publishing or displaying an oversized snapshot. */
export function validateSnapshot(snapshot: TestnetSnapshot): TestnetSnapshot {
  const require = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  require(snapshot.schemaVersion === 1 && snapshot.network === "stellar:testnet", "Only Stellar Testnet snapshots are allowed");
  require(Number.isSafeInteger(snapshot.ledger) && snapshot.ledger > 0 && Number.isFinite(Date.parse(snapshot.capturedAt)), "A verified ledger and timestamp are required");
  require(snapshot.accounts.length > 0 && snapshot.accounts.length <= SNAPSHOT_LIMITS.accounts, "Maximum 5 accounts per user");
  require(snapshot.mandates.length <= SNAPSHOT_LIMITS.mandates, "Maximum 5 mandates per user");
  require(snapshot.transactions.length <= SNAPSHOT_LIMITS.accounts * SNAPSHOT_LIMITS.transactionsPerAccount, "Snapshot transaction limit exceeded");
  const addresses = new Set<string>();
  const counts = new Map<string, number>();
  for (const account of snapshot.accounts) {
    require(/^C[A-Z2-7]{55}$/.test(account.address) && !addresses.has(account.address), "A unique real contract address is required");
    require(/^\d+(\.\d{1,7})?$/.test(account.balance), "Invalid account balance");
    addresses.add(account.address); counts.set(account.address, 0);
  }
  const rules = new Set<string>();
  for (const mandate of snapshot.mandates) {
    const key = `${mandate.account}:${mandate.ruleId}`;
    require(addresses.has(mandate.account) && !rules.has(key), "Mandates must belong to a listed account and have unique rule IDs");
    require(mandate.policies.length <= 5 && mandate.signerPublicKeys.length <= 5 && (!mandate.approvedSellers || mandate.approvedSellers.length <= 5), "Mandate metadata limit exceeded");
    rules.add(key);
  }
  const hashes = new Set<string>();
  for (const transaction of snapshot.transactions) {
    require(/^[a-f0-9]{64}$/.test(transaction.hash) && !hashes.has(transaction.hash), "Unique transaction hashes are required");
    require(transaction.successful === true && addresses.has(transaction.from) && addresses.has(transaction.to), "Only confirmed transactions between listed accounts are allowed");
    require(rules.has(`${transaction.from}:${transaction.ruleId}`), "Transaction mandate rule is missing");
    require(Number.isSafeInteger(transaction.ledger) && transaction.ledger <= snapshot.ledger, "Transaction ledger must precede the snapshot");
    hashes.add(transaction.hash);
    // A transfer counts toward both participating accounts' limits.
    for (const address of new Set([transaction.from, transaction.to])) {
      const count = (counts.get(address) ?? 0) + 1;
      require(count <= SNAPSHOT_LIMITS.transactionsPerAccount, "Maximum 5 transactions per account");
      counts.set(address, count);
    }
  }
  require(new TextEncoder().encode(JSON.stringify(snapshot)).byteLength <= 65_536, "Snapshot exceeds the 64 KB public-data limit");
  return snapshot;
}
