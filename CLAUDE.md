# Screensaver Art — Project Reference

## What this project is
A **pnpm workspace** monorepo containing:
- **Shared UI library** (`packages/ui/`) — React components shared between the website and Electron app
- **Electron desktop app** (`electron-app/`) — **the only thing end users install**. Handles auth, subscription, gallery sync, video obfuscation, and installs the platform-native screensaver.
- **macOS screensaver** (`screensaver/`) — native Swift `.saver` bundle. **Pure player.** Reads videos from a local cache populated by the Electron app. No auth, no network.
- **Marketing + account website** (`living-art-screensaver-web/`) — Next.js, deployed to `living-art-screensaver.com` via Vercel
- **Gallery playlist** (`gallery.json`) — single source of truth for all art items
- **Web preview** (`index.html`) — standalone HTML+CSS+JS, no build step

## Key paths
| Path | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Workspace config — ties all packages together |
| `packages/ui/` | **Shared UI** — React components (LoginForm, SignUpForm, SubscriptionCard, base UI) |
| `electron-app/` | **The user-facing installer** — see below |
| `electron-app/src/main/installer.ts` | Installs/uninstalls `.saver` into `~/Library/Screen Savers/` |
| `electron-app/src/main/cache-sync.ts` | Fetches `/api/gallery`, downloads + obfuscates MP4s, writes manifest |
| `electron-app/src/main/obfuscation.ts` | XOR + magic-header + djb2 filename hash. **Mirror of `screensaver/Constants.swift`** — change both. |
| `electron-app/scripts/bundle-saver.sh` | Builds `.saver` and copies it into `electron-app/resources/` |
| `electron-app/electron-builder.yml` | DMG / NSIS distribution config |
| `index.html` | Standalone web preview (HTML+CSS+JS, no build step) |
| `gallery.json` | Playlist — all art items with `src`, `title`, `type`, `collection`, `date`, prompts |
| `R2 Bucket` | `https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/` — MP4 assets |
| `screensaver/*.swift` | Native screensaver — pure player, see split below |
| `screensaver/Info.plist` | Bundle metadata (CFBundleIdentifier, NSPrincipalClass) |
| `screensaver/build.sh` | Build + install script (developer shortcut; end users use the Electron app) |
| `living-art-screensaver-web/` | Next.js website (marketing, auth, billing, gallery API) |
| `living-art-screensaver-web/app/api/gallery/route.ts` | **The gating endpoint** — serves gallery to the Electron app |
| `living-art-screensaver-web/app/api/subscription/verify/route.ts` | Subscription status check |
| `living-art-screensaver-web/app/api/webhooks/stripe/route.ts` | Stripe → Supabase sync |

## Getting started (pnpm workspace)
```bash
pnpm install              # install all workspace dependencies from repo root
```

## Build & install the screensaver directly (developer shortcut)
```bash
bash screensaver/build.sh --install
# kills cached processes, compiles, installs to ~/Library/Screen Savers/ScreensaverArt.saver
```
End users never run this — they install the Electron app, which handles it.

## Electron desktop app
```bash
cd electron-app
pnpm dev                  # runs bundle-saver.sh, then launches Electron with HMR
pnpm build                # builds renderer + main + preload to electron-app/out/
pnpm dist:mac             # → electron-app/dist/Living Art Screensaver-<v>.dmg
pnpm dist:win             # → electron-app/dist/Living Art Screensaver Setup-<v>.exe
```
- Uses `electron-vite` for build tooling (main + preload + renderer) and `electron-builder` for distribution
- Renderer is React + Tailwind v4, imports shared components from `@screensaver-art/ui`
- Auth via `@supabase/supabase-js` (not SSR — stores session in Chromium localStorage)
- Cache management: main process handles file I/O via IPC; renderer shows stats and clear button
- Cache dir: `~/Library/Caches/ScreensaverArt/` (macOS), `%LOCALAPPDATA%\ScreensaverArt\` (Windows)
- The `.saver` bundle is built and bundled into `electron-app/resources/` by `scripts/bundle-saver.sh` before every `pnpm dev` / `pnpm build`. `electron-builder` ships everything in `resources/` to `Contents/Resources/` in the packaged app, where `installer.ts` finds it via `process.resourcesPath`.
- Windows `.scr` support is scaffolded but not implemented; the install flow returns an "unsupported on this platform" error there.

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
| **GitHub Pages** | Hosts `gallery.json` and `index.html` at `https://zerolocker.github.io/screensaver-art/` — deployed natively from `master` (Settings → Pages → "Deploy from a branch") |

## Add new art pieces
1. Upload MP4 to Cloudflare R2 bucket `screensaver-assets` under the `gallery/` prefix.
2. Add an entry to `gallery.json` — include `src` (full R2 URL), `title`, `type`, `date`, `collection`, `image_prompt`, `video_prompt`.
3. Push to `master` — GitHub Pages auto-deploys `gallery.json`. Subscribers' Electron apps pick up the new piece on their next sync.

---

## Subscription & Gating Architecture

### The product model
- Users subscribe at `living-art-screensaver.com` ($0.99/month via Stripe), or directly inside the Electron app's "Account & Setup" tab (deep-links into the website's billing portal)
- **Subscribed**: Electron app downloads + caches all gallery items
- **Not subscribed**: Electron app downloads + caches the first 2 items only
- The screensaver doesn't know or care about subscriptions — it just plays whatever is in the cache directory

