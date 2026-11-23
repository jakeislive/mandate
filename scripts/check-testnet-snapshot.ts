import assert from "node:assert/strict";
import { StrKey } from "@stellar/stellar-sdk";
import { snapshotData } from "../apps/web/src/testnet-snapshot-data.ts";
import { validateSnapshot } from "../apps/web/src/testnet-snapshot-types.ts";

const snapshot = validateSnapshot(snapshotData);
assert.equal(StrKey.isValidContract(snapshot.asset.contract), true);
for (const account of snapshot.accounts) assert.equal(StrKey.isValidContract(account.address), true);
for (const mandate of snapshot.mandates) for (const publicKey of mandate.signerPublicKeys) assert.equal(StrKey.isValidEd25519PublicKey(publicKey), true);
console.log(`Public Testnet snapshot validated: ${snapshot.accounts.length} accounts, ${snapshot.mandates.length} mandates, ${snapshot.transactions.length} confirmed receipts; all within 5/5/5 limits.`);
