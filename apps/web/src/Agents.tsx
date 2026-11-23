import { useState, type FormEvent } from "react";
import type { AccountAgent } from "@mandate/shared";
import { api } from "./api.ts";
import { initials } from "./format.ts";
import { ConnectSteps } from "./ConnectSteps.tsx";
import { Dialog } from "./Dialog.tsx";
import { PlusIcon } from "./icons.tsx";
import { IS_STATIC_DEMO } from "./demo-mode.ts";

const shortKey = (key: string) => `${key.slice(0, 6)}…${key.slice(-6)}`;

export function Agents({ agents, onDone }: { agents: AccountAgent[]; onDone: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  return <section className="agents-section">
    <div className="section-header agents-actions"><button className="button is-primary" onClick={() => setCreating(true)}><PlusIcon /> Add agent</button></div>
    {agents.length === 0 ? <p className="card empty">No agents yet. Set up a purchasing workflow, or add an agent to connect an assistant like Claude.</p> : <ul className="agent-grid">{agents.map(agent => <AgentCard key={agent.id} agent={agent} onDone={onDone} />)}</ul>}
    {creating && <NewAgent onDone={onDone} onClose={() => setCreating(false)} />}
  </section>;
}

function status(agent: AccountAgent): { label: string; tone: "verified" | "muted" | "form-error" } {
  if (IS_STATIC_DEMO) return { label: agent.status === "revoked" ? "Removed demo agent" : "Simulated test agent", tone: agent.status === "revoked" ? "muted" : "verified" };
  if (agent.status === "waiting") return { label: "Waiting to connect", tone: "muted" };
  if (agent.status === "revoked") return { label: "Removed", tone: "form-error" };
  if (agent.status === "connected") return agent.verified ? { label: "Connected · own key, verified on chain", tone: "verified" } : { label: "Connected · not yet confirmed on chain", tone: "muted" };
  return agent.verified ? { label: "Verified on chain", tone: "verified" } : { label: "Not verified on chain", tone: "form-error" };
}

function AgentCard({ agent, onDone }: { agent: AccountAgent; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const run = async (work: () => Promise<unknown>, failure: string) => {
    setBusy(true); setError("");
    try { await work(); await onDone(); setConfirming(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : failure); }
    finally { setBusy(false); }
  };
  const { label, tone } = status(agent);
  return <li className="card agent-card">
    <div className="agent-heading"><span className="account-letter" aria-hidden="true">{initials(agent.name)}</span><div><h2>{agent.name}</h2><span className={tone}>{label}</span></div></div>
    {agent.status === "waiting" && <ConnectSteps agent={agent} busy={busy} onNewCode={() => void run(() => api.newPairingCode(agent.id), "Could not make a new code")} />}
    {agent.pending?.map(draft => <p className="form-note" key={draft.name}>{draft.name}: {draft.limit} USD every {draft.period === "month" ? "30 days" : draft.period === "week" ? "7 days" : "24 hours"}, granted on Stellar when it connects.</p>)}
    {agent.status === "connected" && agent.publicKey && <p className="muted">Signs with its own key <code title={agent.publicKey}>{shortKey(agent.publicKey)}</code>. Mandate cannot sign for it.</p>}
    {(agent.status === undefined || IS_STATIC_DEMO) && <AgentIdentity agent={agent} />}
    {agent.explorerUrl && agent.status !== "revoked" && <a className="transaction-link" href={agent.explorerUrl} target="_blank" rel="noreferrer">View registration on Stellar ↗</a>}
    {agent.status !== undefined && agent.status !== "revoked" && (confirming
      ? <div className="confirm"><span>Remove {agent.name}? Its mandates are revoked too.</span><button className="button is-danger" disabled={busy} onClick={() => void run(() => api.removeAgent(agent.id), "Could not remove the agent")}>{busy ? "Removing…" : "Remove"}</button><button className="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button></div>
      : <button className="button is-quiet agent-remove" onClick={() => setConfirming(true)}>Remove agent</button>)}
    {error && <p role="alert" className="form-error">{error}</p>}
  </li>;
}

function AgentIdentity({ agent }: { agent: AccountAgent }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const copy = async () => {
    setError("");
    try { await navigator.clipboard.writeText(agent.id); setCopied(true); }
    catch { setError("Could not copy the identification value."); }
  };
  return <div className="agent-identity"><label className="field">Agent identification<input readOnly value={agent.id} /></label><button className="button" onClick={() => void copy()}>Copy identification</button>{copied && <p className="muted" role="status">Copied to clipboard.</p>}{error && <p role="alert" className="form-error">{error}</p>}</div>;
}

function NewAgent({ onDone, onClose }: { onDone: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState("");
  const [ownKey, setOwnKey] = useState(!IS_STATIC_DEMO);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<AccountAgent | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const agent = await api.createAgent({ name, requestId, ...(ownKey ? { connect: true } : {}) });
      await onDone();
      if (ownKey) setAdded(agent); else onClose();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add the agent"); }
    finally { setBusy(false); }
  };
  if (added) return <Dialog title={`Connect ${added.name}`} onClose={onClose}><div className="form"><ConnectSteps agent={added} busy={false} onNewCode={onClose} /><div className="form-actions"><button className="button is-primary" type="button" onClick={onClose}>Done</button></div></div></Dialog>;
  return <Dialog title="Add agent" onClose={() => { if (!busy) onClose(); }}><form className="form" onSubmit={event => void submit(event)}>
    <label className="field">Agent name<input required autoFocus maxLength={120} disabled={busy} value={name} onChange={event => { setName(event.target.value); setRequestId(crypto.randomUUID()); }} /></label>
    <p className="form-note">{IS_STATIC_DEMO ? "Add a simulated agent to the demo workspace. No real keys or external accounts are connected." : "The agent makes its own key and connects with a one-time code. It signs every payment itself, so nobody else can pay as it, including Mandate. Works with Claude (MCP), LangChain or scripts."}</p>
    {!IS_STATIC_DEMO && <details className="other-ways" open={!ownKey}>
      <summary>Other ways to connect</summary>
      <fieldset className="choice-group" disabled={busy}>
        <legend>How it pays</legend>
        <label className="choice"><input type="radio" name="agent-kind" checked={ownKey} onChange={() => { setOwnKey(true); setRequestId(crypto.randomUUID()); }} /><span><strong>With its own key</strong><small className="muted">Recommended. One sign-in per agent, registered on Stellar.</small></span></label>
        <label className="choice"><input type="radio" name="agent-kind" checked={!ownKey} onChange={() => { setOwnKey(false); setRequestId(crypto.randomUUID()); }} /><span><strong>With a mandate ID</strong><small className="muted">For the <a href="/pay">Pay page</a> and chat. Mandate holds the key; the agent shows its identification and a secret mandate ID.</small></span></label>
      </fieldset>
    </details>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button is-primary" disabled={busy}>{busy ? (ownKey ? "Adding…" : "Registering on Stellar…") : "Add agent"}</button></div>
  </form></Dialog>;
}
