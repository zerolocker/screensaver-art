# Growth & Marketing — Progress Hub  ⟵ START HERE

**Canonical, shared status for the growth/marketing initiative.** Multiple agents
work this repo *without shared chat context* — this committed file is how they
coordinate. One agent commits it → every other agent sees it. **If you touch
growth work, read this first and update it in the same PR.**

This hub holds the **state**. The **reasoning** lives in
[`growth-and-marketing-strategy.md`](growth-and-marketing-strategy.md) — don't
duplicate its arguments here; link to a section (e.g. "§10") instead.

---

## How agents use this file (protocol)

1. **Read first.** This file + the Doc map below, before starting any growth work.
2. **Claim before you start.** Add a row to **In progress** with your task, branch/PR,
   and date — so another agent doesn't double-work it.
3. **Log when you finish.** Update the **Status** table (→ ✅) and add a one-line dated
   entry to the **Activity log**. **Commit this file in the same PR as the work.**
4. **Keep it terse and current.** This is a dashboard, not prose. An out-of-date hub is
   worse than none — update it even for partial progress.
5. **Don't relitigate settled calls.** See **Decisions** below + the strategy doc's
   reasoning. If you disagree, raise it with the founder, don't silently reverse it.
6. **Conflicts:** if two agents edit this file, resolve via git; the **Activity log** is
   append-only (newest on top) so merges are cheap.

## Doc map (read in this order)
| Doc | What it's for |
|---|---|
| `CLAUDE.md` | Product + repo overview (every agent reads this first anyway) |
| **`docs/GROWTH-PROGRESS.md`** (this file) | **Live state + backlog + protocol** — the hub |
| `docs/growth-and-marketing-strategy.md` | The strategy + *why* (reasoning, not state) |
| `docs/launch-kit.md` | 📕 **Archive** — the launch ran and failed (§4.2). Copy/media still reusable; **§3 Reddit is the one live item** |
| `marketing/README.md` | The social asset engine **and the poster** (`make-social-assets.mjs` → `post-social.mjs`) |

---

## The current bet (read before picking anything up)

**The launch spikes are spent** — PH returned 5 upvotes and can't be re-run for months; Show HN
is closed (§4.2). *Why* PH flopped is unknowable; what matters is that neither can be fired
again soon. The plan is now channels that **compound** or **run unattended**:

> ⚠️ **Founder marketing time ≈ 0 h/week** (2026-08-02). **Anything needing a recurring human
> chore will not happen.** Rank by "runs itself once built" / "built once, pays forever" —
> not by upside. Prefer work you can *finish* (a script, a page, a submission pack) over work
> that hands the founder a habit; batch unavoidable human steps into one ≤30-min sitting.

## Status (canonical)
Legend: ✅ live · 🔨 built, not yet used · ⏭️ next · 🅿️ parked (needs a decision/data) · ❌ tried/dead

