import { IS_STATIC_DEMO } from "./demo-mode.ts";
import { useState, type FormEvent } from "react";
import type { AccountMandate, PaymentWorkspace, SpendingAccount, SpendingPeriod } from "@mandate/shared";
import { money } from "./format.ts";
import { api } from "./api.ts";
import { MandateDetails } from "./MandateDetails.tsx";

export function CreateMandateForm({ workspace, onDone, onClose }: { workspace: PaymentWorkspace; onDone: () => Promise<void>; onClose?: () => void }) {
  const [name, setName] = useState("");
  const [userAgentId, setUserAgentId] = useState("");
  const [limit, setLimit] = useState("");
  const [sellerIds, setSellerIds] = useState("");
  const [period, setPeriod] = useState<SpendingPeriod>("day");
  const [expiry, setExpiry] = useState(() => new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10));
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ mandate: AccountMandate; mandateId?: string; agentName?: string; account: SpendingAccount } | null>(null);
  const main = workspace.accounts[0];
  const account = main?.verified ? main : undefined;
  const change = (update: () => void) => { update(); setRequestId(crypto.randomUUID()); };
  // Agents that are waiting to connect or removed cannot hold a mandate.
  const choices = workspace.agents.filter(agent => agent.status === undefined || agent.status === "connected");
  const selected = choices.find(agent => agent.id === userAgentId);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!account) return;
    setBusy(true); setError("");
    try {
      const result = await api.createMandate({ name, recipientType: "agent", ...(userAgentId ? { recipient: userAgentId } : {}), limit, sellerIds: sellerIds.trim() ? sellerIds.trim().split(/[\s,]+/).map(Number) : [], period, expiresAt: new Date(`${expiry}T23:59:59`).toISOString(), requestId });
      setCreated({ mandate: result.mandate, ...(result.mandateId ? { mandateId: result.mandateId } : {}), ...(selected ? { agentName: selected.name } : {}), account });
      await onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the mandate"); }
    finally { setBusy(false); }
  };
  if (created) return <section className="card mandate-form-card is-created"><h2 className="form-card-title">Mandate created</h2><MandateDetails {...created} onClose={() => { onClose?.(); setCreated(null); setName(""); setUserAgentId(""); setLimit(""); setSellerIds(""); setRequestId(crypto.randomUUID()); }} /></section>;
  return <section className="card mandate-form-card"><h2 className="form-card-title">Create a mandate</h2><form className="form" onSubmit={event => void submit(event)}>
    <p className="form-note">{account ? `Main account · ${money(account.balance, account.currency)} available` : "Your main account is awaiting verification. Refresh the dashboard to check again."}</p>
    <label className="field">Mandate name<input required maxLength={120} value={name} disabled={busy} onChange={event => change(() => setName(event.target.value))} placeholder="Team purchasing allowance" /></label>
    <label className="field">Mandate user (optional)<select value={userAgentId} disabled={busy} onChange={event => change(() => setUserAgentId(event.target.value))}><option value="">Any registered agent</option>{choices.map(agent => <option key={agent.id} value={agent.id}>{agent.name}{agent.status === "connected" ? (IS_STATIC_DEMO ? " · demo agent" : " · own key") : ""}</option>)}</select></label>
    <p className="muted">{IS_STATIC_DEMO ? "This creates a simulated allowance for a demo agent. No real accounts or signing keys are connected." : selected?.status === "connected" ? `Only ${selected.name}'s own key will be able to sign for this mandate. There is no secret ID, and the seller list is enforced on chain.` : "Choose an agent from your account or leave this blank. Without an agent that holds its own key, any agent registered to your account can use the mandate with its identification value and the secret mandate ID."}</p>
    <label className="field">Seller IDs (optional)<input type="text" maxLength={2000} pattern={"\\s*[0-9]+(?:(?:\\s*,\\s*|\\s+)[0-9]+)*\\s*"} title="Enter seller IDs as positive whole numbers, separated by commas or spaces" value={sellerIds} disabled={busy} onChange={event => change(() => setSellerIds(event.target.value))} placeholder="101, 202, 303" aria-describedby="seller-ids-help" /></label>
    <p className="form-note" id="seller-ids-help">Enter up to 100 seller IDs, separated by commas or spaces. Payments will only go to these sellers. Leave blank to allow any verified seller. {IS_STATIC_DEMO ? "Use the demo seller IDs shown in the vendor accounts." : selected?.status === "connected" ? "Each ID must already belong to a Mandate account: the list is written into the mandate on Stellar." : "Sellers are verified when a payment is checked or made."}</p>
    <label className="field">Spending limit (USD)<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,7})?" value={limit} disabled={busy} onChange={event => change(() => setLimit(event.target.value))} placeholder="10.00" /></label>
    <div className="field-row"><label className="field">Rolling window<select value={period} disabled={busy} onChange={event => change(() => setPeriod(event.target.value as SpendingPeriod))}><option value="day">24 hours</option><option value="week">7 days</option><option value="month">30 days</option></select></label><label className="field">Expires on<input required type="date" min={new Date().toISOString().slice(0, 10)} value={expiry} disabled={busy} onChange={event => change(() => setExpiry(event.target.value))} /></label></div>
    <p className="form-note">The mandate spends from your main account. {IS_STATIC_DEMO ? "Its limit, expiry, and approved sellers are simulated in this browser." : "Its limit, expiry, and verified recipients are enforced on Stellar testnet."}</p>
    <p className="muted">A mandate grants access to this account's existing balance. Creating it does not open another account.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button is-primary" disabled={busy || !account}>{busy ? "Creating mandate…" : "Create mandate"}</button></div>
  </form></section>;
}
