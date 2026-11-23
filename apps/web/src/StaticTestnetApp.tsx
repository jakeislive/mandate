import { useEffect, useState, type MouseEvent } from "react";
import { DEMO_LOGIN, READ_ONLY_MESSAGE, TESTNET_SNAPSHOT } from "./demo.ts";
import { SNAPSHOT_LIMITS, type TestnetSnapshot } from "./testnet-snapshot-types.ts";
import { SmartAccountAddress } from "./SmartAccountAddress.tsx";
import { TestNetworkWarning } from "./TestNetworkWarning.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { Logo } from "./icons.tsx";
import { money } from "./format.ts";

const date = (value: string) => new Date(value).toLocaleString();
const transactionsFor = (snapshot: TestnetSnapshot, address: string) => snapshot.transactions.filter(tx => tx.from === address || tx.to === address);

export function StaticTestnetApp() {
  const snapshot = TESTNET_SNAPSHOT;
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const navigate = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (!link || link.origin !== window.location.origin || link.target || link.hasAttribute("download")) return;
    event.preventDefault();
    if (link.pathname !== window.location.pathname) window.history.pushState(null, "", link.href);
    setPathname(link.pathname);
    window.scrollTo(0, 0);
  };
  const path = pathname.replace(/\/$/, "");
  const page = path === "/mandates" ? "mandates" : path === "/spending" || path === "/activity" ? "transactions" : path === "/agents" ? "signers" : path === "/pay" || path === "/chat" ? "readonly" : "accounts";
  return <><TestNetworkWarning persistent /><div className="page payment-page snapshot-page" onClick={navigate}>
    <header className="glass topbar"><a className="brand" href="/"><Logo />Mandate</a><div className="topbar-side"><span className="snapshot-user-id">User ID: {DEMO_LOGIN.name}</span><ThemeToggle /></div></header>
    <main className="testnet-snapshot">
      <nav className="glass workspace-tabs" aria-label="Workspace"><a href="/" aria-current={page === "accounts" ? "page" : undefined}>Accounts {snapshot.accounts.length}</a><a href="/mandates" aria-current={page === "mandates" ? "page" : undefined}>Mandates {snapshot.mandates.length}</a><a href="/spending" aria-current={page === "transactions" ? "page" : undefined}>Transactions {snapshot.transactions.length}</a><a href="/agents" aria-current={page === "signers" ? "page" : undefined}>Signer keys</a></nav>
      {page === "accounts" && <section aria-label="Testnet accounts"><div className="section-header"><h2>Accounts</h2><p className="muted">{snapshot.accounts.length} / {SNAPSHOT_LIMITS.accounts} maximum</p></div><ul className="agent-grid">{snapshot.accounts.map(account => <li className="card agent-card" key={account.address}>
        <h3>{account.label}</h3><p className="parent-amount">{money(account.balance, "USD")}</p><p className="verified">Verified Testnet Smart Account</p>
        <p className="muted">USD balance observed during verification · {transactionsFor(snapshot, account.address).length} / {SNAPSHOT_LIMITS.transactionsPerAccount} included transactions</p>
        <SmartAccountAddress address={account.address} />
        <a className="transaction-link" href={`${snapshot.explorerUrl}/contract/${account.address}`} target="_blank" rel="noreferrer">View account on Stellar ↗</a>
        {snapshot.mandates.some(mandate => mandate.account === account.address) && <a className="button" href="/mandates">View mandates</a>}
        <div className="account-buttons"><button className="button" disabled>Add funds</button><button className="button" disabled>Make payment</button></div>
      </li>)}</ul></section>}
      {page === "mandates" && <section aria-label="Testnet mandates"><div className="section-header"><h2>Mandates</h2><p className="muted">{snapshot.mandates.length} / {SNAPSHOT_LIMITS.mandates} maximum</p></div><p className="form-note">These are actual context rules read from the purchasing Smart Account. Creation and changes are disabled in this static view.</p><ul className="agent-grid">{snapshot.mandates.map(mandate => <li className="card agent-card" key={`${mandate.account}:${mandate.ruleId}`}>
        <h3>{mandate.name}</h3><span className="pill">{mandate.validUntilLedger === null || mandate.validUntilLedger > snapshot.ledger ? "Active at snapshot" : "Expired at snapshot"}</span>
        <p className="parent-amount">{money(mandate.limit, "USD")} limit</p><p className="muted">{money(mandate.spent, "USD")} spent in the current {mandate.periodLedgers.toLocaleString()}-ledger window</p>
        <p className="muted">Rule {mandate.ruleId} · {mandate.validUntilLedger === null ? "No ledger expiry" : `Expires at ledger ${mandate.validUntilLedger}`}</p>
        <SmartAccountAddress address={mandate.account} label="Source Smart Account address" />
        <p className="muted">{mandate.approvedSellers?.length ? `${mandate.approvedSellers.length} approved seller addresses on chain` : "Any recipient verified by the installed seller registry"}</p>
        <a className="transaction-link" href={`${snapshot.explorerUrl}/contract/${mandate.account}`} target="_blank" rel="noreferrer">View account and rules on Stellar ↗</a>
      </li>)}</ul></section>}
      {page === "transactions" && <section aria-label="Confirmed Testnet transactions"><div className="section-header"><h2>Transactions</h2><button className="button" onClick={() => download(snapshot)}>Export CSV</button></div><p className="form-note">Every receipt below was confirmed successful on Stellar Testnet. A transfer counts toward both participating accounts' five-transaction limits.</p><ul className="agent-grid">{snapshot.transactions.map(tx => <li className="card agent-card" key={tx.hash}>
        <h3>{money(tx.amount, "USD")} transferred</h3><span className="verified">Confirmed on Stellar Testnet</span>
        <p className="muted">{date(tx.closedAt)} · ledger {tx.ledger} · mandate rule {tx.ruleId}</p>
        <SmartAccountAddress address={tx.from} label="Source Smart Account address" /><SmartAccountAddress address={tx.to} label="Recipient Smart Account address" />
        <p className="snapshot-hash">{tx.hash}</p><a className="transaction-link" href={`${snapshot.explorerUrl}/tx/${tx.hash}`} target="_blank" rel="noreferrer">View confirmed transaction ↗</a>
      </li>)}</ul></section>}
      {page === "signers" && <section><h2>On-chain signer public keys</h2><p className="form-note">Public keys read from the actual mandate rules. No private keys or agent credentials are included.</p><ul className="agent-grid">{snapshot.mandates.map(mandate => <li className="card agent-card" key={mandate.ruleId}><h3>{mandate.name} · rule {mandate.ruleId}</h3>{mandate.signerPublicKeys.map(key => <code className="snapshot-hash" key={key}>{key}</code>)}</li>)}</ul></section>}
      {page === "readonly" && <section className="card snapshot-summary"><h2>Read-only Testnet snapshot</h2><p>{READ_ONLY_MESSAGE}</p><a className="button" href="/spending">View confirmed transactions</a></section>}
    </main>
  </div></>;
}

function download(snapshot: TestnetSnapshot) {
  const rows = [["Date", "Network", "Transaction hash", "From", "To", "Amount", "Currency", "Ledger", "Mandate rule"], ...snapshot.transactions.map(tx => [tx.closedAt, snapshot.network, tx.hash, tx.from, tx.to, tx.amount, "USD", String(tx.ledger), String(tx.ruleId)])];
  const data = rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
  const link = document.createElement("a"); link.href = url; link.download = "mandate-testnet-snapshot.csv"; link.click(); URL.revokeObjectURL(url);
}
