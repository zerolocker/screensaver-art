# Screensaver Art — Project Reference

## What this project is
A **pnpm workspace** monorepo containing:
- **Shared constants** (`packages/constants/`) — **pure-data** package (no React, no Node, no deps): the single source of truth for cross-app constants/configs/types — `FREE_ITEM_COUNT`, `PRICING`, the gallery item shape (`ArtItem`), the `/api/gallery` response contract (`GalleryApiResponse`), and the tag vocabulary + helpers. Imported by the website (client + server routes), the Electron app (main + renderer), and tests.
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
| `packages/constants/` | **Pure-data shared package** (`@screensaver-art/constants`) — `FREE_ITEM_COUNT` (the free-tier size = default selection = advertised count), `PRICING`, `ArtItem`/`GalleryApiResponse` types, tag vocabulary (`TAG_ORDER`, `tagsOf`, `orderTags`). No build step; consumers compile the TS source. The Electron **main** process bundles it via `externalizeDepsPlugin({ exclude: [...] })`; the website lists it in `transpilePackages`. |
| `packages/ui/` | **Shared UI** — React components (LoginForm, SignUpForm, SubscriptionCard, base UI) |
| `electron-app/` | **The user-facing installer** — see below |
| `electron-app/src/main/installer.ts` | Auto-registers the `.appex` on launch (`ensureRegistered` — **version-aware**: re-registers only when it's not registered or the app was updated, so an update can't keep running stale appex code), queries registration status, and sets the active screensaver — all delegated to the PaperSaver helper (`register`/`find`/`status`/`activate`). No manual install/uninstall UI; no direct `pluginkit` calls or output parsing. |
| `electron-app/src/main/cache-sync.ts` | Fetches `/api/gallery`, downloads + obfuscates MP4s, writes manifest to `/Users/Shared/LivingArtScreensaver/` |
| `electron-app/src/main/obfuscation.ts` | XOR + magic-header + djb2 filename hash. **Mirror of `screensaver-macos/ScreensaverArtExtension/Constants.swift`** — change both. |
| `electron-app/src/main/logger.ts` | Dependency-free main-process logger — console + JSONL file (`<userData>/logs/main.log`) + in-memory ring buffer. Renderer logs forwarded via `log:record` IPC. |
| `electron-app/src/main/report.ts` | Assembles a debug snapshot (versions, OS, installer/codesign diagnostics, cache summary, recent logs) and uploads it to `/api/error-report`. |
| `electron-app/scripts/bundle-appex.sh` | Builds the universal `.appex` + helper and copies them into `electron-app/resources/`. Stamps the appex `CFBundleVersion` from `electron-app/package.json` (via `LART_APPEX_VERSION` → `build.sh`) so each release bumps it — pluginkit caches registrations by version, so this is what lets a launch-time re-register actually refresh the system's copy. |
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
- macOS install is **automatic**: the embedded `.appex` is registered on launch (no copy into `~/Library/Screen Savers/`) — the renderer's `InstallerProvider` calls `installer:ensureRegistered`, which `pluginkit -a`'s it via the PaperSaver helper. It's **version-aware**: it re-registers only when the appex isn't registered or the app was updated (the appex `CFBundleVersion` is stamped from the app version at build time), and kills the running screensaver process so an update can't keep playing stale code. There's no manual Install/Uninstall UI (registration is harmless to leave behind on app deletion). Activation = the PaperSaver helper (one-click "Set" banner at the top of the app), or the user picks it in System Settings. If the embedded appex is missing (a damaged/incomplete install) the app shows a blocking recovery screen (send report + restart), gated post-login so the report carries the user id.
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
| **Supabase** | Auth (passwordless: email one-time code + Apple/Google/Microsoft OAuth) + `subscriptions` table + `user-error-reports` Storage bucket (private; debug reports from the Electron app) |
| **Stripe** | Payments — $0.99/month billed quarterly ($2.97 every 3 months, to cut per-transaction fees), single tier |
| **Cloudflare R2** | Hosts MP4 video assets (public, no auth) |
| **Vercel** | Hosts the Next.js website |
| **GitHub Pages** | Hosts `gallery.json` and `index.html` at `https://zerolocker.github.io/screensaver-art/` — deployed natively from `master` (Settings → Pages → "Deploy from a branch") |

The Apple (6-month) and Microsoft/Azure (24-month) sign-in secrets **expire** and must be rotated. Dates + procedure live in `docs/secret-rotation.md`; `.github/secret-rotation.json` is the source of truth and `.github/workflows/secret-rotation-reminder.yml` auto-opens a reminder issue before each due date.

