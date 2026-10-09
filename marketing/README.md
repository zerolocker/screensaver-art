# Social clips

Turns gallery pieces into one vertical social clip and posts it. Each night, the curation stitches all of that night's pieces into one 9:16 clip under one piece of music, and posts it to Instagram, YouTube, TikTok and Pinterest (step 8 of [`AUTOMATED_CURATION.md`](../curation/AUTOMATED_CURATION.md)). Growth status: [`docs/GROWTH-PROGRESS.md`](../docs/GROWTH-PROGRESS.md).

| File | What it does |
|---|---|
| `make-social-assets.mjs` | Renders the clip(s), `captions.md` and `meta.json` |
| `post-social.mjs` | Posts one rendered post to Instagram, YouTube, TikTok and Pinterest |
| `lib/captions.mjs` | Caption text, shared by both scripts |
| `lib/hashtags.mjs` | Each piece's hashtags and search phrase |
| `lib/title_pill.py` | Draws the title pill under the art (Pillow) |
| `lib/music.mjs` | Generates the music (one Lyria call) and loops it to the clip's length |

Needs `ffmpeg`, Node 18+, and python3 with Pillow (without Pillow, the title falls back to a plain ffmpeg text box). No npm packages.

## Rendering

```bash
# The night's post: its pieces as one clip, most recognizable first, with music for the set
node marketing/make-social-assets.mjs --titles "Mount Fuji" "The Mail Coach" "The Charreada" "Splash Fountain" \
  --music-prompt "$MUSIC_PROMPT"
node marketing/make-social-assets.mjs --latest 4                  # the 4 newest pieces as one clip, silent
node marketing/make-social-assets.mjs --title "Splash Fountain"   # one piece on its own (9:16 + 2:3)
node marketing/make-social-assets.mjs \
  --src ./a.mp4 --title "Stormy Sea" --style "Romanticism" \
  --src ./b.mp4 --title "Mount Fuji" --style "Ukiyo-e" --audio ./music.mp3   # local files as one clip
```

| Flag | Default | Meaning |
|---|---|---|
| `--titles <t>…` | | These gallery pieces as one clip, in this order. Each is an exact title or a substring only one title contains (case-insensitive). An ambiguous one is an error that lists the matches. |
| `--title <t>` | | One gallery piece, matched the same way. After a `--src`, that file's title. |
| `--latest [N]` | 4 | The N newest `gallery.json` entries, oldest first |
| `--src <path\|url>` | | Use this MP4 instead of a gallery piece. Repeat it for a set. |
| `--style <text>` | from the title | The style shown in the pill and captions. After a `--src`, that file's style. |
| `--formats <list>` | `9x16,2x3` | One piece only: which shapes to render. A set or a portrait piece is 9:16 only. |
| `--duration <sec>` | the clip's length | Trim each piece to at most this long. Never loops to pad. |
| `--music-prompt <text>` | off | Generate music from this prompt and record it as `music_prompt` on every piece's `gallery.json` entry |
| `--audio <file\|url>` | off | Use an existing audio file instead |
| `--gain <dB>` | `-9` | Music level |
| `--out <dir>` | `marketing/out` | Output folder (gitignored) |

Output, per post, in `marketing/out/<slug>/`:
- `<slug>_9x16.mp4` (1080×1920). A set's goes to all four channels; a single piece's to Instagram, TikTok and YouTube, whose players letterbox anything else.
- `<slug>_2x3.mp4` (1080×1620) for Pinterest. Only a single landscape piece gets one.
- `captions.md`: exactly what will be posted.
- `meta.json`: the hand-off to the poster, including `webSlug`, the permanent `/art/<slug>` page the pin links to. A set's also lists its `pieces` in order. The poster never recomputes any of it.

A set's slug is its name, e.g. `mount-fuji-and-3-more`. `marketing/out/.posted.json` records what has been posted where.

**The nightly set.** A night's pieces go out as one post, because four posts a day is more than anyone wants in a feed.
- Each piece is framed exactly as it would be alone, then the pieces play in the order given, each dissolving into the next over 1 s. Lead with the most recognizable piece: it's what the first seconds of a feed show.
- Every piece plays at the pieces' shared frame rate (24 fps for the Veo and Omni clips tested), so no frame repeats. If their rates differ, the set plays at 30 fps.
- One clip goes to every channel, Pinterest included: a 2:3 can't hold a set that mixes portrait and landscape pieces, and Pinterest takes 9:16 video.
- The pin links to the first piece's page, which the pin's title names.

**The frame.** A landscape piece is zoomed to 1.5× the frame width over a blurred copy of itself, so the clip shows its middle two-thirds. In a feed, only cropping makes the art bigger. The piece's title sits in a pill right under the art, styled like the screensaver's own. There's no brand text, URL or call to action in the clip: a post that looks like an ad gets scrolled past. Each piece plays once, at its source's length.

**Portrait pieces** (taller than wide, read from the video after any rotation flag) already fill a phone, so they go out as they are: no zoom, blurred background or title pill, only scaled to the canvas at their own frame rate. They never get a 2:3, since cropping would cut the painting; Pinterest gets the 9:16.

**The music** is written for the night's pieces by the nightly agent ([`PROMPT_GUIDANCE.md`](../curation/PROMPT_GUIDANCE.md), *Music prompts*): one prompt for the whole set. Music that contradicts the picture is worse than silence, so there's no shared library. It's mixed at −9 dB with fades. Lyria returns about 30 s and a set runs about 40 s, so shorter music is looped, with a 3 s crossfade where it meets its own start. The MP3 is temporary; only the prompt is kept, as `music_prompt` on every piece in the post. Every prompt must say "Instrumental, no vocals" (Lyria sings by default, and the script refuses a prompt without it) and "Even dynamics, no build or drop".

