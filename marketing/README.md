# Social clips

Turns a gallery piece into vertical social clips and posts them. The nightly curation runs both scripts for one piece a night (step 8 of [`AUTOMATED_CURATION.md`](../curation/AUTOMATED_CURATION.md)). Growth status: [`docs/GROWTH-PROGRESS.md`](../docs/GROWTH-PROGRESS.md).

| File | What it does |
|---|---|
| `make-social-assets.mjs` | Renders the clips, `captions.md` and `meta.json` |
| `post-social.mjs` | Posts one rendered piece to Instagram, YouTube, TikTok and Pinterest |
| `lib/captions.mjs` | Caption text, shared by both scripts |
| `lib/hashtags.mjs` | Each piece's hashtags and search phrase |
| `lib/title_pill.py` | Draws the title pill under the art (Pillow) |
| `lib/music.mjs` | Generates the piece's music (one Lyria call) |

Needs `ffmpeg`, Node 18+, and python3 with Pillow (without Pillow, the title falls back to a plain ffmpeg text box). No npm packages.

## Rendering

```bash
node marketing/make-social-assets.mjs --latest 4                       # the 4 newest pieces, silent
node marketing/make-social-assets.mjs --title "Splash Fountain" --music-prompt "$MUSIC_PROMPT"
node marketing/make-social-assets.mjs --src ./clip.mp4 --title "Stormy Sea" --style "Romanticism"
```

| Flag | Default | Meaning |
|---|---|---|
| `--latest [N]` | 4 | The N newest `gallery.json` entries |
| `--title <text>` | | The entry whose title contains this (case-insensitive) |
| `--src <path\|url>` | | Use this MP4 directly; pair with `--title`/`--style` |
| `--style <text>` | from the title | The style shown in the pill and captions |
| `--formats <list>` | `9x16,2x3` | Which shapes to render |
| `--duration <sec>` | the clip's length | Trim to at most this long. Never loops to pad. |
| `--music-prompt <text>` | off | Generate music from this prompt and record it as `music_prompt` in `gallery.json`. Refused if more than one piece matches. |
| `--audio <file\|url>` | off | Use an existing audio file instead |
| `--gain <dB>` | `-9` | Music level |
| `--out <dir>` | `marketing/out` | Output folder (gitignored) |

Output, per piece, in `marketing/out/<slug>/`:
- `<slug>_9x16.mp4` (1080×1920) for Instagram, TikTok and YouTube, whose players letterbox anything else.
- `<slug>_2x3.mp4` (1080×1620) for Pinterest.
- `captions.md`: exactly what will be posted.
- `meta.json`: the hand-off to the poster, including `webSlug`, the piece's permanent `/art/<slug>` page. The poster never recomputes it.

`marketing/out/.posted.json` records what has been posted where.

**The frame.** The art is zoomed to 1.5× the frame width over a blurred copy of itself, so the clip shows its middle two-thirds. In a feed, only cropping makes the art bigger. The piece's title sits in a pill right under the art, styled like the screensaver's own. There's no brand text, URL or call to action in the clip: a post that looks like an ad gets scrolled past. The clip plays once, at the source's length.

**The music** is written for the piece by the nightly agent ([`PROMPT_GUIDANCE.md`](../curation/PROMPT_GUIDANCE.md), *Music prompts*). Music that contradicts the picture is worse than silence, so there's no shared library. It's mixed at −9 dB with fades. The MP3 is temporary; only the prompt is kept, in `gallery.json`. Every prompt must say "Instrumental, no vocals" (Lyria sings by default, and the script refuses a prompt without it) and "Even dynamics, no build or drop".

## Posting

```bash
bash curation/with-secrets.sh ZERNIO_API_KEY -- node marketing/post-social.mjs --check      # preflight, posts nothing
bash curation/with-secrets.sh ZERNIO_API_KEY -- node marketing/post-social.mjs --slug <slug>
```

