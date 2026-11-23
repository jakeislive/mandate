import type { AccountAgent, AccountMandate, CreateWorkflowInput, FiatCheckout, FiatFundingStatus, FundingMethod, MandateCreation, CreateAccountMandateInput, Customer, MandatePaymentInput, MandatePaymentPreview, MandatePaymentResult, PaymentChatState, PaymentEntry, PaymentNetwork, PaymentWorkspace, SpendingAccount } from "@mandate/shared";
import { createDemo, DEMO_LOGIN, DemoError } from "./demo.ts";
import { IS_STATIC_DEMO } from "./demo-mode.ts";
import type { TestnetSnapshot } from "./testnet-snapshot-types.ts";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
let demo: ReturnType<typeof createDemo> | undefined;
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  if (IS_STATIC_DEMO) {
    try {
      if (!demo) {
        // Discard the previous simulator's state without reading or parsing it.
        try { window.localStorage.removeItem("mandate.static-demo.v1"); } catch { /* No record storage is required. */ }
        demo = createDemo();
      }
      return demo.request(path, method, body as Record<string, unknown> | undefined) as T;
    } catch (error) {
      if (error instanceof DemoError) throw new ApiError(error.status, error.message);
      throw new Error("The Testnet view could not open. Please try again.");
    }
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, credentials: path === "/pay" || path === "/pay/preview" || (path.startsWith("/chat/") && path !== "/chat/sessions") ? "omit" : "same-origin", headers: { ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error("Can't reach the Mandate service. Start pnpm dev:receipts and try again."); }
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, result?.error ?? `Request failed (${response.status})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
export const api = {
  testnetSnapshot: () => request<TestnetSnapshot>("/snapshot"),
  openChat: () => request<PaymentChatState>("/chat/sessions", "POST"),
  chatState: (id: string) => request<PaymentChatState>(`/chat/sessions/${encodeURIComponent(id)}`),
  sendChat: (id: string, message: string) => request<PaymentChatState>(`/chat/sessions/${encodeURIComponent(id)}/messages`, "POST", { message }),
  createAgent: (input: { name: string; requestId: string; connect?: boolean }) => request<AccountAgent>("/agents", "POST", input),
  newPairingCode: (id: string) => request<AccountAgent>(`/agents/${encodeURIComponent(id)}/pairing`, "POST"),
  removeAgent: (id: string) => request<void>(`/agents/${encodeURIComponent(id)}`, "DELETE"),
  workspace: () => request<PaymentWorkspace>("/workspace"),
  network: () => request<{ mode: PaymentWorkspace["mode"]; network?: PaymentNetwork }>("/network"),
  loginDemo: () => request<Customer>("/auth/login", "POST", { email: DEMO_LOGIN.email, password: DEMO_LOGIN.password }),
  updateProfile: (input: { company?: string; team?: string }) => request<Customer>("/profile", "PATCH", input),
  /** A new agent with its own key, plus the mandate it gets when it connects. */
  createWorkflow: (input: CreateWorkflowInput) => request<AccountAgent>("/workflows", "POST", input),
  /** Only the signed-in owner can change a limit; it is rewritten on Stellar. */
  updateMandate: (reference: string, input: { limit?: string; category?: string | null; requestId: string }) => request<AccountMandate>(`/mandates/${encodeURIComponent(reference)}`, "PATCH", input),
  login: (input: { email: string; password: string }) => request<Customer>("/auth/login", "POST", input),
  logout: () => request<void>("/auth/logout", "POST"),
  fund: (id: string, amount: string, requestId: string, method: FundingMethod) => request<PaymentEntry | FiatCheckout>(`/accounts/${id}/funding`, "POST", { amount, requestId, method }),
  fiatFundingStatus: (sessionId: string) => request<FiatFundingStatus>(`/funding/stripe/${encodeURIComponent(sessionId)}`),
  /** No `mandateId` when the mandate goes to an agent with its own key. */
  createMandate: (input: CreateAccountMandateInput) => request<Omit<MandateCreation, "mandateId"> & { mandateId?: string }>("/mandates", "POST", input),
  revealMandate: (reference: string) => request<{ mandateId: string }>(`/mandates/${encodeURIComponent(reference)}/reveal`, "POST"),
  revoke: (id: string) => request<void>(`/mandates/${id}`, "DELETE"),
  pay: (input: { accountId: string; mandateReference?: string; agentId?: string; amount: string; destination: string; reference: string; requestId: string }) => request<PaymentEntry>("/payments", "POST", input),
  previewMandatePayment: (input: MandatePaymentInput) => request<MandatePaymentPreview>("/pay/preview", "POST", input),
  payWithMandate: (input: MandatePaymentInput) => request<MandatePaymentResult>("/pay", "POST", input),
};
