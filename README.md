# Mandate

Purchasing agents for teams, inside rules the agents cannot break.

This demo runs entirely in the browser with a fixed TUser login, sample accounts, mandates, and transactions. Its payments and policy checks are simulated, and changes stay in browser storage. No real accounts, funds, signing keys, or blockchain transactions are used. The technology and architecture below describe the full application source, which remains available alongside the static demo.

## Product

Mandate gives teams purchasing agents with defined budgets and approved vendors. Agents connect with their own keys, and Stellar smart contracts enforce their payment rules. Finance teams can review spending, declined attempts, and receipts.

The dashboard organizes the team's account and USD balance around **Workflows**, **Agents**, **Mandates**, and **Spending**.

### Purchasing workflows

A purchasing workflow combines a task, an agent, and a mandate:

1. Choose a template: Software renewals, Office supplies, Cloud and API usage, or a blank workflow.
2. Select verified vendors, a budget, a rolling spending window, and an end date.
3. Connect the agent using a one-time code and give it its purchasing instructions.

Workflow cards show the remaining budget, approved vendors, recent purchases, and declined attempts. Only the signed-in owner can change the budget or approved vendors. Agents cannot raise their own limits.

Teams can maintain company and team details and optionally list their account in the vendor directory.

### Accounts and funding

Each workspace has a main Smart Account and an on-chain USD balance. Agents spend from that balance through their mandates rather than holding separate balances.

**Add funds** offers Stripe Checkout and a Stellar funding flow. The current prototype uses demo USD on Stellar Testnet. Stripe sandbox payments authorize demo funding; they do not transfer real dollars. These tokens are not USDC or redeemable money.

Funding is credited after on-chain confirmation. Interrupted requests can resume without crediting the account twice.

Payments use USD and transfer between verified Smart Accounts. Deposits accept two decimal places; payments and mandate limits retain seven. Account addresses are masked by default, with explicit reveal and copy controls.

### Agents and mandates

Agents connect through MCP, LangChain, or the command line. Each agent with its own key is registered to its owner's account on chain. Mandates assigned to that agent require its signature; Mandate cannot sign on its behalf.

A mandate grants spending access to the main account's existing balance. It defines a rolling allowance, expiry, and optional approved sellers. Multiple mandates can share an account while keeping separate allowances. Removing an agent revokes its access and mandates.

Mandate also supports delegated payments using a secret mandate credential and registered agent identity. Owners can manage these credentials in the dashboard. For this flow, the payment service enforces optional seller lists; for agents with their own keys, those lists are enforced on chain. Seller verification and spending limits are enforced on chain in both flows.

Payments are declined when authorization, recipient verification, allowance, expiry, or balance requirements are not met. Pending transactions remain pending until confirmed.

### Spending and receipts

The **Spending** tab summarizes purchases over the last 30 days by workflow and vendor. It includes declined attempts with their reasons, confirmed funding and payment transactions, explorer links, and CSV exports for finance.

Payment receipts come from confirmed chain activity. Agent reports add purchase descriptions, while chain events allow payments to be recorded even when an agent does not report them. Declined attempts are reported by the agent and evaluated by the service.

### Chat and iPhone app

The dashboard's **Chat** interface uses a LangChain payment agent and supports follow-up questions and payment results. Signed-in users receive a default chat agent and mandate with a limited allowance. Payments use the main account's existing balance.

The native iPhone app supports workspace sign-in, account views, agent connection and removal, and mandate creation and revocation.

## Technology

Mandate is a pnpm workspace with TypeScript services, a React dashboard, a native iOS app, and Rust smart contracts on Stellar.

| Layer | Technology |
|---|---|
| Web dashboard | React and Vite |
| Payments API | Node.js, TypeScript, and Express |
| Persistence | SQLite |
| Smart accounts and policies | Rust and OpenZeppelin Stellar contracts |
| Blockchain integration | Stellar SDK |
| HTTP purchases | x402 |
| Agent integrations | Model Context Protocol SDK and LangChain |
| Conversational payments | Google's Gemini through LangChain |
| Funding checkout | Stripe Checkout |

### Open-source foundations

| Project | Role in Mandate |
|---|---|
| [OpenZeppelin Stellar contracts](https://github.com/OpenZeppelin/stellar-contracts) | Smart accounts, context rules, spending limits, and signature verification |
| [x402](https://github.com/x402-foundation/x402) | Agent purchases over HTTP and payment facilitation |
| [Stellar SDK](https://github.com/stellar/js-stellar-sdk) | Transactions, simulation, and on-chain authorization |
| [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) | Tools for connecting assistants to Mandate |
| [LangChain](https://github.com/langchain-ai/langchainjs) | Agent tools and conversational payment integration |

Mandate adds agent and seller registries, agent verification, and recipient policies. Its open-source x402 facilitator supports smart accounts with payment policies.

## Architecture

### Components

| Component | Responsibility |
|---|---|
| [apps/web](apps/web) | Owner dashboard, chat interface, and public payment interface |
| [apps/ios](apps/ios) | Native workspace client |
| [apps/receipts](apps/receipts) | Workspace API, funding, payment coordination, and chain-derived receipts |
| [apps/agent](apps/agent) | Agent-owned keys and purchasing tools for MCP, LangChain, and the command line |
| [apps/merchant](apps/merchant) | Vendor catalog and x402-protected product endpoints |
| [apps/facilitator](apps/facilitator) | Verification and submission of x402 payments |
| [packages/langchain](packages/langchain) | Delegated payment client, conversational agent, and chat integration |
| [packages/shared](packages/shared) | Shared types and utilities |
| [contracts](contracts) | Smart account, registries, signature verifiers, and payment policies |

### Payment flow

The web and native clients use the payments API for workspace operations. Agents with their own keys authenticate their requests and sign their transfers.

For direct payments, the API prepares a transfer, the agent verifies and signs it, and the API submits it. For x402 purchases, the agent authorizes the vendor's payment request and the facilitator submits it.

In both paths, the owner's Smart Account checks the applicable authorization, spending allowance, expiry, and recipient policies on Stellar. The API reads confirmed chain events to produce receipts.

### Seller verification

Seller verification is an on-chain registry entry associated with the exact recipient Smart Account address. A display name or valid address alone does not establish verification. Revoking a registry entry blocks subsequent payments to that recipient.

The prototype attests accounts it provisions. This verification does not constitute KYC, business verification, or domain-ownership verification.

### Data and security

Workspace records and transaction journals are stored in SQLite. Sensitive credentials held by the service are encrypted at rest. Agents with their own keys retain control of those keys.

Owner actions require authenticated sessions, and agent actions require authorization associated with the registered agent. Secret mandate credentials are excluded from ordinary workspace responses, receipts, and public links.

Persisted transaction records support retries and recovery. Funding confirmation handles duplicate requests and callbacks without issuing duplicate credits.

## License

[MIT](LICENSE).
