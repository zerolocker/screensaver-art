# Marketing asset engine

> Part of the growth initiative — live status + backlog in the hub:
> [`../docs/GROWTH-PROGRESS.md`](../docs/GROWTH-PROGRESS.md).

Turn a gallery piece into **ready-to-post social clips + captions**. The nightly
curation agent produces landscape (16:9) art; social feeds are vertical/square.
This reframes a piece into **9:16** (Reels / TikTok / Shorts) and **1:1** (feed /
Pinterest) with a blurred-fill background + subtle wordmark, loops it to a
comfortable length, and writes starter per-platform captions.

Because it reuses art you already generate nightly, the marginal cost of a day's
worth of social content is ~one ffmpeg run. This is the engine behind the
"content flywheel" in [`../docs/growth-and-marketing-strategy.md`](../docs/growth-and-marketing-strategy.md).

## Requirements
- **ffmpeg** on `PATH` (`ffmpeg -version`). On macOS: `brew install ffmpeg`.
- Node ≥ 18 (uses built-ins + global `fetch`; **no npm deps**).

## Usage
```bash
# The nightly batch — the 4 newest gallery.json pieces:
node marketing/make-social-assets.mjs --latest 4

# A specific piece (title substring match, case-insensitive):
node marketing/make-social-assets.mjs --title "Art Nouveau"

# A local/remote file directly, with an explicit style for the captions:
node marketing/make-social-assets.mjs --src ./clip.mp4 --title "Stormy Sea" --style "Romanticism"
```

### Flags
| Flag | Default | Meaning |
|---|---|---|
| `--latest [N]` | 4 | Process the N newest `gallery.json` entries (newest are appended last). |
| `--title <substr>` | — | Process the gallery entry whose title contains `<substr>`. |
| `--src <path\|url>` | — | Use this MP4 directly (skips gallery lookup). Pair with `--title`/`--style`. |
| `--style <text>` | derived | Override the art style used in captions + the style hashtag. |
| `--formats <list>` | `9x16,1x1` | Comma list of `9x16`, `1x1`. |
| `--duration <sec>` | 12 | Loop/trim target length (art clips are short, so we loop to fill). |
| `--no-wordmark` | off | Don't burn the `living-art-screensaver.com` URL pill. |
| `--out <dir>` | `marketing/out` | Output base directory (gitignored). |

## Output
```
marketing/out/<slug>/
  <slug>_9x16.mp4     # 1080×1920, blurred-fill, wordmark, looped
  <slug>_1x1.mp4      # 1080×1080
  captions.md         # per-platform starter captions + hashtags
```
`out/` is gitignored — it's build output, not source.

## How it reframes
The art is never cropped or letterboxed: a blurred, zoomed-in copy of the clip
fills the frame, and the whole piece sits centered on top. A small, gentle
`living-art-screensaver.com` pill (frosted, mirrors the in-app title placard;
`marketing/assets/url-pill.png`) sits bottom-center as a subtle CTA back to the
site — skipped automatically if that asset is missing, or with `--no-wordmark`.
Audio is dropped (the art is silent) — **add a trending audio natively in
the app when you post**; native/ trending audio meaningfully boosts reach, which a
baked-in track can't.

## Hooking it into the nightly pipeline
Run it right after the nightly curation appends the new pieces — e.g. at the end
of the curation run, `node marketing/make-social-assets.mjs --latest 4` — and the
day's clips + captions are waiting in `marketing/out/`. Posting itself stays
manual for now (or wire an aggregator like Postiz / upload-post — see the
build-vs-buy section of the strategy doc). A ~2-min human pass to pick a trending
audio and reply to early comments is worth far more than fully hands-off posting.

## Caption copy
`captions.md` is a **starting point**, not gospel — tweak the hook, keep it human.
The templates live in `make-social-assets.mjs` (`captionsMarkdown`). An easy future
upgrade: generate captions with Gemini (the curation `.env` already has
`GEMINI_API_KEY`) for per-piece variety instead of templates.
