// What the team's agents spent, by workflow and vendor, what the account
// refused, and every receipt. Exports a CSV for finance.
import type { CSSProperties } from "react";
import type { AccountAgent, AccountMandate, PaymentDecline, PaymentEntry, PaymentWorkspace, Vendor } from "@mandate/shared";
import { formatAmount, toBaseUnits } from "@mandate/shared";
import { SmartAccountAddress } from "./SmartAccountAddress.tsx";
import { money } from "./format.ts";

const DAYS = 30;
const units = (amount: string) => BigInt(toBaseUnits(amount));
const total = (entries: { amount?: string }[]) => formatAmount(entries.reduce((sum, entry) => sum + units(entry.amount ?? "0"), 0n).toString());
const short = (address: string) => `${address.slice(0, 5)}…${address.slice(-5)}`;

function names(workspace: PaymentWorkspace) {
  const vendors = workspace.vendors ?? [];
  return {
    vendor: (address?: string) => address ? vendors.find((vendor: Vendor) => vendor.address === address)?.name ?? `Unlisted seller ${short(address)}` : "Unknown seller",
    mandate: (reference: string | null): AccountMandate | undefined => workspace.mandates.find(mandate => mandate.reference === reference),
    agent: (id?: string): AccountAgent | undefined => workspace.agents.find(agent => agent.id === id),
  };
}

function groups<T>(items: T[], key: (item: T) => string, amount: (item: T) => string): { label: string; amount: string; share: number; count: number }[] {
  const sums = new Map<string, { amount: bigint; count: number }>();
  for (const item of items) { const group = sums.get(key(item)) ?? { amount: 0n, count: 0 }; group.amount += units(amount(item)); group.count++; sums.set(key(item), group); }
  const largest = [...sums.values()].reduce((max, group) => group.amount > max ? group.amount : max, 0n);
  return [...sums].map(([label, group]) => ({ label, amount: formatAmount(group.amount.toString()), count: group.count, share: largest > 0n ? Number(group.amount * 100n / largest) : 0 }))
    .sort((a, b) => Number(units(b.amount) - units(a.amount)));
}

function csv(workspace: PaymentWorkspace): string {
  const name = names(workspace);
  const cell = (value: string) => /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  const rows: string[][] = [["Date", "Status", "Workflow", "Category", "Agent", "Vendor", "Vendor address", "Amount", "Currency", "Reference", "Reason refused", "Stellar transaction"]];
  const paid = workspace.activity.filter(entry => entry.kind === "payment").map(entry => ({ at: entry.createdAt, row: [entry.createdAt, "Paid", name.mandate(entry.mandateReference)?.name ?? "", name.mandate(entry.mandateReference)?.category ?? "", name.agent(entry.agentId)?.name ?? "", name.vendor(entry.destination), entry.destination, entry.amount, entry.currency, entry.reference, "", entry.txHash ?? entry.id] }));
  const refused = (workspace.declines ?? []).map(decline => ({ at: decline.createdAt, row: [decline.createdAt, "Refused", name.mandate(decline.mandateReference)?.name ?? "", name.mandate(decline.mandateReference)?.category ?? "", name.agent(decline.agentId)?.name ?? "", name.vendor(decline.destination), decline.destination ?? "", decline.amount ?? "", decline.currency, decline.reference, decline.reason, ""] }));
  for (const { row } of [...paid, ...refused].sort((a, b) => b.at.localeCompare(a.at))) rows.push(row);
  return rows.map(row => row.map(cell).join(",")).join("\n");
}

