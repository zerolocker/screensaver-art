# Marketing asset engine

> Part of the growth initiative — live status + backlog in the hub:
> [`../docs/GROWTH-PROGRESS.md`](../docs/GROWTH-PROGRESS.md).

Turn a gallery piece into **ready-to-post social clips + captions — and then post
them**. The nightly curation agent produces landscape (16:9) art; social feeds are
vertical/square. `make-social-assets.mjs` reframes a piece into **9:16** (Reels /
TikTok / Shorts) and **1:1** (feed / Pinterest) with a blurred-fill background, a
subtle wordmark and a music bed, loops it to a comfortable length, and writes
per-platform captions. `post-social.mjs` then publishes it to **Instagram,
YouTube, TikTok and Pinterest**.

| Script | What it does |
|---|---|
| `make-social-assets.mjs` | renders the clips + `captions.md` + `meta.json` |
| `post-social.mjs` | publishes one rendered piece to all four channels |
| `make-beds.mjs` | one-off: generates the music-bed library and puts it on R2 |

Because it reuses art you already generate nightly, the marginal cost of a day's
worth of social content is ~one ffmpeg run. This is the engine behind the
"content flywheel" in [`../docs/growth-and-marketing-strategy.md`](../docs/growth-and-marketing-strategy.md).

## Requirements
- **ffmpeg** on `PATH` (`ffmpeg -version`). On macOS: `brew install ffmpeg`.
- Node ≥ 18 (uses built-ins + global `fetch`; **no npm deps**).

## Usage
```bash
# The nightly batch — the 4 newest gallery.json pieces, scored with a music bed:
node marketing/make-social-assets.mjs --latest 4 --audio

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
| `--audio [bed]` | off | Score the clip with a music bed. Bare `--audio` picks one from `beds.json` (deterministically per piece); pass a bed id, a path or a URL to pin one. |
| `--gain <dB>` | `-9` | Bed level. Negative = quieter than the source. |
| `--no-wordmark` | off | Don't burn the `living-art-screensaver.com` URL pill. |
| `--out <dir>` | `marketing/out` | Output base directory (gitignored). |

## Output
```
marketing/out/<slug>/
  <slug>_9x16.mp4     # 1080×1920, blurred-fill, wordmark, looped, scored
  <slug>_1x1.mp4      # 1080×1080
  captions.md         # the exact per-platform copy the poster will publish
  meta.json           # the hand-off to post-social.mjs
marketing/out/.posted.json   # ledger: what has already been published where
```
`out/` is gitignored — it's build output, not source.

**`meta.json` is the contract between the two scripts.** It records the title, the
style, the rendered formats and — the important one — `webSlug`, the piece's
permanent `/art/<slug>` landing page. The poster never re-derives any of it.

## How it reframes
The art is never cropped or letterboxed: a blurred, zoomed-in copy of the clip
fills the frame, and the whole piece sits centered on top. A small, gentle
`living-art-screensaver.com` pill (frosted, mirrors the in-app title placard;
`marketing/assets/url-pill.png`) sits bottom-center as a subtle CTA back to the
site — skipped automatically if that asset is missing, or with `--no-wordmark`.
## Audio — the music bed
`--audio` loops a bed under the clip at **−9 dB**, with a 1 s fade in and a 1.5 s fade
out (a hard cut on a sustained pad is very audible). The art leads; the music sits
under it.

The beds are generated once by the **`lyria-music-gen`** skill and reused. Nobody
watching a nightly feed notices that tonight's bed also played last Tuesday, so a
fresh track per clip would be a standing API bill for an imperceptible difference —
`make-social-assets.mjs` instead picks one of five deterministically per piece.

```bash
node marketing/make-beds.mjs                              # build the library (one-off)
node marketing/make-beds.mjs --only still-water --force   # replace one bed
```

- **`marketing/beds.json` is committed; the MP3s are not** (`CLAUDE.md` → Repo rules).
  The manifest holds each bed's id, its generation prompt and its public R2 URL; the
  audio is cached into the gitignored `marketing/beds/` on first use, including on a
  fresh clone.
- ⚠️ **Lyria sings by default** — every prompt in `beds.json` says *"instrumental, no
  vocals"*, and `make-beds.mjs` refuses to generate one that doesn't. (The skill checks
  the *result* too and exits non-zero if it hears lyrics, so a bad bed can't be
  published by accident.)
- Self-generated audio is the only workable answer here: the platforms' trending
  libraries are licence-restricted for commercial accounts *and* a posting API can't
  attach a native sound anyway (strategy **§11**/**§11.2**). A baked-in track needs no
  cooperation from anyone.

## Posting (`post-social.mjs`)

```bash
# preflight: keys, connected accounts, the Pinterest board. Posts nothing.
bash curation/with-secrets.sh UPLOADPOST_API_KEY ZERNIO_API_KEY -- \
  node marketing/post-social.mjs --check