## Add new art pieces
1. Upload MP4 to Cloudflare R2 bucket `screensaver-assets` under the `gallery/` prefix.
2. Add an entry to `gallery.json` — include `src` (full R2 URL), `title`, `type`, `date`, `collection`, `image_prompt`, `video_prompt`.
3. Push to `master` — GitHub Pages auto-deploys `gallery.json`. Subscribers' Electron apps pick up the new piece on their next sync.

---

## Subscription & Gating Architecture

### The product model
- Users subscribe at `living-art-screensaver.com` ($0.99/month, billed quarterly as $2.97 every 3 months via Stripe), or directly inside the Electron app's "Account & Setup" tab (deep-links into the website's billing portal)
- **Everyone** browses the *entire* gallery in the app — a free user can preview every piece.
- **Subscribed**: can select + cache any pieces (selection drives what plays).
- **Not subscribed**: only the first `freeCount` pieces are *unlockable*; the rest show a lock ("Subscribe to unlock") and are never downloaded/cached. The first `freeCount` are selected by default.
- The screensaver doesn't know or care about subscriptions — it just plays whatever is in the cache directory

### Where gating happens
Gating is now **client-side**, with the server just publishing the threshold. `/api/gallery` inspects the Bearer token, checks Supabase `subscriptions`, and returns the **full** list for everyone plus the free threshold:
```
{ items: GalleryItem[], isSubscribed: boolean, freeCount: number }
```
(`totalCount` was dropped — it's just `items.length` now.) The Electron app renders all items but locks the ones past `freeCount` for non-subscribers (lock icon instead of the selection tick, and the modal's add button becomes "Subscribe to unlock"). `cache-sync` enforces the same rule: it never downloads a locked piece, and on each sync evicts any cached `.bin` that is now locked (e.g. an expired subscription) or no longer in the gallery — re-enforcing the gate even though the API hands back the full list.

**Cache is decoupled from "what plays":** the manifest = *selected ∩ unlocked* (what the screensaver plays), but the on-disk cache is kept *wider*. Deselecting an unlocked piece on a normal (auto) sync **keeps** its `.bin` so re-adding is instant; only a manual "Sync Now" (`pruneDeselected`) tidies deselected files off disk. A subscriber's cache therefore trends toward "everything ever selected" — the **Clear cache** button in Account is the reset.

### Auth flow
Auth is **passwordless** — there is no email/password sign-in or sign-up. The same
single screen serves both (a first-time email/provider just creates the account):
- **Email one-time code** (`signInWithOtp` + `verifyOtp`, `shouldCreateUser: true`)
- **Social sign-in** — Apple / Google / Microsoft via `signInWithOAuth` using the
  **PKCE** flow. The app opens the **system browser** (never an embedded webview —
  Google blocks those). The provider's `redirect_to` is a web page we control,
  **`/auth/desktop-callback`**, not the deep link directly: pointing the browser
  straight at `livingart://` left it spinning on a half-finished custom-scheme
  navigation even after the app signed in. The hand-off page forwards the PKCE
  `code` to the `livingart://auth-callback?code=…` deep link (which the main
  process receives) and shows a "you can close this window" message;
  `exchangeCodeForSession` then swaps the code for a session. The web URL must be
  in Supabase Auth → Redirect URLs. The website uses the identical PKCE flow
  (`/auth/callback`); provider config (labels, scopes/query params) is shared in
  `@screensaver-art/ui`. The social buttons never disable/spin on click — sign-in
  continues elsewhere, so disabling them only ever stranded users on a spinner.

1. User opens the Electron app
2. Signs in passwordlessly (email code or a social provider); `@supabase/supabase-js`
   persists the session in Chromium localStorage. On later launches the app falls
   back to the stored session when offline so local features keep working.
3. App calls `GET /api/gallery` with `Authorization: Bearer <access_token>`
4. App downloads each MP4, XOR-obfuscates it, writes it to the cache directory, and updates `gallery.json` (the manifest)
5. App auto-registers the embedded `.appex` on launch via the PaperSaver helper (`pluginkit -a`) — version-aware, so an app update re-registers the new build — then offers a one-click "Set" banner (also via the helper) to make it the active screensaver, or the user can pick it in System Settings

