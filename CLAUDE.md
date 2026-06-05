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
| `electron-app/src/main/logger.ts` | Dependency-free main-process logger — console + JSONL file (`<userData>/logs/main.log`) + in-memory ring buffer. Renderer logs forwarded via `log:record` IPC. |
| `electron-app/src/main/report.ts` | Assembles a debug snapshot (versions, OS, installer/codesign diagnostics, cache summary, recent logs) and uploads it to `/api/error-report`. |
| `electron-app/scripts/bundle-appex.sh` | Builds the universal `.appex` + helper and copies them into `electron-app/resources/` |
| `electron-app/scripts/afterpack-sign.cjs` | electron-builder `afterPack` hook — fixes the embedded appex signature after the universal merge (which invalidates it, breaking `pluginkit` registration). Ad-hoc by default; pre-signs the appex+helper with Developer ID when `LART_CODESIGN_IDENTITY` is set. |
| `electron-app/scripts/aftersign-staple.cjs` | electron-builder `afterSign` hook — staples the notarization ticket onto the `.app` (electron-builder notarizes but doesn't staple). Runs only when notary creds are set. |
| `electron-app/electron-builder.cjs` | DMG (universal) / NSIS distribution config — **JS, env-driven**: ad-hoc unless `LART_CODESIGN_IDENTITY` selects Developer ID (then hardened runtime + notarization). Wires both signing hooks. |
| `electron-app/build/entitlements.mac.plist` + `.inherit.plist` | Hardened-runtime entitlements for the outer Electron app + its helper processes (Developer ID builds). The appex has its own entitlements. |
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
| `living-art-screensaver-web/app/api/error-report/route.ts` | Stores Electron-app debug reports (Bearer-auth) in the Supabase `user-error-reports` bucket via the service role |

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
| **Supabase** | Auth (email/password) + `subscriptions` table + `user-error-reports` Storage bucket (private; debug reports from the Electron app) |
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
Distribution is owned by the Electron app — see `electron-app/electron-builder.cjs`. The `.appex` is embedded in the Electron `.app`'s `Contents/PlugIns/` and registered with `pluginkit`. There is no per-screensaver DMG.

### Code signing & notarization (env-driven)
The embedded `.appex` **must** have a valid signature or `pluginkit -a` silently refuses to register it (it exits 0 but the extension never appears in `pluginkit -m` — surfaced in-app as "Failed to register the screensaver (helper exit 0)."). The trap: for a `universal` build, `@electron/universal` merges the x64 + arm64 apps and **rewrites nested `Info.plist` files after the appex was signed**, invalidating its signature. So the appex always needs (re)signing *after* the merge — that's what `scripts/afterpack-sign.cjs` (the `afterPack` hook) does, on the merged universal app.

The whole pipeline is toggled by the **`LART_CODESIGN_IDENTITY`** env var, kept in lockstep between `electron-builder.cjs` and the hooks:

**Ad-hoc (default — local/contributor builds, no cert):** `electron-builder.cjs` sets `identity: null` (electron-builder skips signing). `afterpack-sign.cjs` ad-hoc signs the whole bundle: `codesign --deep --sign -`, re-sign the appex with its entitlements, re-seal the outer app, `--verify --deep --strict`. Registers fine on the build machine; not distributable to others.

**Developer ID (release):** set `LART_CODESIGN_IDENTITY="Developer ID Application: NAME (TEAMID)"`. Then:
- `electron-builder.cjs` → `hardenedRuntime: true`, `identity: <that>`. electron-builder signs the frameworks/helper-apps/outer app with the hardened runtime (`build/entitlements.mac{,.inherit}.plist`). **It ignores `Contents/PlugIns/` by design**, so it never touches the appex.
- `afterpack-sign.cjs` pre-signs the **appex** (with its sandbox + `/Users/Shared` temporary-exception entitlements) and the **helper**, both hardened-runtime + secure-timestamp. electron-builder then seals the outer app over them.
- **Notarization** is electron-builder-native (`@electron/notarize`) and kicks in when Apple notary creds are in the env — easiest is a keychain profile from `xcrun notarytool store-credentials`: `APPLE_KEYCHAIN_PROFILE="…"` (or `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`). `@electron/notarize` submits but doesn't staple, so `scripts/aftersign-staple.cjs` (the `afterSign` hook) staples the ticket onto the `.app` before the DMG is built. With no creds, the app is signed but not notarized (staple skipped).

Release: copy `electron-app/release.env.example` → `release.env` (gitignored; holds your `LART_CODESIGN_IDENTITY` + `APPLE_KEYCHAIN_PROFILE` — not secrets, just developer-specific), then `pnpm dist:mac:release` (wrapper: `scripts/dist-mac-release.sh` loads `release.env` and runs `pnpm dist:mac`). Equivalent to setting the env vars inline:
```bash
LART_CODESIGN_IDENTITY="Developer ID Application: NAME (TEAMID)" \
APPLE_KEYCHAIN_PROFILE="living-art-notary" \
pnpm dist:mac
# verify:
spctl -a -vvv -t install "dist/mac-universal/Living Art Screensaver.app"   # → accepted, Notarized Developer ID
xcrun stapler validate "dist/Living Art Screensaver-1.0.0.dmg"
```
The `temporary-exception` entitlements are accepted by Developer ID notarization (automated malware scan, not an App Store entitlement review — Aerial ships the same combo). Test the DMG on a *different* Mac to truly confirm Gatekeeper is happy.

### Logging & error reports
- **Main process**: `src/main/logger.ts` logs to console + `<userData>/logs/main.log` (JSONL, rotated at ~5 MB) + an in-memory ring buffer. `installGlobalHandlers()` captures `uncaughtException`/`unhandledRejection`. Installer, cache-sync, and IPC are instrumented.
- **Renderer**: `src/renderer/src/lib/log.ts` mirrors to the console and forwards to main via `log:record`, and installs `window` `error`/`unhandledrejection` handlers. So one report covers both processes.
- **Swift helper**: logs to the unified log under subsystem `com.livingart.screensaver.app` (category `helper`) — `log stream --predicate 'subsystem == "com.livingart.screensaver.app"'`. Never writes to stdout (that carries the JSON the Electron app parses).
- **Error report**: the Account page has a "Send error report" button (shown on errors + a persistent Diagnostics card). `report.ts` assembles a JSON snapshot — app/OS/Electron versions, `installer.getDiagnostics()` (status + appex `codesign --verify` + helper `find`), cache summary, and the recent log buffer — and POSTs it (Bearer-auth) to `/api/error-report`, which stores it in the Supabase `user-error-reports` bucket at `<userId>/<timestamp>-<id>.json`. No video content or access token is included in the body.

---

## Releasing a new version

The website's "Download for Mac" button doesn't link to a fixed file — it links
to **`/download/mac`**, a Next.js route that resolves "latest" from this repo's
**GitHub Releases** at request time. So shipping a new version = publishing a new
GitHub Release with the DMG attached; the link updates itself within ~2 min (no
website redeploy).

### One command
```bash
./scripts/release.sh            # patch bump (1.0.0 → 1.0.1)
./scripts/release.sh minor      # or: major / 1.4.2 (explicit)
```
`scripts/release.sh` bumps `electron-app/package.json`, builds a **signed +
notarized** universal DMG (`pnpm dist:mac:release`, reads `electron-app/release.env`),
commits the bump, tags `vX.Y.Z`, pushes, and `gh release create`s the release
with the DMG attached under the stable name **`Living-Art-Screensaver-mac.dmg`**.
Toggles: `DRY_RUN=1` (build only, nothing pushed/published), `SKIP_BUILD=1`
(reuse the existing DMG to re-publish), `ALLOW_BRANCH=1` (release off non-master).
Prereqs: `release.env` present, `gh` authed (repo scope), Xcode + xcodegen.

### The download link (`/download/:os`)
- `living-art-screensaver-web/app/download/[os]/route.ts` — `mac` → latest `.dmg`,
  `win` → latest `.exe` (Windows scaffolded, no build ships yet). 302s to the
  signed asset URL; returns 5xx (not a public fallback) if the token is missing
  or the release lookup fails. The platform segment is required — there is no
  bare `/download` default.
- The four "Download" buttons (hero/pricing/cta/account) point at `/download/mac`.
- **One-time:** the route + button changes must be deployed once (push to master →
  Vercel) before the first release link works. Per-release, no website change.

### The `GITHUB_RELEASE_TOKEN` (always required)
The route **always** goes through the GitHub API with a server-side token — it
never redirects to a public asset URL. This keeps it identical whether the repo
is public or private (making the repo private is a zero-change event). The token
is **`GITHUB_RELEASE_TOKEN`**, a fine-grained PAT with `Contents: Read-only` on
this repo, set in two places:
- **Vercel** project env (Production + Preview + Development) — for the deployed site.
- **`living-art-screensaver-web/.env.local`** (gitignored) — for `pnpm dev`.

With the token, the route asks the API for the asset with
`Accept: application/octet-stream` and 302s to the short-lived **signed**
`objects.githubusercontent.com` URL, which downloads fine for anonymous users on
public or private repos (bytes never flow through Vercel). If the token is
missing the route returns 500 by design — so a private repo can never silently
hand out broken public links.

---

## Repo history
- `living-art-screensaver-web` was originally a separate repo (`zerolocker/living-art-screensaver-web`).
  It was merged into this repo on 2026-03-22 via `git subtree add --prefix=living-art-screensaver-web ... --squash`.
  The old repo is archived and read-only.
- 2026-04-25: Architecture refactor — the Electron app became the sole installer and the screensaver was reduced to a pure player. Auth, subscription verification, gallery fetching, and upsell were all removed from the screensaver. Cache files are now XOR-obfuscated.
- 2026-05-30: Migrated the macOS screensaver from the legacy `.saver` plug-in to a modern ExtensionKit **`.appex`** (`screensaver/` → `screensaver-macos/`, built with Xcode/xcodegen). The cache moved from the `legacyScreenSaver` sandbox container to `/Users/Shared/LivingArtScreensaver/`, which **eliminated the "access data from other apps" TCC prompt** (deleted `mac-permission.ts`). Install now uses `pluginkit`; activation is one-click via a new PaperSaver-backed helper (`screensaver-helper/`) surfaced as a "Set" banner in the app. The packaged app is a universal (Intel + Apple Silicon) DMG. Developer-ID signing + notarization remains a TODO.
