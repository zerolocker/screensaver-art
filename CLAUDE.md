# Screensaver Art — Project Reference

## What this project is
A **pnpm workspace** monorepo containing:
- **Shared UI library** (`packages/ui/`) — React components shared between the website and Electron app
- **Electron desktop app** (`electron-app/`) — **the only thing end users install**. Handles auth, subscription, gallery sync, video obfuscation, and installs + activates the platform-native screensaver.
- **macOS screensaver** (`screensaver-macos/`) — native Swift **`.appex` ExtensionKit screensaver** (Sonoma+), built with Xcode (via xcodegen). **Pure player.** Reads videos from a shared local cache populated by the Electron app. No auth, no network. Embedded into the Electron app and registered with `pluginkit`.
- **Screensaver helper** (`screensaver-helper/`) — tiny SwiftPM CLI (`lart-screensaver-helper`) that wraps [PaperSaver](https://github.com/AerialScreensaver/PaperSaver) so the Electron app can do everything that needs Swift: detect/set the active screensaver (one-click "Set"), and register/unregister/discover the `.appex` via PaperSaver's `PluginkitManager` (so the Electron app never shells out to `pluginkit` itself).
- **Marketing + account website** (`living-art-screensaver-web/`) — Next.js, deployed to `living-art-screensaver.com` via Vercel
- **Gallery playlist** (`gallery.json`) — single source of truth for all art items
- **Web preview** (`index.html`) — standalone HTML+CSS+JS, no build step

## Key paths
| Path | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Workspace config — ties all packages together |
| `packages/ui/` | **Shared UI** — React components (LoginForm, SignUpForm, SubscriptionCard, base UI) |
| `electron-app/` | **The user-facing installer** — see below |
| `electron-app/src/main/installer.ts` | Registers/unregisters the `.appex`, queries registration status, reads/sets the active screensaver — all delegated to the PaperSaver helper (`register`/`unregister`/`find`/`status`/`activate`). No direct `pluginkit` calls or output parsing. |
| `electron-app/src/main/cache-sync.ts` | Fetches `/api/gallery`, downloads + obfuscates MP4s, writes manifest to `/Users/Shared/LivingArtScreensaver/` |
| `electron-app/src/main/obfuscation.ts` | XOR + magic-header + djb2 filename hash. **Mirror of `screensaver-macos/ScreensaverArtExtension/Constants.swift`** — change both. |
| `electron-app/scripts/bundle-appex.sh` | Builds the universal `.appex` + helper and copies them into `electron-app/resources/` |
| `electron-app/electron-builder.yml` | DMG (universal) / NSIS distribution config |
| `index.html` | Standalone web preview (HTML+CSS+JS, no build step) |
| `gallery.json` | Playlist — all art items with `src`, `title`, `type`, `collection`, `date`, prompts |
| `R2 Bucket` | `https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/` — MP4 assets |
| `screensaver-macos/project.yml` | xcodegen spec — generates `ScreensaverArt.xcodeproj` (DevHost scaffold + the `.appex` extension target) |
| `screensaver-macos/ScreensaverArtExtension/*.swift` | The screensaver extension — pure player, see split below |
| `screensaver-macos/ScreensaverArtExtension/{Info.plist,*.entitlements}` | `XPC!` package type, `NSExtension`/`com.apple.screensaver`, sandbox + `/Users/Shared/` read exception |
| `screensaver-macos/build.sh` | Regenerates the project (xcodegen) and builds the `.appex` (Release = universal) |
| `screensaver-helper/` | SwiftPM package for `lart-screensaver-helper` (PaperSaver-backed `status`/`activate`/`register`/`unregister`/`find`) |
| `living-art-screensaver-web/` | Next.js website (marketing, auth, billing, gallery API) |
| `living-art-screensaver-web/app/api/gallery/route.ts` | **The gating endpoint** — serves gallery to the Electron app |
| `living-art-screensaver-web/app/api/subscription/verify/route.ts` | Subscription status check |
| `living-art-screensaver-web/app/api/webhooks/stripe/route.ts` | Stripe → Supabase sync |

## Getting started (pnpm workspace)
```bash
pnpm install              # install all workspace dependencies from repo root
```

## Build the screensaver directly (developer shortcut)
```bash
# Requires Xcode + xcodegen (brew install xcodegen).
bash screensaver-macos/build.sh Debug   # fast, host-arch, auto-registers via pluginkit
bash screensaver-macos/build.sh         # Release, universal (Intel + Apple Silicon)
```
This regenerates `ScreensaverArt.xcodeproj` from `project.yml` and builds the
`.appex` (embedded in a throwaway `DevHost.app` scaffold so it can register).
A Debug build auto-registers the extension with `pluginkit` for local testing;
set it active from System Settings or via `screensaver-helper`. End users never
run this — they install the Electron app, which embeds + registers the `.appex`.

## Electron desktop app
```bash
cd electron-app
pnpm dev                  # runs bundle-appex.sh, then launches Electron with HMR
pnpm build                # builds renderer + main + preload to electron-app/out/
pnpm dist:mac             # → electron-app/dist/Living Art Screensaver-<v>-universal.dmg
pnpm dist:win             # → electron-app/dist/Living Art Screensaver Setup-<v>.exe
```
- Uses `electron-vite` for build tooling (main + preload + renderer) and `electron-builder` for distribution
- Renderer is React + Tailwind v4, imports shared components from `@screensaver-art/ui`
- Auth via `@supabase/supabase-js` (not SSR — stores session in Chromium localStorage)
- Cache management: main process handles file I/O via IPC; renderer shows stats and clear button
- Cache dir: `/Users/Shared/LivingArtScreensaver/` (macOS), `%LOCALAPPDATA%\ScreensaverArt\` (Windows). See "Why the cache lives in /Users/Shared" below.
- `scripts/bundle-appex.sh` (run before every `pnpm dev`/`build`) builds the universal `.appex` + helper into `electron-app/resources/`. `electron-builder` embeds the `.appex` at `Contents/PlugIns/` and the helper at `Contents/Resources/` in the packaged app, where `installer.ts` finds them. Requires Xcode + xcodegen.
- macOS install = register the embedded `.appex` (no copy into `~/Library/Screen Savers/`) — `installer.ts` calls the helper's `register`, which `pluginkit -a`'s it via PaperSaver. Activation = the PaperSaver helper (one-click "Set"), or the user picks it in System Settings. Uninstall = the helper's `unregister` (PaperSaver's `pluginkit -r`), surfaced as the "Uninstall from System Settings" button on the Account page.
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
5. App installs the screensaver (one-time) — registers the embedded `.appex` via the PaperSaver helper (which runs `pluginkit -a`), then offers a one-click "Set" (also via the helper) to make it the active screensaver, or the user can pick it in System Settings

### Why server-side gating not client-side
We chose to gate the gallery server-side via `/api/gallery` rather than just limiting on the client. This prevents the full URL list from being trivially readable. The MP4s themselves are still public on R2 (no signed URLs); we layer a cache-side obfuscation on top of that, see below.

### Cache obfuscation (the new piece)
Every cached MP4 is stored as `<djb2-hash>.bin`, where the bytes are:
- 8-byte magic header `LARTV001`
- the MP4 content XOR'd with a 32-byte cycling key

The exact key, magic, and djb2-127 filename hash are duplicated in two places that **must stay in sync**:
- `electron-app/src/main/obfuscation.ts` — writer
- `screensaver-macos/ScreensaverArtExtension/Constants.swift` — reader

This is **not real cryptography** — both binaries embed the key, so anyone willing to `strings` or disassemble can recover it. We deliberately picked a friction layer rather than DRM:
- The `.bin` files in the cache directory don't open in QuickTime even after rename
- The Swift screensaver decrypts on demand into `NSTemporaryDirectory()/ScreensaverArt/` (its own sandbox container's temp dir, always writable), hands the temp URL to AVPlayer, and deletes the temp file when the slot is reused
- This blocks the casual "drag the MP4 out of the cache and post it on Twitter" path without burning engineering effort on real DRM, which would be over-engineered for a $0.99 product

If piracy ever becomes a real problem, the next step is signed URLs from R2, not stronger client-side encryption.

### Why the cache lives in /Users/Shared (macOS)

The `.appex` screensaver is sandboxed (ExtensionKit requires it), so by default it can only read its own container. We share the video cache with the un-sandboxed Electron app via a **fixed path under `/Users/Shared/`** (`/Users/Shared/LivingArtScreensaver/`):

- `/Users/Shared/` is **nobody's** app container / Application-Support, so the un-sandboxed Electron app writing there triggers **no** macOS "access data from other apps" (`SystemPolicyAppData`) TCC prompt. (This is why the old `mac-permission.ts` explainer/recovery code is gone.)
- The sandboxed extension reads it via a `com.apple.security.temporary-exception.files.absolute-path.read-only = /Users/Shared/` entitlement (see `ScreensaverArtExtension.entitlements`). No App Group, no provisioning profile — the same trick [Aerial](https://github.com/AerialScreensaver/Aerial) uses.

This replaced the old approach where the legacy `.saver` ran inside `legacyScreenSaver`'s container and Electron had to write into *that* container (which is what triggered the TCC prompt).

### Offline support
- Cache lives in `/Users/Shared/LivingArtScreensaver/` (Mac) / `%LOCALAPPDATA%\ScreensaverArt\` (Windows)
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

## Screensaver internals (Swift, `.appex`)

The screensaver is a modern **ExtensionKit `.appex`** (macOS Sonoma+), not the
legacy `.saver` plug-in. It runs in its **own sandboxed process** and appears in
System Settings → Screen Saver alongside Apple's first-party savers. Each class
lives in its own file under `screensaver-macos/ScreensaverArtExtension/`:

| File | Class / enum | Responsibility |
|---|---|---|
| `ScreensaverArtExtension.swift` | `ScreensaverArtExtension` | Principal class (`ScreenSaverExtension` subclass), set as `NSExtensionPrincipalClass` in Info.plist |
| `ScreensaverArtViewController.swift` | `ScreensaverArtViewController` | `ScreenSaverViewController` subclass; `loadView()` builds the view |
| `ScreensaverArtView.swift` | `ScreensaverArtView` | Main view — A/B CALayer crossfade, timer, empty-state hint. Starts/stops from `viewDidMoveToWindow` (robust across ScreenSaverEngine + System Settings preview) and `startAnimation`/`stopAnimation` |
| `CachedGallery.swift` | `CachedGallery` | Reads the manifest; decrypts a `.bin` to a temp `.mp4` for AVPlayer |
| `Models.swift` | `CachedItem`, `CachedManifest` | Decodable types matching the manifest the Electron app writes |
| `Constants.swift` | `Cache`, `Obfuscation` | Cache path (`/Users/Shared/LivingArtScreensaver/`) + XOR key/magic shared with the Electron app |
| `UpsellOverlay.swift` | `UpsellOverlay` | Free-preview upsell shown after one loop when `isSubscribed` is false |
| `Logger.swift` | `LartLog` | Shared OSLog subsystem `com.livingart.screensaver.app` |
| `ScreenSaverPrivate.h` + `*-Bridging-Header.h` | — | Private decls for `ScreenSaverExtension` / `ScreenSaverViewController` (not in the public SDK) |

### Build model
- No hand-rolled `swiftc`/`.saver` bundle anymore. `project.yml` (xcodegen) defines two targets: `ScreensaverArtExtension` (the `.appex`) and `DevHost` (a minimal app scaffold that embeds the extension so it can build/sign/register locally — never shipped; the real host is the Electron app).
- The appex executable's entry point is `NSExtensionMain` (classic `NSExtension` model, `CFBundlePackageType = XPC!`, `NSExtensionPointIdentifier = com.apple.screensaver`), exactly like Apple's `Arabesque.appex`.
- Local builds are **ad-hoc** signed ("Sign to Run Locally"). The `temporary-exception` entitlements are honored ad-hoc locally and are allowed under Developer ID notarization for release (not the App Store).

### No configure sheet
`SSEHasConfigureSheet = false` (Info.plist). The screensaver has no UI of its own — accounts and cache are managed in the Electron app.

### Distribution
Distribution is owned by the Electron app — see `electron-app/electron-builder.yml`. The `.appex` is embedded in the Electron `.app`'s `Contents/PlugIns/` and registered with `pluginkit`. There is no per-screensaver DMG.

### Code signing for release (TODO — out of scope so far)
Builds are unsigned/ad-hoc today (`identity: null`). Before public release, Developer-ID-sign + notarize, signing **inside-out**: the `.appex` and `lart-screensaver-helper` first, then the outer Electron `.app`. Set `hardenedRuntime: true` for notarization. Universal (Intel + Apple Silicon) is already done.

---

## Repo history
- `living-art-screensaver-web` was originally a separate repo (`zerolocker/living-art-screensaver-web`).
  It was merged into this repo on 2026-03-22 via `git subtree add --prefix=living-art-screensaver-web ... --squash`.
  The old repo is archived and read-only.
- 2026-04-25: Architecture refactor — the Electron app became the sole installer and the screensaver was reduced to a pure player. Auth, subscription verification, gallery fetching, and upsell were all removed from the screensaver. Cache files are now XOR-obfuscated.
- 2026-05-30: Migrated the macOS screensaver from the legacy `.saver` plug-in to a modern ExtensionKit **`.appex`** (`screensaver/` → `screensaver-macos/`, built with Xcode/xcodegen). The cache moved from the `legacyScreenSaver` sandbox container to `/Users/Shared/LivingArtScreensaver/`, which **eliminated the "access data from other apps" TCC prompt** (deleted `mac-permission.ts`). Install now uses `pluginkit`; activation is one-click via a new PaperSaver-backed helper (`screensaver-helper/`) surfaced as a "Set" banner in the app. The packaged app is a universal (Intel + Apple Silicon) DMG. Developer-ID signing + notarization remains a TODO.
