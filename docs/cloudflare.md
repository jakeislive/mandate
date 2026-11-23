# Static demo on Cloudflare Pages

The `deploy` branch runs entirely in the browser. It uses fixed demo accounts and sample activity, with edits saved in local storage. It needs no API, database, Stripe credentials, Gemini key, or Stellar signing keys.

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

No runtime secrets are required. Leave `VITE_STATIC_DEMO` unset: the static demo is the default. Do not set it to `false` for this deployment.

Select **Save and Deploy**. Pages publishes the site and rebuilds it when commits reach `deploy`. The included redirect rules support direct visits and refreshes on dashboard, mandate, spending, payment, and chat routes.

If you begin in the Workers setup flow, choose **Pages** before connecting the repository. This project publishes static assets and does not need a Worker entry point or deploy command.

See [Cloudflare's Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/) for the dashboard workflow.

## Demo behavior

**Login** opens the fixed TUser workspace. Public demo credentials are `test@testing.com` and `testing1234567890`; they are not a security boundary or credentials for a real service. Public account creation is disabled.

The initial workspace contains one main account, three vendor accounts, three purchasing workflows, a chat mandate, six simulated purchases, and two declined attempts. Funding, payments, mandate creation, budget edits, agent removal, and a local scripted payment chat update browser-local demo data.

Warnings appear throughout the site and in creation, funding, and payment flows. Demo addresses are deliberately invalid for Stellar transfers. No action submits a blockchain transaction or moves real funds. Chat messages are processed locally and are not sent to an AI provider.

Each browser has its own copy. Signing out preserves its demo history; clearing this site's local storage restores the sample data.

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
