# living-art-screensaver-web

The marketing + account website for **Living Art Screensaver**, built with
[Next.js](https://nextjs.org) and deployed on [Vercel](https://vercel.com).

It handles the landing page, passwordless auth, Stripe billing, the gallery API
served to the desktop app, and the download/auto-update endpoints. See the repo
root `CLAUDE.md` for the full architecture.

## Getting Started

This project uses **pnpm** (do not use npm or yarn). From the repo root:

```bash
pnpm install
```

Then run the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result. Edit
`app/page.tsx` (and the components under `components/`) — the page auto-updates
as you save.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) — Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) — an interactive Next.js tutorial.
