# Living Art Screensaver

Turn your Mac's idle display into a dynamic, evolving art gallery — AI-generated animations that feel alive.

**Website:** [living-art-screensaver.com](https://living-art-screensaver.com)
**Web preview:** [zerolocker.github.io/screensaver-art](https://zerolocker.github.io/screensaver-art/)

---

## What's in this repo

This is a monorepo containing all three parts of the product:

| Directory | What it is |
|---|---|
| `screensaver/` | Native macOS screensaver (Swift, AVPlayer) |
| `living-art-screensaver-web/` | Marketing site + account/billing portal (Next.js) |
| `index.html` | Standalone web preview — no build step |
| `gallery.json` | Master playlist — single source of truth for all artworks |

---

## The product

The macOS screensaver cycles through AI-generated animated artworks using a crossfade A/B layer system. Users subscribe at $0.99/month to unlock the full gallery (123+ artworks). Without a subscription, the screensaver plays the first 2 artworks.

**How it works end-to-end:**
1. User subscribes at `living-art-screensaver.com` via Stripe
2. They sign into the screensaver via System Settings → Screen Saver → Options
3. The screensaver fetches the gallery from `/api/gallery` using their auth token
4. Subscribed users get the full playlist; free users get 2 artworks + an upsell overlay

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
```

- **Auth:** Supabase email/password. Tokens stored in macOS Keychain.
- **Billing:** Stripe ($0.99/month). Webhooks sync subscription status to Supabase.
- **Gallery API:** `GET /api/gallery?collection=classic` — requires Bearer token, gates content by subscription status.
- **Offline:** Videos cached in `~/Library/Caches/ScreensaverArt/` as they play. Gallery JSON also cached so the screensaver works without a network connection.

---

## Development

**Build & install the screensaver:**
```bash
bash screensaver/build.sh --install
# Compiles Swift and installs to ~/Library/Screen Savers/ScreensaverArt.saver
```

**Run the website locally:**
```bash
cd living-art-screensaver-web
pnpm install
pnpm dev          # → localhost:3000
```

**Add new artworks:**
1. Upload MP4 to Cloudflare R2 under the `gallery/` prefix
2. Add an entry to `gallery.json` (include `src`, `title`, `type`, `collection`, `date`, prompts)
3. Push to GitHub — the screensaver picks it up on next launch, no rebuild needed

See `CLAUDE.md` for full architectural details and decision rationale.
