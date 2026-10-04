# Living Art Screensaver

A Mac screensaver that turns the idle screen into a gallery of art, animated by AI, with new pieces every night.

- Website: [living-art-screensaver.com](https://living-art-screensaver.com)
- Web preview: [zerolocker.github.io/screensaver-art](https://zerolocker.github.io/screensaver-art/)

## How it works

Users install one desktop app (Electron). They sign in, optionally pay ($0.99/month billed quarterly, or $15.99 once), and pick the pieces they want. The app downloads those videos into a local cache and registers a native macOS screensaver, which plays them offline.

```
gallery.json ──► /api/gallery (website) ──► Electron app ──► /Users/Shared/LivingArtScreensaver/
 (on master)       + Supabase auth           downloads,         gallery.json + videos/*.bin
                   + Stripe status           obfuscates              │
                                                                     ▼
                                                     ScreensaverArtExtension.appex (player)
```

Everyone can browse the whole gallery. Free users can play 50 pieces; subscribers can play all of them.

## How the art is made

A scheduled agent adds four pieces every night ([`curation/AUTOMATED_CURATION.md`](curation/AUTOMATED_CURATION.md)). For each piece it:

1. Picks a style from art history.
2. Generates a 4K still (Nano Banana Pro) and rejects it if it wouldn't look good framed on a wall.
3. Animates the still (Veo 3.1). Some clips loop seamlessly; others play once.
4. Uploads the still and video to Cloudflare R2 and adds the entry to `gallery.json`.

A second mode animates real public-domain paintings instead ([`curation/REAL_PAINTINGS_CURATION.md`](curation/REAL_PAINTINGS_CURATION.md)).

A human reviews the gallery from time to time, removes weak pieces, and turns the lessons into rules in [`curation/PROMPT_GUIDANCE.md`](curation/PROMPT_GUIDANCE.md), which the agent reads before every run.

## Development

```bash
pnpm install                         # from the repo root

cd electron-app && pnpm dev          # the desktop app (needs Xcode + xcodegen)
cd living-art-screensaver-web && pnpm dev   # the website, on localhost:3000
./scripts/release.sh                 # ship a signed, notarized release
```

Architecture, conventions and gotchas are in [`CLAUDE.md`](CLAUDE.md).