function download(workspace: PaymentWorkspace) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv(workspace)], { type: "text/csv" }));
  link.download = `mandate-spending-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function Spending({ workspace }: { workspace: PaymentWorkspace }) {
  const name = names(workspace);
  const since = Date.now() - DAYS * 86400_000;
  const recent = <T extends { createdAt: string }>(items: T[]) => items.filter(item => Date.parse(item.createdAt) >= since);
  const payments = recent(workspace.activity.filter(entry => entry.kind === "payment"));
  const declines = workspace.declines ?? [];
  const recentDeclines = recent(declines);
  const byWorkflow = groups(payments, entry => name.mandate(entry.mandateReference)?.name ?? (entry.mandateReference ? "Ended mandate" : "Paid by the owner"), entry => entry.amount);
  const byVendor = groups(payments, entry => name.vendor(entry.destination), entry => entry.amount);
  const empty = workspace.activity.length === 0 && declines.length === 0;
  return <section className="spending">
    <div className="section-header agents-actions"><button className="button" disabled={empty} onClick={() => download(workspace)}>Export CSV</button></div>
    <ul className="stat-row">
      <li className="card stat"><p className="eyebrow">Spent by agents · last {DAYS} days</p><p className="stat-value">{money(total(payments), "USD")}</p><p className="muted">{payments.length} {payments.length === 1 ? "purchase" : "purchases"}</p></li>
      <li className="card stat"><p className="eyebrow">Refused by your rules</p><p className="stat-value">{recentDeclines.length}</p><p className="muted">{recentDeclines.length ? `${money(total(recentDeclines), "USD")} was not paid` : "Nothing refused"}</p></li>
      <li className="card stat"><p className="eyebrow">Active mandates</p><p className="stat-value">{workspace.mandates.filter(mandate => mandate.status === "active").length}</p><p className="muted">Each one enforced on Stellar</p></li>
    </ul>
    {payments.length > 0 && <div className="breakdowns">
      <Breakdown title="By workflow" rows={byWorkflow} />
      <Breakdown title="By vendor" rows={byVendor} />
    </div>}
    {declines.length > 0 && <section className="card"><h2 className="list-title">Refused</h2><ul className="ledger-list">{declines.map(decline => <Decline key={decline.id} decline={decline} vendor={name.vendor(decline.destination)} mandate={name.mandate(decline.mandateReference)?.name} agent={name.agent(decline.agentId)?.name} />)}</ul></section>}
    <section className="card"><h2 className="list-title">Receipts</h2>{workspace.activity.length === 0 ? <p className="empty">Funding and payments will appear here.</p> : <ul className="ledger-list">{workspace.activity.map(entry => <Receipt key={entry.id} entry={entry} workspace={workspace} vendor={name.vendor(entry.destination)} mandate={name.mandate(entry.mandateReference)?.name} agent={name.agent(entry.agentId)} />)}</ul>}</section>
  </section>;
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; amount: string; share: number; count: number }[] }) {
  return <section className="card breakdown"><h2 className="list-title">{title}</h2><ul className="bar-list">{rows.map(row => <li key={row.label}>
    <div className="bar-label"><span>{row.label}</span><strong>{money(row.amount, "USD")}</strong></div>
    <div className="bar" style={{ "--share": `${Math.max(row.share, 2)}%` } as CSSProperties} role="img" aria-label={`${row.count} ${row.count === 1 ? "purchase" : "purchases"}`} />
  </li>)}</ul></section>;
}

function Decline({ decline, vendor, mandate, agent }: { decline: PaymentDecline; vendor: string; mandate?: string; agent?: string }) {
  return <li><span className="ledger-symbol is-refused" aria-hidden="true">×</span><div className="ledger-main"><strong>{decline.reference}</strong><p className="form-error">{decline.reason}. Nothing was paid.</p><p className="muted">{[agent, mandate, vendor].filter(Boolean).join(" · ")}</p><small className="muted">{new Date(decline.createdAt).toLocaleString()}</small></div>{decline.amount && <strong className="ledger-amount is-refused">{money(decline.amount, decline.currency)}</strong>}</li>;
}

function Receipt({ entry, workspace, vendor, mandate, agent }: { entry: PaymentEntry; workspace: PaymentWorkspace; vendor: string; mandate?: string; agent?: AccountAgent }) {
  const funding = entry.kind === "funding";
  return <li><span className="ledger-symbol" aria-hidden="true">{funding ? "+" : "↗"}</span><div className="ledger-main">
    <strong>{funding ? `Account funded · ${entry.source === "Stellar testnet funding" ? "Testnet" : "FIAT"}` : entry.reference}</strong>
    <p className="muted">{funding ? workspace.accounts.find(account => account.id === entry.accountId)?.name ?? "Previous account activity" : [vendor, mandate].filter(Boolean).join(" · ")}</p>
    {entry.agentId && <p className="muted">Agent: {agent?.name ?? entry.agentId} · {entry.agentId}</p>}
    {entry.kind === "payment" && <SmartAccountAddress address={entry.destination} label="Recipient Smart Account address" />}
    <small className="muted">{new Date(entry.createdAt).toLocaleString()} · {entry.settlement === "traditional-demo" ? "Banking demo · simulated" : "Stellar testnet"}{entry.mandateReference ? " · Via mandate" : ""}</small>
    {entry.explorerUrl && <p><a className="transaction-link" href={entry.explorerUrl} target="_blank" rel="noreferrer">View transaction ↗</a></p>}
  </div><strong className="ledger-amount">{money(entry.amount, entry.currency)}</strong></li>;
}
