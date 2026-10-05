# Marketing asset engine

> Part of the growth initiative — live status + backlog in the hub:
> [`../docs/GROWTH-PROGRESS.md`](../docs/GROWTH-PROGRESS.md).

Turn gallery pieces into **a ready-to-post social clip + captions — and then post
it**. **Each night posts all of its pieces as one 9:16 clip** (see *The nightly set*):
each piece in turn, dissolving into the next, under one music bed written for the set.
`post-social.mjs` publishes it to **Instagram, YouTube, TikTok and Pinterest**.

Every piece is framed for a phone. A landscape (16:9) piece is reframed: the art
zoomed over a blurred copy of itself, its title in a pill under it. **A portrait piece
goes out as it is** (see *Portrait pieces*). **Each piece keeps its own length and
plays once** — these are authored pieces, and many are deliberately non-looping. A
single piece can still be rendered on its own, in **9:16** and **2:3** (Pinterest).

| Script | What it does |
|---|---|
| `make-social-assets.mjs` | renders the clip(s) + `captions.md` + `meta.json` |
| `post-social.mjs` | publishes one rendered post to all four channels |
| `lib/captions.mjs` | the caption copy, shared by both |
| `lib/hashtags.mjs` | each piece's hashtags + search phrase, from its style and era |
| `lib/title_pill.py` | renders the title pill burned under the art (Pillow) |
| `lib/music.mjs` | generates the bed (one Lyria call, via the `lyria-music-gen` skill) and fits it to the clip |

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
# The night's post: its pieces as one clip, most recognizable first, scored for the set:
node marketing/make-social-assets.mjs --titles "Mount Fuji" "The Mail Coach" "The Charreada" "Splash Fountain" \
  --music-prompt "$MUSIC_PROMPT"

# The four newest pieces as one clip, in gallery order, silent:
node marketing/make-social-assets.mjs --latest 4

# One piece on its own (9:16 + 2:3):
node marketing/make-social-assets.mjs --title "Splash Fountain"

# Local/remote files as one clip; a --title/--style after a --src names that file:
node marketing/make-social-assets.mjs \
  --src ./a.mp4 --title "Stormy Sea" --style "Romanticism" \
  --src ./b.mp4 --title "Mount Fuji" --style "Ukiyo-e" --audio ./bed.mp3
```

### Flags
| Flag | Default | Meaning |
|---|---|---|
| `--titles <t>…` | — | These gallery pieces as one clip, in this order. Each is an exact title or a substring only one title contains (case-insensitive); an ambiguous one is an error that lists the matches. |
| `--title <t>` | — | One gallery piece, matched the same way. After a `--src`, that file's title instead. |
| `--latest [N]` | 4 | The N newest `gallery.json` entries, oldest first. |
| `--src <path\|url>` | — | Use this MP4 instead of a gallery piece. Repeat it for a set. |
| `--style <text>` | derived | Override the art style shown in the title pill and captions. After a `--src`, that file's style. |
| `--formats <list>` | `9x16,2x3` | One piece only: comma list of `9x16`, `2x3`. A portrait piece always renders just `9x16`; a set is 9:16 only. |
| `--duration <sec>` | source length | Trim each piece to at most N seconds. Only ever trims — nothing is looped to pad a longer target. |
| `--music-prompt <text>` | off | Generate one bed from this prompt (one Lyria call) and score the clip with it. Also records the prompt as `music_prompt` on every piece's `gallery.json` entry. |
| `--audio <file\|url>` | off | Score with an existing audio file instead of generating one. |
| `--gain <dB>` | `-9` | Bed level. Negative = quieter than the source. |
| `--out <dir>` | `marketing/out` | Output base directory (gitignored). |

## Output
```
marketing/out/<slug>/
  <slug>_9x16.mp4     # 1080×1920 — every channel for a set; Instagram, TikTok, YouTube for one piece
  <slug>_2x3.mp4      # 1080×1620 — Pinterest (a single landscape piece only)
  captions.md         # the exact per-platform copy the poster will publish
  meta.json           # the hand-off to post-social.mjs (incl. the music prompt used)
