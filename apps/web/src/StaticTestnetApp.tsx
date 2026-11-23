import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api.ts";
import { DEMO_LOGIN, READ_ONLY_MESSAGE } from "./demo.ts";
import { SNAPSHOT_LIMITS, type TestnetSnapshot } from "./testnet-snapshot-types.ts";
import { SignIn } from "./SignIn.tsx";
import { SmartAccountAddress } from "./SmartAccountAddress.tsx";
import { TestNetworkWarning } from "./TestNetworkWarning.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { Logo } from "./icons.tsx";
import { money } from "./format.ts";

const date = (value: string) => new Date(value).toLocaleString();
const transactionsFor = (snapshot: TestnetSnapshot, address: string) => snapshot.transactions.filter(tx => tx.from === address || tx.to === address);

export function StaticTestnetApp() {
  const [snapshot, setSnapshot] = useState<TestnetSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setSnapshot(await api.testnetSnapshot()); setError(""); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) setSnapshot(undefined);
      else setError(cause instanceof Error ? cause.message : "Could not open the Testnet snapshot");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const logout = async () => {
    try { await api.logout(); setSnapshot(undefined); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign out"); }
  };
  const path = window.location.pathname.replace(/\/$/, "");
  const page = path === "/mandates" ? "mandates" : path === "/spending" || path === "/activity" ? "transactions" : path === "/agents" ? "signers" : path === "/pay" || path === "/chat" ? "readonly" : "accounts";
  return <><TestNetworkWarning persistent /><div className="page payment-page">
    <header className="glass topbar"><a className="brand" href="/"><Logo />Mandate</a><div className="topbar-side"><span className="pill">Stellar Testnet · snapshot</span>{snapshot && <><span className="owner"><span className="owner-name">{DEMO_LOGIN.name}</span></span><button className="button is-quiet" onClick={() => void logout()}>Sign out</button></>}<ThemeToggle /></div></header>
    {error && <p className="banner is-bad" role="alert">{error}</p>}
    {loading ? <p className="loading muted">Opening Testnet snapshot…</p> : !snapshot ? <SignIn onSignedIn={load} /> : <main className="testnet-snapshot">
      <section className="card snapshot-summary" aria-label="Snapshot verification">
        <p className="eyebrow">REAL TESTNET RECORDS · READ ONLY</p><h1>Testnet purchasing workspace</h1>
        <p>Public smart accounts, mandate rules, and successful transfers verified on Stellar Testnet. This is a fixed snapshot, not a live balance.</p>
        <p className="muted">USD is a Testnet token for demonstration; it is not redeemable money.</p>
        <p className="muted">Verified <time dateTime={snapshot.capturedAt}>{date(snapshot.capturedAt)}</time> · ledger {snapshot.ledger}</p>
        <p className="muted">TUser is the demo view label. Signing in does not grant control of these accounts.</p>
        <p className="snapshot-limits">Maximum per user: {SNAPSHOT_LIMITS.accounts} accounts · {SNAPSHOT_LIMITS.mandates} mandates · {SNAPSHOT_LIMITS.transactionsPerAccount} transactions per account.</p>
        <p className="muted">Included: {snapshot.accounts.length} accounts · {snapshot.mandates.length} mandates · {snapshot.transactions.length} distinct transactions. Records cannot be added from this page.</p>
      </section>
      <nav className="glass workspace-tabs" aria-label="Workspace"><a href="/" aria-current={page === "accounts" ? "page" : undefined}>Accounts {snapshot.accounts.length}</a><a href="/mandates" aria-current={page === "mandates" ? "page" : undefined}>Mandates {snapshot.mandates.length}</a><a href="/spending" aria-current={page === "transactions" ? "page" : undefined}>Transactions {snapshot.transactions.length}</a><a href="/agents" aria-current={page === "signers" ? "page" : undefined}>Signer keys</a></nav>
      {page === "accounts" && <section aria-label="Testnet accounts"><div className="section-header"><h2>Accounts</h2><p className="muted">{snapshot.accounts.length} / {SNAPSHOT_LIMITS.accounts} maximum</p></div><ul className="agent-grid">{snapshot.accounts.map(account => <li className="card agent-card" key={account.address}>
        <h3>{account.label}</h3><p className="parent-amount">{money(account.balance, "USD")}</p><p className="verified">Verified Testnet Smart Account</p>
        <p className="muted">USD balance observed during verification · {transactionsFor(snapshot, account.address).length} / {SNAPSHOT_LIMITS.transactionsPerAccount} included transactions</p>
        <SmartAccountAddress address={account.address} />
        <a className="transaction-link" href={`${snapshot.explorerUrl}/contract/${account.address}`} target="_blank" rel="noreferrer">View account on Stellar ↗</a>
        <p className="form-note">Test account only. Do not send real funds or connect real accounts.</p>
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
      <footer className="workspace-footer">{READ_ONLY_MESSAGE} No database or signing keys are deployed. The fixed snapshot has no growing user, request, chat, or transaction collections. Testnet data can change or be reset after the recorded verification time.</footer>
    </main>}
  </div></>;
}

function download(snapshot: TestnetSnapshot) {
  const rows = [["Date", "Network", "Transaction hash", "From", "To", "Amount", "Currency", "Ledger", "Mandate rule"], ...snapshot.transactions.map(tx => [tx.closedAt, snapshot.network, tx.hash, tx.from, tx.to, tx.amount, "USD", String(tx.ledger), String(tx.ruleId)])];
  const data = rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
  const link = document.createElement("a"); link.href = url; link.download = "mandate-testnet-snapshot.csv"; link.click(); URL.revokeObjectURL(url);
}
