import { useState, type FormEvent, type ReactNode } from "react";
import type { AccountMandate, FundingMethod, SpendingAccount, Vendor } from "@mandate/shared";
import { formatValue, money } from "./format.ts";
import { api } from "./api.ts";
import { Dialog } from "./Dialog.tsx";
import { IS_STATIC_DEMO } from "./demo-mode.ts";

export type AccountAction = { kind: "fund"; account: SpendingAccount } | { kind: "pay"; account: SpendingAccount; mandate?: AccountMandate };
interface Props { action: AccountAction; vendors?: Vendor[]; onDone: () => Promise<void>; onClose: () => void }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field">{label}{children}</label>; }

export function AccountForms({ action, vendors = [], onDone, onClose }: Props) {
  const [agentId, setAgentId] = useState("");
  const [amount, setAmount] = useState("");
  const [fundingMethod, setFundingMethod] = useState<FundingMethod>(IS_STATIC_DEMO ? "testnet" : "fiat");
  const [recipient, setRecipient] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const account = action.account;
  const grant = action.kind === "pay" ? action.mandate : undefined;
  const title = action.kind === "fund" ? "Add funds" : "Make a payment";
  const change = (update: () => void) => { update(); setRequestId(crypto.randomUUID()); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (action.kind === "fund") {
        const result = await api.fund(account.id, amount, requestId, fundingMethod);
        if ("status" in result && result.status === "checkout") { window.location.assign(result.url); return; }
      }
      else await api.pay({ accountId: account.id, mandateReference: grant?.reference, ...(grant ? { agentId } : {}), amount, destination: recipient, reference, requestId });
      await onDone(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed"); }
    finally { setBusy(false); }
  };
  return <Dialog title={title} onClose={() => { if (!busy) onClose(); }}>
    <form className="form" onSubmit={event => void submit(event)}>
      <p className="muted">{account.name} · {account.currency} account</p>
      {action.kind === "fund" ? IS_STATIC_DEMO ? <p className="form-note">Add simulated test-network USD to this browser's demo balance. No card, bank account, real funds, or blockchain connection is used.</p> : <>
        <fieldset className="field"><legend>Funding method</legend><div className="opening-choices two-choices">
          <label className={`opening-choice ${fundingMethod === "fiat" ? "is-selected" : ""}`}><input type="radio" name="funding-method" value="fiat" checked={fundingMethod === "fiat"} disabled={busy} onChange={() => change(() => setFundingMethod("fiat"))} /><span><strong>FIAT</strong><span>Pay by test card with Stripe sandbox.</span></span></label>
          <label className={`opening-choice ${fundingMethod === "testnet" ? "is-selected" : ""}`}><input type="radio" name="funding-method" value="testnet" checked={fundingMethod === "testnet"} disabled={busy} onChange={() => change(() => setFundingMethod("testnet"))} /><span><strong>Testnet</strong><span>Automatically fund with USD on Stellar testnet.</span></span></label>
        </div></fieldset>
        <p className="form-note">{fundingMethod === "fiat" ? "Continue to Stripe test checkout. Use test card 4242 4242 4242 4242 with a future expiry and any three-digit CVC. No real money is charged. Minimum 0.50 USD." : "Enter an amount to use the automatic Stellar testnet funding flow. Testnet USD is issued and transferred into your account."} Your balance updates after confirmation.</p>
      </> : <>
        {grant && <Field label="Agent identification"><input required maxLength={128} value={agentId} disabled={busy} onChange={event => change(() => setAgentId(event.target.value))} placeholder="agt_…" /></Field>}
        {grant && <p className="form-note">{grant.name}: {formatValue(grant.spent, grant.currency ?? account.currency)} of {money(grant.limit, grant.currency ?? account.currency)} used. Only verified recipients are allowed.</p>}
        <Field label="Recipient Smart Account address">{IS_STATIC_DEMO ? <select required value={recipient} disabled={busy} onChange={event => change(() => setRecipient(event.target.value))}><option value="">Choose a demo vendor</option>{vendors.map(vendor => <option key={vendor.sellerId} value={vendor.address}>{vendor.name}</option>)}</select> : <input required maxLength={56} value={recipient} disabled={busy} onChange={event => change(() => setRecipient(event.target.value))} placeholder="C…" />}</Field>
        <Field label="Payment reference"><input required maxLength={200} value={reference} disabled={busy} onChange={event => change(() => setReference(event.target.value))} /></Field>
      </>}
      <Field label="Amount (USD)"><input required inputMode="decimal" pattern={action.kind === "fund" ? "[0-9]+(\\.[0-9]{1,2})?" : "[0-9]+(\\.[0-9]{1,7})?"} value={amount} disabled={busy} onChange={event => change(() => setAmount(event.target.value))} placeholder="0.00" /></Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button is-primary" disabled={busy}>{busy ? action.kind === "fund" && fundingMethod === "fiat" ? "Opening Stripe…" : (IS_STATIC_DEMO ? "Saving demo transaction…" : "Confirming on Stellar…") : action.kind === "pay" ? "Confirm payment" : fundingMethod === "fiat" ? "Continue to Stripe" : "Add funds"}</button></div>
    </form>
  </Dialog>;
}