# the nightly call (step 8 of curation/AUTOMATED_CURATION.md)
bash curation/with-secrets.sh UPLOADPOST_API_KEY ZERNIO_API_KEY -- \
  node marketing/post-social.mjs --latest 4
```

Two vendors, four channels — the split is strategy **§11.1**, and all four are equal
priority:

| Channel | Vendor | How the clip gets there |
|---|---|---|
| Instagram, YouTube | **upload-post** | one multipart `POST /api/upload`, both platforms in the same call |
| TikTok, Pinterest | **Zernio** | presigned media upload, then one `POST /v1/posts` with `publishNow` |

### Flags
| Flag | Default | Meaning |
|---|---|---|
| `--check` | — | Preflight only: verify both keys, list connected accounts, resolve the board. |
| `--dry-run` | — | Build and validate everything, publish nothing (includes TikTok's own dry-run check). |
| `--latest [N]` | 4 | Consider the N most recently rendered pieces. |
| `--count <K>` | 1 | How many of them to actually post. |
| `--slug <s>` | — | Post one specific rendered piece (its `marketing/out/<slug>` dir). |
| `--channels <list>` | all four | `instagram,youtube,tiktok,pinterest`. |
| `--format <fmt>` | `9x16` | Which rendered clip to post. |
| `--force` | off | Post again even if the ledger says it already went out. |

Env overrides: `UPLOADPOST_USER` (profile name — auto-detected when there is one
profile) and `PINTEREST_BOARD` (a board **name** or id; defaults to *Daily Curation*,
falling back to the account default).

### The five things that make it safe to run unattended
1. **Every post links to that piece's own page** — `/art/<slug>` with a per-channel
   `utm_source`, never the home page. The slug comes from `meta.json`, which mirrors
   the website's own permanent rule; a drift test
   (`living-art-screensaver-web/lib/__tests__/social-slug-drift.test.ts`) fails the
   build if the two ever disagree. **A post's destination URL cannot be edited after
   publishing** — which is the whole reason none of this is improvised at post time.
2. **It refuses to publish a dead link.** The landing page only exists once Vercel has
   rebuilt from the pushed `gallery.json`, so the poster polls it first and waits the
   deploy out rather than pinning a 404.
3. **One piece a night, not four.** Four posts a day is a cadence nobody wants in a
   feed, and it would burn upload-post's free monthly uploads in under a week. The
   other three stay rendered for later nights.
4. **A ledger (`out/.posted.json`) plus an idempotency key.** Re-runs skip what already
   went out; Zernio also gets an `x-request-id`, so a retried call resumes the original
   post instead of creating a second one.
5. **In-flight ≠ failed.** Zernio reports `pending`/`processing` while it is still
   working, and retries a platform that transiently errors — a real pin did exactly
   that and published a minute later. The poster waits for a terminal state and treats
   an unsettled one as *sent*, because calling it a failure would make the next night
   publish a duplicate.

Don't reach for a platform trending sound: it's licence-restricted for commercial
accounts *and* a posting API can't attach one (§11), which is why we score the clips
ourselves. Spend the ~2 min/day replying to early comments instead.

## Caption copy
The copy lives in `lib/captions.mjs` and is shared: `captions.md` shows exactly what
`post-social.mjs` will publish, so what you read is what went out.

Each line — hook, body, CTA — is drawn from a small pool keyed by a hash of the piece
and the platform. **Deterministic, but varied:** a re-run produces byte-identical copy
(so a failed post can be retried), while no two nights read alike. That matters
because one fixed template published 365 times a year on the same account reads as
spam to people and platforms alike. Generating per-piece captions with Gemini (the
curation `.env` already has `GEMINI_API_KEY`) is the "agentic layer" of strategy
§11 (C) — these pools are the cheap 90% of it.
