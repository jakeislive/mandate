# Real Testnet snapshot on Cloudflare Workers

The `deploy` branch displays fixed public records from the actual Stellar Testnet: two smart accounts, two on-chain spending mandates, and three confirmed USD transfers. It needs no runtime API, database, Stripe credentials, Gemini key, or Stellar signing keys.

Cloudflare builds and publishes only the web app in `apps/web/dist`. The native iOS app in `apps/ios` is not built, uploaded, or deployed.

## Connect the GitHub repository

The repository includes a root [wrangler.json](../wrangler.json) for a **Workers Static Assets** deployment. This matches the dashboard flow that runs `npx wrangler deploy`. It publishes only `apps/web/dist`, with no backend Worker entry point, database, or mobile build.

Connect this GitHub repository to the Worker using these settings:

| Setting | Value |
|---|---|
| Production branch | `deploy` |
| Root directory | Repository root; leave blank |
| Build command | `pnpm run build` |
| Deploy command | `npx wrangler deploy` |
| Worker name | `mandate`; match the dashboard name to `wrangler.json` |
| Static asset directory | `apps/web/dist`, configured in `wrangler.json` |
| Node version | `24` (also declared in `.node-version`) |
| Build environment variable | `PNPM_VERSION=12.18.0` |

No runtime secrets are required. Leave `VITE_STATIC_DEMO` unset: the read-only snapshot is the default. Do not set it to `false` for this deployment. The build validates the snapshot's data limits before producing the web assets.

Select **Save and Deploy**. Cloudflare publishes the site and rebuilds it when commits reach `deploy`. The asset configuration enables single-page application routing for direct visits and refreshes. The included header and redirect files are copied into the static build output.

The Worker name must match the name in `wrangler.json`. If the existing dashboard project has a different name, change the config's `name` to that exact name before retrying.

See [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) and [static asset configuration](https://developers.cloudflare.com/workers/static-assets/binding/) for the dashboard workflow and configuration format.

## Why the earlier deployment failed

The log's `pnpm run build` succeeded. The next command, `npx wrangler deploy`, had no root Wrangler configuration, so Cloudflare tried automatic application detection at the monorepo root and refused to select an application. The explicit asset directory fixes that ambiguity.

The logged build command also omitted the Testnet snapshot validation step. That means it built a revision older than the current real-Testnet `deploy` branch. Confirm the production branch is `deploy` and the latest local commits have been pushed. Selecting `deploy` alone does not fix a missing Workers configuration.

For an alternative **Pages** project, publish `apps/web/dist` after `pnpm run build` without a Wrangler deploy command. The settings above are for the existing Workers deployment flow shown in the error log.

## Snapshot behavior

The dashboard opens directly to the fixed public view with **User ID: TUser**. No login or session storage is required. The ID labels the public view and does not grant control of the displayed wallets. Public account creation is disabled.

The public records are embedded in [testnet-snapshot-data.ts](../apps/web/src/testnet-snapshot-data.ts), including the verification timestamp and ledger. Account and transaction links open Stellar Testnet explorer pages. Balances and mandate rules were read from the chain during verification and represent a historical snapshot. Mandate expiry is shown as the exact on-chain ledger number.

Warnings identify these as test accounts on a test network and prohibit adding real funds or connecting real accounts. Creation, mandate changes, funding, payments, and chat are disabled. The page never signs or submits a transaction.

No account, mandate, transaction, request, or chat collections are saved in browser storage. The public dashboard opens without login or session storage; the theme preference may use local storage. API initialization discards the previous simulator's local data without parsing it.

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

Builds use the checked-in snapshot and do not query the network. If Testnet resets or records become unavailable, the embedded verification timestamp still identifies the historical observation; refresh requires available chain records.

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
