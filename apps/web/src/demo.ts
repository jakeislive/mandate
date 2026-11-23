import { formatAmount, toBaseUnits } from "@mandate/shared";
import type { AccountAgent, AccountMandate, PaymentChatState, PaymentEntry, PaymentNetwork, PaymentWorkspace, SpendingAccount, SpendingPeriod } from "@mandate/shared";

// Public demo credentials, deliberately unrelated to any real account or service.
export const DEMO_LOGIN = { email: "test@testing.com", password: "testing1234567890", name: "TUser" } as const;
export const DEMO_STORAGE_KEY = "mandate.static-demo.v1";
export const DEMO_MAIN_ADDRESS = "C_DEMO_TUSER_DO_NOT_SEND_REAL_FUNDS";
export const DEMO_PAYMENT = { mandateId: "mnd_demo_chat_for_static_demo_only", agentId: "agt_demo_chat", sellerAddress: "C_DEMO_SEATWISE_DO_NOT_SEND_REAL_FUNDS", sellerName: "Seatwise" } as const;
const DAY = 86_400_000;
const mainId = "demo-main";
const ownerId = "demo-tuser";
const usd = (value: bigint) => formatAmount(value.toString());
const units = (value: string) => BigInt(toBaseUnits(value));
const network: PaymentNetwork = {
  id: "stellar:testnet", name: "Test network · simulated", currency: "USD", tokenContract: "DEMO_USD",
  rpcUrl: "", horizonUrl: "", explorerUrl: "", smartAccounts: true, verifiedSmartAccounts: true,
  mandates: true, agentVerification: true, faucet: true,
};

interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface DemoState {
  workspace: PaymentWorkspace;
  signedIn: boolean;
  secrets: Record<string, string>;
  requests: Record<string, { fingerprint: string; result: unknown }>;
  chats: Record<string, PaymentChatState & { conversation: string }>;
}
export class DemoError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function requireDemo(value: unknown, status: number, message: string): asserts value {
  if (!value) throw new DemoError(status, message);
}
function text(value: unknown, label: string, max = 120): string {
  requireDemo(typeof value === "string" && value.trim().length > 0 && value.trim().length <= max, 400, `${label} is required`);
  return value.trim();
}
function amount(value: unknown, decimals = 7): string {
  requireDemo(typeof value === "string" && new RegExp(`^\\d{1,7}(\\.\\d{1,${decimals}})?$`).test(value) && units(value) > 0n, 400, `Enter a positive amount with up to ${decimals} decimal places`);
  return usd(units(value));
}
function seed(now: number): DemoState {
  const at = (days: number) => new Date(now - days * DAY).toISOString();
  const vendors = [
    { sellerId: 101, name: "Seatwise", category: "Software", address: "C_DEMO_SEATWISE_DO_NOT_SEND_REAL_FUNDS" },
    { sellerId: 202, name: "Paperline Supply", category: "Office supplies", address: "C_DEMO_PAPERLINE_DO_NOT_SEND_REAL_FUNDS" },
    { sellerId: 303, name: "Cloudhaven", category: "Cloud and APIs", address: "C_DEMO_CLOUDHAVEN_DO_NOT_SEND_REAL_FUNDS" },
  ];
  const accounts: SpendingAccount[] = [
    { id: mainId, sellerId: 1, ownerId, name: "TUser main account", rail: "blockchain", type: "stellar", currency: "USD", balance: "4784", address: DEMO_MAIN_ADDRESS, verified: true, createdAt: at(6) },
    ...vendors.map((vendor, i) => ({ id: `demo-vendor-${vendor.sellerId}`, sellerId: vendor.sellerId, ownerId: `demo-seller-${vendor.sellerId}`, name: vendor.name, rail: "blockchain" as const, type: "stellar" as const, currency: "USD", balance: ["84", "60", "72"][i]!, address: vendor.address, verified: true, createdAt: at(6) })),
  ];
  const agents: AccountAgent[] = vendors.map((vendor, i) => ({ id: `agt_demo_${vendor.sellerId}`, accountId: mainId, name: ["Software renewals agent", "Office supplies agent", "Cloud usage agent"][i]!, verified: true, status: "connected", createdAt: at(5) }));
  agents.push({ id: "agt_demo_chat", accountId: mainId, name: "Chat agent", verified: true, createdAt: at(5) });
  const mandates: AccountMandate[] = vendors.map((vendor, i) => ({
    reference: `demo-mandate-${vendor.sellerId}`, accountId: mainId, name: ["Software renewals", "Office supplies", "Cloud and API usage"][i]!,
    recipientType: "agent", recipient: agents[i]!.id, agentId: agents[i]!.id, limit: ["300", "200", "500"][i]!, spent: "0",
    period: i === 1 ? "week" : "month", expiresAt: new Date(now + 90 * DAY).toISOString(), status: "active", createdAt: at(5), currency: "USD", verifiedRecipientsOnly: true, sellerIds: [vendor.sellerId], category: vendor.category,
  }));
  mandates.push({ reference: "demo-chat-mandate", accountId: mainId, name: "Chat mandate", recipientType: "agent", recipient: "agt_demo_chat", limit: "1", spent: "0", period: "day", expiresAt: new Date(now + 30 * DAY).toISOString(), status: "active", createdAt: at(5), currency: "USD", verifiedRecipientsOnly: true });
  const purchases = [
    { vendor: 0, amount: "40", reference: "Project tracker seats", days: 4.5 },
    { vendor: 1, amount: "24", reference: "Warehouse copy paper", days: 4 },
    { vendor: 0, amount: "19", reference: "Password manager renewal", days: 3.5 },
    { vendor: 1, amount: "36", reference: "Shipping labels and toner", days: 3 },
    { vendor: 0, amount: "25", reference: "Design tool seat", days: 2 },
    { vendor: 2, amount: "72", reference: "Cloud API usage credits", days: 1 },
  ];
  const activity: PaymentEntry[] = purchases.map<PaymentEntry>((purchase, i) => ({ id: `demo-payment-${i + 1}`, accountId: mainId, source: DEMO_MAIN_ADDRESS, destination: vendors[purchase.vendor]!.address, kind: "payment", amount: purchase.amount, currency: "USD", mandateReference: mandates[purchase.vendor]!.reference, agentId: agents[purchase.vendor]!.id, reference: purchase.reference, createdAt: at(purchase.days), settlement: "traditional-demo" })).reverse();
  activity.push({ id: "demo-initial-funding", accountId: mainId, source: "Simulated test-network funding", destination: DEMO_MAIN_ADDRESS, kind: "funding", amount: "5000", currency: "USD", mandateReference: null, reference: "Demo starting balance", createdAt: at(5), settlement: "traditional-demo" });
  return {
    signedIn: false, secrets: { "demo-chat-mandate": "mnd_demo_chat_for_static_demo_only" }, requests: {}, chats: {},
    workspace: { mode: "stellar-testnet", network, customer: { id: ownerId, name: DEMO_LOGIN.name, email: DEMO_LOGIN.email, company: "Demo workspace", team: "Operations" }, accounts, agents, mandates, shared: [], vendors, activity,
      declines: [
        { id: "demo-decline-budget", accountId: mainId, agentId: agents[0]!.id, mandateReference: mandates[0]!.reference, destination: vendors[0]!.address, amount: "400", currency: "USD", reason: "Payment exceeds the mandate's spending limit", reference: "Annual software plan", createdAt: at(0.5) },
        { id: "demo-decline-seller", accountId: mainId, agentId: agents[1]!.id, mandateReference: mandates[1]!.reference, destination: vendors[0]!.address, amount: "40", currency: "USD", reason: "Seller is not approved by this mandate", reference: "Software purchase using the office supplies mandate", createdAt: at(0.3) },
      ] },
  };
}

