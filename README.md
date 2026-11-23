# Mandate

Purchasing agents for teams, inside rules the agents cannot break.

## Product

A team at a mid-sized company sets up a **purchasing workflow** in a minute: what an agent buys (software renewals, office supplies, cloud and API usage), which vendors it may use, and its budget. The agent connects with its own key. Every payment it makes is checked by Stellar smart contracts against that budget and vendor list, and leaves a receipt the finance team can export.

- **Workflows**: pick a template, choose approved vendors by name, set a budget. You get a one-time code and ready-made instructions for the agent.
- **One sign-in per agent**: each agent makes its own key, registered on chain. Nobody else can pay as it, including Mandate.
- **No approval requests**: an agent cannot ask for more. Only the signed-in owner can change a budget, and the change is written to Stellar.
- **Spending**: totals by workflow and vendor, every refused attempt with the reason, receipts read from chain events and a CSV export.

The dashboard shows the team's account and USD balance at the top, followed by **Workflows**, **Agents**, **Mandates** and **Spending**. Signup provisions a private Classic wallet and a verified Smart Account automatically.

### Purchasing workflows

**Workflows → New purchasing workflow** is where a team that has never run a purchasing agent starts:

1. **Pick a template**: Software renewals, Office supplies, Cloud and API usage, or a blank one.
2. **Choose vendors and a budget.** Vendors are picked by name from the directory of verified sellers; the ones that sell that kind of thing start selected. Set the budget, its window (24 hours, 7 days or 30 days) and an end date.
3. **Hand the agent its code.** The dashboard shows a one-time code, the command that adds Mandate to Claude, and instructions to paste into the agent: its job, how to check its budget, and to stop and report if a purchase is declined.

A workflow is an agent with its own key plus a mandate. The mandate is drafted in step 2 and goes on Stellar the moment the agent connects, because its only signer is the key the agent makes for itself. If that step fails, the next dashboard load retries it.

Each workflow card shows what is left of the budget, its vendors, its last purchase and how many attempts were refused. **Change budget** rewrites the limit in the spending-limit policy on Stellar. Only the signed-in owner can do this; agents have no route to ask.

The company and team are set at signup or with **Edit team**. Accounts are listed in the vendor directory only if they choose to be (`PATCH /api/profile` with a `vendor` name and category).

### Accounts and funding

Create an account with your name, email and password. Your main account starts with zero USD balance and is ready to fund after signup. If network setup is interrupted, sign in again to resume the same wallet pair.

Signup automatically provisions a dedicated Classic wallet and Smart Account, installs asset-specific payment policies, and registers the C address
as a verified recipient. The dashboard shows the Smart Account address and live
USD balance. The Classic wallet remains private.

**Add funds** offers **FIAT**, through Stripe Checkout, and **Testnet**, through the Stellar funding flow. Both credit the same on-chain demo USD balance. Stripe currently uses sandbox payments, which authorize demo funding rather than transferring real dollars. The token is not USDC or redeemable money.

Funding follows this flow:

1. The account owner selects a funding method and amount with up to two decimal places.
2. For FIAT, the API verifies that the Stripe session is paid and matches the stored account and amount. Signed webhooks complete funding even if the browser closes; returning to the dashboard also checks confirmation.
3. The demo issuer sends that exact amount to the account's mapped Classic wallet, creating its USD trustline automatically.
4. The service forwards the USD tokens through their Stellar Asset Contract into the Smart Account.
5. After forwarding confirms, the dashboard refreshes its on-chain USD balance and shows the funding receipt.

Checkout requests and confirmed funding are persisted so retries and duplicate webhooks reuse the same checkout and credit once. Cancelled, unpaid, expired or mismatched sessions do not credit the account.
The issuer's private key is encrypted in the custody vault. Its public address and token contract are exposed in `/api/network`.
The Classic wallet retains XLM privately for reserves and fees.

Deposits accept up to 1,000,000 demo USD per request. Both funding transactions
persist before broadcast. Repeating an unchanged request resumes interrupted
funding without issuing or forwarding tokens twice. Only confirmed forwarding
creates a successful funding receipt.

