# Screensaver Art — Project Reference

## What this project is
A **pnpm workspace** monorepo containing:
- **Shared UI library** (`packages/ui/`) — React components shared between the website and Electron app
- **Electron companion app** (`electron-app/`) — cross-platform desktop app (auth, gallery browser, cache management)
- **macOS screensaver** (`screensaver/`) — native Swift `.saver` bundle, streams art from R2
- **Marketing + account website** (`living-art-screensaver-web/`) — Next.js, deployed to `living-art-screensaver.com` via Vercel
- **Gallery playlist** (`gallery.json`) — single source of truth for all art items
- **Web preview** (`index.html`) — standalone HTML+CSS+JS, no build step

## Key paths
| Path | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Workspace config — ties all packages together |
| `packages/ui/` | **Shared UI** — React components (LoginForm, SignUpForm, SubscriptionCard, base UI) |
| `electron-app/` | **Electron companion app** — gallery browser, auth, cache management |
| `index.html` | Standalone web preview (HTML+CSS+JS, no build step) |
| `gallery.json` | Playlist — all art items with `src`, `title`, `type`, `collection`, `date`, prompts |
| `R2 Bucket` | `https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/` — MP4 assets |
| `screensaver/*.swift` | Native screensaver — split into focused modules (see below) |
| `screensaver/Info.plist` | Bundle metadata (CFBundleIdentifier, NSPrincipalClass) |
| `screensaver/build.sh` | Build + install script |
| `screensaver/distribute.sh` | Packages the screensaver as a distributable DMG |
| `living-art-screensaver-web/` | Next.js website (marketing, auth, billing, gallery API) |
| `living-art-screensaver-web/app/api/gallery/route.ts` | **The gating endpoint** — serves gallery to the macOS app |
| `living-art-screensaver-web/app/api/subscription/verify/route.ts` | Subscription status check |
| `living-art-screensaver-web/app/api/webhooks/stripe/route.ts` | Stripe → Supabase sync |

## Getting started (pnpm workspace)
```bash
pnpm install              # install all workspace dependencies from repo root
```

## Build & install the screensaver
```bash
bash screensaver/build.sh --install
# kills cached processes, compiles, installs to ~/Library/Screen Savers/ScreensaverArt.saver
```

## Electron companion app
```bash
cd electron-app
pnpm dev                  # launches Electron with HMR
pnpm build                # builds to electron-app/out/
```
- Uses `electron-vite` for build tooling (main + preload + renderer)
- Renderer is React + Tailwind v4, imports shared components from `@screensaver-art/ui`
- Auth via `@supabase/supabase-js` (not SSR — stores session in Chromium localStorage)
- Cache management: main process handles file I/O via IPC; renderer shows stats and clear button
- Cache dir: `~/Library/Caches/ScreensaverArt/` (macOS), `%LOCALAPPDATA%\ScreensaverArt\` (Windows)

## Website (living-art-screensaver-web)
```bash
cd living-art-screensaver-web
pnpm dev                  # localhost:3000
```
- Deployed on **Vercel** (project `v0-living-art-screensaver`, team `gavin-1a51c3e5`)
- Vercel is connected to **this repo** (`zerolocker/screensaver-art`), root directory set to `living-art-screensaver-web/`
- Auto-deploys on push to `master`
- Uses **pnpm** — do not use npm or yarn

## Shared UI library (packages/ui)
- Package name: `@screensaver-art/ui`
- Exports: `LoginForm`, `SignUpForm`, `SubscriptionCard`, base UI components (`Button`, `Card`, `Input`, `Label`), `cn()` utility
- Also exports `globals.css` with shared design tokens (OKLch color palette, fonts, radii)
- Components are **framework-agnostic** — no Next.js imports; auth forms accept `onSubmit` callbacks
- No build step — consuming apps (Next.js, Vite) compile the TSX source directly
- Website uses `transpilePackages: ['@screensaver-art/ui']` in `next.config.mjs`

### Tailwind v4 + pnpm workspace gotcha
Tailwind v4's Vite plugin auto-detects classes in imported files, but **does not scan workspace packages resolved through `node_modules` symlinks**. Each consuming app must add a `@source` directive in its CSS pointing at the shared package source:
```css
@import 'tailwindcss';
@source "../../../../packages/ui/src";   /* relative to the CSS file */
```
Without this, classes like `bg-primary` used only in `packages/ui` components won't be generated. The website avoids this issue because Next.js handles transpilePackages differently.

## Infrastructure
| Service | What it does |
|---|---|
| **Supabase** | Auth (email/password) + `subscriptions` table |
| **Stripe** | Payments — $0.99/month, single tier |
| **Cloudflare R2** | Hosts MP4 video assets (public, no auth) |
| **Vercel** | Hosts the Next.js website |
| **GitHub Pages** | Hosts `gallery.json` and `index.html` at `https://zerolocker.github.io/screensaver-art/` — deployed via GitHub Actions (only these 2 files, not the full repo) |

