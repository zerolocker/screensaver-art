# Living Art Screensaver

Turn your computer's idle display into a dynamic, evolving art gallery — AI-generated animations that feel alive.

**Website:** [living-art-screensaver.com](https://living-art-screensaver.com)
**Web preview:** [zerolocker.github.io/screensaver-art](https://zerolocker.github.io/screensaver-art/)

---

## What's in this repo

This is a pnpm workspace monorepo containing:

| Directory | What it is |
|---|---|
| `packages/ui/` | Shared React components (auth forms, subscription card, base UI) |
| `electron-app/` | Cross-platform desktop app — the **only thing the user installs**. Handles auth, billing portal, video sync, and installs + activates the platform-native screensaver. |
| `screensaver-macos/` | Native macOS screensaver as a modern **`.appex`** ExtensionKit extension (Swift, built with Xcode/xcodegen). Pure player — no auth, no network. Reads videos from a shared local cache populated by the Electron app. |
| `screensaver-helper/` | Tiny SwiftPM CLI (`lart-screensaver-helper`) wrapping PaperSaver so the app can detect/set the active screensaver (one-click "Set"). |
| `living-art-screensaver-web/` | Marketing site + account/billing portal (Next.js) |
| `index.html` | Standalone web preview — no build step |
| `gallery.json` | Master playlist — single source of truth for all artworks |
| `curation/` | The **nightly AI curation agent** (`AUTOMATED_CURATION.md`) that commissions new art, plus the human-in-the-loop cleanup tool that keeps improving it |

---

## How it works end-to-end

1. User downloads the **Living Art Screensaver** desktop app (Electron).
2. They sign in inside the app and (optionally) subscribe via Stripe — $0.99/month, billed quarterly ($2.97 every 3 months).
3. The app fetches the gallery from `living-art-screensaver.com/api/gallery`, downloads each MP4, **XOR-obfuscates** it, and writes it into the shared cache at `/Users/Shared/LivingArtScreensaver/videos/`. `/Users/Shared/` is nobody's app container, so writing there triggers no macOS "access data from other apps" prompt; the sandboxed screensaver reads it via a filesystem-exception entitlement.
4. The app installs the native screensaver — on macOS it registers the embedded **`.appex`** extension with `pluginkit` (one-time), then offers a one-click "Set" to make it the active screensaver. Subsequent runs of the app just refresh the cache.
5. The screensaver itself is a thin player: it reads the cache manifest, decrypts each `.bin` to a temp file, and crossfades between them. It has no network access and no UI for accounts.

The result: only one user-facing installer, and the screensaver process itself is small, offline, and free of subscription-management complexity.

---

## How art gets made

The gallery curates itself. A **nightly AI curation agent** — see
[`curation/AUTOMATED_CURATION.md`](curation/AUTOMATED_CURATION.md) — commissions
four new pieces every night, so there's a fresh exhibition each morning. For each
piece it:

1. Picks a theme/style from art history (pre-21st-century).
2. Generates a 4K still with **text-to-image** (Nano Banana Pro / Gemini 3 Pro Image).
3. Runs a **vision gate** — it looks at the still and re-rolls anything that reads
   as a catalog photo, shows AI artifacts, or just wouldn't look good framed,
   *before* spending a video generation on it.
4. Animates the still with **image-to-video** (Google Veo 3.1) — some pieces loop
   seamlessly (same first + last frame), others play once.
5. Uploads the still + MP4 to **Cloudflare R2** and appends the entry (title, tags,
   prompts) to `gallery.json`.

The agent is **self-improving**: before writing prompts it reads
`curation/PROMPT_GUIDANCE.md`, which accumulates quality rules distilled from a
**human-in-the-loop cleanup pass** ([`curation/README.md`](curation/README.md))
that flags and removes weak pieces. Every curation round tightens the guidance, so
the bot produces fewer misses over time. New pieces are **subscriber-only by
default** — fresh art is the recurring perk that justifies the subscription.

---

## Technical architecture

```
Cloudflare R2          GitHub Pages           Vercel
(MP4 assets)  ←──────  gallery.json  ←──────  /api/gallery
                                                    │
                                               Supabase
                                           (auth + subscriptions)
                                                    │
                                              Stripe webhooks

         ┌─────── Electron app (the installer) ───────┐
         │  - Sign in to Supabase                     │
         │  - Fetch /api/gallery with Bearer token    │
         │  - Download MP4s, XOR-obfuscate, cache     │
         │  - pluginkit -a the embedded .appex        │
         │  - One-click "Set" (PaperSaver helper)     │
         └────────────────────┬───────────────────────┘
                              │ writes
                              ▼
              /Users/Shared/LivingArtScreensaver/
              ├── gallery.json  (manifest)
              └── videos/*.bin  (XOR-obfuscated)
                              ▲
                              │ reads (sandbox filesystem-exception entitlement)
         ┌──── ScreensaverArtExtension.appex (player) ┐
         │  - Loads manifest                          │
         │  - Decrypts each .bin to a temp .mp4       │
         │  - A/B crossfade with AVPlayer             │
         │  - No network, no auth, no settings UI     │
         └────────────────────────────────────────────┘
```

- **Auth:** Passwordless Supabase auth — email one-time code or Apple / Google / Microsoft OAuth (PKCE flow) — handled in the Electron app. Sessions persist in Chromium localStorage.
- **Billing:** Stripe — $0.99/month, billed quarterly ($2.97 every 3 months, to cut per-transaction fees). Webhooks sync subscription status to Supabase. The website hosts the Stripe portal; the Electron app deep-links to it.
- **Gallery API:** `GET /api/gallery?collection=classic` returns the **full** gallery to everyone, each item carrying a per-item `free` flag — gating is client-side. Non-subscribers can browse every piece but only unlock the ones flagged `free` (currently 50); the Electron app refuses to download locked pieces and evicts any that later become locked. Subscribers unlock the whole gallery.
- **Cache obfuscation:** every video is XOR'd byte-by-byte with a fixed 32-byte cycling key plus an 8-byte magic header (`LARTV001`), and stored on disk as `<hash>.bin`. The same key + algorithm lives in both `electron-app/src/main/obfuscation.ts` and `screensaver-macos/ScreensaverArtExtension/Constants.swift`. This is not cryptography — anyone willing to disassemble either binary can recover the key. The intent is to deter the casual "drag the MP4 out of the cache and post it" path. Anything stronger would be over-engineered for a $0.99 product.

---

## Development

```bash
pnpm install              # install all workspace dependencies from repo root
```

**Build the screensaver directly (developer shortcut):** *(requires Xcode + `brew install xcodegen`)*
```bash
bash screensaver-macos/build.sh Debug   # fast, host-arch; auto-registers via pluginkit
# Then pick it in System Settings → Screen Saver, or set it active from screensaver-helper.
```

**Run the Electron desktop app:**
```bash
cd electron-app
pnpm dev                  # builds the .appex + helper, then launches Electron with HMR
```

**Build a distributable Electron installer:**
```bash
cd electron-app
pnpm dist:mac             # → electron-app/dist/Living Art Screensaver-1.0.0-universal.dmg
pnpm dist:win             # → electron-app/dist/Living Art Screensaver Setup-1.0.0.exe
```
The macOS DMG is **universal** (Intel + Apple Silicon). By default it's ad-hoc signed (runs on the build machine; not distributable to others). For a **signed + notarized release** (one-time setup: a "Developer ID Application" cert in your keychain + `xcrun notarytool store-credentials`), copy `electron-app/release.env.example` → `release.env` (gitignored), fill in your identity + keychain profile, then:
```bash
pnpm dist:mac:release
```
This signs with the hardened runtime, notarizes via Apple, and staples the ticket. (Equivalently, pass `LART_CODESIGN_IDENTITY` + `APPLE_KEYCHAIN_PROFILE` inline to `pnpm dist:mac`.) See `CLAUDE.md` → "Code signing & notarization" for how it works.

**Cut a public release (one command):**
```bash
./scripts/release.sh          # patch bump (1.0.0 → 1.0.1); also: minor / major / 1.2.0
```
This bumps `electron-app/package.json`, builds the signed + notarized DMG, commits + tags `vX.Y.Z`, pushes, and publishes a GitHub Release with the DMG attached. The website's "Download for Mac" button (`/download/mac`) resolves "latest" from GitHub Releases at request time, so the new version goes live within ~2 min — no website redeploy.

> ⚠️ `pnpm dist:mac` / `pnpm dist:mac:release` only build a DMG **locally** — they do **not** bump the version or publish anything. To actually ship a new version, run `./scripts/release.sh`. See `CLAUDE.md` → "Releasing a new version" for the toggles (`DRY_RUN`, `SKIP_BUILD`, `ALLOW_BRANCH`) and full details.

**Run the website locally:**
```bash
cd living-art-screensaver-web
pnpm dev                  # → localhost:3000
```

**Add new artworks:**
1. Upload MP4 to Cloudflare R2 under the `gallery/` prefix
2. Add an entry to `gallery.json` (include `src`, `title`, `type`, `collection`, `date`, prompts)
3. Push to `master` — GitHub Pages auto-deploys `gallery.json`

See `CLAUDE.md` for full architectural details and decision rationale.
