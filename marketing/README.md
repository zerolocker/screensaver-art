# Marketing asset engine

> Part of the growth initiative — live status + backlog in the hub:
> [`../docs/GROWTH-PROGRESS.md`](../docs/GROWTH-PROGRESS.md).

Turn a gallery piece into **ready-to-post social clips + captions — and then post
them**. The nightly curation agent produces landscape (16:9) art; social feeds are
vertical. `make-social-assets.mjs` reframes a piece into **9:16** (Instagram, TikTok,
YouTube) and **2:3** (Pinterest): the art zoomed over a blurred copy of itself, the
piece's title in a pill under it, and a music bed written for that artwork. It writes
the per-platform captions too. **The clip keeps the source's own length and plays
once** — these are authored pieces, and many are deliberately non-looping.
`post-social.mjs` then publishes it to **Instagram, YouTube, TikTok and Pinterest**.

| Script | What it does |
|---|---|
| `make-social-assets.mjs` | renders the clips + `captions.md` + `meta.json` |
| `post-social.mjs` | publishes one rendered piece to all four channels |
| `lib/captions.mjs` | the caption copy, shared by both |
| `lib/title_pill.py` | renders the title pill burned under the art (Pillow) |
| `lib/music.mjs` | generates the per-piece bed (one Lyria call, via the `lyria-music-gen` skill) |

Because it reuses art you already generate nightly, the marginal cost of a day's
worth of social content is ~one ffmpeg run. This is the engine behind the
"content flywheel" in [`../docs/growth-and-marketing-strategy.md`](../docs/growth-and-marketing-strategy.md).

## Requirements
- **ffmpeg** on `PATH` (`ffmpeg -version`). On macOS: `brew install ffmpeg`.
- **python3 with Pillow** for the title pill. The nightly curation already has it (the
  image and video skills import it). Without it the title falls back to ffmpeg's own
  square text box rather than disappearing.
- Node ≥ 18 (uses built-ins + global `fetch`; **no npm deps**).

## Usage
```bash
# Render the night's four pieces (silent — only the one being posted gets scored):
node marketing/make-social-assets.mjs --latest 4

# The piece being posted, scored with music written for it:
node marketing/make-social-assets.mjs --title "Splash Fountain" --music-prompt "$MUSIC_PROMPT"

# A specific piece (title substring match, case-insensitive):
node marketing/make-social-assets.mjs --title "Art Nouveau"

# A local/remote file directly, with an explicit style for the title and captions:
node marketing/make-social-assets.mjs --src ./clip.mp4 --title "Stormy Sea" --style "Romanticism"
```

### Flags
| Flag | Default | Meaning |
|---|---|---|
| `--latest [N]` | 4 | Process the N newest `gallery.json` entries (newest are appended last). |
| `--title <substr>` | — | Process the gallery entry whose title contains `<substr>`. |
| `--src <path\|url>` | — | Use this MP4 directly (skips gallery lookup). Pair with `--title`/`--style`. |
| `--style <text>` | derived | Override the art style shown in the title pill and captions. |
| `--formats <list>` | `9x16,2x3` | Comma list of `9x16`, `2x3`. |
| `--duration <sec>` | source length | Trim to at most N seconds. Only ever trims — nothing is looped to pad a longer target. |
| `--music-prompt <text>` | off | Generate a bed from this prompt (one Lyria call) and score the clip with it. Also records the prompt as `music_prompt` on the piece's `gallery.json` entry. Refused when more than one piece matches. |
| `--audio <file\|url>` | off | Score with an existing audio file instead of generating one. |
| `--gain <dB>` | `-9` | Bed level. Negative = quieter than the source. |
| `--out <dir>` | `marketing/out` | Output base directory (gitignored). |

## Output
```
marketing/out/<slug>/
  <slug>_9x16.mp4     # 1080×1920 — Instagram, TikTok, YouTube
  <slug>_2x3.mp4      # 1080×1620 — Pinterest
  captions.md         # the exact per-platform copy the poster will publish
  meta.json           # the hand-off to post-social.mjs (incl. the music prompt used)
marketing/out/.posted.json   # ledger: what has already been published where
```
`out/` is gitignored — it's build output, not source.

**`meta.json` is the contract between the two scripts.** It records the title, the
style, the rendered formats and — the important one — `webSlug`, the piece's
permanent `/art/<slug>` landing page. The poster never re-derives any of it.

## How it reframes
A blurred, darkened copy of the clip fills the canvas, and the art sits on it **zoomed
to 1.5× the canvas width**, so the clip shows the middle two-thirds of the piece. That
is deliberate: in a feed every tile has the same width, so a letterboxed piece is the
same small strip whatever the canvas shape, and only cropping makes the art itself
bigger (here, half again as large). The nightly agent picks pieces whose subject
survives the crop (`AUTOMATED_CURATION.md` step 8a).