All payments transfer from a Smart C address to another verified Smart C address.
All accounts fund, receive and spend the same demo USD token. The dashboard
shows only the actual on-chain USD balance. Smart Account addresses start masked;
**Show Smart Account address** reveals them, and **Hide Smart Account address**
masks them again. **Copy Smart Account address** works while masked. Mandates and payments always use USD,
with no currency selector. Classic G addresses are not payment recipients.
Payments and mandate limits retain seven decimal places; deposits accept two.
Existing XLM remains on chain and is not converted into or displayed as USD.

The **Spending** tab totals agent purchases over the last 30 days by workflow and
by vendor, lists every attempt the account refused with the reason, and shows
confirmed funding and payment transactions with explorer links. **Export CSV**
downloads purchases and refusals for finance. The dashboard refreshes when returning to its tab and every 15 seconds.
Payments back to the source account are rejected.

### Agents and on-chain identification

The **Agents** tab lists every agent associated with your main account. **Add agent** adds one that holds its own key: for Claude over MCP, LangChain agents and scripts. It connects with a one-time code; see [Agents with their own key](#agents-with-their-own-key-mcp-langchain-x402).

**Other ways to connect** in that dialog offers the older kind, an agent **with a mandate ID**: it registers a name and a stable public identification value (`agt_…`) right away, and pays on the Pay page or in chat with a secret mandate ID that the service signs for. Any agent of this kind can use any of the account's secret-ID mandates.

Agents have no balance or spending limits of their own. **Remove agent** deletes its registry entry on chain and revokes every mandate it holds.

The service attests `(Smart Account C address, agent ID)` in an administrator-controlled agent registry, following the seller-verification pattern. Registrations appear only after chain confirmation, and the dashboard checks their current on-chain status. Agent names are display labels; the registry entry determines membership. Identification is public and is not a separate bearer secret or proof of legal identity.

For secret-ID mandates, payments require both the secret `mandateId` and the registered `agentId`. The mandate verifier checks the on-chain registry during Smart Account authorization. The mandate signature binds the agent ID to the account, rule and payment digest, and emits an on-chain agent authorization event. Foreign, missing, unknown or revoked identities cannot authorize a mandate payment. The API records `agentId` in activity and receipts. Existing mandate rules are upgraded before payment by replacing the old signer with the agent-aware verifier; their limits and spending history remain intact.

### Agents with their own key (MCP, LangChain, x402)

An agent that holds its own key can pay only under the mandates you give it, and Mandate cannot pay as it. There are no approval requests: an agent cannot ask for more, and nothing it does can raise a limit or add a seller. A workflow does steps 1 and 3 for you; this is the same thing by hand.

1. **Agents → Add agent.** The dashboard shows a one-time code (like `K7Q4-92XD`, valid 30 minutes, usable once). Nothing is registered yet.
2. **Connect the agent.** The agent redeems the code through the MCP, LangChain or command-line integration. The agent creates an ed25519 key in `~/.mandate/agent.json` (mode 600) and signs the connect request with it. Mandate then registers `(account, agent ID) → public key` in the on-chain agent registry. From then on, the registry accepts only that key for this agent.
3. **Mandates → New mandate**, and choose the agent as **Mandate user**. Its key becomes the rule's **only signer**: there is no secret mandate ID, Mandate holds no key for it, and the Pay page and `/api/payments` refuse it. The seller ID list is resolved to addresses and written into the rule on chain, so every listed ID must already belong to a Mandate account.
4. **The agent pays.** Each request to Mandate is signed with its key (`x-mandate-agent`, `x-mandate-time`, `x-mandate-signature` over method, path, time and body hash; signatures expire after 5 minutes).
   - **Direct payment** (`pay_seller`): Mandate checks the seller, limit, list, balance and expiry, then builds the transfer and returns the unsigned authorization. The agent decodes it and refuses to sign anything except `transfer(account, seller, amount)` on the USD token. It signs and returns it, and Mandate submits it and pays the network fee.
   - **x402** (`find_products`, `buy`): the agent pays a vendor directly, signing the x402 payment itself, and the vendor's facilitator submits it. The agent then reports the purchase with a one-line reason, and Mandate records it only after reading the confirmed transfer from chain: from this account, in USD, to a verified seller. If the account refuses the payment, the agent reports the attempt and Mandate works out the reason itself, so the owner sees it under **Spending**.

**Receipts come from the chain, not from the agent.** The verified-seller policy emits a `PaymentAuthorized` event for every mandate payment, whoever submitted it. The API reads those events every few seconds and records any payment it does not already have, so an agent that pays a store and never reports it still leaves a receipt. The agent's report only adds the description. Refusals never reach the chain, so those are still reported by the agent.

Every payment is checked again by the owner's smart account on Stellar, whether or not it went through Mandate: the agent verifier (signature, plus the registered key for this agent), the spending-limit policy, and the verified-seller policy (verified C address, and the mandate's seller list if it has one). So an agent that skips Mandate, uses x402, or tries another key still cannot overspend, pay an unverified or unlisted seller, or pay after you remove it.