marketing/out/.posted.json   # ledger: what has already been published where
```
A set's slug is its name, e.g. `mount-fuji-and-3-more`. `out/` is gitignored — it's
build output, not source.

**`meta.json` is the contract between the two scripts.** It records the title, the
style, the rendered formats and — the important one — `webSlug`, the permanent
`/art/<slug>` landing page the pin links to. A set's `meta.json` also lists its
`pieces` in order, each with its own title, style, era and slug. The poster never
re-derives any of it.

## The nightly set
**A night's pieces go out as one clip, not one piece a night.** Each piece's 9:16
segment is framed exactly as it would be alone (landscape reframed, portrait as-is),
then the segments play in the order given, each dissolving into the next over 1 s.
Lead with the most recognizable piece: it is what the first seconds of a feed show.

- **One frame rate.** Every segment plays at the pieces' own rate when they share one
  (24 fps for the Veo and Omni clips tested), so no frame is repeated, else at 30 fps.
- **One bed** for the whole clip, from one `--music-prompt` written for the set.
- **One clip for every channel, Pinterest included.** A 2:3 can't hold a set that
  mixes portrait and landscape segments, and Pinterest takes 9:16 video.
- **The pin links to the first piece's page.** A pin has one link and can't be edited
  later, and the first piece is the one the pin's title names.
- **The captions list every piece** (see *Caption copy*).

## How it reframes a landscape piece
A blurred, darkened copy of the clip fills the canvas, and the art sits on it **zoomed
to 1.5× the canvas width**, so the clip shows the middle two-thirds of the piece. That
is deliberate: in a feed every tile has the same width, so a letterboxed piece is the
same small strip whatever the canvas shape, and only cropping makes the art itself
bigger (here, half again as large). The nightly agent opens its set with a piece whose
subject survives the crop (`AUTOMATED_CURATION.md` step 8a).

The art stays vertically centred, and **the piece's title sits in a pill right under
it** (*The Street Food Stall · Contemporary Illustration*). The pill mirrors the one the
screensaver itself shows: dark, translucent, fully rounded, system font at medium
weight. `lib/title_pill.py` renders it; a long title shrinks to fit within 85% of the
width rather than wrapping.

**There is no brand or marketing text in the clip** — no URL, no call to action
(founder call, 2026-09-12). A post that reads as an ad gets scrolled past, and words on
screen pull attention off the art. The caption carries the pitch instead.

Which clip goes where: Instagram, TikTok and YouTube get **9:16**, because their players
are 9:16 and give any other shape black bars. A single landscape piece also renders a
**2:3** for Pinterest, its recommended pin shape; a set or a portrait piece pins its 9:16.
On 9:16 the title lands near the top of the area Instagram's caption covers; the art is
deliberately not lifted until a real post shows whether that matters.

## Portrait pieces
**A portrait piece goes out as it is.** A tall painting animated at 9:16 already fills a
phone, so there is nothing to reframe: no zoom, no blurred background, no title pill. Its
frames are only scaled to the 1080×1920 canvas, at their own frame rate. The music bed
and `--duration` work as for any piece.

**Portrait means taller than wide**, read from the video itself with ffprobe (after any
rotation flag). `gallery.json` has no aspect field.

**Pinterest gets the same 9:16 clip.** It accepts 9:16 video, and a 2:3 crop would cut
the painting the as-is clip keeps whole. So a portrait piece renders one file, its
`meta.json` lists only `9x16`, and the poster's rule does the rest: Pinterest gets the
2:3 when a post has one, otherwise the 9:16. One upload serves all four channels.

## Audio — the music bed
`--music-prompt` makes one Lyria call, then fits the result to the clip at **−9 dB**,
with fades in and out that scale with the clip (up to 1 s / 1.5 s — a hard cut on a
sustained pad is very audible). The art leads; the music sits under it.

**A set runs longer than one bed.** Lyria's `clip` model returns ~30 s and four 10 s
pieces make ~37 s, so a bed shorter than the clip is looped: copies of it are chained
with a 3 s equal-power crossfade where it runs back into its own start, then cut to
length. (The skill's `pro` model returns ~3 min, but as an arranged piece with
sections, which fights the even dynamics a bed needs.)

**The music is written for the art, not pulled from a library.** An
earlier version reused five generic ambient beds, on the theory that nobody notices
the bed varying nightly. True — but it misses what *is* noticed: a bright, noisy
plaza full of children playing in a fountain scored with a slow, tender solo piano
reads as a mistake, because the music contradicts the picture. Matching music is
worth one API call a night; mismatched music is worth less than silence.

**The prompt is the durable artifact, not the MP3.** The audio is generated into a
temp dir, muxed into the clips, and deleted — nothing is committed, nothing is
uploaded (`CLAUDE.md` → Repo rules). What persists is `music_prompt` on the
`gallery.json` entry of **every piece in the post**, a curation-only field alongside
`image_prompt` and `video_prompt` (the shared `ArtItem` type deliberately omits all
three — no client reads them). The pieces of a set share one bed, so they share the
prompt: the field always says what played under that piece.

**Who writes the prompt: the nightly curation agent.** It has just written the image
and video prompts and looked at the stills, so nothing downstream knows the pieces as
well. For a set, it writes one prompt that sits under all of them. The rules, a worked
example and the anti-patterns live in
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

# the nightly call (step 8 of curation/AUTOMATED_CURATION.md): the night's set
bash curation/with-secrets.sh ZERNIO_API_KEY -- \
  node marketing/post-social.mjs --slug <set-slug-from-the-render>
```