| Initiative | Status | Where it lives / notes |
|---|---|---|
| PostHog analytics (web + Electron) | ✅ live | events + funnels; strategy §3 |
| Open Graph / Twitter social cards | ✅ live | `living-art-screensaver-web/app/opengraph-image.tsx`; §5 |
| Mobile "email me the Mac link" | ✅ live | `components/marketing/download-cta.tsx`; §5–6 |
| Cross-platform **demand probe** (self-report) | ✅ live | `components/marketing/platform-interest.tsx` — **PostHog-only, no backend**; superseded the old "detect Windows + waitlist" idea (§5/§8) |
| Marketing **asset engine** + launch media | ✅ live | `marketing/make-social-assets.mjs` → `out/<slug>/` (clips + captions + `meta.json`), now feeding the poster nightly. Launch video/reel/stills/screenshots in `out/{hero,launch-images}/` (inventory: `launch-kit.md` §4) — **those** are still unposted. §11 (A) |
| **Launch kit** | 📕 archive | `docs/launch-kit.md` — copy + media still reusable; §3 Reddit is its one live item. |
| **Product Hunt launch** | ❌ **ran 2026-07-26 — flopped** | **5 upvotes, 2 comments, no badge, no measurable traffic.** Post-mortem → §4.2. Not re-runnable for months. |
| **Show HN** | ❌ **dropped as a plan item** | Blocked at submission 2026-08-02 (HN not taking new Show HN posts). Copy stays loaded; **nothing may depend on it reopening.** |
| Reddit (r/macapps + visual subs) | ⏭️ **never run** | Day-2 slot unused. Highest-fit free channel, ~20 min (`launch-kit.md` §3). |
| **Daily social posting + aggregator** | ✅ **live 2026-09-07** | §4.1 + §11 (B) — `marketing/post-social.mjs`, hung off the nightly curation (`AUTOMATED_CURATION.md` step 8). One piece a night to **all four** channels: IG / YT / TikTok lead with one fixed caption (*Screensaver app with animated art - Link in bio*) and pins link to their own `/art/<slug>` + UTM (since 2026-09-12; before that every post carried its own link). **Verified with real posts on IG / YT / TikTok / Pinterest.** **All four channels on Zernio since 2026-09-12** (upload-post dropped); 4 accounts ≈ $12/mo. |
| **Clip audio: Lyria music bed** | ✅ **live 2026-09-07, per-piece 2026-09-08** | §11.2 — `make-social-assets.mjs --music-prompt` scores the posted clip at −9 dB with music written for *that* artwork. The nightly agent writes the prompt (`PROMPT_GUIDANCE.md` → Music prompts); it is recorded as `music_prompt` in `gallery.json` and the MP3 is temp-only. The 5-bed shared library it replaced is deleted. |
| Brand-name / on-page SEO basics | ✅ live | 2026-07-17 (PRs #68, #69): keyword title, shared meta description, JSON-LD. |
| **Gallery landing pages** (`/gallery`, `/art/<slug>`, `/era/<tag>`) | ✅ **shipped 2026-08-03** | §4.3 — dropped then **reversed** the same day, justified as **social landing pages, not SEO**. 262 piece pages + 15 era wings + a 6-page index + a self-growing sitemap, all prerendered from `gallery.json`. `/art/*` is `noindex, follow` behind one constant (`INDEX_ART_PAGES`); `/gallery` + `/era/*` are indexable. `/style/<movement>` still deferred (203 labels, 158 singletons). **Ready for #1's posts.** |
| **Directory submissions** | ⏭️ **#2** | §4.4 — alternativeto.net, MacUpdate, indie dirs. Agent preps the pack, founder pastes once. |
| **Press + creator outreach** | ⏭️ **#3** | §4.1/§4.4 — highest-leverage *non-automatable* play; agent builds list + `/press` kit + drafts. |
| "Art of the week" email / newsletter | 🅿️ needs a send-path call | §4.6 — viable only if the send automates off the nightly job. |
| Option B ecosystem art packs | 🅿️ later | Appendix A — one-time publish into a 20–50M-user surface; revisit after #1–#3. |
| Retention / lifecycle email | 🅿️ later | §9 — needs users first. |
| **Pricing** | ✅ **closed** | $15.99 lifetime shipped 2026-07-18 (PR #70). **Founder de-prioritized pricing 2026-08-02** — annual stays untested; don't reopen without traffic (§10). |
| Referral / shareable export | 🅿️ later | §12 |
| Windows / Mac App Store build | 🅿️ pending demand-probe data | §8, §4.7 |
| Paid ads | 🅿️ not now | §13 — only after a proven funnel |

**One-liner:** foundation live, pricing closed, the pins have somewhere to land (283 gallery
routes) — and **as of 2026-09-07 the art posts itself nightly to all four channels**. First
real traffic should now arrive tagged by channel (pins through their own links; IG / YT /
TikTok through their bio links, once those carry tags), so the next thing this hub gains is
**data**: which of IG / YouTube / TikTok / Pinterest actually converts. Next: **directories →
press/creators → Reddit.**

## In progress (claim here before starting)
| Task | Agent / branch / PR | Started | Notes |
|---|---|---|---|
| _(nothing in flight)_ | | | |

## ✅ Founder setup — DONE (2026-08-23)

Accounts created and connected. **Since 2026-09-12 all four (IG / YT / TikTok / Pinterest) are
connected on Zernio**, and the one API key is `ZERNIO_API_KEY` in `curation/.env` (documented in
`curation/.env.example`, reachable via `curation/with-secrets.sh`). **Zernio → TikTok publishes
publicly** — verified by live test, so no channel is contingent. All four channels are equal
priority.

**Backlog #1 shipped on top of this 2026-09-07.** Billing is settled: the founder pays for Zernio
(first 2 accounts free, then $6/mo each, so 4 accounts ≈ $12/mo, posts unmetered). upload-post is
abandoned, and its `UPLOADPOST_API_KEY` is no longer read by anything.

## ⏰ Dated reminders
| When | Who | What |
|---|---|---|
| **2026-09-22** (2 weeks after go-live) | **founder** | **Review the automated social posts for quality and errors.** ~15 min, once. Open the four accounts and actually look at what a fortnight of unattended posting produced. Checklist below. |

**2026-09-22 — first quality review of the automated posts.** The nightly job has been
publishing since 2026-09-07 with nobody watching it. Two weeks in is the first point where
there is enough output to judge, and early enough that a systematic error hasn't run for a
month. Go through the four accounts ([IG](https://www.instagram.com/living_art_screensaver/) ·
[YouTube](https://www.youtube.com/@livingartscreensaver) ·
[TikTok](https://www.tiktok.com/@livingartscreensaver) ·
[Pinterest](https://www.pinterest.com/livingartscreensaver/daily-curation/)) and check:

- **The music fits the art** — the failure mode this design exists to prevent (a tender piano
  under a plaza of shrieking kids). If several misses, the fix is `PROMPT_GUIDANCE.md` →
  *Music prompts*, not the code. **Any singing at all is a bug** — the guards should make it
  impossible, so report it rather than shrugging.
- **Clip length + framing** — each clip should be the piece's own length (~8s), playing once.
  Since 2026-09-12 the art is zoomed 1.5× (sides cropped) with the piece's title in a pill under
  it: **check whether the title looks misaligned, or sits under Instagram's caption.** The art
  was deliberately left centred so real posts could answer that; lifting it is the fix if so.
- **The fixed caption** — IG / TikTok / YouTube all lead with *Screensaver app with animated
  art - Link in bio* (founder call, 2026-09-12). Is anyone asking what it is, or asking for other
  platforms? The caption leaves out "Mac" on purpose so that interest can show up.
- **Every pin's link resolves** to that piece's `/art/<slug>` page, not a 404 and not the home
  page, and **the three bio links** (IG, TikTok, YouTube) reach the site.
- **Piece selection** — is the agent picking pieces that work as a vertical phone clip, or
  defaulting to whatever is newest? Criteria are `AUTOMATED_CURATION.md` step 8a.
- **Instagram + YouTube after the 2026-09-12 move to Zernio** — posts from before that date
  went through upload-post. Check that the later IG Reels carry the AI label, and that the
  YouTube Shorts have a real title (not the caption's first line) plus the synthetic-media
  disclosure.
- **Anything the UTM data says** (backlog #4 lands the same week).

Log what you find in the Activity log, and fold any prompt/criteria changes back into
`curation/PROMPT_GUIDANCE.md` so the nightly agent inherits them.

## Next up (prioritized backlog)
Ordered for **0 h/week**: runs-itself first, build-once second, human tasks batched last.

1. **Directory submissions** (§4.4) — agent builds a ready-to-paste pack (blurbs at each site's
   length limit, screenshots, categories, links); founder pastes in one sitting.
2. **Press + creator outreach** (§4.1/§4.4) — target list, `/press` kit page, personalized
   drafts. **One feature ≈ months of our own posting.**
3. **Reddit** (`launch-kit.md` §3) — ~20 min; the posting automation is live, so traffic now
   lands on a site that keeps earning.
4. **Read the UTM data** (**2026-09-22**, with the post review above) — pins are tagged
   `utm_source=pinterest&utm_medium=social&utm_campaign=daily`. IG / TikTok / YouTube captions
   carry no link since 2026-09-12, so their traffic is only attributable through tagged bio links
   (founder chore below). First real evidence of which converts; §4.1 deliberately ranks none of
   them until this exists.

~~Wire the posting automation~~ ✅ **done 2026-09-07** — see the Status table and the activity log.

## Decisions needed from the founder
- **Chore: the profile bio links** (founder is on it, 2026-09-12). IG / TikTok / YouTube captions
  now say *Link in bio*, so the bio link is the whole funnel for those three. **TikTok has no bio
  and no website link yet**, so its posts currently lead nowhere; add both. Then tag all three
  bio links, e.g. `https://living-art-screensaver.com/?utm_source=tiktok&utm_medium=bio`, or the
  2026-09-22 review can't tell those channels apart.
- **Email-send path** — Supabase mailer / Resend / other. Blocks §4.6 + §9; only viable if the
  send automates off the nightly job.
- **Was the PH launch ever *featured*?** (unfeatured ⇒ near-invisible, which changes how we read
  5 upvotes). _(The social-account chore that used to share this line is done — all four channels
  are on Zernio.)_
- **Poster stills for 77 pieces** — approve generating first-frame stills and uploading them to
  **R2** (never git — `CLAUDE.md` → Repo rules), with the URL written into `gallery.json`'s `img`.
  Those 77 gallery tiles currently render on a colour gradient, and their social cards fall back
  to the generic site card instead of the artwork. Cheapest fix: have the nightly curation job
  write `img` for every new piece and backfill the old ones once.
- ~~Aggregator choice~~ ✅ 2026-08-02 (§11 B) · ~~Pricing~~ ✅ **closed 2026-08-02** — lifetime
  shipped (PR #70) and the founder has **de-prioritized pricing**; don't reopen it without
  traffic (§10).

---

## Activity log (append-only — newest first)
- **2026-09-12** — **Social clips: zoomed art, its title underneath, one fixed caption.** Founder
  call after reviewing the first posts. **No brand or marketing text in the clip** (a post that
  reads as an ad gets scrolled past, and words on screen pull attention off the art), so the URL
  pill is gone. The art is now **zoomed 1.5×**, showing the middle two-thirds of each piece half
  again as large (in a feed a letterbox alone never enlarges the art), with **the piece's title in
  a pill under it**, mirroring the screensaver's own title pill. **Instagram, TikTok and YouTube
  lead with one fixed caption, *Screensaver app with animated art - Link in bio***: short enough
  for the line or two a phone shows, no URL because those three don't make caption links
  clickable, and **no "Mac" on purpose**, so non-Mac interest shows up. The piece's name follows
  behind "more", and TikTok adds two hashtags. **Pins still link to their own `/art/<slug>`** and
  name the piece in their title, since that is what Pinterest search ranks. **Pinterest gets a
  new 2:3 render; the other three keep 9:16** (their players letterbox anything else), and the
  unused 1:1 render is dropped. The art is deliberately **not lifted**, though on 9:16 the title
  may sit under Instagram's caption: the founder wants to see a real post first. The variant
  caption pools are gone. YouTube Shorts are now filed under Film & Animation (Zernio's default
  was People & Blogs), and the `/art/<slug>` prose stops calling every piece a loop: only pieces
  authored to loop are described as one. New founder chore: TikTok's bio + website link, and
  tags on the three bio links. _(This PR.)_
- **2026-09-08** — **Music is now scored to the artwork, and the nightly agent owns both calls.**
  Founder review of the first clip killed the shared-bed design: a joyful, noisy summer plaza
  full of children in a splash fountain had been scored with *"solo felt piano in a large empty
  room, tender and slow"*. The library reasoning ("nobody notices the bed varying nightly") was
  true and beside the point — **what gets noticed is music that contradicts the picture**, and
  that is worse than silence. So: the 5-bed library and its R2 objects are **deleted**,
  `make-social-assets.mjs --music-prompt` makes **one Lyria call per posted piece**, and the
  **nightly curation agent** now (a) picks which of its four pieces to post and (b) writes that
  piece's music prompt — it has just written the image and video prompts and looked at the still,
  so nothing downstream knows the piece as well.
  **The prompt is the durable artifact, not the MP3:** the audio is generated to a temp dir,
  muxed at −9 dB, and deleted; `music_prompt` is written onto that piece's `gallery.json` entry
  as a curation-only field beside `image_prompt`/`video_prompt`. Only the posted piece is scored,
  so **only one of the four carries the field** — and the script refuses `--music-prompt` when
  more than one piece matches, so that can't drift. Selection criteria, prompt rules, a worked
  example and the anti-patterns are in `curation/PROMPT_GUIDANCE.md` → *Music prompts*; the
  runbook is `AUTOMATED_CURATION.md` step 8. _(This PR.)_
- **2026-09-12** — **Social posting consolidated onto Zernio; upload-post abandoned.** Founder
  call: Zernio is paid now, and keeping upload-post for IG + YT cost more than moving those two
  accounts onto Zernio (upload-post's free 10 uploads/mo covered ~5 nights; Basic is $24/mo,
  while Zernio at 4 accounts is ≈ $12/mo with posts unmetered). All four accounts were already
  connected on Zernio. `post-social.mjs` now runs on one key (`ZERNIO_API_KEY`) and one API. It
  uploads the clip once, then makes **one Zernio post per channel** rather than a single
  multi-platform post, so a payload one platform rejects can't fail the other three. That
  per-channel isolation replaces the per-vendor isolation the split used to provide. The
  AI-disclosure flags carried over (`isAiGenerated` on IG, `containsSyntheticMedia` on YT), and
  YouTube Shorts now also get the caption module's tags. This was the "consolidate later" that
  §11.1 planned for, and it came early because of price rather than channel count.
- **2026-09-07** — **#1 shipped: the art now posts itself, nightly, to all four channels.**
  `marketing/post-social.mjs` glues the rendered clips to upload-post (Instagram + YouTube) and
  Zernio (TikTok + Pinterest) and hangs off the nightly curation as step 8. **Verified with real
  posts on all four** — [IG](https://www.instagram.com/reel/DdAiNn_jS9q/) ·
  [YT](https://www.youtube.com/watch?v=xC6V8iTtdEQ) ·
  [TikTok](https://www.tiktok.com/@livingartscreensaver/video/7682974613550271775) ·
  [Pinterest](https://www.pinterest.com/pin/1146940230213600786/) — then a second full round on a
  different piece to prove the fixed code path. **Clips are no longer silent:** `--audio` mixed a
  Lyria bed at −9 dB, drawn from a small shared library — a design superseded the next day, see
  the 2026-09-08 entry. **No media committed** — `marketing/out/` is gitignored.
  Decisions worth not relitigating: **(1) one piece a night, not four** — four posts a day is a
  cadence nobody wants, and it would spend upload-post's free month in under a week. **(2) Every
  post links to `/art/<slug>` with a per-channel UTM**, and the slug is *read from the render's
  `meta.json`*, never improvised — a post's destination URL can't be edited after publishing, so
  a drift test now fails the build if the poster's slug rule and the website's ever diverge.
  **(3) The poster refuses to publish a link that isn't live yet**, waiting out the Vercel deploy
  that the same night's `gallery.json` push triggers. **(4) Captions come from variant pools**
  keyed per piece + platform — deterministic (a retry republishes identical copy) but never the
  same sentence twice running, which is the actual failure mode of one template at daily cadence.
  Three things the vendors' docs got wrong, found the hard way: Zernio's `upload-direct` is
  documented at 25 MB but rejects >~4.5 MB (we use the presigned path), its `pending` status
  means "retrying", **not** failed — a pin that first errored published a minute later, and
  reporting it as a failure would have made the next night post a duplicate — and its presign
  response field is `publicUrl`, not the `fileUrl` the docs claim.
  ⚠️ **The one live cost:** upload-post free = **10 uploads/month**, so IG + YT go quiet around
  day 6 without the $24/mo plan. Zernio's half is durably free at 2 accounts. _(This PR.)_
- **2026-08-23** — **Zernio → TikTok public posting confirmed** by a founder live test: a real
  post published rather than landing as a private draft, so its client is audited. This was the
  last open contingency in backlog #1 — the four-channel plan now has no "verify before relying
  on it" caveat, and §11.1's table reads ✅ instead of ⚠️. Also removed the remaining framing
  that treated TikTok as lower priority or riskier than the other three; all four are equal.
- **2026-08-23** — **`lyria-music-gen` skill built** (§11.2). One call, prompt in, instrumental
  MP3 out, on the existing `GEMINI_API_KEY` — no new vendor. `clip` ≈30s, `pro` ≈3min.
  **Verified the vocals trap is real:** "a gentle folk song about autumn rain" came back sung,
  with a timestamped lyric sheet. So the skill warns pre-call when the prompt lacks instrumental
  wording, and post-call detects lyrics from Lyria's own text part (`<instrumental>` vs
  timestamped lines) and exits non-zero — the audio is still written so the paid call isn't
  wasted. `--allow-vocals` opts out. Next: wire it into `make-social-assets.mjs`, which still
  renders silent. _(PR #88.)_
- **2026-08-23** — **Removed the platform rankings; all four social channels are now equal.**
  The docs had ranked TikTok below Pinterest/YouTube on content "durability" and called
  Reels/TikTok "viral lottery tickets". **Unsupported** — TikTok treats posts as evergreen (old
  videos get re-tested and surface via search months later), and the cross-platform "half-life"
  figures are meta-analyses of secondary sources, not measurements. The follow-on argument that
  TikTok's mobile audience is a poor fit for a Mac-only download **also doesn't hold**: the
  "email me the Mac link" flow (§5–6) is exactly the bridge for that, so a phone-first platform
  is not a handicap. §4.1 now lists Pinterest / YouTube / Reels / TikTok as four equal channels
  with different discovery mechanisms and **no ranking**, since we have zero data on which
  converts for us — post to all four and let the UTM data decide. _(This PR.)_
- **2026-08-03** — **Gallery landing pages shipped — the social channel now has destinations.**
  283 new prerendered routes: **262** `/art/<slug>`, **15** `/era/<tag>`, a **6-page** `/gallery`
  index, plus a sitemap generated from `gallery.json` (so the nightly push to `master`, which
  already auto-deploys, grows the routes and the sitemap by itself). Built as §4.3 argues —
  **destinations for pins, not an SEO play**. Four calls worth knowing: **(1) slugs are permanent
  by construction** — derived from the immutable R2 key, never the title or catalog position,
  because a pin's URL can't be edited after posting; a test fails the build on any collision.
  **(2) `/art/*` ships `noindex, follow`**, `/gallery` + `/era/*` are indexable — 262 pages of
  generated art *and* generated prose is the shape Google's scaled-content systems demote, and a
  penalty would hit brand-name search; Pinterest doesn't care. One constant, `INDEX_ART_PAGES`,
  flips the meta tag and the sitemap together. **(3) Descriptions are templated from
  title/movement/era/date plus 15 hand-written era paragraphs — never the `image_prompt`/
  `video_prompt` fields**, which are machine instructions and missing on 61 pieces; real
  per-piece prose is a follow-up that belongs in `gallery.json` as data, not a build-time model
  call. **(4) Image optimisation had to be turned on**: the R2 `img` stills are 4K WebPs of
  1.4–3.3 MB each, so a 48-tile grid was ~120 MB of images — now ~2 MB, and a full scroll fetches
  **zero** video bytes (clips load on hover, or on dwell for the 77 poster-less pieces, capped at
  4 at a time). **No media committed.** Open: the poster gap (founder decision above) and
  richer per-piece prose. _(This PR.)_
- **2026-08-03** — **SEO drop reversed — gallery pages are back, reframed.** A second opinion
  argued for `/art/<slug>` + `/style` + `/era`. Its numbers were half right (era tags **15** ✅,
  missing posters **126** ✅; but **262** pieces not 223, and **203** movement labels not ~60,
  **158 of them singletons**) and its SEO claim was overstated — bare movement names are
  informational queries owned by Wikipedia/museums, and our pieces are AI *homages*. **But its
  Pinterest point stands and changes the decision:** #1 makes Pinterest the plan, Pinterest needs
  a destination per pin, and today every clip can only link to the homepage. So the pages are
  **social infrastructure**, with SEO as a free option — and they can be `noindex`ed if scaled
  AI content looks risky. Scope: `/gallery` + `/art/<slug>` (262) + `/era/<tag>` (15);
  `/style/<movement>` deferred until 203 labels are grouped. Posters stay out of git (R2, founder
  step). **Must land before the first pins** — pins can't be re-pointed. _(PR #82.)_
- **2026-08-03** — **SEO dropped (founder call); backlog re-ranked.** Reasoning in §4.3: the
  searchable market is small and its intent is *how-to*, not shopping; this is a demand-
  **generation** product (people see it and want it, they don't search for it); and the
  "self-growing corpus" was thinner than assumed — measured **262 pieces across 203 distinct
  movements**, only 9 with 3+ pieces, so per-movement pages would have been thin by construction.
  **Brand-name SEO stays** (already shipped) because it captures recall from social rather than
  betting on search volume. Backlog is now **#1 posting automation → #2 directories → #3
  press/creators → #4 Reddit**, which makes **#1 the whole plan** — and it is blocked on the
  founder creating the two vendor accounts. _(This PR.)_
- **2026-08-03** — **Media rule added to `CLAUDE.md`; Lyria stays founder-owned.** An agent
  overstepped a docs request by *implementing* the §11.2 music bed — a generator script plus four
  committed MP3s (~2.7 MB). Reverted before merge (PR #78 closed, branch deleted), so **master's
  history never contained them** and no clone pays for them. New hard rule in `CLAUDE.md` →
  *Repo rules*: **never commit images/audio/video without the founder's explicit approval**,
  because a committed blob is permanent — deleting it later doesn't shrink the repo. §11.2 now
  says the founder builds this as a repo skill and agents must not implement it. _(This PR.)_
- **2026-08-02** — **Post-launch pivot: re-baselined all three growth docs.** PH **ran 2026-07-26
  and flopped** (5 upvotes, 2 comments, no badge, no traffic — verified live); **Show HN dropped**
  (blocked at submission). §4.2's post-mortem is deliberately thin: PH exposes no impression data,
  so **why** is unknowable and no cause list is asserted — what's actionable is that neither can
  be fired again soon. **It says nothing about demand** — at ~0 sessions the funnel is untested.
  New constraint: **founder time ≈ 0 h/week**, so the backlog is ranked by "runs itself once
  built": **(1)** posting automation (clips *never* posted) → **(2)** SEO + programmatic gallery
  corpus (3 indexed URLs vs. 262 pieces) → **(3)** directories → **(4)** press/creators →
  **(5)** the never-run Reddit post. Folded in two stale wins: the **$15.99 lifetime tier**
  (PR #70) and **on-page SEO** (PRs #68/#69).
  Two founder calls landed in review: **pricing is closed** (de-prioritized now that lifetime
  ships — dropped from the strategy TL;DR), and social clips will carry a **Lyria-generated
  music bed** (new §11.2 — licence-clean *and* API-postable, unlike a platform trending sound;
  `make-social-assets.mjs` still needs the `--audio` flag).
  Docs trimmed below their pre-PR size; `launch-kit.md` is now an archive. _(This PR.)_
- **2026-08-02** — **Posting-aggregator research + decision (§11 B rewritten).** Compared
  upload-post, Zernio (ex-`getlate.dev`), Blotato, Postiz, Ayrshare on price, billing unit,
  platform coverage, upload mechanics and — decisively — **TikTok audit status**. All prices
  re-verified against live pricing pages (several secondary/blog sources were stale or wrong).
  **Decision: upload-post for IG + YT, Zernio for TikTok + Pinterest**, both starting free, to
  trial two APIs cheaply and consolidate later; the consolidation trigger is ~5 channels, past
  which upload-post's flat per-brand pricing beats Zernio's per-account model.
  _Two corrections to the strategy doc:_ **(1) Postiz was wrongly listed as a pre-audited
  aggregator** — hosted *and* self-hosted it requires your own TikTok developer app, making you
  the unaudited client (posts forced `SELF_ONLY`); it's now ruled out in the §11.1 table.
  **(2) Ayrshare repriced ~$49 → $149/mo minimum**, putting it ~4× over budget.
  _Open risk at the time (**resolved 2026-08-23** — see the newer entry above):_ Zernio's own
  TikTok audit status was undocumented, so it needed one live post to verify. No code written; glue script deliberately deferred.
- **2026-07-12 → 07-15** — **Launch media + kit built** (PR #63, branch `growth/launch-execution`).
  Asset engine run on the newest 6 pieces (12 clips + captions); hero rebuilt to mirror
  `hero-section.tsx` exactly (7 pieces, site cadence, synced pill) rather than a literal
  ScreenSaverEngine capture; a 37.6s **16:9 launch video with real gallery audio** rendered from
  the live site via headless Chrome + ffmpeg, ending on an art-backed end-card; launch images +
  a redacted app screenshot; end-cards later regenerated for the new swirl logo; hero monitor
  enlarged ~3.5× ("layout B") with the headline scaled 54→84px to stay readable on video. Live
  site verified end-to-end (OG unfurl, `/download/mac` → signed DMG, demand probe, mobile
  email-link). `launch-kit.md` finalized with copy + a launch-day runbook.
  **Inventory of what exists → `launch-kit.md` §4** (this entry condensed 2026-08-02 once the
  launch was over; full detail in the PR #63 history).
- **2026-07-03** — Established this hub; moved live status out of the strategy doc into here.
- **2026-07-03** — Strategy doc execution-status pass (snapshot, per-section tags, roadmap). _(PR #61)_
- **2026-07-03** — Marketing asset engine (`marketing/make-social-assets.mjs`) + launch kit
  (`docs/launch-kit.md`). _(PR #61)_
- **2026-07-03** — OG social cards, mobile "email me the link", and the self-report demand
  probe (replaced the Windows-detect/waitlist idea; PostHog-only). _(PR #59, merged)_
- **2026-07-03** — Growth & marketing strategy doc created. _(merged to master)_