/** Browser-only simulation. It never signs transactions or contacts a network. */
export function createDemo(storage: Storage, clock = () => Date.now()) {
  const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
  const timestamp = () => new Date(clock()).toISOString();
  const read = (): DemoState => {
    const saved = storage.getItem(DEMO_STORAGE_KEY);
    if (!saved) return seed(clock());
    try {
      const state = JSON.parse(saved) as DemoState;
      requireDemo(state.workspace?.customer?.id === ownerId && Array.isArray(state.workspace.activity) && state.requests && state.secrets && state.chats, 400, "Invalid demo state");
      return state;
    } catch { return seed(clock()); }
  };
  const refresh = (state: DemoState) => {
    for (const mandate of state.workspace.mandates) {
      if (mandate.status === "active" && Date.parse(mandate.expiresAt) <= clock()) mandate.status = "expired";
      const days = mandate.period === "day" ? 1 : mandate.period === "week" ? 7 : 30;
      const window = days * DAY;
      const created = Date.parse(mandate.createdAt);
      const start = created + Math.floor((clock() - created) / window) * window;
      mandate.spent = usd(state.workspace.activity.filter(entry => entry.kind === "payment" && entry.mandateReference === mandate.reference && Date.parse(entry.createdAt) >= start).reduce((sum, entry) => sum + units(entry.amount), 0n));
    }
  };
  const newMandate = (state: DemoState, body: Record<string, unknown>, agentId?: string) => {
    const limit = amount(body.limit);
    requireDemo(["day", "week", "month"].includes(String(body.period)), 400, "Choose a spending period");
    requireDemo(typeof body.expiresAt === "string" && Number.isFinite(Date.parse(body.expiresAt)) && Date.parse(body.expiresAt) > clock(), 400, "Expiry must be in the future");
    requireDemo(!body.accountId || body.accountId === mainId, 403, "Use the demo main account");
    const sellerIds = body.sellerIds ?? [];
    requireDemo(Array.isArray(sellerIds) && sellerIds.length <= 100 && sellerIds.every(seller => Number.isSafeInteger(seller) && seller > 0), 400, "Enter up to 100 positive seller IDs");
    const selected = agentId ?? (typeof body.recipient === "string" ? state.workspace.agents.find(agent => agent.id === body.recipient && agent.status === "connected")?.id : undefined);
    const mandate: AccountMandate = {
      reference: id("demo-mandate"), accountId: mainId, name: text(body.name, "Mandate name"), recipientType: "agent", recipient: selected ?? String(body.recipient || "Any registered agent"),
      ...(selected ? { agentId: selected } : {}), limit, spent: "0", period: body.period as SpendingPeriod, expiresAt: body.expiresAt, status: "active", createdAt: timestamp(), currency: "USD", verifiedRecipientsOnly: true,
      sellerIds: [...new Set(sellerIds as number[])], ...(body.category ? { category: text(body.category, "Category", 40) } : {}),
    };
    state.workspace.mandates.push(mandate);
    if (selected) return { mandate };
    const mandateId = id("mnd_demo");
    state.secrets[mandate.reference] = mandateId;
    return { mandate, mandateId };
  };
  const checkPayment = (state: DemoState, body: Record<string, unknown>, mandate?: AccountMandate) => {
    const account = state.workspace.accounts[0]!;
    const value = amount(body.amount);
    const seller = state.workspace.vendors.find(vendor => vendor.address === body.sellerAddress);
    const agent = state.workspace.agents.find(candidate => candidate.id === body.agentId && candidate.status !== "revoked" && candidate.verified);
    const checks = [
      { label: "Verified demo seller", passed: !!seller },
      { label: "Sufficient demo balance", passed: units(account.balance) >= units(value) },
      ...(mandate ? [
        { label: "Active mandate", passed: mandate.status === "active" && Date.parse(mandate.expiresAt) > clock() },
        { label: "Registered demo agent", passed: !!agent && (!mandate.agentId || mandate.agentId === agent.id) },
        { label: "Within spending limit", passed: units(mandate.spent) + units(value) <= units(mandate.limit) },
        { label: "Approved seller", passed: !mandate.sellerIds?.length || !!seller && mandate.sellerIds.includes(seller.sellerId) },
      ] : []),
    ];
    return { account, value, seller, agent, checks };
  };
  const pay = (state: DemoState, body: Record<string, unknown>, mandate?: AccountMandate): PaymentEntry => {
    const { account, value, seller, agent, checks } = checkPayment(state, body, mandate);
    const failed = checks.find(check => !check.passed);
    requireDemo(!failed, 400, failed ? `Payment declined: ${failed.label}` : "Payment declined");
    const reference = text(body.reference, "Payment reference", 200);
    account.balance = usd(units(account.balance) - units(value));
    const recipient = state.workspace.accounts.find(candidate => candidate.address === seller!.address)!;
    recipient.balance = usd(units(recipient.balance) + units(value));
    const payment: PaymentEntry = { id: id("demo-payment"), accountId: mainId, source: account.address!, destination: seller!.address, kind: "payment", amount: value, currency: "USD", mandateReference: mandate?.reference ?? null, ...(agent ? { agentId: agent.id } : {}), reference, createdAt: timestamp(), settlement: "traditional-demo" };
    state.workspace.activity.unshift(payment);
    refresh(state);
    return payment;
  };
  const publicPay = (state: DemoState, body: Record<string, unknown>) => {
    const mandate = state.workspace.mandates.find(candidate => state.secrets[candidate.reference] === body.mandateId);
    try {
      requireDemo(mandate, 401, "Invalid demo mandate ID");
      return { status: "paid", payment: pay(state, body, mandate) };
    } catch (error) {
      if (!(error instanceof DemoError)) throw error;
      if (mandate) state.workspace.declines.unshift({ id: id("demo-decline"), accountId: mainId, agentId: String(body.agentId ?? ""), mandateReference: mandate.reference, destination: String(body.sellerAddress ?? ""), ...(typeof body.amount === "string" && /^\d+(\.\d{1,7})?$/.test(body.amount) ? { amount: body.amount } : {}), currency: "USD", reason: error.message, reference: String(body.reference ?? "Demo payment"), createdAt: timestamp() });
      return { status: "declined", reason: error.message };
    }
  };
  const dispatch = (state: DemoState, path: string, method: string, body: Record<string, unknown>): unknown => {
    const workspace = state.workspace;
    if (path === "/network") return { mode: "stellar-testnet", network };
    if (path === "/auth/register") throw new DemoError(403, "Account creation is disabled. Use the demo login.");
    if (path === "/auth/login" && method === "POST") {
      requireDemo(body.email === DEMO_LOGIN.email && body.password === DEMO_LOGIN.password, 401, "Email or password is incorrect");
      state.signedIn = true;
      return workspace.customer;
    }
    if (path === "/auth/logout") { state.signedIn = false; return undefined; }
    if (path === "/pay" && method === "POST") return publicPay(state, body);
    if (path === "/pay/preview") {
      const mandate = workspace.mandates.find(candidate => state.secrets[candidate.reference] === body.mandateId);
      requireDemo(mandate, 401, "Invalid demo mandate ID");
      const { account, seller, agent, checks } = checkPayment(state, body, mandate);
      return { agent: { id: String(body.agentId ?? ""), name: agent?.name ?? "Unknown agent", verified: !!agent }, mandate: { ...mandate, address: account.address }, seller: { address: body.sellerAddress, name: seller?.name ?? "Unknown seller", verified: !!seller }, currency: "USD", balance: account.balance, checks };
    }
    requireDemo(state.signedIn, 401, "Use the login button to open the demo workspace");
    if (path === "/workspace") return workspace;
    if (path === "/profile" && method === "PATCH") {
      for (const field of ["company", "team"] as const) if (field in body) workspace.customer[field] = String(body[field] ?? "").trim().slice(0, 80);
      return workspace.customer;
    }
    const funding = path.match(/^\/accounts\/([^/]+)\/funding$/);
    if (funding && method === "POST") {
      requireDemo(funding[1] === mainId, 403, "Use the demo main account");
      const value = amount(body.amount, 2);
      requireDemo(units(value) <= units("1000000"), 400, "Maximum demo funding is 1,000,000 USD");
      const account = workspace.accounts[0]!;
      account.balance = usd(units(account.balance) + units(value));
      const entry: PaymentEntry = { id: id("demo-funding"), accountId: mainId, source: "Simulated test-network funding", destination: account.address!, kind: "funding", amount: value, currency: "USD", mandateReference: null, reference: "Demo funds added", createdAt: timestamp(), settlement: "traditional-demo" };
      workspace.activity.unshift(entry);
      return entry;
    }
    if (path === "/payments" && method === "POST") {
      requireDemo(body.accountId === mainId, 403, "Use the demo main account");
      const mandate = body.mandateReference ? workspace.mandates.find(candidate => candidate.reference === body.mandateReference) : undefined;
      requireDemo(!body.mandateReference || mandate, 404, "Mandate not found");
      return pay(state, { ...body, sellerAddress: body.destination }, mandate);
    }
    if (path === "/mandates" && method === "POST") return newMandate(state, body);
    const mandatePath = path.match(/^\/mandates\/([^/]+)(\/reveal)?$/);
    if (mandatePath) {
      const mandate = workspace.mandates.find(candidate => candidate.reference === mandatePath[1]);
      requireDemo(mandate, 404, "Mandate not found");
      if (mandatePath[2]) { requireDemo(state.secrets[mandate.reference], 400, "This demo agent has no secret mandate ID"); return { mandateId: state.secrets[mandate.reference] }; }
      if (method === "DELETE") { mandate.status = "revoked"; return undefined; }
      if (method === "PATCH") {
        requireDemo(mandate.status === "active", 409, "Only active mandates can be changed");
        if (body.limit !== undefined) mandate.limit = amount(body.limit);
        if (body.category !== undefined) mandate.category = String(body.category ?? "");
        return mandate;
      }
    }
    if ((path === "/agents" || path === "/workflows") && method === "POST") {
      const workflow = path === "/workflows";
      const agent: AccountAgent = { id: id("agt_demo"), accountId: mainId, name: text(body.name, "Agent name"), verified: true, createdAt: timestamp(), ...(workflow || body.connect ? { status: "connected" as const } : {}) };
      if (workflow) newMandate(state, body, agent.id);
      workspace.agents.push(agent);
      return agent;
    }
    const agentPath = path.match(/^\/agents\/([^/]+)$/);
    if (agentPath && method === "DELETE") {
      const agent = workspace.agents.find(candidate => candidate.id === agentPath[1]);
      requireDemo(agent, 404, "Agent not found");
      agent.status = "revoked"; agent.verified = false;
      for (const mandate of workspace.mandates) if (mandate.agentId === agent.id || mandate.recipient === agent.id) mandate.status = "revoked";
      return undefined;
    }
    if (path === "/chat/sessions" && method === "POST") {
      const mandate = workspace.mandates.find(candidate => candidate.reference === "demo-chat-mandate")!;
      const chat = { sessionId: id("demo-chat"), requestId: id("demo-chat-payment"), agentId: "agt_demo_chat", mandate, reply: "", turns: 0, busy: false, complete: false, paymentAttempted: false, conversation: "" };
      state.chats[chat.sessionId] = chat;
      return chat;
    }
    const chatPath = path.match(/^\/chat\/sessions\/([^/]+)(\/messages)?$/);
    if (chatPath) {
      const chat = state.chats[chatPath[1]!];
      requireDemo(chat, 404, "Demo chat not found");
      if (!chatPath[2]) return chat;
      requireDemo(!chat.complete, 409, "Start a new chat for another demo payment");
      chat.conversation += `\n${text(body.message, "Message", 4000)}`;
      chat.turns++;
      const value = chat.conversation.match(/\bpay\s+(\d+(?:\.\d{1,7})?)/i)?.[1] ?? chat.conversation.match(/\b(\d+(?:\.\d{1,7})?)\s*USD\b/i)?.[1];
      const seller = workspace.vendors.find(vendor => chat.conversation.toLowerCase().includes(vendor.name.toLowerCase()) || chat.conversation.includes(vendor.address));
      if (!value || !seller) chat.reply = "This is a local demo assistant. Try: Pay 0.20 USD to Seatwise. Only the demo vendors are supported.";
      else {
        chat.paymentAttempted = true; chat.complete = true;
        chat.paymentResult = publicPay(state, { mandateId: state.secrets["demo-chat-mandate"], agentId: chat.agentId, sellerAddress: seller.address, amount: value, reference: "Simulated chat payment", requestId: chat.requestId }) as PaymentChatState["paymentResult"];
        chat.reply = chat.paymentResult!.status === "paid" ? `Simulated payment of ${value} USD to ${seller.name} completed. No real funds moved.` : `Demo payment declined: ${"reason" in chat.paymentResult! ? chat.paymentResult!.reason : "Not authorized"}`;
      }
      return chat;
    }
    throw new DemoError(404, "This action is not available in the static demo");
  };
  return {
    request(path: string, method = "GET", body: Record<string, unknown> = {}): unknown {
      const state = read();
      refresh(state);
      const mutable = ["POST", "PATCH", "DELETE"].includes(method);
      const cacheKey = mutable && typeof body.requestId === "string" ? `${path}:${body.requestId}` : undefined;
      const fingerprint = JSON.stringify({ method, body });
      // Authorization precedes idempotency, including when a browser has signed out.
      if (cacheKey && path !== "/pay") requireDemo(state.signedIn, 401, "Please log in to the demo");
      const previous = cacheKey ? state.requests[cacheKey] : undefined;
      if (previous) { requireDemo(previous.fingerprint === fingerprint, 409, "Reuse a request ID only with the same details"); return structuredClone(previous.result); }
      const result = dispatch(state, path, method, body);
      if (cacheKey) state.requests[cacheKey] = { fingerprint, result };
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
      return structuredClone(result);
    },
  };
}