### Where gating happens
Gating still lives server-side in `/api/gallery`. The endpoint inspects the Bearer token, checks Supabase `subscriptions`, and returns either the full list or the first 2 items. Same response for both subscribed and free users:
```
{ items: GalleryItem[], isSubscribed: boolean, totalCount: number }
```
The Electron app caches whatever comes back and removes any local `.bin` files that aren't in the latest response (so an expired subscription shrinks the cache to 2 items on the next sync).

### Auth flow
1. User opens the Electron app
2. Signs in with email + password — `@supabase/supabase-js` handles the round-trip; session persists in Chromium localStorage
3. App calls `GET /api/gallery` with `Authorization: Bearer <access_token>`
4. App downloads each MP4, XOR-obfuscates it, writes it to the cache directory, and updates `gallery.json` (the manifest)
5. App installs the screensaver (one-time) — copies `.saver` from its bundled resources into `~/Library/Screen Savers/`, kills any running screensaver processes, strips quarantine, and opens System Settings to the Screen Saver pane

### Why server-side gating not client-side
We chose to gate the gallery server-side via `/api/gallery` rather than just limiting on the client. This prevents the full URL list from being trivially readable. The MP4s themselves are still public on R2 (no signed URLs); we layer a cache-side obfuscation on top of that, see below.

### Cache obfuscation (the new piece)
Every cached MP4 is stored as `<djb2-hash>.bin`, where the bytes are:
- 8-byte magic header `LARTV001`
- the MP4 content XOR'd with a 32-byte cycling key

The exact key, magic, and djb2-127 filename hash are duplicated in two places that **must stay in sync**:
- `electron-app/src/main/obfuscation.ts` — writer
- `screensaver/Constants.swift` — reader

This is **not real cryptography** — both binaries embed the key, so anyone willing to `strings` or disassemble can recover it. We deliberately picked a friction layer rather than DRM:
- The `.bin` files in the cache directory don't open in QuickTime even after rename
- The Swift screensaver decrypts on demand into `NSTemporaryDirectory()/ScreensaverArt/`, hands the temp URL to AVPlayer, and deletes the temp file when the slot is reused
- This blocks the casual "drag the MP4 out of `~/Library/Caches/` and post it on Twitter" path without burning engineering effort on real DRM, which would be over-engineered for a $0.99 product

If piracy ever becomes a real problem, the next step is signed URLs from R2, not stronger client-side encryption.

### Offline support
- Cache lives in `~/Library/Caches/ScreensaverArt/` (Mac) / `%LOCALAPPDATA%\ScreensaverArt\` (Windows)
- The Electron app populates and refreshes this cache; the screensaver only reads
- The screensaver re-reads `gallery.json` every time `startAnimation` fires, so a fresh sync is picked up the next time the screensaver kicks in — no reboot needed
- The Electron app can be quit; the screensaver keeps working from the existing cache
- If the cache is empty (user hasn't synced yet) the screensaver shows a black screen with "Open the Living Art Screensaver app to sync your gallery."

### Collection support (future-proofing)
- Every `gallery.json` entry has a `collection` field (currently all `"classic"`)
- `/api/gallery?collection=<name>` filters server-side
- The Electron app currently passes `collection=classic`. Add a UI selector when more collections exist.

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

### Native Supabase client (for Electron app requests)
The website's default Supabase client uses cookies (for browser sessions). The Electron app sends a Bearer token instead. Use `lib/supabase/native-client.ts` which creates a `@supabase/supabase-js` client with `Authorization: Bearer <token>` in the global headers — **not** the SSR cookie client.

---

## Screensaver internals (Swift)

### Swift module breakdown
The screensaver was deliberately stripped to the minimum needed to play videos. Each class lives in its own file under `screensaver/`:

| File | Class / enum | Responsibility |
|---|---|---|
| `Constants.swift` | `Cache`, `Obfuscation` | Cache directory paths and the XOR key/magic shared with the Electron app |
| `Models.swift` | `CachedItem`, `CachedManifest` | Decodable types matching the manifest the Electron app writes |
| `CachedGallery.swift` | `CachedGallery` | Reads the manifest; decrypts a `.bin` to a temp `.mp4` for AVPlayer |
| `ScreensaverArtView.swift` | `ScreensaverArtView` | Main view — A/B CALayer crossfade, 8s timer, empty-state hint |

The previous auth/configure-sheet/upsell modules (`AuthManager.swift`, `Keychain.swift`, `ConfigureSheetController.swift`, `GalleryFetcher.swift`, `SubscriptionCache.swift`, `UpsellOverlay.swift`) and the standalone DMG installer (`distribute.sh`) have been removed. All of that responsibility moved to the Electron app.

### No configure sheet
`hasConfigureSheet` is now `false`. The screensaver has no UI of its own — accounts and cache are managed in the Electron app.

### Distribution
Distribution is owned by the Electron app — see `electron-app/electron-builder.yml`. There is no longer a per-screensaver DMG.

---

## Repo history
- `living-art-screensaver-web` was originally a separate repo (`zerolocker/living-art-screensaver-web`).
  It was merged into this repo on 2026-03-22 via `git subtree add --prefix=living-art-screensaver-web ... --squash`.
  The old repo is archived and read-only.
- 2026-04-25: Architecture refactor — the Electron app became the sole installer and the screensaver was reduced to a pure player. Auth, subscription verification, gallery fetching, and upsell were all removed from the screensaver. Cache files are now XOR-obfuscated.