### Why gating is client-side now (and why that's OK)
We originally gated server-side (`/api/gallery` returned only the free slice) to keep the full URL list from being trivially readable. We traded that away so a free user can *browse + preview the whole gallery* (a better upsell than hiding it) — the API now returns every item to everyone. The anti-casual-piracy story is unchanged and never relied on hiding URLs anyway: the MP4s are already public on R2 (no signed URLs), and the friction layer is the **cache-side obfuscation** below. What still enforces the paywall is that `cache-sync` refuses to download locked pieces and evicts any that become locked — so a non-subscriber never has the locked `.bin` files. If piracy ever matters, the next step is signed R2 URLs, not re-hiding the playlist.

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
with the DMG attached under a versioned, platform-tagged name
(**`Living-Art-Screensaver-<version>-mac.dmg`**) — that asset name is the filename
users get on download (the `/download/:os` route passes it through via
`Content-Disposition`).
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

### Auto-update (electron-updater)

The installed Mac app updates itself (Claude-Desktop style): it downloads a new
release in the background and shows a **"Relaunch to update"** banner. No more
re-downloading the DMG and dragging it into `/Applications`.

- **How it works.** `electron-app/src/main/updater.ts` wraps `electron-updater`'s
  `autoUpdater` — it checks on launch + every 6 h, downloads silently
  (`autoDownload`), and pushes state to the renderer (`update:event` IPC). The
  renderer's `UpdateProvider` + `UpdateBanner` (top of the `AppBanners` stack)
  surface the relaunch prompt; `quitAndInstall()` installs + relaunches. Account →
  "About" has a manual **Check for updates**.
- **Where updates come from.** electron-builder's `publish: generic` (in
  `electron-builder.cjs`) points the app at **`/updates`** on the website. That
  route (`app/updates/[...path]/route.ts`) serves the updater's files from the
  latest GitHub release through the **same `GITHUB_RELEASE_TOKEN` proxy** as
  `/download` (shared logic in `lib/github-release.ts`): `latest-mac.yml` is
  proxied inline, the `.zip`/`.blockmap` 302 to a signed CDN URL. So auto-update
  keeps the "private repo = zero-change" property — no token is baked into the app.
- **Build artifacts.** `mac.target` now also builds a **`zip`** (Squirrel.Mac
  updates from a zip, not the DMG) and electron-builder emits `latest-mac.yml` +
  the zip `.blockmap`. `scripts/release.sh` uploads all three to the GitHub
  release **under their built, space-free names** — `latest-mac.yml` references
  the zip by exact filename, and GitHub rewrites spaces in asset names to dots,
  which would break the lookup (hence `mac.artifactName` =
  `Living-Art-Screensaver-<version>-universal.zip`). The DMG keeps its own
  hyphenated name as before.
- **Signing is mandatory.** Squirrel.Mac only applies a **Developer-ID-signed +
  notarized** update (the release path already does this); auto-update is a no-op
  in dev / ad-hoc builds (`app.isPackaged` guard). The embedded `.appex` needs no
  special handling: it ships inside the same signed/notarized/stapled `.app` the
  zip wraps, and `installer.ts`'s version-aware `ensureRegistered` re-registers it
  with `pluginkit` on the post-update relaunch (the bumped appex `CFBundleVersion`
  triggers it).
