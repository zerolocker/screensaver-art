# Launch copy

Reusable copy for Reddit, directories and press. The Product Hunt and Show HN drafts were removed after those launches failed; they are in git history (`git log -- docs/launch-kit.md`).

## One-line pitches

- "Turn your Mac's screensaver into a living gallery: centuries of art, animated by AI, refreshed every night." (matches the website)
- "A new piece of curated AI art on your Mac, every day, as your screensaver."
- "Aerial, but for AI-animated paintings, and it refreshes daily."

## Reddit (not yet posted)

Lead with a video, say you made it, answer comments, and post to one subreddit at a time.

| Subreddit | Angle |
|---|---|
| r/macapps | `[App] Living Art — a Mac screensaver that adds a new AI-animated artwork every night (free tier)`. Best fit; the free tier is the hook. |
| r/apple, r/mac | A softer "I made this" with a clip. |
| r/battlestations, r/desksetup | The visual only; answer "what's that?" in the comments. |
| r/AIArt | How the nightly pipeline and curation work. |

```
I made a Mac screensaver that turns your idle display into a gallery of classic art,
gently animated by AI — and it quietly adds a new curated piece every night.

Free to download and browse the whole collection; a small subscription unlocks it
all. Not trying to spam — genuinely made this and would love feedback. Clip below 👇
```

## Media

`marketing/out/` is build output and isn't committed. Regenerate clips with `node marketing/make-social-assets.mjs --latest 6`.

| Asset | Path |
|---|---|
| 37.6 s 16:9 launch video with sound | `marketing/out/hero/living-art-launch-video-16x9.mp4` |
| Full-screen art reel, 1:1 loop, stills | `marketing/out/hero/` |
| Website and app screenshots | `marketing/out/launch-images/` |

Show motion first. A moving wall of art beats any still.

## Tracking links

`https://living-art-screensaver.com/?utm_source=<source>&utm_medium=<medium>&utm_campaign=<campaign>`, for example `reddit` / `social` / `r_macapps`.
