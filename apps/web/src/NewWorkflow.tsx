// Sets up a purchasing workflow in three steps: what it buys, who it may buy
// from and how much, then the code and instructions for its agent. The agent
// makes its own key when it connects, and only then does the mandate go on
// Stellar with that key as its only signer.
import { useState, type FormEvent } from "react";
import type { AccountAgent, PaymentWorkspace, SpendingPeriod } from "@mandate/shared";
import { api } from "./api.ts";
import { ConnectSteps } from "./ConnectSteps.tsx";
import { Dialog } from "./Dialog.tsx";
import { money } from "./format.ts";
import { agentBrief, periodWords, templates, type Template } from "./workflows.ts";
import { IS_STATIC_DEMO } from "./demo-mode.ts";

export function NewWorkflow({ workspace, onDone, onClose }: { workspace: PaymentWorkspace; onDone: () => Promise<void>; onClose: () => void }) {
  const vendors = workspace.vendors ?? [];
  const [template, setTemplate] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<number[]>([]);
  const [limit, setLimit] = useState("");
  const [period, setPeriod] = useState<SpendingPeriod>("week");
  const [expiry, setExpiry] = useState(() => new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10));
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<AccountAgent | null>(null);
  const change = (update: () => void) => { update(); setRequestId(crypto.randomUUID()); };
  const choose = (next: Template) => {
    setTemplate(next); setName(next.name); setLimit(next.limit); setPeriod(next.period);
    // Start with the vendors that sell this kind of thing; the team can change the list.
    setChosen(vendors.filter(vendor => vendor.category === next.category).map(vendor => vendor.sellerId));
    setRequestId(crypto.randomUUID()); setError("");
  };
  const toggle = (sellerId: number) => change(() => setChosen(current => current.includes(sellerId) ? current.filter(id => id !== sellerId) : [...current, sellerId]));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!template) return;
    setBusy(true); setError("");
    try {
      const agent = await api.createWorkflow({ name, category: template.category, limit, period, expiresAt: new Date(`${expiry}T23:59:59`).toISOString(), sellerIds: chosen, requestId });
      await onDone();
      setCreated(agent);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not set up the workflow"); }
    finally { setBusy(false); }
  };
  const close = () => { if (!busy) onClose(); };

  if (created && template) {
    if (IS_STATIC_DEMO) return <Dialog title="Demo workflow created" onClose={onClose}><div className="form"><p>{name} is ready with a simulated agent and a {money(limit, "USD")} budget every {periodWords[period]}. View its mandate in the dashboard.</p><button className="button is-primary" onClick={onClose}>Done</button></div></Dialog>;
    const { customer } = workspace;
    const brief = created.pairing?.code ? agentBrief({ workflow: name, job: template.job, company: customer.company, team: customer.team, owner: customer.name, code: created.pairing.code }) : undefined;
    return <Dialog title={`Connect the ${name} agent`} onClose={onClose}><div className="form">
      <p className="form-note">{name} is ready: {money(limit, "USD")} every {periodWords[period]}{chosen.length ? `, ${chosen.length} approved ${chosen.length === 1 ? "vendor" : "vendors"}` : ", any verified seller"}. The budget goes on Stellar when the agent connects, with the agent's own key as its only signer.</p>
      <ConnectSteps agent={created} busy={false} onNewCode={onClose} brief={brief} />
      <div className="form-actions"><button className="button is-primary" type="button" onClick={onClose}>Done</button></div>
    </div></Dialog>;
  }

  if (!template) return <Dialog title="New purchasing workflow" onClose={close}><div className="form">
    <p className="muted">What should an agent buy for your team? Pick a starting point. You choose the vendors and the budget next.</p>
    <div className="template-grid">{templates.map(option => <button key={option.id} type="button" className="glass template" onClick={() => choose(option)}>
      <strong>{option.name || "Something else"}</strong>
      <span className="muted">{option.blurb}</span>
      {option.limit && <span className="pill">{money(option.limit, "USD")} every {periodWords[option.period]}</span>}
    </button>)}</div>
  </div></Dialog>;

  return <Dialog title="New purchasing workflow" onClose={close}><form className="form" onSubmit={event => void submit(event)}>
    <label className="field">Workflow name<input required autoFocus maxLength={100} disabled={busy} value={name} onChange={event => change(() => setName(event.target.value))} placeholder="Software renewals" /></label>
    <fieldset className="choice-group" disabled={busy}>
      <legend>Approved vendors</legend>
      {vendors.length === 0 ? <p className="muted">No vendors are listed yet. This workflow will be able to pay any verified seller.</p> : vendors.map(vendor => <label className="choice" key={vendor.sellerId}>
        <input type="checkbox" checked={chosen.includes(vendor.sellerId)} onChange={() => toggle(vendor.sellerId)} />
        <span><strong>{vendor.name}</strong><small className="muted">{vendor.category} · {IS_STATIC_DEMO ? "demo vendor" : "verified on Stellar"}</small></span>
      </label>)}
      <p className="muted">{IS_STATIC_DEMO ? "The demo agent can pay only the vendors you select. This is simulated locally." : chosen.length ? "The agent can pay only these vendors. The list is written into its mandate on Stellar." : "With none selected, the agent can pay any verified seller."}</p>
    </fieldset>
    <div className="field-row">
      <label className="field">Budget (USD)<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" disabled={busy} value={limit} onChange={event => change(() => setLimit(event.target.value))} placeholder="300" /></label>
      <label className="field">Every<select value={period} disabled={busy} onChange={event => change(() => setPeriod(event.target.value as SpendingPeriod))}><option value="day">24 hours</option><option value="week">7 days</option><option value="month">30 days</option></select></label>
    </div>
    <label className="field">Runs until<input required type="date" min={new Date().toISOString().slice(0, 10)} disabled={busy} value={expiry} onChange={event => change(() => setExpiry(event.target.value))} /></label>
    <p className="form-note">The agent cannot raise this budget or add a vendor. Only you can, from this dashboard.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button" type="button" disabled={busy} onClick={() => { setTemplate(null); setError(""); }}>Back</button><button className="button is-primary" disabled={busy}>{busy ? "Setting up…" : "Set up workflow"}</button></div>
  </form></Dialog>;
}