The art stays vertically centred, and **the piece's title sits in a pill right under
it** (*The Street Food Stall · Contemporary Illustration*). The pill mirrors the one the
screensaver itself shows: dark, translucent, fully rounded, system font at medium
weight. `lib/title_pill.py` renders it; a long title shrinks to fit within 85% of the
width rather than wrapping.

**There is no brand or marketing text in the clip** — no URL, no call to action
(founder call, 2026-09-12). A post that reads as an ad gets scrolled past, and words on
screen pull attention off the art. The caption carries the pitch instead.

Which clip goes where: Instagram, TikTok and YouTube get **9:16**, because their players
are 9:16 and give any other shape black bars. Pinterest gets **2:3**, its recommended pin
shape. On 9:16 the title lands near the top of the area Instagram's caption covers; the
art is deliberately not lifted until a real post shows whether that matters.

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
# preflight: key, connected accounts, the Pinterest board. Posts nothing.
bash curation/with-secrets.sh ZERNIO_API_KEY -- \
  node marketing/post-social.mjs --check

# the nightly call (step 8 of curation/AUTOMATED_CURATION.md)
bash curation/with-secrets.sh ZERNIO_API_KEY -- \
  node marketing/post-social.mjs --latest 4
```

One vendor, four channels, all equal priority: **Zernio** posts to Instagram, YouTube,
TikTok and Pinterest (strategy **§11.1**). Each clip goes up once through Zernio's
presigned media upload (the 9:16 serves three channels, the 2:3 the pin), then each
channel gets its own `POST /v1/posts` with `publishNow`. That is one post per channel
rather than one post for all four, because a payload that one platform rejects fails
the whole request, and it must not take the other three down with it. (Until
2026-09-12, Instagram + YouTube went through upload-post.)

### Flags
| Flag | Default | Meaning |
|---|---|---|
| `--check` | — | Preflight only: verify the key, list connected accounts, resolve the board. |
| `--dry-run` | — | Build and validate everything, publish nothing (includes TikTok's own dry-run check). |
| `--latest [N]` | 4 | Consider the N most recently rendered pieces. |
| `--count <K>` | 1 | How many of them to actually post. |
| `--slug <s>` | — | Post one specific rendered piece (its `marketing/out/<slug>` dir). |
| `--channels <list>` | all four | `instagram,youtube,tiktok,pinterest`. |
| `--format <fmt>` | `9x16`; `2x3` for Pinterest | Post this rendered clip to every channel instead. A piece rendered before 2:3 existed pins its 9:16 clip. |
| `--force` | off | Post again even if the ledger says it already went out. |

Env override: `PINTEREST_BOARD` (a board **name** or id; defaults to *Daily Curation*,
falling back to the account default).

### The five things that make it safe to run unattended
1. **Every pin links to that piece's own page** — `/art/<slug>` with
   `utm_source=pinterest`, never the home page. The slug comes from `meta.json`, which
   mirrors the website's own permanent rule; a drift test
   (`living-art-screensaver-web/lib/__tests__/social-slug-drift.test.ts`) fails the
   build if the two ever disagree. **A pin's destination URL cannot be edited after
   publishing** — which is the whole reason none of this is improvised at post time.
   Instagram, TikTok and YouTube posts carry no link at all: their captions can't be
   clicked, so they say *Link in bio* and the profile does the linking.
2. **It refuses to pin a dead link.** The landing page only exists once Vercel has
   rebuilt from the pushed `gallery.json`, so the poster polls it before pinning and
   waits the deploy out rather than pinning a 404. The other three channels don't wait.
3. **One piece a night, not four.** Four posts a day is a cadence nobody wants in a
   feed. The other three stay rendered for later nights.
4. **A ledger (`out/.posted.json`) plus an idempotency key.** Re-runs skip what already
   went out. Each post also carries an `x-request-id`, so a call retried within
   Zernio's ~5-minute window returns the original post instead of creating a second one.
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

**Instagram, TikTok and YouTube lead with one fixed line** (founder call, 2026-09-12):

```
Screensaver app with animated art - Link in bio
```

- **It says this is an app**, not an account that shares daily art, in the few words a
  phone shows before "more".
- **No URL.** Those three platforms don't make caption links clickable; the bio link does.
- **No "Mac", on purpose.** Interest from people on other platforms is a signal worth
  seeing.

Under it, after a blank line, each post names its piece in the same words as the title
pill, so posts stay distinguishable to search. TikTok adds `#screensaver #animatedart`.
On YouTube the fixed line is the title and the piece's name is the description. A
caption repeated every night isn't a duplicate to Zernio, which fingerprints the text
and the media together.

**Pinterest is different:** a pin is itself a link, so it never says "Link in bio". Its
title names the piece (*Screensaver app with animated art: The Street Food Stall*),
because pin titles are what Pinterest search ranks, and its link is the piece's
`/art/<slug>` page.

Everything is a pure function of the piece, so a retried post republishes
byte-identical copy.
