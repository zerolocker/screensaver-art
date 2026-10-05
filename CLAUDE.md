# Living Art Screensaver

A macOS screensaver that plays AI-animated art. Users install one Electron app. It handles sign-in and payment, downloads the videos, and registers a native screensaver that plays them. New art is added every night by a curation agent.

## Repo rules

- **Never commit media** (images, audio, video) without the founder's explicit approval. Ask every time, even for small or AI-generated files. Media goes to R2.
- Use **pnpm**, never npm or yarn.

## Layout

| Path | What it is |
|---|---|
| `packages/constants/` | Shared pure-data package: `FREE_ITEM_COUNT`, `PRICING`, the `ArtItem` type, the `/api/gallery` response type, the tag list, and the gating rules (`isItemLocked`, `isSubscriptionActive`). No build step: the website's `transpilePackages` and the Electron main's `externalizeDepsPlugin({ exclude })` compile it. |
| `packages/ui/` | Shared React components (auth forms, `SubscriptionCard`, base UI, and `ArtVideo`, the shared gallery `<video>`) and `globals.css` design tokens. No build step, no Next.js imports. |
| `electron-app/` | The app users install. Sign-in, payment, gallery sync, screensaver registration. Windows support is scaffolded but not built. |
| `screensaver-macos/` | The screensaver: a sandboxed Swift ExtensionKit `.appex`. A pure player with no network or auth. |
| `screensaver-helper/` | `lart-screensaver-helper`, a small Swift CLI wrapping [PaperSaver](https://github.com/AerialScreensaver/PaperSaver). The app calls it to register the `.appex` and set it as the active screensaver. |
| `living-art-screensaver-web/` | Next.js website on Vercel: marketing, account, Stripe, and the APIs the app calls. |
| `gallery.json` | The playlist. One entry per art piece. |
| `curation/` | The nightly curation agent's runbooks and the human review tool. See `curation/README.md`. |
| `marketing/` | Renders and posts the daily social clip. See `marketing/README.md`. |
| `index.html` | Standalone web preview, served by GitHub Pages. Nothing depends on it. |

## Commands

```bash
pnpm install                              # from the repo root

cd electron-app
pnpm dev                                  # builds the .appex + helper, then runs the app
pnpm dist:mac                             # local universal DMG, ad-hoc signed

cd living-art-screensaver-web
pnpm dev                                  # localhost:3000

bash screensaver-macos/build.sh Debug     # build the .appex alone; auto-registers it
./scripts/release.sh [minor|major|X.Y.Z]  # ship a signed, notarized release
```

Building the app or screensaver needs Xcode and `brew install xcodegen`.

## How it works

1. The app calls `GET /api/gallery` with the user's Supabase token. The route reads `gallery.json` from the `master` branch through the GitHub Contents API, so a push to `master` is the whole deploy.
2. The app downloads each MP4, obfuscates it, and writes it to `/Users/Shared/LivingArtScreensaver/` with a manifest.
3. The `.appex` reads the manifest each time it starts, decrypts each file to a temp MP4, and crossfades between them (`ScreensaverArtView.swift`). It has no settings UI. Free users see a small subscribe pill.

### Gating

- `/api/gallery` returns every piece to everyone, plus `isSubscribed`. Gating happens in the client.
- A piece is locked when the user isn't subscribed and the piece lacks `free: true` (`isItemLocked`). Exactly `FREE_ITEM_COUNT` (50) pieces are free; a test keeps the two in sync.
- The app never downloads a locked piece, and each sync deletes cached files that became locked or left the gallery.
- The manifest lists only selected, unlocked pieces. The cache can hold more: deselected files stay until a manual "Sync Now" or "Clear cache".
- The MP4s are public on R2, so this gating is friction, not security. If piracy matters, use signed R2 URLs.

### Cache and obfuscation

- Each video is cached as `<djb2 hash of URL>.bin`: the 8-byte header `LARTV001`, then the MP4 XOR'd with a 32-byte key. It stops casual copying; it is not encryption.
- **The key, header and hash exist twice and must match:** `electron-app/src/main/obfuscation.ts` (writer) and `screensaver-macos/ScreensaverArtExtension/Constants.swift` (reader).
- The cache lives in `/Users/Shared/` because the sandboxed `.appex` can read it through a `temporary-exception` entitlement, and writing there triggers no macOS privacy prompt.

### Screensaver registration

- On launch the app registers the embedded `.appex` with `pluginkit` through the helper (`electron-app/src/main/installer.ts`). It re-registers only when the app version changed.
- Before registering, it runs `lsregister -f` on the bundle (after an in-place update, a stale LaunchServices entry makes `pluginkit -a` silently do nothing). Then it polls `find`, because `pluginkit -a` registers about a second later.
- `scripts/bundle-appex.sh` stamps the app version into the appex's `CFBundleVersion`. pluginkit caches by version, so without this an update keeps running old screensaver code.
- An `.appex` with an invalid signature is silently ignored by `pluginkit`.

### Auth

- Passwordless only: an emailed one-time code, or Apple, Google or Microsoft sign-in with PKCE.
- The app opens the provider in the system browser. The provider redirects to `/auth/desktop-callback`, which hands the code to the app through the `livingart://auth-callback` deep link. That URL must be in Supabase's redirect allow-list.
- The app keeps its session in Chromium localStorage and sends it to the website as a Bearer token. Server routes that the app calls use `lib/supabase/native-client.ts`, not the cookie client.

### Payments

- Two offers: $0.99/month billed as $2.97 every 3 months (`STRIPE_PRICE_ID`), and a $15.99 lifetime purchase (`STRIPE_LIFETIME_PRICE_ID`).
- Both are stored on the user's `subscriptions` row. `isSubscriptionActive()` is the one access rule: lifetime, or status `active`/`trialing`.
- Buying lifetime cancels any running subscription. Subscription webhooks never touch the lifetime columns.
- From the app, "Subscribe" posts the user's token to `/api/checkout` and opens the returned Stripe URL directly, so the user never logs in to the website. On any error it opens `/account` instead.
- Setup and the price-change procedure: `living-art-screensaver-web/docs/stripe-webhooks.md`.

### Signing and notarization

- `LART_CODESIGN_IDENTITY` switches the build between ad-hoc signing (default, runs only on the build machine) and Developer ID with hardened runtime and notarization.
- The universal merge rewrites files inside the `.appex` and breaks its signature. `scripts/afterpack-sign.cjs` re-signs the `.appex` and helper after the merge. electron-builder never signs `Contents/PlugIns/`.
- Notarization runs when Apple credentials are in the environment. `scripts/aftersign-staple.cjs` staples the ticket.
- For a release, copy `electron-app/release.env.example` to `release.env` and run `pnpm dist:mac:release`.

### Releases and auto-update

- `./scripts/release.sh` bumps the version, builds a signed, notarized DMG, tags, pushes, and publishes a GitHub Release. Toggles: `DRY_RUN=1`, `SKIP_BUILD=1`, `ALLOW_BRANCH=1`.
- `/download/mac` redirects to the latest release's DMG. `/updates/*` serves electron-updater's files from the latest release. Both read GitHub with `GITHUB_RELEASE_TOKEN` (set in Vercel and in the website's `.env.local`), so the repo can go private. A missing token returns 500.
- electron-updater needs the `zip` target and asset names without spaces, because GitHub turns spaces into dots and `latest-mac.yml` names the zip exactly.
- Updates only install on a Developer ID build running from `/Applications`.

### Logging

- The main process logs to the console, `<userData>/logs/main.log`, and a ring buffer. The renderer forwards its logs over IPC.
- "Send error report" uploads a snapshot (versions, installer diagnostics, cache summary, recent logs) to `/api/error-report`, which stores it in the Supabase `user-error-reports` bucket.
- The Swift helper logs to the unified log under `com.livingart.screensaver.app` and keeps stdout for JSON.

## Gallery data

- Each `gallery.json` entry has `src`, `title`, `type`, `date`, `tags`, and the website-only images `img` (2K), `og_img` (1280×720 JPEG) and `thumb` (640w). AI pieces also have `image_prompt` and `video_prompt`; every piece in the night's posted set has `music_prompt`.
- Real public-domain paintings have `source: "real_artwork"` and provenance fields instead of an image prompt (`isRealArtwork()`).
- Clips are 16:9, except real paintings animated as portrait (9:16). There is no aspect field: each player reads the clip's size and shows a portrait clip whole on the `#0b0b0d` wall (`PORTRAIT_WALL`) instead of cropping it. That is `ArtVideo` on the website and in the app, and `ScreensaverArtView.swift` in the screensaver, which keeps its own copy of the colour.
- Add pieces with `curation/publish-piece.mjs`. It uploads to R2 with immutable cache headers and never overwrites a key.
- Don't set `free` on new pieces. They are subscriber-only by design.

## Website

- Vercel project `v0-living-art-screensaver`, deployed on every push to `master`.
- `lib/gallery-catalog.ts` builds `/gallery`, `/art/<slug>` and `/era/<tag>` from `gallery.json` at build time. These pages are landing pages for social posts.
- **Slugs come from the R2 key and must never change**: posted pins can't be edited, so a changed slug breaks them forever.
- Tailwind v4 doesn't scan workspace packages, so each app's CSS needs `@source "…/packages/ui/src"`.

## Infrastructure

| Service | Use |
|---|---|
| Supabase | Auth, the `subscriptions` table (schema in `living-art-screensaver-web/scripts/*.sql`), the `user-error-reports` bucket |
| Stripe | Payments |
| Cloudflare R2 | Media, served from `https://screensaver-assets.living-art-asset.com/gallery/`. Never use the `r2.dev` URL. Test caching with a GET; HEAD always shows `DYNAMIC`. |
| Vercel | The website |
| GitHub Pages | `index.html` preview only |

The Apple and Microsoft sign-in secrets expire. See `docs/secret-rotation.md`.

## Other docs

- `docs/GROWTH-PROGRESS.md`: growth status and backlog. Read it before marketing work.
- `docs/posthog-analytics.md`: analytics events.
- `curation/README.md`: how art is made and reviewed.
