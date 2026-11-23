import { useState } from "react";
import { api } from "./api.ts";
import { TestNetworkWarning } from "./TestNetworkWarning.tsx";

export function SignIn({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setError("");
    try { await api.loginDemo(); await onSignedIn(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in"); }
    finally { setBusy(false); }
  };
  return <main className="demo-login"><TestNetworkWarning /><button className="button is-primary" disabled={busy} onClick={() => void submit()}>{busy ? "Opening demo…" : "Login"}</button>{error && <p className="form-error" role="alert">{error}</p>}</main>;
}

