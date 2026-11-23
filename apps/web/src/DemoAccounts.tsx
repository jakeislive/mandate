import type { SpendingAccount } from "@mandate/shared";
import { money } from "./format.ts";
import { SmartAccountAddress } from "./SmartAccountAddress.tsx";

export function DemoAccounts({ accounts }: { accounts: SpendingAccount[] }) {
  return <section className="demo-accounts" aria-label="Demo vendor accounts">
    <div className="section-header"><div><h2>Demo vendor accounts</h2><p className="muted">Static test accounts for exploring payments. Addresses cannot receive real funds.</p></div></div>
    <ul className="agent-grid">{accounts.map(account => <li className="card agent-card" key={account.id}>
      <h3>{account.name}</h3><p className="parent-amount">{money(account.balance, "USD")}</p>
      <p className="muted">Simulated balance · seller ID {account.sellerId}</p>
      <SmartAccountAddress address={account.address!} label={`${account.name} demo address`} />
    </li>)}</ul>
  </section>;
}
