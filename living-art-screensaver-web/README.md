# living-art-screensaver-web

The Living Art Screensaver website: marketing pages, passwordless sign-in, Stripe billing, the gallery API for the desktop app, and the download and auto-update endpoints. Built with Next.js and deployed on Vercel. Architecture notes are in the repo-root `CLAUDE.md`.

```bash
pnpm install   # from the repo root; use pnpm, not npm or yarn
pnpm dev       # http://localhost:3000
pnpm test
```

Setup guides: [`docs/stripe-webhooks.md`](docs/stripe-webhooks.md), [`docs/download-link-email.md`](docs/download-link-email.md).