- **Caveats.** Auto-update only kicks in **from the next release onward** — the
  first build that contains the updater still has to be installed manually (the
  user's current build has no updater). And the app must run from `/Applications`
  (not the DMG / a translocated path) for Squirrel to swap it in place.

---

## Repo history
- `living-art-screensaver-web` was originally a separate repo (`zerolocker/living-art-screensaver-web`).
  It was merged into this repo on 2026-03-22 via `git subtree add --prefix=living-art-screensaver-web ... --squash`.
  The old repo is archived and read-only.
- 2026-04-25: Architecture refactor — the Electron app became the sole installer and the screensaver was reduced to a pure player. Auth, subscription verification, gallery fetching, and upsell were all removed from the screensaver. Cache files are now XOR-obfuscated.
- 2026-05-30: Migrated the macOS screensaver from the legacy `.saver` plug-in to a modern ExtensionKit **`.appex`** (`screensaver/` → `screensaver-macos/`, built with Xcode/xcodegen). The cache moved from the `legacyScreenSaver` sandbox container to `/Users/Shared/LivingArtScreensaver/`, which **eliminated the "access data from other apps" TCC prompt** (deleted `mac-permission.ts`). Install now uses `pluginkit`; activation is one-click via a new PaperSaver-backed helper (`screensaver-helper/`) surfaced as a "Set" banner in the app. The packaged app is a universal (Intel + Apple Silicon) DMG. Developer-ID signing + notarization remains a TODO.
- 2026-06-07: Switched billing from monthly to **quarterly** — still $0.99/month, but charged as **$2.97 every 3 months** to cut Stripe's per-transaction fee on a sub-$1 charge. Also **repositioned the marketing as free-forward** (free with 100 artworks; upsell "the full gallery plus new pieces every day"). The interval/amount live in the Stripe Price (`STRIPE_PRICE_ID`); display data was centralised in `@screensaver-art/ui`'s `PRICING` (`billedAmount`, `billingPeriodMonths`, `billingNote`, `freeItemCount`) and guarded by the `pricing-drift` test. Existing subscribers were migrated to the new Price (immediate + prorated) via `living-art-screensaver-web/scripts/migrate-to-quarterly.mjs`.
- 2026-06-08: **Removed the manual "Install Screensaver" step.** The Electron app now auto-registers the embedded `.appex` on launch (post sign-in) via a new `installer:ensureRegistered` — **version-aware**, so it re-registers only when the appex isn't registered or the app was updated. This fixed a real flaw: the appex `CFBundleVersion` was hardcoded (`"1"`), so a new app version's screensaver kept running **stale code** (pluginkit caches by version, and nothing re-triggered registration). Now `bundle-appex.sh` stamps the appex version from `package.json`, the launch-time re-register drops the old running process, and the whole Screensaver card (install/uninstall/status) was deleted from the Account page — leaving just the top-of-app "Set" banner. A missing embedded appex shows a blocking recovery screen (send report + restart) instead. Manual uninstall was dropped (lingering pluginkit registration is harmless).
- 2026-06-10: **Went passwordless-only** (PR #25). Removed email/password sign-in + sign-up from both the Electron app and the website (deleted `LoginForm`/`SignUpForm` and the website's sign-up/forgot/reset/success pages). The single auth screen is now **email one-time code** (`signInWithOtp`, `shouldCreateUser: true`) + **Apple/Google/Microsoft OAuth**; both create the account on first use. Provider config (labels, scopes — incl. Azure's required `email` scope) is shared in `@screensaver-art/ui` (`oauth.ts`, `OAuthButtons`). **Unified both clients on the PKCE flow**: the app exchanges the `livingart://auth-callback?code=…` deep link via `exchangeCodeForSession`, matching the website's `/auth/callback`. Also made auth **offline-resilient** — startup falls back to the stored session (read directly from localStorage) instead of bouncing to login or hanging when a token refresh can't reach the network, and the Gallery shows a calm offline notice (auto-retrying on reconnect) instead of a fetch error.
- 2026-06-11: **Added background auto-update** (`electron-updater`). The installed Mac app now downloads new releases silently and shows a **"Relaunch to update"** banner — no more re-downloading the DMG. New `src/main/updater.ts` + `update:*` IPC, renderer `UpdateProvider`/`UpdateBanner` (top of the `AppBanners` stack) + an Account "About" check button. electron-builder gained a **`zip`** mac target (Squirrel.Mac updates from a zip) and a `publish: generic` block pointed at the website's new **`/updates`** feed, which serves `latest-mac.yml` + the zip/blockmap from the latest GitHub release through the same `GITHUB_RELEASE_TOKEN` proxy as `/download` (shared `lib/github-release.ts`) — preserving "private repo = zero-change". `release.sh` uploads the three update assets under space-free names (`mac.artifactName` → `Living-Art-Screensaver-<v>-universal.zip`; GitHub rewrites spaces to dots, which would break the manifest→zip lookup). Auto-update needs Developer-ID signing + notarization (no-op in dev) and only kicks in from the **next** release onward (the first build with the updater installs manually). The embedded `.appex` needs no special handling — it rides inside the same signed zip and the version-aware `ensureRegistered` re-registers it on the post-update relaunch. See *Releasing a new version › Auto-update*.
- 2026-06-13: **Free-browse gallery + lock-based upsell, and decoupled cache from play.** `/api/gallery` now returns the **full** gallery to everyone (gating moved client-side) and replaced `totalCount` with **`freeCount`** (the server-defined free threshold the client gates on). The Electron Gallery shows every piece; for non-subscribers, pieces past `freeCount` render a **lock** ("Subscribe to unlock" tooltip / modal button) instead of the selection tick. `cache-sync` never downloads a locked piece and evicts ones that become locked (lapsed subscription) — so the paywall holds even though the API returns everything. **Cache decoupled from the play set:** deselecting an unlocked piece now *keeps* its `.bin` on an auto sync (instant re-add); a manual "Sync Now" passes `pruneDeselected` to tidy them off disk. Manifest = selected ∩ unlocked; the Swift `CachedManifest` dropped `totalCount` to match. Gallery also gained an inline **Select all** (toggles the currently-shown unlocked pieces) and a **search** box (title + tag, `matchesQuery`). See *Subscription & Gating Architecture*.
