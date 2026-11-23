// Purchasing workflows: each one is an agent that holds its own key, plus the
// mandate that says what it may spend and with which vendors.
import { IS_STATIC_DEMO } from "./demo-mode.ts";
import { useState } from "react";
import type { AccountAgent, AccountMandate, PaymentWorkspace } from "@mandate/shared";
import { api } from "./api.ts";
import { ConnectSteps } from "./ConnectSteps.tsx";
import { EditBudget } from "./EditBudget.tsx";
import { MandateCard } from "./MandateCard.tsx";
import { NewWorkflow } from "./NewWorkflow.tsx";
import { money } from "./format.ts";
import { PlusIcon } from "./icons.tsx";
import { agentBrief, periodWords, sellerLine, templates } from "./workflows.ts";

export function Workflows({ workspace, onDone }: { workspace: PaymentWorkspace; onDone: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  // A workflow's agent holds its own key. Agents that share a secret mandate ID are listed under Agents.
  const agents = workspace.agents.filter(agent => agent.status === "waiting" || agent.status === "connected");
  return <section className="agents-section">
    <div className="section-header agents-actions"><button className="button is-primary" onClick={() => setCreating(true)}><PlusIcon /> New purchasing workflow</button></div>
    {agents.length === 0
      ? <div className="card empty workflow-empty"><h2>Set up your first purchasing workflow</h2><p className="muted">Pick what an agent should buy for your team, the vendors it may use and its budget. You get a code and instructions to hand to the agent.</p><ul className="workflow-starters">{templates.filter(template => template.name).map(template => <li key={template.id} className="pill">{template.name}</li>)}</ul></div>
      : <ul className="workflow-grid">{agents.map((agent, index) => <WorkflowCard key={agent.id} agent={agent} workspace={workspace} tone={index} onDone={onDone} />)}</ul>}
    {creating && <NewWorkflow workspace={workspace} onDone={onDone} onClose={() => setCreating(false)} />}
  </section>;
}

function WorkflowCard({ agent, workspace, tone, onDone }: { agent: AccountAgent; workspace: PaymentWorkspace; tone: number; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState<AccountMandate | null>(null);
  const [error, setError] = useState("");
  const vendors = workspace.vendors ?? [];
  const mandates = workspace.mandates.filter(mandate => mandate.agentId === agent.id && mandate.status === "active");
  const pending = agent.pending ?? [];
  const title = mandates[0]?.name ?? pending[0]?.name ?? agent.name;
  const category = mandates[0]?.category ?? pending[0]?.category;
  const template = templates.find(option => option.category === category) ?? templates[templates.length - 1]!;
  const payments = workspace.activity.filter(entry => entry.kind === "payment" && entry.agentId === agent.id);
  const declines = (workspace.declines ?? []).filter(decline => decline.agentId === agent.id);
  const run = async (work: () => Promise<unknown>, failure: string) => {
    setBusy(true); setError("");
    try { await work(); await onDone(); setConfirming(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : failure); }
    finally { setBusy(false); }
  };
  const brief = agent.pairing?.code ? agentBrief({ workflow: title, job: template.job, company: workspace.customer.company, team: workspace.customer.team, owner: workspace.customer.name, code: agent.pairing.code }) : undefined;
  return <li className="card workflow-card">
    <div className="workflow-heading"><div><h2>{title}</h2><p className={agent.status === "connected" && agent.verified ? "verified" : "muted"}>{agent.status === "waiting" ? "Waiting for its agent to connect" : agent.verified ? `${agent.name} · ${IS_STATIC_DEMO ? "simulated agent" : "own key, verified on chain"}` : `${agent.name} · connected, not yet confirmed on chain`}</p></div>{category && <span className="pill">{category}</span>}</div>
    {mandates.length > 0 && <ul className="workflow-mandates">{mandates.map((mandate, index) => <MandateCard key={mandate.reference} mandate={mandate} tone={tone + index}>
      <p className="muted">Approved vendors: {sellerLine(mandate, vendors)}</p>
      <p className="muted">Runs until {new Date(mandate.expiresAt).toLocaleDateString()} · {IS_STATIC_DEMO ? "simulated rules" : "enforced on Stellar"}</p>
      <div className="account-buttons"><button className="button" onClick={() => setEditing(mandate)}>Change budget</button></div>
    </MandateCard>)}</ul>}
    {pending.map(draft => <p className="form-note" key={draft.name}>Budget ready: {money(draft.limit, "USD")} every {periodWords[draft.period]}. Vendors: {sellerLine(draft, vendors)}. It goes on Stellar when the agent connects.</p>)}
    {agent.status === "waiting" && <ConnectSteps agent={agent} busy={busy} brief={brief} onNewCode={() => void run(() => api.newPairingCode(agent.id), "Could not make a new code")} />}
    {agent.status === "connected" && mandates.length === 0 && pending.length === 0 && <p className="muted">No active mandate. Give this agent one from the Mandates tab.</p>}
    {agent.status === "connected" && <p className="muted workflow-activity">{payments.length ? `${payments.length} ${payments.length === 1 ? "purchase" : "purchases"}, last: ${payments[0]!.reference.split(" · ")[0]} (${money(payments[0]!.amount, payments[0]!.currency)})` : "No purchases yet"}{declines.length ? ` · ${declines.length} refused` : ""} · <a className="transaction-link" href="/spending">See spending</a></p>}
    {confirming
      ? <div className="confirm"><span>Remove {title}? Its agent is removed and its mandate is revoked.</span><button className="button is-danger" disabled={busy} onClick={() => void run(() => api.removeAgent(agent.id), "Could not remove the workflow")}>{busy ? "Removing…" : "Remove"}</button><button className="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button></div>
      : <button className="button is-quiet agent-remove" onClick={() => setConfirming(true)}>Remove workflow</button>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {editing && <EditBudget mandate={editing} onDone={onDone} onClose={() => setEditing(null)} />}
  </li>;
}
