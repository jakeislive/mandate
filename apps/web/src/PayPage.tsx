import { useEffect, useState, type FormEvent } from "react";
import type { MandatePaymentPreview, MandatePaymentResult, PaymentNetwork } from "@mandate/shared";
import { formatValue, money } from "./format.ts";
import { api } from "./api.ts";
import { SmartAccountAddress } from "./SmartAccountAddress.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { Logo } from "./icons.tsx";

export function PayPage() {
  const [network, setNetwork] = useState<PaymentNetwork>();
  const [agentId, setAgentId] = useState("");
  const [mandateId, setMandateId] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<MandatePaymentPreview | null>(null);
  const [result, setResult] = useState<MandatePaymentResult | null>(null);
  const [error, setError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const [busy, setBusy] = useState<"check" | "pay" | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api.network();
        if (active) { setNetwork(data.network); setNetworkError(data.mode === "stellar-testnet" ? "" : "This payment page requires the Stellar testnet service."); }
      } catch (cause) { if (active) setNetworkError(cause instanceof Error ? cause.message : "Could not connect"); }
    };
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const pending = result?.status === "pending";
  const completed = result?.status === "paid";
  const locked = !!busy || pending || completed;
  const change = (update: () => void) => { update(); setRequestId(crypto.randomUUID()); setPreview(null); setResult(null); setError(""); };
  const input = () => ({ mandateId: mandateId.trim(), agentId: agentId.trim(), sellerAddress: sellerAddress.trim(), sellerName: sellerName.trim(), amount: amount.trim(), reference: reference.trim(), requestId });
  const check = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checking = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "check";
    setBusy(checking ? "check" : "pay"); setError("");
    try {
      if (checking) setPreview(await api.previewMandatePayment(input()));
      else {
        const next = await api.payWithMandate(input());
        // A mandate may expire or be revoked while a submitted payment is pending.
        // That cannot tell us whether the original transaction settled.
        if (pending && next.status === "declined") setError(`Confirmation could not be refreshed: ${next.reason}. Check the original transaction in the explorer; its outcome is still unconfirmed here.`);
        else setResult(next);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The payment service could not complete this request"); }
    finally { setBusy(null); }
  };
  return <div className="page payment-page">
    <header className="glass topbar"><a className="brand" href="/"><Logo />Mandate</a><div className="topbar-side"><a className="button" href="/chat">Chat to pay</a><span className="pill">{network?.name ?? "Connecting…"}</span><a className="button" href="/">Owner dashboard</a><ThemeToggle /></div></header>
    <main className="public-pay">
      <div className="page-title"><p className="eyebrow">THIRD-PARTY PAYMENT</p><h1>Pay with a mandate.</h1><p className="muted">Use a mandate to pay a verified Smart Account. No owner login is required.</p></div>
      <section className="card"><form className="form pay-form" onSubmit={event => void check(event)}>
        <fieldset className="field pay-fieldset"><legend>Mandate details</legend>
          <label className="field">Mandate ID<input type="password" required maxLength={128} value={mandateId} disabled={locked} onChange={e => change(() => setMandateId(e.target.value))} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="mnd_…" /></label>
          <label className="field">Agent identification<input required maxLength={128} value={agentId} disabled={locked} onChange={e => change(() => setAgentId(e.target.value))} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="agt_…" /></label>
          <p className="muted">Your agent identification must be registered to the source account on chain. Your mandate ID is secret and authorizes this payment. It selects the source account. All payments use USD. Check the details before paying.</p>
        </fieldset>
        <fieldset className="field pay-fieldset"><legend>Seller details</legend>
          <label className="field">Seller name<input required maxLength={120} value={sellerName} disabled={locked} onChange={e => change(() => setSellerName(e.target.value))} placeholder="Seller display name" /></label>
          <label className="field">Seller Smart Account address<input required maxLength={56} value={sellerAddress} disabled={locked} onChange={e => change(() => setSellerAddress(e.target.value))} placeholder="C…" /></label>
          <p className="muted">Copy the seller’s Smart Account address from their dashboard. The address is checked against the on-chain registry.</p>
        </fieldset>
        <div className="field-row"><label className="field">Amount (USD)<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,7})?" value={amount} disabled={locked} onChange={e => change(() => setAmount(e.target.value))} placeholder="0.10" /></label><label className="field">Payment reference<input required maxLength={200} value={reference} disabled={locked} onChange={e => change(() => setReference(e.target.value))} placeholder="What are you paying for?" /></label></div>
        {preview && <div className="pay-checks"><h2>{preview.mandate.name}</h2><p className="muted">Agent: {preview.agent.name} · {preview.agent.id}</p><SmartAccountAddress address={preview.mandate.address} label="Source Smart Account address" /><p className="muted">{formatValue(preview.mandate.spent, preview.currency)} of {money(preview.mandate.limit, preview.currency)} used · expires {new Date(preview.mandate.expiresAt).toLocaleString()}</p><ul>{preview.checks.map(item => <li key={item.label} className={item.passed ? "check-pass" : "check-fail"}><span aria-hidden="true">{item.passed ? "✓" : "×"}</span> {item.label}</li>)}</ul><p className="muted">Checks are a preview. The contract validates the actual payment at submission.</p></div>}
        {(networkError || error) && <p className="banner is-bad" role="alert">{networkError || error}</p>}
        {result && <div role="status" aria-live="polite" className={`pay-result ${result.status}`}>
          <h2>{result.status === "paid" ? "Payment succeeded" : result.status === "declined" ? "Payment declined" : "Awaiting confirmation"}</h2>
          {result.status === "paid" ? <><p>{money(result.payment.amount, result.payment.currency)} paid to {sellerName}.</p>{result.payment.explorerUrl ? <a href={result.payment.explorerUrl} target="_blank" rel="noreferrer">View transaction on Stellar ↗</a> : null}</> : <p>{result.reason}</p>}
          {result.status === "pending" && <><p>Retry confirmation with the same request ID. Do not create another payment while this one is unconfirmed.</p><a href={`${network?.explorerUrl}/tx/${result.txHash}`} target="_blank" rel="noreferrer">View pending transaction ↗</a></>}
        </div>}
        <p className="workspace-note">Request ID: <code>{requestId}</code>. An unchanged retry is processed once.</p>
        <div className="form-actions">{completed ? <button className="button" type="button" onClick={() => { setResult(null); setPreview(null); setAmount(""); setReference(""); setRequestId(crypto.randomUUID()); }}>Start another payment</button> : <><button className="button" type="submit" value="check" disabled={!!busy || pending}>{busy === "check" ? "Checking…" : "Check mandate & seller"}</button><button className="button is-primary" type="submit" value="pay" disabled={!!busy || !network?.mandates || (!pending && !preview?.checks.every(check => check.passed))}>{busy === "pay" ? "Confirming on Stellar…" : pending ? "Check confirmation" : "Make payment"}</button></>}</div>
      </form></section>
      <p className="workspace-note">All payments settle on Stellar testnet. The mandate identifies the source account. Agent identification is verified on chain. All payments use USD. A payment can be declined for an invalid mandate ID, an expired or revoked mandate, an unverified or incompatible recipient, an exceeded limit, or insufficient funds.</p>
    </main>
  </div>;
}
