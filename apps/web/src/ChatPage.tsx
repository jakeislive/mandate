import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PaymentChatState } from "@mandate/shared";
import { api, ApiError } from "./api.ts";
import { money } from "./format.ts";
import { Logo } from "./icons.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { IS_STATIC_DEMO } from "./demo-mode.ts";
import { TestNetworkWarning } from "./TestNetworkWarning.tsx";

const hideMandate = (text: string) => text.replace(/mnd_[\w-]+/g, "[mandate hidden]");
const example = IS_STATIC_DEMO ? "Pay 0.20 USD to Seatwise" : "Pay 0.20 USD to seller C_REPLACE_WITH_SELLER_SMART_ACCOUNT_ADDRESS";

export function ChatPage() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [session, setSession] = useState<PaymentChatState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsCheck, setNeedsCheck] = useState(false);
  const expectedTurn = useRef(0);
  const sending = useRef(false);
  const conversation = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const log = conversation.current;
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages, busy, error]);
  const receive = (state: PaymentChatState) => {
    setSession(state);
    if (state.busy || state.turns < expectedTurn.current) {
      setNeedsCheck(true);
      setError("A response is not available yet. Check again in a moment.");
      return;
    }
    setNeedsCheck(false);
    setError(state.error ?? "");
    if (state.reply) setMessages(previous => [...previous, { role: "assistant", text: hideMandate(state.reply) }]);
    if (!state.complete) requestAnimationFrame(() => input.current?.focus());
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending.current || session?.complete || needsCheck) return;
    sending.current = true;
    setBusy(true); setError("");
    let opened = session;
    try {
      if (!opened) { opened = await api.openChat(); setSession(opened); }
      expectedTurn.current = opened.turns + 1;
      setMessages(previous => [...previous, { role: "user", text: hideMandate(message) }]);
      setDraft("");
      receive(await api.sendChat(opened.sessionId, message));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the payment agent.");
      if (opened) setNeedsCheck(true);
    } finally { sending.current = false; setBusy(false); }
  };
  const checkResponse = async () => {
    if (!session || sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try { receive(await api.chatState(session.sessionId)); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check the response.");
      if (cause instanceof ApiError && cause.status === 404) {
        setNeedsCheck(false);
        setSession({ ...session, complete: true });
      }
    }
    finally { sending.current = false; setBusy(false); }
  };
  const reset = () => {
    setMessages([]); setSession(undefined); setDraft(""); setError(""); setNeedsCheck(false); expectedTurn.current = 0;
    input.current?.focus();
  };
  const result = session?.paymentResult;
  return <div className="page payment-page">
    <header className="glass topbar"><a className="brand" href="/"><Logo />Mandate</a><div className="topbar-side"><a className="button" href="/pay">Pay</a><a className="button" href="/">Dashboard</a><ThemeToggle /></div></header>
    <main className="chat-page">
      <TestNetworkWarning />
      <div className="section-header"><div className="page-title"><p className="eyebrow">{IS_STATIC_DEMO ? "LOCAL DEMO ASSISTANT" : "LANGCHAIN · STELLAR TESTNET"}</p><h1>Chat to pay.</h1><p className="muted">Tell your payment agent what you need. It will ask for any missing details.</p></div><button className="button" disabled={busy || needsCheck} onClick={reset}>New chat</button></div>
      <section className="card chat-panel" aria-label="Payment chat">
        <div ref={conversation} className="chat-messages" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
          <article className="chat-message assistant"><p className="eyebrow">Payment agent</p><p>{IS_STATIC_DEMO ? "Sign in to the demo workspace, then try: Pay 0.20 USD to Seatwise. This local scripted assistant uses your simulated $1 daily chat mandate. It does not contact an AI provider or a blockchain." : "I can help you make a USD payment. Tell me the amount and seller Smart Account address. Signed-in chats use your default agent and $1 daily chat mandate. If you\'re not signed in, include your mandate ID and agent identification."}</p><p className="muted">{IS_STATIC_DEMO ? "One simulated payment per chat. No real funds move." : "One payment per chat. Asking me to pay authorizes the payment."}</p></article>
          {messages.length === 0 && <button className="chat-example" onClick={() => { setDraft(example); input.current?.focus(); }}>Try a payment prompt <span aria-hidden="true">↗</span></button>}
          {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={index}><p className="eyebrow">{message.role === "user" ? "You" : "Payment agent"}</p><p>{message.text}</p></article>)}
          {busy && <p className="chat-thinking muted" role="status">{needsCheck ? "Checking response…" : "Agent is working…"}</p>}
        </div>
        {result && <div className={`pay-result chat-result ${result.status}`} role="status">
          <h2>{result.status === "paid" ? "Payment succeeded" : result.status === "pending" ? "Awaiting confirmation" : "Payment declined"}</h2>
          {result.status === "paid" ? <><p>{money(result.payment.amount, result.payment.currency)} paid.</p>{result.payment.explorerUrl && <a href={result.payment.explorerUrl} target="_blank" rel="noreferrer">View transaction on Stellar ↗</a>}</> : <p>{hideMandate(result.reason)}</p>}
          {result.status === "pending" && <p>Keep the request ID and the same payment details when checking this payment. Do not start another payment while the outcome is unconfirmed.</p>}
        </div>}
        {error && <div className="banner is-bad chat-error" role="alert"><p>{error}</p>{needsCheck && <button className="button" disabled={busy} onClick={() => void checkResponse()}>Check response</button>}</div>}
        <form className="chat-composer" onSubmit={event => void send(event)}>
          <label className="field" htmlFor="chat-message">Message<textarea ref={input} id="chat-message" rows={3} maxLength={4000} value={draft} disabled={busy || session?.complete || needsCheck} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
          }} placeholder={session?.complete ? "This chat is complete. Start a new chat for another payment." : "Ask to pay, or add your payment details…"} autoComplete="off" spellCheck={false} /></label>
          <div className="chat-composer-footer"><p className="muted">Enter to send · Shift + Enter for a new line</p><button className="button is-primary" type="submit" disabled={busy || !draft.trim() || session?.complete || needsCheck}>{busy ? "Working…" : "Send message"}</button></div>
        </form>
      </section>
      {session?.agentId && <p className="workspace-note chat-request">Your chat agent: <code>{session.agentId}</code></p>}
      {session?.mandate && <p className="workspace-note">{session.mandate.name} · {money(session.mandate.limit, "USD")} per {session.mandate.period === "day" ? "24 hours" : session.mandate.period === "week" ? "7 days" : "30 days"} · {session.mandate.status} · expires {new Date(session.mandate.expiresAt).toLocaleDateString()}. <a href="/mandates">Manage mandates</a></p>}
      {session && <p className="workspace-note chat-request">Payment request ID: <code>{session.requestId}</code>{(session.paymentAttempted && result?.status !== "paid") && <>. For a retry, use <code>pnpm agent:langchain --request-id "{session.requestId}"</code> with the same payment details{session.agentId ? ` and agent identification ${session.agentId}` : ""}.</>}</p>}
      <p className="workspace-note">{IS_STATIC_DEMO ? "Demo messages stay in this browser. No API keys, personal accounts, or real payment details are needed. Reloading clears the visible conversation." : "Your default mandate ID stays on the server. Messages you type, including any IDs you enter, are sent to Gemini. Mandate IDs are hidden in the conversation. Chats expire after one hour of inactivity or an API restart. Reloading this page clears the conversation from view."}</p>
    </main>
  </div>;
}