## Posting

```bash
bash curation/with-secrets.sh ZERNIO_API_KEY -- node marketing/post-social.mjs --check      # preflight, posts nothing
bash curation/with-secrets.sh ZERNIO_API_KEY -- node marketing/post-social.mjs --slug <slug>
```

| Flag | Default | Meaning |
|---|---|---|
| `--check` | | Check the key, list connected accounts, find the board |
| `--dry-run` | | Build and validate everything, publish nothing |
| `--latest [N]` | 4 | Consider the N most recent renders (a set counts as one) |
| `--count <K>` | 1 | How many of them to post |
| `--slug <s>` | | Post this rendered post |
| `--channels <list>` | all four | `instagram,youtube,tiktok,pinterest` |
| `--format <fmt>` | `9x16`; `2x3` for Pinterest | Post this shape everywhere. A post with no 2:3 pins its 9:16. |
| `--force` | off | Post again even if the ledger says it went out |

`PINTEREST_BOARD` sets the board name or id (default "Daily Curation").

Everything goes through Zernio. Each clip is uploaded once through Zernio's presigned upload (its direct upload rejects files over about 4.5 MB). Then each channel gets its own post, so one platform rejecting a post can't sink the other three.

What makes it safe to run unattended:
- **Pins link to a piece's own page** (a set's first piece) with `utm_source=pinterest`. A pin's link can't be edited later, so the slug comes from `meta.json`, and `living-art-screensaver-web/lib/__tests__/social-slug-drift.test.ts` fails if the poster's slug rule and the website's ever differ.
- **No pinning dead links.** The page exists only after Vercel rebuilds from the new `gallery.json`, so the poster waits until it's live. The other channels have no link and don't wait.
- **No double posts.** The ledger skips what already went out, and each request has an idempotency key, so a retry returns the original post.
- **Pending isn't failed.** Zernio reports `pending` while it retries a platform. The poster waits for a final state and treats an unsettled post as sent, because marking it failed would repost it the next night.

## Captions

All copy lives in `lib/captions.mjs` and depends only on the pieces, so a retry posts identical text.

Instagram and YouTube lead with one fixed line; TikTok's differs at the end:

```
Animated art screensaver app - Link in bio               (Instagram, YouTube)
Animated art screensaver app - Link in comment and bio   (TikTok)
```

Every description starts with the app pitch, then `living-art-screensaver.com` on its own line. Instagram and YouTube use "Link in bio"; TikTok uses "Link in comment and bio". Pinterest uses just the pitch because the pin itself links to the artwork page. The visible domain gives viewers an address to remember even where description URLs aren't clickable. The pitch leaves out "Mac" so interest from other platforms shows up.

Under the header come the pieces in the order they play, with a blank line between each piece and before the hashtags. AI pieces show their title and style. Real paintings show the title, then the artist, date and museum on a second line; license and full provenance remain on their artwork pages. YouTube titles still name the painting and painter for real art; otherwise they use the pitch and a set's name.

**Sets stay within each platform's limits** (Instagram and TikTok 2,200 characters, YouTube title 100, description 5,000 and tags 500, pin title 100 and description 500). A very long set names its first pieces and counts the rest ("+3 more").

**Pinterest** keeps a direct link to the first piece's artwork page, tagged for attribution. Pinterest search ranks the pin's words, so titles lead with the painting and artist for real art, or the style for AI art ("Animated Ukiyo-e: Mount Fuji | Art screensaver app"). Descriptions use the same header and spaced artwork blocks, with no hashtags or bio CTA.

**Hashtags** (`lib/hashtags.mjs`): Instagram and TikTok get `#screensaver #animatedart` plus up to two for the pieces. YouTube gets three. A piece's own tags are one for its movement or country and one for its era; a set takes every piece's first tag before any piece's second, so the line shows the set's range.
- A tag must be true of every piece it lands on. `Chinese & Korean` has no era tag, because `#chineseart` is wrong on a Korean painting.
- A tag must have an audience. Style tags were checked against TikTok's view counts; tags under about 5M views were dropped, and the art-specific form wins where the bare word means something else (`#renaissanceart`, `#cyberpunkart`).
- Few on purpose: Instagram allows five, and favours targeted ones. No `#art`.

**Real paintings** (`source: "real_artwork"`) keep the fixed first line, then name each painting, painter and museum:

```
Animated art screensaver app - Link in bio
living-art-screensaver.com

Paris Street; Rainy Day
Gustave Caillebotte, 1877 · Art Institute of Chicago

#screensaver #animatedart #caillebotte #impressionism
```

Their hashtags come from the artist, in order: the artist, their movement (or the era), `#arthistory`, and `#famouspaintings` for the famous names listed in `lib/hashtags.mjs`. Artist tags weren't checked against TikTok's counts. When every piece in a post is a real painting, the YouTube and pin titles name the first painting and its artist ("Paris Street; Rainy Day by Gustave Caillebotte and 3 more, animated | Art screensaver app").

**TikTok's pinned comment.** The TikTok account can't have a bio link (no Business option, and personal accounts need 1,000 followers). So after each video goes live, the poster comments "Get the screensaver app: living-art-screensaver.com" and pins it.
- It's plain text; TikTok comment links aren't clickable.
- It needs Zernio's TikTok Business app connection. An older connection gets `400 PLATFORM_LIMITATION`; reconnect the account in Zernio.
- Pinning right after commenting fails, so the poster retries every 15 s.
- A failure only warns (`⚠ tiktok link comment`, saved as `linkComment` in the ledger). It never fails the run, since the video is already public.
