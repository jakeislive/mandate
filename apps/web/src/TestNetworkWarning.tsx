import { IS_STATIC_DEMO } from "./demo-mode.ts";

export function TestNetworkWarning({ persistent = false }: { persistent?: boolean }) {
  return <aside className={`test-network-warning${persistent ? " is-persistent" : ""}`} aria-label="Test network warning">
    <strong>Test account · test network only.</strong> Do not add real funds or connect real accounts.
    {IS_STATIC_DEMO && <span> Real Stellar Testnet records · read-only snapshot.</span>}
  </aside>;
}