### GitHub Pages deploy workflow (`.github/workflows/deploy-pages.yml`)
- Triggered on push to `master` when `gallery.json` or `index.html` change (also supports `workflow_dispatch`)
- Copies **only** `gallery.json` and `index.html` into a `_site/` directory and deploys via `actions/deploy-pages`
- This ensures no source code (Swift, TypeScript, CLAUDE.md, etc.) is publicly accessible even though the repo is private
- **Prerequisite**: in the repo Settings → Pages, source must be set to **"GitHub Actions"** (not "Deploy from a branch")

## Add new art pieces
1. Upload MP4 to Cloudflare R2 bucket `screensaver-assets` under the `gallery/` prefix.
2. Add an entry to `gallery.json` — include `src` (full R2 URL), `title`, `type`, `date`, `collection`, `image_prompt`, `video_prompt`.
3. Push to `master` — the Pages workflow auto-deploys `gallery.json`; the screensaver picks it up on next launch (no rebuild needed).

---

## Subscription & Gating Architecture

### The product model
- Users subscribe at `living-art-screensaver.com` ($0.99/month via Stripe)
- **Subscribed**: see all gallery items
- **Not subscribed / not logged in**: see first 2 items only + upsell overlay after one loop

### Why server-side gating not client-side
We chose to gate the gallery server-side via `/api/gallery` rather than just limiting on the client. This prevents the full URL list from being trivially readable. The MP4s themselves are still public on R2 (no signed URLs) — this is an acceptable tradeoff for a $0.99 product. If piracy becomes a real problem, add Cloudflare signed URLs.

### `/api/gallery` endpoint (the key piece)
```
GET https://living-art-screensaver.com/api/gallery?collection=classic
Authorization: Bearer <supabase_access_token>
```
Response: `{ items: GalleryItem[], isSubscribed: boolean, totalCount: number }`
- Active subscriber → full gallery filtered by collection
- No token / unsubscribed → first 2 items only
- Never returns 401 — always returns something so the screensaver has content

### Auth flow in the macOS app
1. User opens **System Settings → Screen Saver → Options** (the configure sheet)
2. Enters email + password in the native form
3. Swift calls `POST /auth/v1/token?grant_type=password` on Supabase directly
4. Access token + refresh token stored in **macOS Keychain**
5. On each screensaver activation: read Keychain → refresh token silently → call `/api/gallery`
6. Subscription status cached locally (24h TTL); **fail open** on network failure

### Why refresh tokens (not long-lived access tokens)
- **Revocation**: JWTs are stateless — a short-lived access token (1h) bounds the damage window after a subscription cancels or account compromise. Refresh tokens are checked server-side.
- **Token rotation**: Supabase rotates refresh tokens on use. If an attacker steals and uses a refresh token first, the legitimate user's next refresh fails — a detectable signal. Long-lived tokens give no such signal.
- **Blast radius**: Access tokens go to every API endpoint; refresh tokens only go to the auth server. Fewer places to leak from.

### Offline support
- `gallery.json` response cached to `~/Library/Caches/ScreensaverArt/gallery.json` after every successful fetch
- MP4s cached to `~/Library/Caches/ScreensaverArt/videos/` as they play (passive warming)
- First 2 videos pre-cached eagerly on login (always available offline)
- LRU eviction at 2 GB cap
- On network failure: play from cache, use cached subscription status (fail open)