One vendor, four channels, all equal priority: **Zernio** posts to Instagram, YouTube,
TikTok and Pinterest (strategy **§11.1**). Each clip goes up once through Zernio's
presigned media upload (a set's 9:16 serves all four channels; a single landscape
piece's 9:16 serves three and its 2:3 the pin), then each channel gets its own
`POST /v1/posts` with `publishNow`. That is one post per channel rather than one post
for all four, because a payload that one platform rejects fails the whole request, and
it must not take the other three down with it. (Until 2026-09-12, Instagram + YouTube
went through upload-post.)

### Flags
| Flag | Default | Meaning |
|---|---|---|
| `--check` | — | Preflight only: verify the key, list connected accounts, resolve the board. |
| `--dry-run` | — | Build and validate everything, publish nothing (includes TikTok's own dry-run check). |
| `--latest [N]` | 4 | Consider the N most recently rendered posts (a set counts as one). |
| `--count <K>` | 1 | How many of them to actually post. |
| `--slug <s>` | — | Post one specific rendered post (its `marketing/out/<slug>` dir). |
| `--channels <list>` | all four | `instagram,youtube,tiktok,pinterest`. |
| `--format <fmt>` | `9x16`; `2x3` for Pinterest | Post this rendered clip to every channel instead. A post with no 2:3 (a set, or a portrait piece) pins its 9:16 clip. |
| `--force` | off | Post again even if the ledger says it already went out. |

Env override: `PINTEREST_BOARD` (a board **name** or id; defaults to *Daily Curation*,
falling back to the account default).

### The five things that make it safe to run unattended
1. **Every pin links to a piece's own page** — `/art/<slug>` with
   `utm_source=pinterest`, never the home page; for a set, its first piece's. The slug
   comes from `meta.json`, which
   mirrors the website's own permanent rule; a drift test
   (`living-art-screensaver-web/lib/__tests__/social-slug-drift.test.ts`) fails the
   build if the two ever disagree. **A pin's destination URL cannot be edited after
   publishing** — which is the whole reason none of this is improvised at post time.
   Instagram, TikTok and YouTube posts carry no link at all: their captions can't be
   clicked, so Instagram and YouTube say *Link in bio* and the profile does the
   linking. TikTok's profile can't carry a link, so it says *Link in comment and bio*
   and gets the address as a pinned comment (see *Caption copy*).
2. **It refuses to pin a dead link.** The landing page only exists once Vercel has
   rebuilt from the pushed `gallery.json`, so the poster polls it before pinning and
   waits the deploy out rather than pinning a 404. The other three channels don't wait.
3. **One post a night, not four.** Four posts a day is a cadence nobody wants in a
   feed, so the night's pieces go out together as one set.
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

**Instagram and YouTube lead with one fixed line** (founder call, 2026-09-12), and TikTok
with the same pitch pointed at its pinned comment (founder call, 2026-09-14):

```
Animated art screensaver app - Link in bio               (Instagram, YouTube)
Animated art screensaver app - Link in comment and bio   (TikTok)
```

- **It says this is an app**, not an account that shares daily art, in the few words a
  phone shows before "more".
- **No URL.** Those three platforms don't make caption links clickable; the bio link
  does, or on TikTok the pinned comment.
- **No "Mac", on purpose.** Interest from people on other platforms is a signal worth
  seeing.

Under it, after a blank line, each post names its pieces, one line each in the order
they play, in the same words as the title pill, so posts stay distinguishable to search,
followed by its hashtags (below). On YouTube the fixed line is the title and the pieces
are the description; a set's title adds its name (*… - Link in bio · Mount Fuji and 3
more*). A caption repeated every night isn't a duplicate to Zernio, which fingerprints
the text and the media together.

**A set stays within each platform's limits** (Instagram and TikTok 2,200 characters,
YouTube title 100 and tags 500, pin title 100 and description 500). A real set is far
under them; a very long one names its first pieces and counts the rest (*+3 more*).

