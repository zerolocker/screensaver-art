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
| `marketing/README.md` | The social asset engine (`marketing/make-social-assets.mjs`) |

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
| Marketing **asset engine** + launch media | ✅ produced | `marketing/make-social-assets.mjs` → `out/<slug>/`; launch video/reel/stills/screenshots in `out/{hero,launch-images}/` (inventory: `launch-kit.md` §4). **Never posted anywhere.** §11 (A) |
| **Launch kit** | 📕 archive | `docs/launch-kit.md` — copy + media still reusable; §3 Reddit is its one live item. |
| **Product Hunt launch** | ❌ **ran 2026-07-26 — flopped** | **5 upvotes, 2 comments, no badge, no measurable traffic.** Post-mortem → §4.2. Not re-runnable for months. |
| **Show HN** | ❌ **dropped as a plan item** | Blocked at submission 2026-08-02 (HN not taking new Show HN posts). Copy stays loaded; **nothing may depend on it reopening.** |
| Reddit (r/macapps + visual subs) | ⏭️ **never run** | Day-2 slot unused. Highest-fit free channel, ~20 min (`launch-kit.md` §3). |
| **Daily social posting + aggregator** | ⏭️ **#1 — vendors chosen 2026-08-02** | §4.1 + §11 (B) — **upload-post** (IG + YT) + **Zernio** (TikTok + Pinterest), both start free. Glue script not written. Best fit for 0 h/week: build once, posts nightly forever. |
| **Clip audio: Lyria music bed** | ⏭️ **founder-owned** | §11.2 — clips will be scored with **Lyria-generated music**; the founder is building it as a repo skill. **Agents: don't implement it, and don't commit audio** (`CLAUDE.md` → Repo rules). |
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

**One-liner:** foundation live, pricing closed, **the pins now have somewhere to land** (283 new
gallery routes), **still ~zero traffic and therefore zero conversion data**. Next: **automated
posting → directories → press/creators → Reddit.** ⚠️ **#1 is the entire plan and it's blocked on
one founder chore** (create the two vendor accounts) — nothing else moves the needle at this
scale.

## In progress (claim here before starting)
| Task | Agent / branch / PR | Started | Notes |
|---|---|---|---|
| _(nothing in flight)_ | | | |

## ✅ Founder setup — DONE (2026-08-23)

Accounts created and connected; API keys in `curation/.env` as `UPLOADPOST_API_KEY` and
`ZERNIO_API_KEY` (documented in `curation/.env.example`, reachable via
`curation/with-secrets.sh`). **Zernio → TikTok publishes publicly** — verified by live test, so
no channel is contingent. All four channels are equal priority.

**Nothing here blocks backlog #1 any more — the remaining work is the glue script (agent work).**

## Next up (prioritized backlog)
Ordered for **0 h/week**: runs-itself first, build-once second, human tasks batched last.

1. **Wire the posting automation** (§11 B) — clips exist, nothing has ever been posted. Glue
   `make-social-assets.mjs` → upload-post (IG + YT) + Zernio (TikTok + Pinterest), hung off the
   nightly curation job. Zernio's public TikTok posting is **verified** (live test 2026-08-23),
   so no channel is contingent. All four run unattended (a platform trending sound is both licence-blocked and un-attachable via API, so
   there's no per-post human step). **Include the audio bed** — clips render silent; mux a track from the
   **`lyria-music-gen` skill** (§11.2; the prompt must say "instrumental, no vocals"). Add §11 (C) captions in the same pass
   if cheap — templates at daily cadence read as spam. Founder: create 2 accounts + connect socials.
2. **Directory submissions** (§4.4) — agent builds a ready-to-paste pack (blurbs at each site's
   length limit, screenshots, categories, links); founder pastes in one sitting.
3. **Press + creator outreach** (§4.1/§4.4) — target list, `/press` kit page, personalized
   drafts. **One feature ≈ months of our own posting.**
4. **Reddit** (`launch-kit.md` §3) — ~20 min; do it once #1 is live so traffic lands on a site
   that keeps earning.

## Decisions needed from the founder
- **Email-send path** — Supabase mailer / Resend / other. Blocks §4.6 + §9; only viable if the
  send automates off the nightly job.
- **One batched chore** — create the upload-post + Zernio accounts, connect IG/YT/TikTok/
  Pinterest; and check whether the PH launch was ever *featured* (unfeatured ⇒ near-invisible,
  which changes how we read 5 upvotes).
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
- **2026-08-23** — **Zernio → TikTok public posting confirmed** by a founder live test: a real
  post published rather than landing as a private draft, so its client is audited. This was the
  last open contingency in backlog #1 — the four-channel plan now has no "verify before relying
  on it" caveat, and §11.1's table reads ✅ instead of ⚠️. Also removed the remaining framing
  that treated TikTok as lower priority or riskier than the other three; all four are equal.
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
