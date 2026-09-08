# Marketing asset engine

> Part of the growth initiative — live status + backlog in the hub:
> [`../docs/GROWTH-PROGRESS.md`](../docs/GROWTH-PROGRESS.md).

Turn a gallery piece into **ready-to-post social clips + captions — and then post
them**. The nightly curation agent produces landscape (16:9) art; social feeds are
vertical/square. `make-social-assets.mjs` reframes a piece into **9:16** (Reels /
TikTok / Shorts) and **1:1** (feed / Pinterest) with a blurred-fill background, a
subtle wordmark and a music bed written for that artwork, and writes per-platform
captions. **The clip keeps the source's own length and plays once** — these are
authored pieces, and many are deliberately non-looping. `post-social.mjs` then publishes it to **Instagram,
YouTube, TikTok and Pinterest**.

| Script | What it does |
|---|---|
| `make-social-assets.mjs` | renders the clips + `captions.md` + `meta.json` |
| `post-social.mjs` | publishes one rendered piece to all four channels |
| `lib/music.mjs` | generates the per-piece bed (one Lyria call, via the `lyria-music-gen` skill) |

Because it reuses art you already generate nightly, the marginal cost of a day's
worth of social content is ~one ffmpeg run. This is the engine behind the
"content flywheel" in [`../docs/growth-and-marketing-strategy.md`](../docs/growth-and-marketing-strategy.md).

## Requirements
- **ffmpeg** on `PATH` (`ffmpeg -version`). On macOS: `brew install ffmpeg`.
- Node ≥ 18 (uses built-ins + global `fetch`; **no npm deps**).

## Usage
```bash
# Render the night's four pieces (silent — only the one being posted gets scored):
node marketing/make-social-assets.mjs --latest 4

# The piece being posted, scored with music written for it:
node marketing/make-social-assets.mjs --title "Splash Fountain" --music-prompt "$MUSIC_PROMPT"

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
| `--duration <sec>` | source length | Trim to at most N seconds. Only ever trims — nothing is looped to pad a longer target. |
| `--music-prompt <text>` | off | Generate a bed from this prompt (one Lyria call) and score the clip with it. Also records the prompt as `music_prompt` on the piece's `gallery.json` entry. Refused when more than one piece matches. |
| `--audio <file\|url>` | off | Score with an existing audio file instead of generating one. |
| `--gain <dB>` | `-9` | Bed level. Negative = quieter than the source. |
| `--no-wordmark` | off | Don't burn the `living-art-screensaver.com` URL pill. |
| `--out <dir>` | `marketing/out` | Output base directory (gitignored). |

## Output
```
marketing/out/<slug>/
  <slug>_9x16.mp4     # 1080×1920, blurred-fill, wordmark, scored, source length
  <slug>_1x1.mp4      # 1080×1080
  captions.md         # the exact per-platform copy the poster will publish
  meta.json           # the hand-off to post-social.mjs (incl. the music prompt used)
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
## Audio — the per-piece music bed
`--music-prompt` makes one Lyria call, then cuts the ~30s result to the clip's own
length at **−9 dB**, with fades in and out that scale with the clip (up to 1 s / 1.5 s
— a hard cut on a sustained pad is very audible). The art leads; the music sits
under it.

**The music is written for the specific artwork, not pulled from a library.** An
earlier version reused five generic ambient beds, on the theory that nobody notices
the bed varying nightly. True — but it misses what *is* noticed: a bright, noisy
plaza full of children playing in a fountain scored with a slow, tender solo piano
reads as a mistake, because the music contradicts the picture. Matching music is
worth one API call a night; mismatched music is worth less than silence.

**The prompt is the durable artifact, not the MP3.** The audio is generated into a
temp dir, muxed into the clips, and deleted — nothing is committed, nothing is
uploaded (`CLAUDE.md` → Repo rules). What persists is `music_prompt` on that piece's
`gallery.json` entry, a curation-only field alongside `image_prompt` and
`video_prompt` (the shared `ArtItem` type deliberately omits all three — no client
reads them). Because only one piece a night is posted, **only one piece a night
carries the field**, and the script refuses `--music-prompt` when more than one piece
matches so that can't drift.

**Who writes the prompt: the nightly curation agent.** It has just written the image
and video prompts and looked at the still, so nothing downstream knows the piece as
well. The rules, a worked example and the anti-patterns live in
[`curation/PROMPT_GUIDANCE.md`](../curation/PROMPT_GUIDANCE.md) → *Music prompts*;
the runbook is step 8 of [`curation/AUTOMATED_CURATION.md`](../curation/AUTOMATED_CURATION.md).

Two clauses belong in every prompt:
- ⚠️ **"Instrumental, no vocals."** Lyria sings by default — a perfectly innocent
  prompt comes back fully sung, with its own lyric sheet. `make-social-assets.mjs`
  rejects a prompt without this *before* spending the call, and the skill fails
  after one if it hears lyrics.
- **"Even dynamics, no build or drop."** A crescendo pulls attention off the art,
  which is the one thing the clip exists to show.

Self-generated audio is also the only workable answer here: the platforms' trending
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