**Pinterest is different:** a pin is itself a link, so it never says "Link in bio", and
its link is a piece's `/art/<slug>` page (a set's first piece). Pinterest search ranks
the words in a pin, and people search a style (*ukiyo-e*), not a piece's name. So since
2026-09-14 the title leads with the style (*Animated Ukiyo-e: Mount Fuji | Art screensaver
app*; for a set, the first piece's: *Animated Ukiyo-e: Mount Fuji and 3 more | …*), the
description names each piece and then the art in plain words (*Japanese art, gently
animated for your screensaver…*), and pins carry no hashtags.

**Hashtags come from the piece** (`lib/hashtags.mjs`, since 2026-09-14). Instagram and
TikTok posts carry `#screensaver #animatedart`, then up to two of the piece's own: one for
its movement or country, one for its era. *Mount Fuji · Ukiyo-e* gets
`#screensaver #animatedart #ukiyoe #japaneseart`. A YouTube description gets three, the
piece's own first, because YouTube shows up to three beside the title. A set merges its
pieces' tags within the same caps, every piece's most specific tag before any piece's
second, so the line shows the range of the set.

- **True of the piece.** An era gets a hashtag only if it fits every style filed under it.
  *Chinese & Korean* has none (`#chineseart` is wrong on a Joseon painting), so those
  pieces take theirs from the style.
- **Has an audience.** Most styles are used once, so only well-known movements, schools
  and countries map to a tag. Each tag was checked against TikTok's own counts: tags under
  ~5M views were dropped, and where the bare word is used for much else the art-specific
  form wins (`#renaissanceart` over `#renaissance`, `#cyberpunkart` over `#cyberpunk`).
- **Few, on purpose.** Instagram caps a post at five hashtags and says a few targeted ones
  beat generic ones, so there is no `#art`.
- **The era comes from `meta.json`** (`era`, written at render time), or from
  `gallery.json` for clips rendered before that field existed.

**TikTok also gets a pinned comment**, *Get the screensaver app:
living-art-screensaver.com*, posted under each video once it is live (since 2026-09-14).
The TikTok account can't have a bio link: it has no Business switch, and a personal
account only gets one at 1,000 followers. So its caption says *Link in comment and
bio*: the pinned comment carries the address, and the bio carries it as plain text
(set by hand, once).

- **Plain text, not a link.** TikTok doesn't make URLs in comments clickable. The
  comment was checked by hand to be visible to signed-out viewers.
- **Needs Zernio's TikTok Business app connection** (every connection since
  2026-09-10). An account still on the old developer app gets
  `400 PLATFORM_LIMITATION`; reconnecting it in Zernio moves it over.
- **The pin is retried.** A pin sent the instant the comment lands fails, because
  TikTok hasn't registered the comment yet, so the poster waits 15s between tries.
- **A failure is a warning, never a failed run.** The video is already public, and
  a post recorded as failed would be published again the next night. The error is
  printed (`⚠ tiktok link comment`) and kept on the ledger entry as `linkComment`.

Everything is a pure function of the piece, so a retried post republishes
byte-identical copy.
