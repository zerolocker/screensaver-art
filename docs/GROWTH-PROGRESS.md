# Growth progress

The shared status board for growth work. Agents work on this without shared context, so:

1. Read this file before starting.
2. Add a row to **In progress** when you start.
3. When you finish, update **Status** and **Next up** in the same PR as the work.

The reasoning behind the plan is in [`growth-and-marketing-strategy.md`](growth-and-marketing-strategy.md).

**The main constraint:** the founder spends about zero hours a week on marketing. Only do work that runs by itself or is done once. Batch any unavoidable human step into one short sitting.

## Status

| Initiative | Status | Notes |
|---|---|---|
| Analytics (website + app) | Live | [`posthog-analytics.md`](posthog-analytics.md) |
| Social link previews | Live | `living-art-screensaver-web/app/opengraph-image.tsx` |
| "Email me the Mac link" for phones | Live | `components/marketing/download-cta.tsx` |
| Platform demand probe | Live | `components/marketing/platform-interest.tsx`. Results are PostHog events only. |
| Brand-name SEO | Live | Title, meta description, JSON-LD |
| Gallery landing pages | Live | `/gallery`, `/art/<slug>`, `/era/<tag>`. `/art/*` is `noindex`. |
| Daily social posts | Live since 2026-09-07 | All of each night's pieces, stitched into one 9:16 clip, to Instagram, YouTube, TikTok and Pinterest through Zernio (about $12/month). See `marketing/README.md`. |
| Music for clips | Live | Lyria. One prompt per night's set, written by the nightly agent. |
| Real-paintings curation | Switching on (PR #105, after app 1.4.10 ships) | Famous public-domain paintings animated with Gemini Omni replace AI art. `curation/REAL_PAINTINGS_CURATION.md`. Switch back with `curation/CURATION_MODE`. |
| Lifetime price ($15.99) | Live | Pricing work is closed until there is traffic. |
| Product Hunt | Failed, 2026-07-26 | 5 upvotes, no traffic. Can't be rerun for months. |
| Show HN | Blocked | HN refused new Show HN posts. Don't plan on it. |
| Reddit | Not started | About 20 minutes. Copy in [`launch-kit.md`](launch-kit.md). |
| Directory submissions | Next | |
| Press and creator outreach | Next | |
| Newsletter | Parked | Needs an email service that can send from the nightly job. |
| Wallpaper Engine / Lively packs | Parked | |
| Retention email | Parked | Needs users first. |
| Referrals, shareable clips | Parked | |
| Windows, Mac App Store | Parked | Waiting on demand-probe data. |
| Paid ads | Not now | |

## Data so far

- In the first week of posting (2026-09-07 to 09-14): TikTok 1,235 views over 8 posts, Instagram 234 over 5, YouTube 151 over 6, Pinterest 11 impressions over 15 pins.
- Four weeks of daily posts of AI-generated art brought no site visits. That is why the real-paintings mode exists: famous paintings are more likely to stop the scroll, and people search for them by name.

## In progress

| Task | Agent / branch / PR | Started |
|---|---|---|
| _(none)_ | | |

## Next up

1. **Directory submissions.** An agent builds a paste-ready pack (blurbs at each site's length limit, screenshots, categories) for alternativeto.net (under Aerial), MacUpdate and indie app directories. The founder pastes it in one sitting.
2. **Press and creator outreach.** Target list, a `/press` kit page, and drafted pitches for the founder to send. One feature is worth months of our own posts.
3. **Reddit.** One subreddit at a time, video first ([`launch-kit.md`](launch-kit.md)).
4. **Read the UTM data** to learn which channel converts. Pins are tagged `utm_source=pinterest&utm_medium=social&utm_campaign=daily`. Instagram, YouTube and TikTok posts carry no link, so they are only measurable through tagged bio links.

## Waiting on the founder

- Tag the Instagram and YouTube bio links (for example `https://living-art-screensaver.com/?utm_source=instagram&utm_medium=bio`), and put `living-art-screensaver.com` in TikTok's bio as plain text. TikTok can't have a clickable bio link under 1,000 followers.
- Pick an email service (Supabase mailer, Resend, …). It blocks the newsletter and retention email.

## Checking the automated posts

Look at the four accounts now and then and check:

- The music fits the art. Any singing is a bug.
- The title pill under the art isn't hidden by Instagram's caption.
- Hashtags fit the piece, and pin titles lead with the style.
- Each pin opens its own `/art/<slug>` page, and the bio links work.
- TikTok's pinned comment is visible when signed out. Failures show in the run log as `⚠ tiktok link comment`.
- Instagram Reels carry the AI label, and YouTube Shorts have a real title and the synthetic-media disclosure.

Fix music problems in `curation/PROMPT_GUIDANCE.md` (Music prompts) and piece-choice problems in `curation/AUTOMATED_CURATION.md` (step 8a).

## Settled decisions

Don't reverse these without asking the founder.

- Nightly art is famous public-domain paintings, animated. The AI-art curation is paused, not deleted.
- Post all of a night's pieces as one clip, to all four channels equally, and let the UTM data rank them.
- Pins link to the first piece's own page. Other captions have no link and say "Link in bio" (TikTok: "Link in comment and bio", with the address in a pinned comment).
- Clips carry no brand or marketing text. The caption does the selling, and it leaves out "Mac" so interest from other platforms shows up.
- Music is written for each night's set. Music that clashes with the pictures is worse than none.
- Buy social posting rather than build it (see the strategy doc).
- `/art/*` pages exist for social, not search, and stay `noindex`.
- Pricing stays as it is until there is traffic.
