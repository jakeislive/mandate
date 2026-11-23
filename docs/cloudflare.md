# Real Testnet snapshot on Cloudflare Pages

The `deploy` branch displays fixed public records from the actual Stellar Testnet: two smart accounts, two on-chain spending mandates, and three confirmed USD transfers. It needs no runtime API, database, Stripe credentials, Gemini key, or Stellar signing keys.

Cloudflare builds and publishes only the web app in `apps/web/dist`. The native iOS app in `apps/ios` is not built, uploaded, or deployed.

## Connect the GitHub repository

In the Cloudflare dashboard, create a **Pages** project and connect this GitHub repository. Use these settings:

| Setting | Value |
|---|---|
| Production branch | `deploy` |
| Framework preset | Vite |
| Root directory | Repository root; leave blank |
| Build command | `pnpm build` |
| Build output directory | `apps/web/dist` |
| Node version | `24` (also declared in `.node-version`) |
| Build environment variable | `PNPM_VERSION=12.18.0` |

No runtime secrets are required. Leave `VITE_STATIC_DEMO` unset: the read-only snapshot is the default. Do not set it to `false` for this deployment. The build validates the snapshot's data limits before producing the web assets.

Select **Save and Deploy**. Pages publishes the site and rebuilds it when commits reach `deploy`. The included redirect rules support direct visits and refreshes on dashboard, mandate, spending, payment, and chat routes.

If you begin in the Workers setup flow, choose **Pages** before connecting the repository. This project publishes static assets and does not need a Worker entry point or deploy command.

See [Cloudflare's Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/) for the dashboard workflow.

## Snapshot behavior

**Login** opens the fixed TUser view. Public demo credentials are `test@testing.com` and `testing1234567890`; they select a public view and do not grant control of the displayed wallets. Public account creation is disabled.

The public records are embedded in [testnet-snapshot-data.ts](../apps/web/src/testnet-snapshot-data.ts). Account and transaction links open Stellar Testnet explorer pages. Balances and mandate rules were read from the chain during verification; the page clearly shows the verification timestamp and ledger. They are a historical snapshot, not live balances. Mandate expiry is shown as the exact on-chain ledger number.

Warnings identify these as test accounts on a test network and prohibit adding real funds or connecting real accounts. Creation, mandate changes, funding, payments, and chat are disabled. The page never signs or submits a transaction.

No account, mandate, transaction, request, or chat collections are saved in browser storage. Session storage holds only a one-character login flag; the theme preference may use local storage. The previous simulator's local data is discarded without parsing it.

## Fixed data limits

- At most **5 accounts** in the user's view.
- At most **5 mandates** in the user's view.
- At most **5 distinct transactions per account**, counting both incoming and outgoing transfers.
- At most **64 KB** of public snapshot data.

Validation rejects data exceeding these limits during snapshot preparation, before a production build, and before display. The data is immutable, unsupported write requests are rejected, and there are no growing caches or collections. Visitors cannot add records to shared server memory because the deployed site has no application server or database. These are limits on displayed records; they do not restrict unrelated activity on the Stellar network.

## Verify and refresh the public records

```sh
pnpm snapshot:testnet
```

This explicit, read-only preparation step verifies the Testnet network passphrase, smart account existence, seller-registry status, actual mandate policies and limits, successful transaction receipts, envelope hashes, transfer details, and matching on-chain mandate spending history. It writes only public snapshot fields and uses no signing keys or database. A failed verification leaves the existing snapshot unchanged.

Builds use the checked-in snapshot and do not query the network. If Testnet resets or records become unavailable, the displayed verification timestamp still identifies the historical observation; refresh requires available chain records.

## Local preview and validation

```sh
pnpm install --frozen-lockfile
pnpm dev:demo
```

```sh
pnpm typecheck
pnpm test:demo
pnpm test:ui:demo
pnpm build
```

The original API and contract source remain available in the repository but are not included as running services in the static deployment. Live-service browser integration tests explicitly disable the static adapter.
