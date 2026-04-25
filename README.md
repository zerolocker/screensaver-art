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
| `electron-app/` | Cross-platform desktop app — the **only thing the user installs**. Handles auth, billing portal, video sync, and installs the platform-native screensaver. |
| `screensaver/` | Native macOS screensaver bundle (Swift). Pure player — no auth, no network. Reads videos from a local cache populated by the Electron app. |
| `living-art-screensaver-web/` | Marketing site + account/billing portal (Next.js) |
| `index.html` | Standalone web preview — no build step |
| `gallery.json` | Master playlist — single source of truth for all artworks |

---

## How it works end-to-end

1. User downloads the **Living Art Screensaver** desktop app (Electron).
2. They sign in inside the app and (optionally) subscribe via Stripe at $0.99/month.
3. The app fetches the gallery from `living-art-screensaver.com/api/gallery`, downloads each MP4, **XOR-obfuscates** it, and writes it to `~/Library/Caches/ScreensaverArt/videos/`.
4. The app installs the native screensaver (`.saver` bundle on macOS) into `~/Library/Screen Savers/` — this only happens once. Subsequent runs of the app just refresh the cache.
5. The screensaver itself is a thin player: it reads the cache manifest, decrypts each `.bin` to a temp file, and crossfades between them. It has no network access and no UI for accounts.

The result: only one user-facing installer, and the screensaver process itself is small, offline, and free of subscription-management complexity.

---

## How art gets made

A background agent acts as a nightly museum curator, commissioning new works while you sleep so there's a fresh exhibition every morning. Each piece is generated with:
- **Text-to-image** for composition and style
- **Image-to-video** (Veo) to bring the composition to life as a looping MP4
- Uploaded to Cloudflare R2 and added to `gallery.json`

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
         │  - Install ScreensaverArt.saver into       │
         │    ~/Library/Screen Savers/                │
         └────────────────────┬───────────────────────┘
                              │ writes
                              ▼
              ~/Library/Caches/ScreensaverArt/
                  ├── gallery.json  (manifest)
                  └── videos/*.bin  (XOR-obfuscated)
                              ▲
                              │ reads
         ┌──────── ScreensaverArt.saver (player) ─────┐
         │  - Loads manifest                          │
         │  - Decrypts each .bin to a temp .mp4       │
         │  - A/B crossfade with AVPlayer             │
         │  - No network, no auth, no settings UI     │
         └────────────────────────────────────────────┘
```

- **Auth:** Supabase email/password, handled in the Electron app. Sessions persist in Chromium localStorage.
- **Billing:** Stripe ($0.99/month). Webhooks sync subscription status to Supabase. The website hosts the Stripe portal; the Electron app deep-links to it.
- **Gallery API:** `GET /api/gallery?collection=classic` — same gating endpoint as before. Free users get 2 items, subscribers get the full list. The Electron app downloads whatever the API returns.
- **Cache obfuscation:** every video is XOR'd byte-by-byte with a fixed 32-byte cycling key plus an 8-byte magic header (`LARTV001`), and stored on disk as `<hash>.bin`. The same key + algorithm lives in both `electron-app/src/main/obfuscation.ts` and `screensaver/Constants.swift`. This is not cryptography — anyone willing to disassemble either binary can recover the key. The intent is to deter the casual "drag the MP4 out of the cache and post it" path. Anything stronger would be over-engineered for a $0.99 product.

---

## Development

```bash
pnpm install              # install all workspace dependencies from repo root
```

**Build & install the screensaver directly (developer shortcut):**
```bash
bash screensaver/build.sh --install
# Compiles Swift and installs to ~/Library/Screen Savers/ScreensaverArt.saver
```

**Run the Electron desktop app:**
```bash
cd electron-app
pnpm dev                  # bundles the .saver, then launches Electron with HMR
```

**Build a distributable Electron installer:**
```bash
cd electron-app
pnpm dist:mac             # → electron-app/dist/Living Art Screensaver-1.0.0.dmg
pnpm dist:win             # → electron-app/dist/Living Art Screensaver Setup-1.0.0.exe
```
The DMG is unsigned by default. Sign + notarize before public release.

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
