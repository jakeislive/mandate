// The owner changes a mandate's limit. An agent has no way to ask for this:
// the change is signed by the owner's rule and written to Stellar.
import { IS_STATIC_DEMO } from "./demo-mode.ts";
import { useState, type FormEvent } from "react";
import type { AccountMandate } from "@mandate/shared";
import { api } from "./api.ts";
import { Dialog } from "./Dialog.tsx";
import { money } from "./format.ts";
import { periodWords } from "./workflows.ts";

export function EditBudget({ mandate, onDone, onClose }: { mandate: AccountMandate; onDone: () => Promise<void>; onClose: () => void }) {
  const [limit, setLimit] = useState(mandate.limit);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await api.updateMandate(mandate.reference, { limit, requestId }); await onDone(); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not change the budget"); }
    finally { setBusy(false); }
  };
  return <Dialog title={`Change budget for ${mandate.name}`} onClose={() => { if (!busy) onClose(); }}><form className="form" onSubmit={event => void submit(event)}>
    <p className="muted">Now {money(mandate.limit, mandate.currency ?? "USD")} every {periodWords[mandate.period]}, with {money(mandate.spent, mandate.currency ?? "USD")} spent in this window.</p>
    <label className="field">New budget (USD)<input required autoFocus inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,7})?" disabled={busy} value={limit} onChange={event => { setLimit(event.target.value); setRequestId(crypto.randomUUID()); }} /></label>
    <p className="form-note">{IS_STATIC_DEMO ? "This changes the demo budget saved in this browser. No blockchain transaction is submitted." : "Only you can change this. The new limit is written to the mandate on Stellar and applies to the next payment."}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button is-primary" disabled={busy || limit === mandate.limit}>{busy ? (IS_STATIC_DEMO ? "Saving demo budget…" : "Updating on Stellar…") : "Change budget"}</button></div>
  </form></Dialog>;
}
