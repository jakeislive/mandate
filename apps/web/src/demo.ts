import { snapshotData } from "./testnet-snapshot-data.ts";
import { validateSnapshot, type TestnetSnapshot } from "./testnet-snapshot-types.ts";

// Demo credentials for the optional live-service workspace.
export const DEMO_LOGIN = Object.freeze({ email: "test@testing.com", password: "testing1234567890", name: "TUser" });
export const READ_ONLY_MESSAGE = "This page displays fixed real Stellar Testnet records. Creating accounts or mandates, funding, payments, and chat are disabled.";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export const TESTNET_SNAPSHOT: TestnetSnapshot = freeze(validateSnapshot(snapshotData));
export class DemoError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Fixed public records. No login, record storage, or caches. */
export function createDemo() {
  return {
    request(path: string, method = "GET", body: Record<string, unknown> = {}): unknown {
      if (path === "/auth/register") throw new DemoError(403, "Account creation is disabled.");
      // Reject every mutation before reading or serializing its body. No request
      // journal, chat sessions, user arrays, or transaction cache can grow.
      if (method !== "GET") throw new DemoError(405, READ_ONLY_MESSAGE);
      if (path === "/network") return { mode: "stellar-testnet", network: {
        id: TESTNET_SNAPSHOT.network, name: "Stellar Testnet · fixed snapshot",
        currency: "USD", rpcUrl: TESTNET_SNAPSHOT.rpcUrl, horizonUrl: TESTNET_SNAPSHOT.horizonUrl,
        explorerUrl: TESTNET_SNAPSHOT.explorerUrl, tokenContract: TESTNET_SNAPSHOT.asset.contract,
        smartAccounts: true, verifiedSmartAccounts: true, mandates: true, faucet: false,
      } };
      if (path === "/snapshot") return structuredClone(TESTNET_SNAPSHOT);
      throw new DemoError(404, "Only the fixed Testnet snapshot is available");
    },
  };
}