| Flag | Default | Meaning |
|---|---|---|
| `--check` | | Check the key, list connected accounts, find the board |
| `--dry-run` | | Build and validate everything, publish nothing |
| `--latest [N]` | 4 | Consider the N most recent renders |
| `--count <K>` | 1 | How many of them to post |
| `--slug <s>` | | Post this rendered piece |
| `--channels <list>` | all four | `instagram,youtube,tiktok,pinterest` |
| `--format <fmt>` | `9x16`; `2x3` for Pinterest | Post this shape everywhere |
| `--force` | off | Post again even if the ledger says it went out |

`PINTEREST_BOARD` sets the board name or id (default "Daily Curation").

Everything goes through Zernio. Each clip is uploaded once through Zernio's presigned upload (its direct upload rejects files over about 4.5 MB). Then each channel gets its own post, so one platform rejecting a post can't sink the other three.

What makes it safe to run unattended:
- **Pins link to the piece's own page** with `utm_source=pinterest`. A pin's link can't be edited later, so the slug comes from `meta.json`, and `living-art-screensaver-web/lib/__tests__/social-slug-drift.test.ts` fails if the poster's slug rule and the website's ever differ.
- **No pinning dead links.** The page exists only after Vercel rebuilds from the new `gallery.json`, so the poster waits until it's live. The other channels have no link and don't wait.
- **No double posts.** The ledger skips what already went out, and each request has an idempotency key, so a retry returns the original post.
- **Pending isn't failed.** Zernio reports `pending` while it retries a platform. The poster waits for a final state and treats an unsettled post as sent, because marking it failed would repost it the next night.

## Captions

All copy lives in `lib/captions.mjs` and depends only on the piece, so a retry posts identical text.

Instagram and YouTube lead with one fixed line; TikTok's differs at the end:

```
Animated art screensaver app - Link in bio               (Instagram, YouTube)
Animated art screensaver app - Link in comment and bio   (TikTok)
```

It says this is an app, in the few words a phone shows. It has no URL, because these captions aren't clickable. It leaves out "Mac" on purpose, so interest from other platforms shows up. Under it come the piece's name and its hashtags. On YouTube the fixed line is the title.

**Pinterest** works differently: a pin is itself a link, and Pinterest search ranks the pin's words. Pin titles lead with the style ("Animated Ukiyo-e: Mount Fuji | Art screensaver app"), the description names the art in plain words, and pins have no hashtags.

**Hashtags** (`lib/hashtags.mjs`): Instagram and TikTok get `#screensaver #animatedart` plus up to two for the piece, one for its movement or country and one for its era. YouTube gets three, the piece's own first.
- A tag must be true of every piece it lands on. `Chinese & Korean` has no era tag, because `#chineseart` is wrong on a Korean painting.
- A tag must have an audience. Style tags were checked against TikTok's view counts; tags under about 5M views were dropped, and the art-specific form wins where the bare word means something else (`#renaissanceart`, `#cyberpunkart`).
- Few on purpose: Instagram allows five, and favours targeted ones. No `#art`.

**Real paintings** (`source: "real_artwork"`) keep the fixed first line, then name the painting, painter and museum:

```
Animated art screensaver app - Link in bio

Caillebotte's Paris Street; Rainy Day, brought to life
Gustave Caillebotte, 1877 · Art Institute of Chicago · Public domain
#screensaver #animatedart #caillebotte #impressionism
```

Their hashtags come from the artist, in order: the artist, their movement (or the era), `#arthistory`, and `#famouspaintings` for the famous names listed in `lib/hashtags.mjs`. Artist tags weren't checked against TikTok's counts. YouTube and pin titles name the painting and artist.

**TikTok's pinned comment.** The TikTok account can't have a bio link (no Business option, and personal accounts need 1,000 followers). So after each video goes live, the poster comments "Get the screensaver app: living-art-screensaver.com" and pins it.
- It's plain text; TikTok comment links aren't clickable.
- It needs Zernio's TikTok Business app connection. An older connection gets `400 PLATFORM_LIMITATION`; reconnect the account in Zernio.
- Pinning right after commenting fails, so the poster retries every 15 s.
- A failure only warns (`⚠ tiktok link comment`, saved as `linkComment` in the ledger). It never fails the run, since the video is already public.
