import { snapshotData } from "./testnet-snapshot-data.ts";
import { validateSnapshot, type TestnetSnapshot } from "./testnet-snapshot-types.ts";

// Public demo login: this selects a public read-only view, not a real wallet.
export const DEMO_LOGIN = Object.freeze({ email: "test@testing.com", password: "testing1234567890", name: "TUser" });
export const DEMO_SESSION_KEY = "mandate.testnet-snapshot.session";
export const READ_ONLY_MESSAGE = "This page displays fixed real Stellar Testnet records. Creating accounts or mandates, funding, payments, and chat are disabled.";
interface SessionStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

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

/** Fixed public records plus a one-character login flag. No record storage or caches. */
export function createDemo(session: SessionStorage) {
  const customer = Object.freeze({ id: "testnet-public-view", name: DEMO_LOGIN.name, email: DEMO_LOGIN.email });
  return {
    request(path: string, method = "GET", body: Record<string, unknown> = {}): unknown {
      if (path === "/auth/register") throw new DemoError(403, "Account creation is disabled. Use the login button.");
      if (path === "/auth/login" && method === "POST") {
        if (body.email !== DEMO_LOGIN.email || body.password !== DEMO_LOGIN.password) throw new DemoError(401, "Email or password is incorrect");
        session.setItem(DEMO_SESSION_KEY, "1");
        return { ...customer };
      }
      if (path === "/auth/logout" && method === "POST") { session.setItem(DEMO_SESSION_KEY, "0"); return undefined; }
      // Reject every mutation before reading or serializing its body. No request
      // journal, chat sessions, user arrays, or transaction cache can grow.
      if (method !== "GET") throw new DemoError(405, READ_ONLY_MESSAGE);
      if (path === "/network") return { mode: "stellar-testnet", network: {
        id: TESTNET_SNAPSHOT.network, name: "Stellar Testnet · fixed snapshot",
        currency: "USD", rpcUrl: TESTNET_SNAPSHOT.rpcUrl, horizonUrl: TESTNET_SNAPSHOT.horizonUrl,
        explorerUrl: TESTNET_SNAPSHOT.explorerUrl, tokenContract: TESTNET_SNAPSHOT.asset.contract,
        smartAccounts: true, verifiedSmartAccounts: true, mandates: true, faucet: false,
      } };
      if (path === "/snapshot") {
        if (session.getItem(DEMO_SESSION_KEY) !== "1") throw new DemoError(401, "Use the login button to view the Testnet records");
        return structuredClone(TESTNET_SNAPSHOT);
      }
      throw new DemoError(404, "Only the fixed Testnet snapshot is available");
    },
  };
}
