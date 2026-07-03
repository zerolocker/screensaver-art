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
| `packages/constants/` | **Pure-data shared package** (`@screensaver-art/constants`) — `FREE_ITEM_COUNT` (the advertised free-tier size = count of `free: true` pieces in `gallery.json`), the per-item gating rule (`isItemFree`/`isItemLocked`), `PRICING`, `ArtItem`/`GalleryApiResponse` types, tag vocabulary (`TAG_ORDER`, `tagsOf`, `orderTags`). No build step; consumers compile the TS source. The Electron **main** process bundles it via `externalizeDepsPlugin({ exclude: [...] })`; the website lists it in `transpilePackages`. |
| `packages/ui/` | **Shared UI** — React components (LoginForm, SignUpForm, SubscriptionCard, base UI) |
| `electron-app/` | **The user-facing installer** — see below |
| `electron-app/src/main/installer.ts` | Auto-registers the `.appex` on launch (`ensureRegistered`, **version-aware** — re-registers only when unregistered or the app updated, so an update can't run stale appex code), queries status, and sets the active screensaver — all via the PaperSaver helper. On the (re)register path it `lsregister -f`'s the bundle first (a Squirrel in-place update's stale LaunchServices entry otherwise makes `pluginkit -a` silently no-op), then **polls `find`** to confirm (`pluginkit -a` registers asynchronously, ~1s later). No manual install/uninstall UI. |
| `electron-app/src/main/screensaver-timing.ts` | Reads the two macOS idle thresholds the "screensaver is set" status banner explains — screensaver start delay (`defaults -currentHost read com.apple.screensaver idleTime`, seconds) + display-off delay (`pmset -g` displaysleep, minutes) — and starts the screensaver on demand (`open -a ScreenSaverEngine`) for "Preview now". macOS-only; degrades to null off-platform. |
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
| `R2 Bucket` | `https://screensaver-assets.living-art-asset.com/gallery/` — MP4 assets, served via a **Cloudflare custom domain** on the `screensaver-assets` bucket (`gallery/` prefix). **Never use the `*.r2.dev` URL** — it bypasses the CDN cache and is rate-limited / not-for-production. Every object carries a 1-year immutable `Cache-Control`, and cacheable GETs return `cf-cache-status: HIT`. (Gotcha: `curl -I`/HEAD shows `DYNAMIC` — Cloudflare caches/serves on **GET** only; test with a GET.) |
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
- macOS install is **automatic**: on launch the renderer's `InstallerProvider` calls `installer:ensureRegistered`, which registers the embedded `.appex` via `pluginkit` (version-aware — see the `installer.ts` key-path row; the appex `CFBundleVersion` is stamped from the app version at build time). No copy into `~/Library/Screen Savers/`, no manual Install/Uninstall UI. Activation is the one-click **"Set"** banner at the top of the app (PaperSaver helper), or the user picks it in System Settings. A missing embedded appex (damaged install) shows a blocking recovery screen — send report + restart, gated post-login so the report carries the user id.
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
1. Upload MP4 to Cloudflare R2 bucket `screensaver-assets` under the `gallery/` prefix. Set a long, immutable `Cache-Control` on the object at upload time (`wrangler r2 object put … --cache-control "public, max-age=31536000, immutable"`) — gallery keys are never overwritten, so caching them hard is safe and stops repeat re-fetches (the curation `upload()` helper already does this).
2. Add an entry to `gallery.json` — include `src` (full custom-domain URL, `https://screensaver-assets.living-art-asset.com/gallery/…`), `title`, `type`, `date`, `collection`, `image_prompt`, `video_prompt`. **Do not set `free`** — new pieces are **locked (subscriber-only) by default**, which is intentional: fresh art is the recurring perk that justifies a subscription, and it keeps the free tier pinned at exactly `FREE_ITEM_COUNT` pieces as the catalog grows. (The free pieces are a fixed, interleaved set chosen once; see *Where gating happens*.)
3. Push to `master` — GitHub Pages auto-deploys `gallery.json`. Subscribers' Electron apps pick up the new piece on their next sync.

---

## Subscription & Gating Architecture

### The product model
- Users subscribe at `living-art-screensaver.com` ($0.99/month, billed quarterly as $2.97 every 3 months via Stripe), or directly inside the Electron app (every "Subscribe" CTA — gallery locks, the upsell banner, the Account card — calls `startCheckout()`, which goes **straight to Stripe checkout**; see *App-initiated checkout* below)
- **Everyone** browses the *entire* gallery in the app — a free user can preview every piece.
- **Subscribed**: can select + cache any pieces (selection drives what plays).
- **Not subscribed**: only the **free** pieces (those flagged `free: true` in `gallery.json`) are *unlockable*; every other piece shows a lock ("Subscribe to unlock") and is never downloaded/cached. The free pieces are selected by default.
- The screensaver doesn't know or care about subscriptions — it just plays whatever is in the cache directory

### Where gating happens
Gating is **client-side** and **per-item**. Each `gallery.json` entry carries a `free` flag; the free pieces are deliberately **interleaved** through the catalog (by date — roughly every other one of the oldest pieces, with the newest left locked) so a free user keeps bumping into locked art while browsing, instead of all the free pieces sitting in one contiguous block. `/api/gallery` inspects the Bearer token, checks Supabase `subscriptions`, and returns the **full** list for everyone (the per-item `free` flag rides along):
```
{ items: GalleryItem[], isSubscribed: boolean }
```
(The old positional `freeCount` threshold and `totalCount` are gone — `items.length` is the total, and `free`-ness is per-item.) The single gating rule lives in `@screensaver-art/constants` as `isItemLocked(item, isSubscribed)` (= `!isSubscribed && item.free !== true`). The Electron app renders all items but locks the non-free ones for non-subscribers (lock icon instead of the selection tick, and the modal's add button becomes "Subscribe to unlock"). `cache-sync` enforces the same rule: it never downloads a locked piece, and on each sync evicts any cached `.bin` that is now locked (e.g. an expired subscription) or no longer in the gallery — re-enforcing the gate even though the API hands back the full list. The advertised free count (`FREE_ITEM_COUNT`, currently **50**) is the number of `free: true` pieces in `gallery.json`; a test (`free-tier invariant`) keeps the two in lockstep.

**Cache is decoupled from "what plays":** the manifest = *selected ∩ unlocked* (what the screensaver plays), but the on-disk cache is kept *wider*. Deselecting an unlocked piece on a normal (auto) sync **keeps** its `.bin` so re-adding is instant; only a manual "Sync Now" (`pruneDeselected`) tidies deselected files off disk. A subscriber's cache therefore trends toward "everything ever selected" — the **Clear cache** button in Account is the reset.

### App-initiated checkout (no website re-login, straight to Stripe)
Clicking any "Subscribe" CTA in the Electron app used to just open `living-art-screensaver.com/account` in the browser — but the app's session lives in *its own* Chromium localStorage, not the browser's cookies, so the user had to **log in again** and then click "Subscribe" **again**. Now the app skips both:
- The renderer's `startCheckout()` (`src/renderer/src/lib/checkout.ts`) POSTs the user's Supabase access token to **`/api/checkout`** (Bearer-authed via `verifyNativeAuth`), which creates a Stripe Checkout Session and returns its URL; the app opens *that* directly with `shell.openExternal` — straight to payment. Any failure (offline, already subscribed → 409, server error) falls back to opening `/account` so the button always does something.
- The Stripe session-building logic is shared in `lib/checkout.ts` (`createSubscriptionCheckoutSession`) between the new API route and the website's cookie-authed `createCheckoutSession` server action.
- **Success/cancel** for the app flow land on the **public** `/checkout/complete?status=success|canceled` page (no auth — the browser running Stripe checkout has no website session). The subscription is recorded by the Stripe webhook; the Account page re-verifies on window focus, so the app reflects the new status when the user switches back. (The website's own checkout, from `/account` / the home `#pricing` section, still returns to `/account?success=…` since those users *are* logged in.)
- **The old `/pricing` 404:** the web `createCheckoutSession`'s `cancel_url` pointed at `${origin}/pricing` (and the pricing section's post-login redirect at `/pricing`), but there is no `/pricing` route — only the `#pricing` anchor on the home page. Both now use real targets (`/account` or `/#pricing`).

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
The API used to return only the free slice (to hide URLs); we traded that for letting free users browse + preview the whole gallery — a better upsell. No piracy regression: the MP4s were always public on R2 (no signed URLs), and the real friction is the **cache-side obfuscation** below — `cache-sync` still refuses to download locked pieces and evicts any that become locked, so a non-subscriber never holds the locked `.bin` files. If piracy ever matters, the next step is signed R2 URLs, not re-hiding the playlist.

### Cache obfuscation
Every cached MP4 is stored as `<djb2-127-hash-of-URL>.bin`: an 8-byte `LARTV001` magic header + the MP4 XOR'd with a 32-byte cycling key. The key, magic, and filename hash are duplicated in two files that **must stay in sync** — `electron-app/src/main/obfuscation.ts` (writer) and `screensaver-macos/ScreensaverArtExtension/Constants.swift` (reader).

This is **not real cryptography** — both binaries embed the key. It's a deliberate friction layer, not DRM: the `.bin` files don't open in QuickTime even after rename, which blocks the casual "drag the MP4 out and post it" path without over-engineering a $0.99 product. The Swift screensaver decrypts on demand into `NSTemporaryDirectory()/ScreensaverArt/`, hands the temp URL to AVPlayer, and deletes it when the slot is reused.

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
| `UpsellPill.swift` | `UpsellPill` | Gentle subscribe nudge for free users (`isSubscribed` false): a small frosted pill above the title that fades in/out (16s on / 16s off) and **never covers the art**. Copy points back to the app's Subscribe button (a screensaver can't be clicked). Replaced an older full-screen 30s modal. |
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
Both `/download` and `/updates` **always** go through the GitHub API with a
server-side token rather than a public asset URL — so the repo can go private
with zero changes. The token is **`GITHUB_RELEASE_TOKEN`**, a fine-grained PAT
with `Contents: Read-only` on this repo, set in two places:
- **Vercel** project env (Production + Preview + Development) — for the deployed site.
- **`living-art-screensaver-web/.env.local`** (gitignored) — for `pnpm dev`.

Given the token, the route requests the asset with `Accept: application/octet-stream`
and 302s to the short-lived **signed** `objects.githubusercontent.com` URL (bytes
never flow through Vercel; works for anonymous users on a private repo). Missing
token → 500 by design, so a private repo can't silently hand out broken links.

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
- **Where updates come from.** electron-builder's `publish: generic` points the
  app at **`/updates`** on the website (`app/updates/[...path]/route.ts`), which
  serves the updater's files from the latest GitHub release through the **same
  `GITHUB_RELEASE_TOKEN` proxy** as `/download` (shared `lib/github-release.ts`) —
  `latest-mac.yml` proxied inline, `.zip`/`.blockmap` 302'd to a signed CDN URL.
  No token is baked into the app.
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
The dated change log lives in [docs/CHANGELOG.md](docs/CHANGELOG.md) — log an entry there only for major changes whose context is hard to recover from the code alone; `git log` has the rest.

## Growth & marketing
User-acquisition work (get people to the site + downloading) is tracked in a shared, multi-agent hub: **[docs/GROWTH-PROGRESS.md](docs/GROWTH-PROGRESS.md)** — the canonical live status/backlog (read + update it before/after growth work). Reasoning lives in [docs/growth-and-marketing-strategy.md](docs/growth-and-marketing-strategy.md); launch copy in [docs/launch-kit.md](docs/launch-kit.md); the social-clip generator in [marketing/](marketing/README.md). If you're doing growth work, start at the hub.