### Collection support (future-proofing)
- Every `gallery.json` entry has a `collection` field (currently all `"classic"`)
- `/api/gallery?collection=<name>` filters server-side
- The macOS app passes the user's selected collection (stored in UserDefaults)
- To add a new collection: add items to `gallery.json` with a new `collection` value — no API changes needed
- To gate collections by subscription tier: add tier logic to the `/api/gallery` route

### Supabase `subscriptions` table schema
```
id                    uuid
user_id               uuid  FK → auth.users
stripe_customer_id    text
stripe_subscription_id text
status                text  ('active' | 'trialing' | 'inactive' | 'cancelled' | 'past_due')
current_period_start  timestamp
current_period_end    timestamp
updated_at            timestamp
```
`isActive` = status is `active` OR `trialing`

### Native Supabase client (for macOS app requests)
The website's default Supabase client uses cookies (for browser sessions). The macOS app sends a Bearer token instead. Use `lib/supabase/native-client.ts` which creates a `@supabase/supabase-js` client with `Authorization: Bearer <token>` in the global headers — **not** the SSR cookie client.

---

## Screensaver internals (Swift)

### Swift module breakdown
Each class lives in its own file under `screensaver/`:

| File | Class | Responsibility |
|---|---|---|
| `Constants.swift` | `API` enum | Supabase URL/key, gallery endpoint, free item count |
| `Models.swift` | `ArtItem`, `GalleryResponse` | Decodable gallery types |
| `Keychain.swift` | `Keychain` | Save/load/delete tokens from macOS Keychain |
| `AuthManager.swift` | `AuthManager` | Supabase REST auth, token refresh, sign-out |
| `SubscriptionCache.swift` | `SubscriptionCache` | 24h local cache of `isActive` + `totalCount` in UserDefaults |
| `VideoCache.swift` | `VideoCache` | File-based MP4 cache, LRU eviction (2 GB cap), gallery JSON persistence |
| `GalleryFetcher.swift` | `GalleryFetcher` | Calls `/api/gallery`, falls back to cached JSON offline |
| `ConfigureSheetController.swift` | `ConfigureSheetController` | Native login/logout panel (System Settings → Options) |
| `UpsellOverlay.swift` | `UpsellOverlay` | Full-screen overlay shown after free content loops; auto-dismisses in 30s |
| `ScreensaverArtView.swift` | `ScreensaverArtView` | Main screensaver view — A/B CALayer crossfade, 8s timer, orchestrates everything |

### Supabase credentials (safe to hardcode — these are public anon keys)
- URL: `https://fcrkikggdvgshuopshgm.supabase.co`
- Anon key: in `Constants.swift` under `API` enum

### Configure sheet
`hasConfigureSheet = true` — accessible via the Options button in System Settings → Screen Saver. Shows login form when logged out, subscription status + logout when logged in.

### DMG distribution (`screensaver/distribute.sh`)
```bash
bash screensaver/distribute.sh        # → screensaver/dist/ScreensaverArt-1.0.dmg
bash screensaver/distribute.sh 1.1   # override version
```
- Builds a compressed DMG containing a single item: **`Install Living Art Screensaver.app`**
- The `.app` is built with `osacompile` from an AppleScript that handles the full install flow
- The `.saver` bundle is embedded inside `Install Living Art Screensaver.app/Contents/Resources/` — the user never sees a raw `.saver` file
- On launch the installer: kills screensaver processes (required by Apple's legacy screensaver framework), copies `.saver` to `~/Library/Screen Savers/`, strips quarantine, opens System Settings to the Screen Saver pane
- The DMG Finder window is configured via AppleScript (icon view, no toolbar/statusbar/sidebar, fixed bounds, icon centred)
- System folders (`.fseventsd`, `.Trashes`) are hidden with `chflags hidden` after mounting so they don't appear to the user

---

## Repo history
- `living-art-screensaver-web` was originally a separate repo (`zerolocker/living-art-screensaver-web`).
  It was merged into this repo on 2026-03-22 via `git subtree add --prefix=living-art-screensaver-web ... --squash`.
  The old repo is archived and read-only.