The same agent works three ways, all from [`apps/agent`](apps/agent):

| Use | How |
|---|---|
| MCP (Claude and other assistants) | Tools `connect_to_mandate`, `check_mandates`, `check_seller`, `pay_seller`, `find_products`, `buy` |
| LangChain | `import { createMandateTools } from "@mandate/agent/langchain"`: the same tools as LangChain tools |
| Command line | Connection, mandate and seller queries, direct payments, product search and purchases |

### Mandates and third-party payments

There is one mandate flow for all accounts. A mandate grants a person or
agent spending access to an existing Smart Account's USD balance.
Creating one does not open an account or create another balance. No source-account selection is needed.

1. Open **Mandates**. New mandates automatically use your main account.
2. Enter the holder, USD limit, rolling period and expiry. Optionally type seller IDs separated by commas or spaces (for example, `101, 202, 303`).
3. Use **Show mandate** to reveal and save the secret mandate ID. The Pay link is simply `/pay`.

Every new mandate installs an on-chain signer and an asset-scoped contract rule,
with a rolling spending limit, ledger expiry and verified-recipient policy.
The API also checks wall-clock expiry. Several mandates can share an account,
each with its own allowance. A USD mandate cannot authorize an XLM transfer.
Revocation disables the secret ID immediately; pending on-chain revocation remains
visible and retryable until the rule is removed.

Each account has a stable numeric seller ID kept internally and assigned
automatically to existing accounts. (For a mandate held by an agent with its own key,
the list is enforced on chain instead; see above.) A mandate accepts up to 100 positive whole-number
seller IDs; duplicates are removed. An empty list allows any verified seller.
Creation validates only the list format, so sellers need not exist or be verified yet.
At payment preview and submission, the service matches the actual destination address
to its seller ID and enforces the list. Seller verification is still required at payment
time and enforced on chain; the numeric seller list is enforced by the payment service.
The API accepts the optional field as `sellerIds: [101, 202, 303]`.

The holder opens `/pay` without an owner login, enters the secret mandate ID, their registered agent identification and
the seller's Smart Account C address copied from their dashboard, then checks and
submits the payment. The mandate determines the buyer's source account and currency;
there is no payment-method selector. The recipient's display name does not establish verification.

The secret mandate ID is a bearer credential; the public agent ID identifies the paying agent and must be registered to the source account. It never appears in links or receipts.
The Pay page always masks it. The owner's dashboard reveals it only after
**Show mandate**, and clears it after **Hide mandate**. **Copy mandate ID** retrieves
the secret through the owner-authenticated endpoint and copies it without revealing
it in the field. Copy buttons work while masked or visible.
Invalid IDs, unverified recipients, limits, expiry, revocation and insufficient
funds decline payment. Unchanged retries reuse their request ID. Pending blockchain
transactions are reported as pending until confirmed.

### LangChain module

[`packages/langchain`](packages/langchain/README.md) provides a standalone LangChain payment agent, a direct payment client and the dashboard's **Chat** interface. Payment prompts include a mandate ID, agent identification, seller Smart Account address and USD amount. The direct client uses explicit arguments without a model. Both call `/api/pay` with a stable request ID.

The chat interface supports follow-up questions and displays payment results. Google's Gemini runs on the API server, keeping its API key out of the client.

New users receive a registered **Chat agent** and **Chat mandate** during signup.
The mandate allows **1 USD per rolling 24 hours** and expires after 30 days.
Signed-in chats use both automatically, so payment prompts only need the seller
address and amount. Existing users receive these defaults when loading the
dashboard, signing in, or starting a signed-in chat. Creating a mandate grants access to the account's
existing balance; fund the main account before paying.

