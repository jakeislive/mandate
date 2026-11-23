import { IS_STATIC_DEMO } from "./demo-mode.ts";

export function TestNetworkWarning({ persistent = false }: { persistent?: boolean }) {
  return <aside className={`test-network-warning${persistent ? " is-persistent" : ""}`} aria-label="Test network warning">
    <strong>Test account · test network only.</strong> Do not add real funds or connect real accounts.
    {IS_STATIC_DEMO && <span> These are real Stellar Testnet records shown as a fixed read-only snapshot. No signing keys or database are included, and this page cannot submit transactions.</span>}
  </aside>;
}