The create-mandate form has an optional **Mandate user** dropdown listing the
account's agents. Leaving it empty labels the mandate **Any registered agent**.
This is a user label; any registered agent on the source account can use
the mandate. Revoked or expired default mandates are never recreated on login.

### iPhone app

The native app lives in [apps/ios](apps/ios) and uses the same Mandate terminology as the web dashboard. It reads `/api/workspace`, creates mandates and revokes them by their record reference. It uses session cookies and converts USD amounts for the native views.

The app's Agents screen adds agents with their own key (showing the one-time code), lists their status and removes them. Mandates for such agents show that only the agent's key can sign. Secret-ID mandate payments require both the secret mandate ID and an on-chain registered agent identification; use the web Pay page or the LangChain client. The native detail sheet can reveal the mandate ID after owner sign-in.

## Technology

Mandate is a pnpm workspace with TypeScript services on Node.js, a React dashboard built with Vite, a native iOS app, and Rust smart contracts on Stellar. The payments API uses Express and SQLite. Stripe Checkout handles FIAT funding confirmation, and LangChain connects the chat interface to Google's Gemini.

### Open-source foundations

Mandate is MIT licensed ([LICENSE](LICENSE)) and stands on open-source Stellar work:

| Piece | What we use it for |
|---|---|
| [OpenZeppelin Stellar contracts](https://github.com/OpenZeppelin/stellar-contracts) (`stellar-accounts`, MIT) | The smart account, context rules, the spending-limit policy and the Ed25519 verifier. Our account, spending-limit policy and verifier contracts are thin wrappers over it |
| [x402](https://github.com/x402-foundation/x402) (`@x402/stellar`, `@x402/express`, `@x402/fetch`, Apache-2.0) | Agent purchases over HTTP, and the base of our facilitator |
| [Stellar SDK](https://github.com/stellar/js-stellar-sdk) | Transactions, simulation and on-chain authorization |
| [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [LangChain](https://github.com/langchain-ai/langchainjs) | How agents connect |

What we add on top is in [contracts](contracts): an agent registry and agent verifier (one key per agent, bound on chain), a seller registry and a verified-seller policy (a mandate can only pay verified sellers, optionally a fixed list).

**The facilitator is open too.** Stock x402 facilitators reject payments from smart accounts that run policies. [apps/facilitator](apps/facilitator) extends x402 to support those accounts, and [docs/upstream](docs/upstream) has the same fix as a patch for `@x402/stellar`.

## Architecture

| Component | Responsibility |
|---|---|
| [apps/web](apps/web) | Owner dashboard, chat interface and public Pay page |
| [apps/ios](apps/ios) | Native workspace client using the same payments API |
| [apps/receipts](apps/receipts) | Payments API, sessions, workspace state, custody vault, funding, transaction journal and chain-derived receipts |
| [apps/agent](apps/agent) | Agent-owned keys and purchasing tools exposed through MCP, LangChain and the command line |
| [apps/merchant](apps/merchant) | Vendor catalog and x402-protected product endpoints |
| [apps/facilitator](apps/facilitator) | Verification and submission of x402 payments from smart accounts with policies |
| [packages/langchain](packages/langchain) | Secret-ID payment client, conversational agent and chat integration |
| [packages/shared](packages/shared) | Shared types and utilities |
| [contracts](contracts) | Smart account, agent and seller registries, signature verifiers and payment policies |

The web and native clients call the payments API for workspace operations. Agents with their own keys use signed requests and authorize transfers themselves. Direct payments are submitted by the API; x402 payments are submitted through the vendor's facilitator. In either path, the owner's Smart Account enforces the mandate on Stellar, and the API reads confirmed events to produce receipts.

### Seller verification

Stellar verification uses **an on-chain registry entry keyed by the exact recipient
Smart Account C address**. A valid address or seller display name alone does not
establish verification.

During account provisioning, the service checks that the Smart Account responds
to `get_context_rule(0)`. The registry administrator then calls
`register(C_address, "workspace/<account-id>")`. The registry stores that address,
metadata and verification ledger. Only its administrator can register or revoke entries.

Before payment, the API calls `is_verified(C_address)`. The sender's payment policy
checks that same registry during on-chain authorization. A mandate additionally
checks its spending limit. Revoking a recipient's registry entry blocks later payments.

The prototype automatically attests accounts it provisions. It does not perform KYC,
business verification or domain-ownership verification. All accounts use
this same registry verification.

### Storage and security

Signing keys, secret mandate IDs and cached command responses are encrypted with
AES-256-GCM. Passwords use salted scrypt hashes; sessions and mandate IDs are
authenticated by their hashes. Ordinary workspace, preview and payment responses
exclude the secret ID. Records and receipts use a separate non-secret `reference`
for management and auditing.
Stellar envelopes persist before
broadcast and retain their original transaction IDs on retries.

### API

| Route | Purpose |
|---|---|
| `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Email/password sessions |
| `GET /api/workspace` | Main account, agents, mandates, activity, refused payments and the vendor directory |
| `PATCH /api/profile` | Company and team for the workspace; `vendor: { name, category }` lists the account in the vendor directory, `vendor: null` removes it |
| `POST /api/workflows` | A purchasing workflow: adds an agent that will bring its own key and drafts its mandate (`name`, `category`, `limit`, `period`, `expiresAt`, `sellerIds`), granted on chain when the agent connects |
| `PATCH /api/mandates/:id` | Owner only: change a mandate's `limit` (rewritten in the spending-limit policy on Stellar) or `category` |
| `POST /api/agents` | Register an agent on chain with a name and request ID; with `connect: true`, add an agent that will bring its own key and return its one-time code |
| `POST /api/agents/:id/pairing` | New one-time code for an agent still waiting to connect |
| `DELETE /api/agents/:id` | Remove an agent from the registry and revoke its mandates |
| `POST /api/agent/connect` | Agent-signed: redeem the code and register the agent's key on chain |
| `GET /api/agent/me`, `/api/agent/mandates`, `/api/agent/sellers/:address` | Agent-signed: connection details, its mandates, seller verification |
| `POST /api/agent/payments/prepare`, `/api/agent/payments/submit` | Agent-signed: build a transfer for the agent to sign, then submit it |
| `POST /api/agent/x402` | Agent-signed: record an x402 purchase after reading it from chain |
| `POST /api/agent/declines` | Agent-signed: report an x402 purchase the account refused; the reason is worked out by the service |
| `POST /api/accounts/open` | Legacy compatibility: returns the existing main account; never opens an additional account |
| `POST /api/accounts/:id/funding` | Funding with amount and request ID; `method: "fiat"` (default) returns HTTP 201 with `{ status: "checkout", provider: "stripe", mode: "test", sessionId, url }`; `"testnet"` returns HTTP 201 with a confirmed funding receipt |
| `GET /api/funding/stripe/:sessionId` | Owner-authenticated Stripe confirmation; returns `paid` with a funding receipt, `pending`, or `expired` |
| `POST /api/stripe/webhook` | Raw-body Stripe webhook with a verified `Stripe-Signature`; completes paid sandbox funding idempotently |
| `POST /api/mandates` | Create a mandate on the main account; `accountId` is optional for older clients |
| `POST /api/mandates/:reference/reveal` | Owner-only retrieval of the secret mandate ID for Show mandate |
| `DELETE /api/mandates/:reference` | Revoke a mandate using its non-secret record reference |
| `POST /api/payments` | Owner or delegate payment |
| `POST /api/pay/preview`, `/api/pay` | Third-party checks and payment using the secret `mandateId` in the JSON body |
| `GET /api/network`, `/api/health` | Testnet metadata and service status |

All new funding and payment successes have `settlement: "stellar-testnet"`, a
`txHash` and explorer link. All new receipts use USD.
Mandate creation and payments require no currency input; explicit non-USD
requests are rejected. Public Pay requests derive the buyer's account from the mandate.
Public Pay endpoints require the secret `mandateId` in the JSON body. They do not
use an owner cookie or a separate Authorization Bearer token. Agent identification is also required as `agentId`. The owner-authenticated
creation response is `{ mandate, mandateId }`; its `mandate.reference` is not a
payment authorization. Secrets are never put in links, receipts or on-chain arguments.

## License

[MIT](LICENSE).
