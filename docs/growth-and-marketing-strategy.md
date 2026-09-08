# Living Art Screensaver — Growth & Marketing Strategy

> **Status:** Living strategy doc. Captures the reasoning from our growth conversation
> plus areas we hadn't yet discussed. The Option B distribution play is folded in as
> **Appendix A**. **See the Progress snapshot below for what's built vs. next** — the
> body sections are the *reasoning*; the snapshot is the *state*.
> **Context:** Solo/indie Mac app, live website, **launched and ~zero users today** (§4.2).
> Product: a screensaver streaming **curated, daily-fresh AI art**. Free tier (50 pieces),
> **$0.99/mo billed quarterly** or **$15.99 lifetime**.

---

## 0. TL;DR — the strategy in eight lines

1. **The art is the marketing.** You produce beautiful video daily at ~zero marginal cost — that's an infinite, free content engine. Build everything around it.
2. **Organic-first, not paid.** At $0.99/mo the unit economics make paid ads a money-loser. Earn attention with content; don't rent it.
3. **Your wedge is *curation + freshness*** — the one thing the free incumbents (Aerial, Wallpaper Engine's Workshop, Lively) structurally can't offer.
4. **Validate on Mac before building anything new** (Windows, a wallpaper engine). The Mac app already ships — validation costs *zero* build, just traffic.
5. **Don't pivot to a wallpaper engine.** Bigger market, but commoditized to free/$5 and moated. Instead *distribute your content into it* (Option B).
6. **Fix the funnel so traffic doesn't leak** — device-aware capture ("email me the Mac link"), a self-report platform-demand probe, great link previews, brand-name SEO.
7. **Instrument everything.** You can't improve what you can't see. Set up analytics + a north-star metric before you pour traffic in.
8. **The launch spikes are spent.** PH returned 5 upvotes (2026-07-26) and Show HN is closed to us — and neither can be re-fired soon, whatever the cause. The plan is now **automated + visual** channels: nightly auto-posting (§11), the gallery landing pages that channel needs (§4.3, shipped), directories, borrowed audiences. See §4.2.

---

## Progress & live status → see the hub

**This document is the *reasoning*. The live status, backlog, and who's-doing-what
live in the shared hub: [`GROWTH-PROGRESS.md`](GROWTH-PROGRESS.md).** Multiple agents
coordinate through that file — check it before starting, update it when you finish.
It's the single source of truth for state; the sections below explain the *why* behind
each item (referenced from the hub by number, e.g. "§10").

**Where things stand (summary — the hub has the itemized table):** the *conversion + analytics
foundation* is live (PostHog, OG cards, mobile email-link, demand probe), on-page SEO shipped,
and **the $15.99 lifetime tier shipped** (§10). **The launch bet was run and failed** — PH
returned 5 upvotes, Show HN is closed to us (§4.2) — so the site still has **~zero traffic and
zero conversion data**. The bottleneck remains **acquisition**, now attacked through
**automated + visual** channels: nightly auto-posting (§11), the **gallery landing pages** that
channel needs (§4.3, shipped 2026-08-03), directories (§4.4), borrowed audiences (§4.1). Note the
pages are *destinations for social*, **not** an SEO bet — nobody searches for a product they
don't know exists, so demand here has to be *generated*, not captured.

> ⚠️ **Hard planning constraint (2026-08-02): founder marketing time ≈ 0 h/week.** Every
> recommendation below must survive that filter. A tactic needing a daily or weekly human touch
> is a tactic that will not run — prefer things that **run themselves once built** or are
> **built once and pay forever**, and batch the irreducibly-human work (account creation,
> pitches sent in the founder's own name) into rare, bounded sittings. This is why §11's
> automation now outranks §4.1's manual posting.

> **New agent?** Read `CLAUDE.md` → **`docs/GROWTH-PROGRESS.md`** (state) → this doc
> (why) → `docs/launch-kit.md` → `marketing/README.md`.

---

## 1. Product, positioning & ideal customer

### The one-sentence positioning
> **"A new, curated piece of AI art on your Mac every day — as your screensaver and wallpaper."**
> Think *a curated daily art channel*, not "yet another wallpaper engine."

### Why positioning matters here
Every adjacent product is either a **free engine** (you bring/scroll for content) or a
**fixed library** (Aerial = Apple's drone footage). Your differentiator is **editorial
curation + daily novelty**. Lead with that everywhere; it's the only thing that justifies
a subscription (see §10) and the only thing competitors can't copy cheaply.

### Ideal Customer Profile (ICP)
Sharpening this focuses channel + message choices:
- **Aesthetic-minded Mac users** — the "nice desk setup," r/battlestations, cozy/ambient crowd.
- **Creatives & knowledge workers** — designers, writers, devs who stare at a screen all day and care how it looks.
- **AI-art-curious** — people who enjoy AI imagery but don't want to prompt it themselves.
- Disproportionately **US, Mac, higher willingness to pay** — exactly where Mac over-indexes.

Channel/message corollary: go where *aesthetic* people gather (Pinterest, IG, desk-setup
YouTube, r/macapps, r/battlestations), and sell the *feeling/look*, not the tech.

---

## 2. The core strategic thesis (and the math behind it)

### Why organic, not paid
- **LTV is tiny.** ~$0.99/mo gross, minus Stripe fees on a small charge, minus the free-user
  majority who never convert → realistic LTV per paying sub is maybe **$10–20**.
- **Paid CAC is large.** Clicks run **$0.50–$2+**, and you need many clicks → installs →
  free users → paying conversions. You'd likely pay **$20–50+ in ad spend per paying sub** —
  **underwater on every customer.**
- **Organic content is free and compounding.** Your marginal cost per "creative" (a new art
  clip) is ~zero, and a single post can pull traffic for months. This is a *structural*
  advantage most apps don't have. **Lean into the asymmetry.**

> Rule of thumb: paid acquisition only works when **LTV > ~3× CAC**. At $0.99/mo that's
> nearly impossible cold. Revisit paid only after (a) a higher-value pricing tier exists
> (§10) and (b) you have a proven, instrumented funnel to amplify (§13).

### The content flywheel
```
Nightly AI art generation (already built)
   → repackage to social formats (cheap)
   → post across platforms (free)
   → some clips catch the algorithm → audience grows
   → bigger audience sees tomorrow's art → flywheel accelerates
```

---

## 3. Metrics foundation — instrument before you scale (don't skip this)

You're about to pour effort into traffic. **If you can't measure it, you're flying blind.**
Set this up *first*; it's the cheapest high-leverage work on the list.

### North-star metric
Pick one. Strong candidate: **weekly active subscribers** (revenue + retention in one
number). Activation proxy in early days: **% of installs that complete a first sync and
set the screensaver.**

### The funnel to instrument (AARRR / "pirate metrics")
| Stage | Question | Track |
|---|---|---|
| **Acquisition** | Where do visitors come from? | Sessions by source (UTMs on every link/post) |
| **Activation** | Do they reach the "wow"? | Install → first art on screen ("time-to-wow"); set-as-screensaver rate |
| **Retention** | Do they keep using it? | D1/D7/D30 active; screensaver still set |
| **Referral** | Do they tell others? | Referral signups; "what's that?" share events |
| **Revenue** | Do they pay & stay? | Free→paid conversion %; **churn %**; MRR |

### Tooling (lightweight, privacy-friendly)
- **Website:** Plausible or PostHog (PostHog also does product analytics + funnels + flags).
- **App:** event logging you already have (logger.ts) → forward key events (sync done,
  screensaver set, subscribe-clicked) to PostHog or similar.
- **Attribution:** UTM convention on *every* outbound link (`utm_source`, `utm_medium`,
  `utm_campaign`) so you know which channel actually converts.

---

## 4. Acquisition channels (ranked by fit)

### 4.1 Content flywheel — social (primary, ongoing)
Your highest-leverage channel because it monetizes your free art.
- **The four channels, treated equally — post everything everywhere:**
  - **Pinterest** — query-driven discovery; strong for "desk setup" browsing.
  - **YouTube** — Shorts for reach, plus searchable long-form.
  - **Instagram Reels** — feed reach to an aesthetics-first audience.
  - **TikTok** — feed reach, plus in-app search as a growing discovery surface.
  - (**Reddit** is separate — a community, not an algorithmic feed; see `launch-kit.md` §3.)
  Each has a different discovery mechanism, and we have **no reliable data** on which converts
  for us. Don't rank them on hunches: post to all four, then let PostHog's UTM data say which
  earns its keep.
- **Volume strategy:** post *every* good piece to *every* platform. Each post is an
  independent shot at virality. Flood the channels — your content is free and infinite.
  **⚠️ At 0 h/week this only happens if it's automated.** Clips have existed since 2026-07-12
  and *none* has been posted — the whole argument for making §11's automation priority #1.
  Manual daily posting is not a plan; it's a wish.
- **Borrow audiences (the real accelerant):** the slow part is building your *own*
  following. Skip it — get featured by big "aesthetic/AI-art/wallpaper" repost accounts,
  and by "best Mac apps / desk setup" YouTubers/creators. One feature on a 500k account
  ≈ months of your own posting. Send them your best loops, free, credited.

### 4.2 Launch spikes — ❌ **run, failed, and demoted** (post-mortem)
> Copy + checklists live in **`docs/launch-kit.md`** — now an **archive/reference**, not a
> plan. **Live status → the hub (`GROWTH-PROGRESS.md`).**

**What happened.** PH launched **2026-07-26** with the full media kit and finalized copy →
**5 upvotes, 2 comments, no badge, no measurable traffic.** **Show HN never ran** — blocked at
submission (2026-08-02); HN reported it isn't accepting new Show HN posts amid a flood of
submissions. (Its published [`showhn.html`](https://news.ycombinator.com/showhn.html) says no
such thing, so read it as a temporary gate — but **nothing may depend on it reopening.**)

**Why it failed — we don't know.** PH gives us no impression data, so any ranking of causes would
be invention. Verifiable: we went in **with no audience** (no following anywhere, nothing ever
posted) and came out with ~0 traffic. Whether it was ever *featured* is worth checking — an
unfeatured launch is barely shown, the difference between "rejected" and "never seen."
**Resist tidy narratives; one uninstrumented data point supports none of them.**

**What it does NOT tell us.** It says **nothing about product demand or pricing.** With ~0
sessions, the funnel (§3, §5) has still never been exercised — no download rate, no activation
rate, no free→paid rate. Do not "fix" conversion or reprice in response to this; the input
variable was traffic, and it was zero. See *A note on validation* in §15.

**Consequences** — these hold regardless of *why* it flopped:
- **Launch spikes leave the critical path** because they're no longer *available*: PH isn't
  re-runnable for months (a fresh launch needs a substantially updated product, historically
  ~6 months apart — verify) and Show HN is closed. A channel we can't fire can't be a plan.
- **Reddit is still un-run** and has neither problem: postable today, repeatable across subs,
  threads that rank for years (§4.1). ~20 min; do it once the always-on channels are live.
- **Anything one-shot is a bonus, not a bet.** The channels below are ranked on whether they
  keep producing after the day you ship them.

### 4.3 Gallery pages — ✅ **shipped 2026-08-03, as *social landing pages***

**Dropped, then un-dropped the same day.** The SEO case for these pages is weak and stays weak.
The reason to build them is different and stronger: **the social channel has nowhere to send
people.**

**Why they're needed (this is a distribution argument, not a search one):**
- **Every social post needs a destination.** All four channels (§4.1) link out, and 262
  posts all pointing at one homepage is weak distribution and reads as spam; a page per piece
  gives every post a unique, relevant landing spot.
- **Every clip we post can currently only link to the homepage.** A piece page converts better
  and is the §5 "instant on-site preview" done properly — see the art before installing.
- **No new exposure risk:** everyone already browses the full gallery in-app and the MP4s are
  public on R2 (see *Where gating happens* in `CLAUDE.md`).

**What's still true from the drop (don't re-inflate the SEO case):**
- We won't rank for "best mac screensaver," and probably not for bare movement names either —
  "Nihonga", "Peredvizhniki" are informational queries owned by Wikipedia and museums, and our
  pieces are **AI homages**, not the real works. Expect long-tail modifiers at best
  ("nihonga wallpaper"), which is a much smaller claim than "the long tail is winnable."
- **~300 AI-generated pages is close to what Google's scaled-content systems demote**, and a
  penalty would hit the whole domain — including the brand-name SEO that *does* matter. Pages
  can serve Pinterest perfectly well while `noindex`ed: **if destinations are the goal, Google's
  opinion is optional.** Decide indexing deliberately, per tier.
- Cost isn't zero: descriptions and poster frames add steps to the nightly pipeline that
  generates the product. New failure modes against a 0 h/week budget.

**Scope (measured 2026-08-03 against `gallery.json`):**

| Tier | Count | Verdict |
|---|---|---|
| `/art/<slug>` | **262** | ✅ build — the destinations Pinterest and every clip need |
| `/era/<tag>` | **15** (avg 17 pieces) | ✅ build — solid, non-thin browse surface |
| `/gallery` index | 1 | ✅ build |
| `/style/<movement>` | **203 labels, 158 of them singletons** | ⏸️ defer — one page per raw label is thin by construction; needs grouping into ~60 curated buckets first |

**Also:** 126 of 262 pieces have no `img` poster. Posters are needed for OG cards and
lazy-loading — but **media doesn't get committed** (`CLAUDE.md` → Repo rules); posters belong in
R2 with the URL in `gallery.json`, and that's a founder-approved step, not an agent one.

**Success metric: social → site UTM clicks, not search rankings.** Sequencing: **build the
destinations before the first pins go out** — pins can't be re-pointed later.

**What shipped (2026-08-03).** 283 new static routes: 262 `/art/<slug>`, 15 `/era/<tag>`, and a
6-page `/gallery` index, all prerendered from `gallery.json` at build time — so the nightly
curation push to `master` grows the routes *and* the sitemap with no extra step. Three calls
worth remembering:

- **Slugs are permanent by construction.** Derived from the immutable R2 object key, never the
  title (curation edits titles), and never from catalog position — because **a pin's destination
  URL cannot be edited after posting**, so a slug that drifted would 404 every pin ever made. A
  test over the real data fails the build if two keys ever collide.
- **Indexing: `/gallery` + `/era/*` are indexable; `/art/*` ships `noindex, follow`.** Exactly
  the "if destinations are the goal, Google's opinion is optional" call above — Pinterest doesn't
  care, and 262 pages of generated art *and* generated prose is the shape scaled-content systems
  demote. One constant (`INDEX_ART_PAGES` in `lib/gallery-catalog.ts`) flips the meta tag and the
  sitemap together.
- **Descriptions are templated, not written, and not prompt dumps.** Built from title/movement/
  era/date plus 15 hand-written era paragraphs. The `image_prompt`/`video_prompt` fields are
  deliberately unused: they're machine instructions ("static camera", "no morphing") and 61
  pieces have none. Good per-piece prose needs an offline pass writing a `description` field into
  `gallery.json` — **data, not a build-time model call.** Still open.

**Still open:** the poster gap (77 pieces have no still anywhere, so their tiles render on a
gradient — needs founder-approved stills on R2, not in git) and the per-piece prose above.

### 4.4 Press & directories (one-time work, permanent backlinks)
Screensaver apps are rare enough to be newsworthy, and every listing is both a trickle of intent
traffic *and* a backlink that helps §4.3.
- **Directories (batchable, first):** **alternativeto.net** (under Aerial — the highest intent
  here), **MacUpdate**, plus indie/app directories. An agent preps the whole pack — blurbs at
  each site's length limit, screenshots, categories, links — so the founder pastes it in **one
  sitting**.
- **Press:** 9to5Mac, MacStories, Cult of Mac, MacRumors. Pitch the *story* (a screensaver that
  generates and curates new art nightly), not the product; include the launch video.
- **Community:** the **Aerial / PaperSaver** community is your ICP and you build on their
  tooling — show up as a builder, not an advertiser.
- **Also §4.1's "borrow audiences"** — creators and repost accounts. The one high-leverage
  channel that can't be automated (it needs the founder's name), so the agent job is reducing it
  to "review and send": target list, `/press` kit page, drafts.

### 4.5 Ecosystem distribution — **Option B** (see Appendix A)
Publish free **curated art sample packs** into Wallpaper Engine Workshop + Lively to borrow
their 20–50M-user traffic, funneling the curation-lovers to your app. Near-zero cost
(reuses nightly art). **Full plan in Appendix A.**

### 4.6 Owned channels — email/newsletter (under-rated; build the list from day one)
The **one channel you own** and that no algorithm can throttle:
- **"Art of the week/day" email** — doubles as *content*, *retention*, and *acquisition*
  (forwardable, shows the daily-fresh value prop in action).
- Capture emails *everywhere*: the Windows waitlist, the "email me the Mac link" flow,
  a homepage newsletter opt-in. An email list is an appreciating asset; start now.

### 4.7 Mac App Store as a *discovery* channel (evaluate, don't assume)
You distribute via notarized DMG today. The **Mac App Store** is a search/discovery surface
many Mac users browse. Trade-offs to weigh: Apple's 15–30% cut, IAP requirement for the
subscription, and sandbox/extension constraints (your `.appex` is already sandboxed, but
MAS rules differ). Not urgent, but it's a *passive discovery* channel worth a feasibility
check once the funnel converts.

---

## 5. Conversion & capture — stop the funnel from leaking
Earned traffic is wasted if the site doesn't convert it. These are mostly **website code**
tasks (high ROI; a 2× conversion lift ≈ 2× the traffic, for far less effort):

> **Status:** the capture layer below is ✅ **live** — with one change from the original
> plan. We did **not** ship OS-detection + a Windows-only waitlist (detecting platform
> risked mislabeling a Mac user → bounce, a very-high-cost error). Instead:
> a universal **self-report demand probe** ("Want it on Windows / iPad / iOS / TV?") that
> lets visitors pick the platforms they want — safer *and* richer (multi-platform intent).
> It's **PostHog-only** (no backend): `components/marketing/platform-interest.tsx`.

- **Device-aware Download CTA:**
  - **Mac / desktop** → "Download for Mac." ✅ live
  - **Phone** → **"Email me the Mac download link"** → the cross-device bridge so mobile
    interest survives to the desktop (see §6). ✅ live
  - **Cross-platform demand probe** (all visitors) → the self-report vote above, replacing
    the old "detect Windows → waitlist" idea. ✅ live
- **Rich link previews (Open Graph / Twitter):** ✅ live — a branded card so every shared
  link unfurls beautifully (`app/opengraph-image.tsx`). Multiplies social reach for free.
- **Instant on-site preview:** let visitors *see the art moving* before downloading
  (you already have `index.html`); show the value before asking for the install.
- **Friction audit:** minimize steps from landing → installed → first art on screen.

---

## 6. The mobile→desktop handoff problem (a desktop product on mobile-first channels)
Real friction: a busy person sees your art on a phone, but must later switch to a Mac to
download. **Reframe the mobile post's job:** not an immediate download, but (1) **brand
recall** and (2) **intent capture off the phone**. Tactics:
- **Capture the email on mobile, deliver the link to desktop** (the "email me the Mac link"
  flow). Don't rely on memory — convert hot intent into an inbox item waiting at their Mac.
- **The email bridge is what makes mobile channels work.** With "email me the Mac link" live, a
  phone-first platform is no longer a handicap — hot intent converts into an inbox item waiting
  at their Mac. Don't discount a channel for being mobile.
- **Win the name search** (brand SEO) — recall fires as "living art screensaver" in Google.
- **Reassurance:** your audience is *Mac users*, disproportionately scrolling *at a desk with
  the Mac right there*. The gap is narrower for your ICP than for most products.

---

## 7. Activation — the first 5 minutes decide everything (we hadn't covered this)
Acquisition is wasted if new users don't reach the "wow." For this product the wow is
**beautiful art actually playing on their screen.** Optimize **time-to-wow**:
- Minimize steps between install and first art on screen (sync speed, sensible defaults,
  the free pieces selected by default — already done).
- The one-click **"Set" banner** is critical activation UI — make sure it's prominent and
  the post-set status banner closes the "now what?" loop (already built; keep it tight).
- **Instrument activation** (install → first sync → screensaver set). If users drop between
  install and "set," that's your highest-ROI fix — more valuable than more traffic.

---

## 8. Platform expansion — Windows (don't build it first)
> **Status:** 🅿️ parked, **as planned** — pending real demand. Instead of guessing from the
> market-share numbers below, the site now *measures* it via the self-report demand probe
> (§5). Decide Windows from the PostHog `platform_interest_*` data, not the chart.

- **The numbers:** Windows is ~60% of US / ~63–72% of worldwide desktop; macOS ~23% US /
  ~15–16% worldwide. So Windows is the *majority* of who'll *see* your content.
- **But it's the worse minority to chase first:** Windows users expect screensaver/wallpaper
  apps to be **free** (Lively, Wallpaper Engine), the screensaver category is effectively
  **dead on Windows**, and building it is **weeks** of native `.scr` + signing + a new QA
  matrix — *before you've validated demand on the platform you already ship.*
- **Because organic content is free, "wasted" Windows impressions cost $0** (unlike paid ads,
  where targeting the wrong OS wastes money). So don't pre-build for them — **capture them:**
  the **Windows waitlist** turns that majority into *measured demand* + a Day-1 launch list.
- **Decision rule:** build Windows when the waitlist (or live demand) justifies it — not
  because of the market-share chart.

---

## 9. Retention & churn — the silent killer of subscriptions (we hadn't covered this)
For a subscription business, **keeping** subscribers matters as much as getting them. A
$0.99/mo product with high churn never compounds.
- **Your retention mechanism is the product promise: daily-fresh, curated art.** Protect the
  pipeline quality — stale/ugly art is churn. (You have the curation skill; keep the bar high.)
- **Lifecycle email:** onboarding sequence, "new this week" nudges, and **win-back** flows for
  lapsed subscribers ("here's what you've missed — come back").
- **Measure churn explicitly** (monthly + the quarterly-billing cliff). Watch for the renewal
  drop at the 3-month charge.
- **Make the value visible:** the in-app "new today" surfacing reminds people *why* they pay.

---

## 10. Monetization & pricing — 🅿️ **settled for now; don't reopen without traffic**
> **Founder call, 2026-08-02: pricing is no longer a priority** now that the lifetime tier
> ships. Dropped from the TL;DR. The reasoning below is kept as background for whenever
> conversion — not acquisition — is the constraint.
The single clearest signal from all our market research: **this category pays *one-time*,
not subscription.** Wallpaper Engine = $4.99 once (20–50M owners). Lively = free. Aerial =
free. Paid Mac screensavers (Bauhaus Clock $19) = **one-time**. A **$0.99/mo subscription
swims against the category's grain.**

> ✅ **Shipped 2026-07-18 (PR #70): the $15.99 one-time "Own it forever" tier**, sold beside the
> $0.99/mo (billed quarterly) subscription; buying lifetime auto-cancels a running subscription
> so nobody double-pays. **Not being pursued:** the annual plan and the trial idea below.
>
> ⚠️ **None of it has been *tested*.** Pricing is a *conversion* lever and there is no
> conversion data at ~0 sessions (§4.2). **Don't iterate on price in response to the failed
> launch** — re-open this when a channel actually delivers traffic.

This doesn't mean kill the subscription — it means **test pricing structures**, because it's
likely your highest-impact conversion lever *once traffic exists*:
- **Add an annual plan** (e.g. ~$9.99/yr) — reads as cheaper, cuts churn, fits "I'll pay once
  a year" psychology. **Still not built.**
- ~~**Add a lifetime / one-time tier**~~ — ✅ **done at $15.99.** It *matches the category's
  mental model*: many who'd never start a subscription will happily pay once. (Yes, it forgoes
  recurring revenue from those users — but it captures buyers you'd otherwise lose entirely.)
- **Reconcile with the "daily-fresh" wedge:** the subscription's justification is *ongoing*
  new art; a lifetime tier could still include daily art, or you position lifetime as
  "the app + current gallery" and subscription as "+ new art forever." Design the fence
  deliberately.
- **Consider a free trial of the *full* gallery** (time-boxed) so users feel the whole value
  before the wall — often lifts conversion vs. a pure freemium lock.
- **A/B test price points and structures** once instrumented (§3). At $0.99/mo, small
  conversion improvements dwarf almost everything else you can do.

> This deserves a dedicated experiment early. It's cheap to try (Stripe Price changes +
> UI copy) and potentially the difference between a viable and non-viable business.

---

## 11. Build vs. buy — the "agentic marketing engine"
You can largely automate the content flywheel off your existing nightly pipeline.
- **(A) Asset step — ✅ BUILT.** `marketing/make-social-assets.mjs` (+ `marketing/README.md`):
  ffmpeg reframes each piece 16:9 → 9:16 + 1:1 (blurred-fill, never cropped) with a subtle
  wordmark, loops to length, and writes per-platform starter captions. No npm deps. Run
  `node marketing/make-social-assets.mjs --latest 4` after the nightly curation batch.
  (Captions are template-based today; upgrading to Gemini is a noted easy win.)
- **(B) Distribution — BUY, and ✅ WIRED 2026-09-07.** `marketing/post-social.mjs` publishes one
  rendered piece a night to all four channels and hangs off the nightly curation run
  (`curation/AUTOMATED_CURATION.md` step 8). Verified with real posts on all four
  (see the hub's activity log). Vendors: §11.1. **$0/mo to start.** *Critical reason to buy, not build:*
  **TikTok's Content Posting API restricts *unaudited* API clients to private posting.** Lifting it needs a separate Content Posting API audit (~1–2 weeks) that requires
  demonstrating a compliant UI with privacy/comment/duet toggles — a UI we don't have and would
  have to build. Instagram/YouTube/Pinterest add their own app review on top. Vendors holding
  their *own* audited client sidestep all of it; building the raw posting/OAuth layer = months
  of compliance for one app's marketing. Don't.
- **(C) Agentic layer — optional BUILD, 90% covered cheaply.** Captions are now drawn from
  variant pools keyed by a hash of the piece + platform (`marketing/lib/captions.mjs`):
  deterministic, so a retry republishes byte-identical copy, but no two nights read alike —
  which is the actual problem a daily cadence has with one fixed template. A nightly Gemini
  call for genuinely per-piece copy remains the upgrade, now worth ~half a day, not one.
- **Total: ~3–4 days of build + $0/mo to start, ~$16–24/mo once IG + YT leave the free tier**,
  hanging off the nightly job → near-unattended daily multi-platform marketing.
- **Keep a human in the loop ~2 min/day** (reply to comments, add a trending sound). The reason
  is **capability, not algorithm** — a distinction worth getting right, because the folklore
  version ("schedulers get throttled") is false. Platforms deny ranking API posts differently:
  Instagram's head Adam Mosseri, asked directly, said scheduled posts "will not affect your
  reach in one way or another," and Meta runs the Content Publishing API *as* the supported way
  to publish from outside the app. What the APIs genuinely **cannot** do is attach a platform's
  native/trending audio — music licensing keeps those libraries app-only ([Zernio's docs](https://zernio.com/blog/tiktok-posting-api):
  Creator's Draft exists because "the API can't add those, only the app can"; IG's Graph API
  strips or rejects licensed tracks) — and audio *is* a discovery surface.
  **⚠️ But the trending-audio play is mostly closed to us — we are a commercial account.**
  Verified 2026-08-02; this is the finding that should drive the workflow:
  - **YouTube** — *"Channels that upload videos for commercial purposes … may see errors when
    uploading Shorts containing sounds from the Shorts Audio Library,"* because of *"agreements
    with some music partners, which restrict use of music in Shorts to personal and
    non-commercial uses"* ([Common uploading errors](https://support.google.com/youtube/answer/10383400?hl=en)).
    Independently, the post-upload route is blocked outright: *"You cannot use music or other
    sounds from our Audio Library on Shorts you create from your videos"*
    ([Create Shorts from your videos](https://support.google.com/youtube/answer/12836917?hl=en)).
  - **TikTok** — Business accounts are restricted to the **Commercial Music Library** and cannot
    use trending sounds in promotional content; the personal-library licences don't extend to
    commercial use. Assume Reels carries an equivalent restriction (**unverified — check before
    relying on it**).
  - What remains available is **commercially-cleared catalogue** music (YouTube's royalty-free
    Audio Library, TikTok's Commercial Music Library). Legal and free, but it carries **none of
    the trending-sound discovery benefit** — that surface is exactly the part we can't licence.

  **So the operational answer flips:** run **all four channels unattended**, and spend the ~2
  min/day on **replying to early comments** — unrestricted, and the part with well-evidenced
  value. Never build a draft-mode workflow around trending audio: the licensing, not the tooling,
  is the blocker. Sound pages are real (YouTube runs a
  [Top Shorts Songs chart](https://charts.youtube.com/charts/TopShortsSongs/us/daily)) — we just
  can't legally reach them at commercial scale. **Our audio answer is §11.2.**
  **Pinterest is unaffected either way:** it advises against relying on audio (much of its
  audience views sound-off), has retired music on new Pins, and Pins are evergreen.

### 11.2 Audio:  AI-generated music — ✅ **skill built 2026-08-23**
Score the social clips with background music generated by Google's Lyria API. Come up with a short prompt (less than 20 words) that describe a pieces of music that fits the visual content well, and use that prompt in the API request.

**Use the `lyria-music-gen` skill** (`.claude/skills/lyria-music-gen/`) — one call, prompt in,
MP3 out, on the existing `GEMINI_API_KEY`. `--model clip` ≈30s (beds), `pro` ≈3min.

⚠️ **Lyria sings by default.** Verified: "a warm, nostalgic song about a summer evening" returns a
fully sung track with its own lyric sheet. **Put "instrumental, no vocals" in the prompt.** The
skill warns before spending a call and fails after one if it detects lyrics, so automation can't
ship vocals by accident.

**✅ Wired 2026-09-07.** `make-social-assets.mjs --audio` loops a bed under the clip at **−9 dB**
with a 1 s / 1.5 s fade, and `marketing/make-beds.mjs` generates the library. The call that
mattered: **a small library reused across clips, not a track per clip** — five beds, picked
deterministically per piece. Nobody watching a nightly feed can tell tonight's bed also played
last Tuesday, so per-clip generation would be a standing API bill for an imperceptible
difference. **The MP3s live on R2, never in git** (`CLAUDE.md` → Repo rules); `marketing/beds.json`
commits only the id, the prompt and the URL, and the audio is cached locally on first use.

### 11.1 Vendor decision (2026-08-02) — split across two, consolidate later

| Channel | Vendor | Cost at our footprint |
|---|---|---|
| Instagram Reels + YouTube Shorts | **upload-post** | free tier → $24/mo ($16 annual) |
| TikTok + Pinterest | **Zernio** (ex-`getlate.dev`) | **$0** — first 2 accounts free, unlimited posts |


**Rationale:** both have a free entry point, so we run them in parallel, learn which API and
which channels actually earn their keep, and **consolidate onto one later** — the glue is a thin
REST wrapper either way, so switching costs an afternoon. The split also lines up with each free
tier: Zernio's 2 free accounts exactly cover TikTok + Pinterest (TikTok being the one channel
upload-post gates behind a paid plan), while upload-post's free tier covers IG + YT.

**What each free tier actually covers** — checked against the live accounts and each vendor's
own docs on 2026-09-07, while wiring the poster:

- **upload-post free = 10 uploads/month, 2 profiles, and no TikTok.** (A "profile" is one
  account *per platform*, so our single profile carries IG + YT together; the free platform
  list is Instagram, LinkedIn, YouTube, Facebook, X, Threads, Pinterest, Reddit, Bluesky.) At
  one piece a night that is **two uploads a night → the free month is spent in five days**, so
  ⚠️ **IG + YT go dark around day 6 until this converts to Basic, $24/mo ($16 annual, unlimited
  uploads, 5 profiles, TikTok included).** This is the one recurring cost the plan has, and the
  first thing to check if the posts stop.
- **Zernio free = the first 2 connected accounts, unlimited posts, full API** — which is exactly
  TikTok + Pinterest, so that half is durably $0. (The account is now on Zernio's usage-based
  billing, `planName: "Usage-Based"`, with unlimited uploads/profiles and $5 of credit sitting
  unused; at two accounts nothing is billable.) Paid accounts start at $6/mo each for 3-10.
- **Zernio posts publicly to TikTok — ✅ confirmed twice**: the founder's live test (2026-08-23)
  and the automation's own first post (2026-09-07). Its client is audited; nothing about the
  four-channel plan is contingent.

One gotcha worth recording, since it cost a failed post: **Zernio's `/media/upload-direct` is
documented at 25 MB but sits behind a serverless function that rejects anything over ~4.5 MB**
(`FUNCTION_PAYLOAD_TOO_LARGE`), and a 12 s 1080×1920 clip is ~12 MB. The poster uses the
presigned-upload path (5 GB) instead.

**Others researched** — prices verified 2026-08-02 against each vendor's live pricing page
(several secondary/blog sources were stale by 2–3×):

| Vendor | Entry price | Billing unit | TikTok public post | Verdict |
|---|---|---|---|---|
| **upload-post** | free (10 uploads/mo, no TikTok) → **$24/mo**, $16 annual, unlimited | **profile** = one account *per platform*; all platforms included | ✅ own audited client | **chosen** — IG + YT |
| **Zernio** | **free** for 2 accounts → $6/mo each (3–10), $3 (11–100) | connected account | ✅ verified by live test | **chosen** — TikTok + Pinterest |
| Blotato | $29/mo (20 accounts) | account | ✅ | ❌ API excluded from the 7-day trial |
| Postiz | $29/mo hosted; free self-host | channel | ❌ BYO developer app | ❌ we'd inherit the audit |
| Ayrshare | $149/mo (1 profile) | profile (≤13 networks) | ✅ | ❌ ~4× budget; built for multi-tenant SaaS |

---

## 12. Built-in virality & referral (we hadn't covered this — and it's a natural fit)
A screensaver/wallpaper is **a publicly visible product** — others see it over your shoulder,
in cafés, on screen-shares and Zoom backgrounds. That's organic "what's *that*?" demand baked
into the product. Amplify it:
- **Referral program** — "give a month, get a month" (or give a friend free time). Cheap,
  and word-of-mouth is your best-converting channel.
- **Shareable export** — let users export/share a favorite clip *with subtle attribution* →
  turns every user into a distributor (and feeds your social channels with UGC).
- **Make the brand glanceable** — a tasteful, non-intrusive mark so the over-the-shoulder
  viewer can find it. (Balance against not marring the art.)

---

## 13. Paid acquisition — when (not now) and how to test
- **Not your focus** at $0.99/mo (§2 math). 
- **If/when you test it:** cap a **small learning budget ($100–200 total)**, *boost a proven
  organic winner* (don't run cold creative), prefer **Reddit ads** (narrow Mac subs) over
  Google Search (nobody searches "buy a screensaver"). Track one number: **cost per paying
  sub.** If a $150 test can't get it under ~$10–15, paid doesn't work at this price — expected
  outcome until a higher-value tier (§10) exists.

---

## 14. What NOT to do (anti-patterns & risks)
- ❌ **Don't make paid ads the primary channel** — underwater unit economics at $0.99/mo.
- ❌ **Don't build Windows first** — weeks of work before validating demand; capture a
  waitlist instead.
- ❌ **Don't pivot to a wallpaper *engine*** — bigger market, but free/$5 and moated by
  Wallpaper Engine + Lively; your subscription dies there. Distribute *into* it (Option B).
- ❌ **Don't build the raw social-posting/OAuth/audit layer** — buy an aggregator.
- ❌ **Don't expect a smooth organic ramp** — it's slow then non-linear (see §15). Don't quit
  in the quiet weeks; that's normal, not failure.
- ❌ **Don't pour traffic into an uninstrumented funnel** — set up analytics first.
- ❌ **Don't let curation quality slip** — stale/ugly art breaks the one promise people pay for.
- ❌ **Don't stake the plan on a one-shot channel you can only fire once** — PH returned 5
  upvotes and can't be re-run for months; Show HN closed before we reached it (§4.2).
- ❌ **Don't read a failed launch as a failed product** — traffic was the zero input; conversion
  and pricing were never exercised. Fix the input before touching anything downstream.
- ❌ **Don't over-explain a single uninstrumented data point** — we can't see why PH flopped, so
  any ranked list of causes is a story, not a finding.
- ❌ **Don't plan tactics that need a recurring human chore** — at ~0 h/week they silently don't
  happen. The social clips sat unposted for three weeks; that's the proof, not a hypothetical.

---

## 15. Market context (the research, summarized)
| Market | Reach | Price norm | Key incumbent(s) | Takeaway for us |
|---|---|---|---|---|
| **Live wallpaper** | **20–50M** (Wallpaper Engine), 14M+ (Lively) | **$5 once / free** | Wallpaper Engine (+ Workshop moat), Lively | Huge but commoditized & moated → *distribute into it*, don't compete as an engine |
| **Mac screensaver** | Niche; ~$1.5B category, ~10M premium-sub users, 5–7% CAGR | **Free / one-time** | **Aerial (free**, Apple footage only) | Smaller, less commoditized; Aerial can't do *curated AI art / daily-fresh* → real differentiation |
| **Desktop OS base** | Win ~60% US / 63–72% WW; Mac ~23% US / 15–16% WW | — | — | Win is the majority *seeing* content, but the worse-monetizing minority to *build* for first |

**The throughline:** every adjacent market prices **free or one-time**, your wedge is
**curation + daily-fresh**, and your **subscription model is the recurring risk** to validate
(via real Mac traffic + pricing experiments — §10), not via more web research.

### A note on validation (desk research vs. real demand)
- **Desk/market research** (web search) answers *"does the category exist, do people pay at
  all?"* — useful to avoid traps. ✅ Done.
- **Demand validation** answers *"will real people pay **you**, at **your** price, via **your**
  funnel?"* — only live traffic can. Category averages never predict an individual product's
  conversion.
- **Good news:** validating Mac demand needs **zero new build** — the app already ships. Point
  the (free) marketing at it and read the subscribe rate. Desk research and live validation
  aren't substitutes; here, live validation is nearly free anyway.
- **Update 2026-08-02 — we still haven't validated anything.** The launch (§4.2) delivered no
  measurable traffic, so the funnel has never been exercised: **no download rate, no activation
  rate, no free→paid rate.** Until a channel puts real sessions through the site, every
  downstream question — price, copy, onboarding, Windows — is unanswerable.

---

## 16. Phased roadmap (sequencing — impact × effort)
_(✅ done · 🔨 built, not used · ⏭️ next · 🅿️ parked — mirrors the Progress snapshot.)_

**Re-sequenced 2026-08-02** after the launch failed (§4.2), under a **≈ 0 h/week** budget. The
old Phase 1 ("manual posting, then the launch spikes") is retired: the launch is spent and
*manual* was never going to happen. New ordering: **automate → compound → batch the human bits.**

**Phase 0 — Foundations:** — ✅ **complete**
- ✅ Analytics + north-star (§3). ⏭️ *still todo:* a UTM convention on outbound links.
- ✅ Conversion capture: device-aware CTAs, "email me the Mac link", demand probe, OG cards (§5–6).
- ✅ On-page + brand SEO basics (§4.3). ✅ Lifetime pricing tier (§10).
- ❌ Launch spikes — run and failed; **out of the critical path** (§4.2).

**Phase 1 — Always-on acquisition (current focus):** everything here runs unattended or is built
once and never touched again.
- ⏭️ **Posting automation** (§11 B/C) — clips have existed since 2026-07-12 and have **never been
  posted**. The item that most directly answers the 0 h/week constraint.
- ✅ **Gallery landing pages** (§4.3) — 262 `/art/<slug>` + 15 `/era/<tag>` + a paginated
  `/gallery`, shipped 2026-08-03. Destinations for the pins, not an SEO bet.
- ⏭️ **Directory submissions** (§4.4) — agent preps, founder pastes once.
- ⏭️ **Press + creator outreach** (§4.1/§4.4) — reduce to "review and send."
- ⏭️ **Reddit** — never run, ~20 min (`launch-kit.md` §3).

**Phase 2 — Compound what works (once Phase 1 delivers sessions):**
- 🅿️ Option B ecosystem packs (Appendix A) — one-time publish into a 20–50M-user surface.
- 🅿️ Email list / "art of the week" (§4.6) — **only if the send automates off the nightly job.**
- 🅿️ Lifecycle/retention email + win-back (§9) — needs users first.

**Phase 3 — Optimize & expand (genuinely blocked on traffic):**
- 🅿️ **Pricing** — closed: lifetime ✅ shipped, further experiments de-prioritized (§10).
- 🅿️ Referral program + shareable export (§12).
- 🅿️ Evaluate Mac App Store discovery (§4.7).
- 🅿️ Build **Windows** *iff* the demand-probe data justifies it (§8).
- 🅿️ Consider paid-ads test *only* after a proven funnel (§13).

---

## 17. Open decisions for the founder
1. **Email infra:** Supabase/Resend/other? Blocks §4.6 + §9 — and the newsletter only clears the
   0 h/week bar if the send automates off the nightly job.
2. **One batched chore:** create the upload-post + Zernio accounts and connect IG/YT/TikTok/
   Pinterest, so an agent can finish the posting automation.
3. **Was the PH launch ever *featured*?** — unfeatured is near-invisible; changes how the
   5-upvote result reads (§4.2).
4. **Brand mark in art:** how visible? (virality vs. purity — §12.)
5. **North-star metric:** confirm "weekly active subscribers" or pick another.
6. ~~Aggregator choice~~ ✅ 2026-08-02 (§11 B) · ~~pricing~~ ✅ closed 2026-08-02 (§10).

---

## Appendix A — Option B: Borrow the Wallpaper Ecosystems (Distribution, not Pivot)

> **One line:** Your moat is the *curated, daily-fresh AI art*, not the rendering engine.
> So publish **free sample art packs** into the giant live-wallpaper ecosystems
> (Wallpaper Engine Workshop, Lively) as a **top-of-funnel channel** that pulls
> their 20–50M users toward the Living Art app — without rebuilding the product
> to compete as one of their engines.

### A.1 Why this play (the strategic logic)

| Market | Reach | Price expectation | Implication for us |
|---|---|---|---|
| Live wallpaper (Wallpaper Engine) | 20–50M lifetime owners | $4.99 once + free Workshop | Huge audience, but commoditized to ~free; a subscription can't win *here* |
| Live wallpaper (Lively) | 14M+ downloads | Free / open source | Same |
| Mac screensaver (Aerial) | The free default | Free (Apple aerial footage only) | Free incumbent, but **no AI art, nothing fresh daily** |

The big markets are **un-monetizable at our price** but **enormous in traffic**.
The right move is to treat them as **distribution**, not as a market to win:
go where the millions already are, hand them a taste of our *differentiator*
(curation + freshness — the one thing the chaotic free libraries lack), and
convert the subset who value that into app installs.

This reuses art we **already generate nightly** (Veo / Nano Banana pipeline), so
the marginal cost of trying it is near zero.

### A.2 What we publish (the "free sample pack")

A small, curated, **time-boxed** set — *not* the whole gallery — so the pack is a
trailer, not the product:

- **8–15 of our most scroll-stopping pieces.** Quality over quantity; this is a
  highlight reel.
- **Free, locked-tier pieces only** — never ship subscriber-only art into a free
  channel (it undercuts the paid tier and leaks the perk). Pull only from the
  `free: true` set in `gallery.json`.
- **Formatted to each host's expectations:**
  - *Wallpaper Engine Workshop:* video wallpapers (mp4), landscape 16:9, looping.
    Workshop supports a "collection" so all pieces sit under one branded entry.
  - *Lively:* mp4/webm; ships as a downloadable wallpaper or a small pack.
- **Branding, lightly:** a tasteful "Living Art" wordmark in a corner or on an
  end-card, plus the pack title/description carrying the hook + link (see below).
  Do **not** plaster watermarks across the art — the beauty is the conversion
  driver; don't kneecap it.

### A.3 The hook (copy that drives the cross-over)

The pack's *title + description* is the ad. Lead with the one thing these
ecosystems can't give from their free dumps — **curation + daily-fresh**:

> **Living Art — Curated AI Art (Free Sample Pack)**
> A hand-picked taste of Living Art. The full app delivers a **new, curated AI
> artwork every day** as your Mac screensaver & wallpaper — no endless scrolling
> through thousands of random files. Get it free at livingartscreensaver.com.

Notes:
- Name first, URL second (brand recall > URL memorization — searchable name wins).
- Quantify the freshness ("new piece every day") — that's the subscription reason.
- Keep it honest: it's a *sample*; the app is where the daily stream lives.

### A.4 The funnel (mobile/desktop/OS handoff already solved in §5–6)

```
Wallpaper Engine Workshop / Lively  (20–50M users browsing free wallpapers)
        │  free sample pack + hook copy
        ▼
   livingartscreensaver.com  (landing)
        │  OS-aware CTA:
        │   • Mac visitor → "Download for Mac"
        │   • Windows/other → "Windows version? Join the waitlist"  (measures demand)
        │   • Phone        → "Email me the Mac download link"        (cross-device bridge)
        ▼
   Living Art app install → free tier → daily curated art → subscribe
```

The OS/device-aware capture flows (Windows waitlist + "email me the link") are the
companion build that makes this traffic *not leak* — see §5–6. Without them, Workshop
traffic that happens to be on Windows or on a phone is wasted; with them, it's
**measured demand**.

### A.5 What this is NOT

- **Not** shipping our engine/app into Steam. We're publishing *content packs*,
  not competing as a wallpaper engine (suicidal vs. free Wallpaper Engine + Lively).
- **Not** the whole gallery. A trailer, not the film.
- **Not** subscriber-only art. Free-tier pieces only.
- **Not** a substitute for validating Mac conversion — it's a *traffic source* that
  feeds the same existing funnel we're validating.

### A.6 Risks & mitigations

| Risk | Mitigation |
|---|---|
| Workshop/Lively TOS on promo links / external CTAs | Check each platform's content rules before publishing; keep promo tasteful and in description, not spammed across the art. |
| "Free art" cannibalizes the app | Cap at a small, fixed highlight set of already-free pieces; the value prop is *daily fresh + curation*, which a static pack can't replicate. |
| People rip the mp4s | They're already public on R2; the pack is intentionally free art. No new exposure. |
| Low cross-over rate | It's near-zero cost (reuses nightly art). Measure pack views → site visits via a UTM'd link; kill or scale based on data. |

### A.7 Measurement (so we learn, not just post)

- Use a **dedicated UTM'd URL** in each pack (e.g. `?utm_source=wallpaper_engine`,
  `?utm_source=lively`) so site analytics attributes the traffic.
- Track the chain: pack views/subscribers (Workshop gives counts) → UTM site
  sessions → installs → subscriptions.
- Decision rule: if a pack drives meaningful UTM traffic at ~zero cost, expand
  (more packs, refreshed monthly). If not, it cost us a few hours of repackaging.

### A.8 Concrete first step (smallest viable test)

1. Pick **10 of the best `free: true` pieces** from `gallery.json`.
2. Repackage to 16:9 looping mp4 (already the source format) + a simple end-card
   wordmark.
3. Publish **one** Wallpaper Engine Workshop collection + **one** Lively pack with
   the hook copy and a UTM'd link.
4. Wait 2–4 weeks; read the UTM traffic; decide expand vs. drop.

This can be largely automated off the existing nightly pipeline later (auto-build
a monthly "best of" pack), but the first one should be hand-curated to set the
quality bar.

---

## Sources (market research, June 2026)
- Desktop OS share: [StatCounter US](https://gs.statcounter.com/os-market-share/desktop/united-states-of-america), [StatCounter WW](https://gs.statcounter.com/os-market-share/desktop/worldwide/), [macOS trend](https://www.accio.com/business/macos-market-share-trend-over-time)
- Live wallpaper: [Wallpaper Engine SteamSpy (20–50M)](https://steamspy.com/app/431960), [Lively (GitHub, 14M+)](https://github.com/rocksdanister/lively), [Mac live-wallpaper apps](https://cindori.com/how-to/best-live-wallpaper-apps-mac)
- Screensaver market: [Screensaver software market report](https://www.marketreportanalytics.com/reports/screensaver-software-54549), [Aerial](https://aerialscreensaver.github.io/), [Best Mac screensavers 2026](https://softorino.com/blog/top-7-screensaver-tools-for-mac-and-windows)
- Posting/asset tooling — **primary sources** for the §11 B vendor table (verified 2026-08-02):
  [upload-post pricing](https://www.upload-post.com/pricing-comparison/) · [upload-post API docs](http://docs.upload-post.com/api/upload-video/) · [Zernio pricing](https://zernio.com/pricing) · [Zernio media uploads](https://docs.zernio.com/guides/media-uploads) · [Blotato pricing](https://www.blotato.com/pricing) · [Postiz pricing](https://postiz.com/pricing) · [Postiz TikTok docs](https://docs.postiz.com/providers/tiktok) (the BYO-app evidence) · [Ayrshare pricing](https://www.ayrshare.com/pricing/)
- The audit rule itself, from the platform: [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started/) — *"all content posted by unaudited clients will be restricted to private viewing mode."* Secondary: [PostPeer: TikTok posting API 2026](https://www.postpeer.dev/blog/best-tiktok-posting-api), [Buffer: best social APIs](https://buffer.com/resources/best-social-media-apis/)
- **Native-audio / unattended-posting rationale (§11, verified 2026-08-02 — platform-official where possible):** [YouTube — commercial channels see errors using Shorts Audio Library sounds](https://support.google.com/youtube/answer/10383400?hl=en) · [YouTube — no Audio Library sounds on Shorts made from your videos](https://support.google.com/youtube/answer/12836917?hl=en) · [YouTube Help — Shorts sound page](https://support.google.com/youtube/answer/10623810?hl=en) (*"other Shorts using the same audio"* + "Use this sound") · [Top Shorts Songs chart](https://charts.youtube.com/charts/TopShortsSongs/us/daily) · [Pinterest — music in Pins retired](https://help.pinterest.com/en/article/add-music-to-a-pin) · [Pinterest creative best practices](https://business.pinterest.com/creative-best-practices/) (sound-off viewing) · [Zernio — Creator's Draft exists because the API can't add native sounds](https://zernio.com/blog/tiktok-posting-api). Adam Mosseri (Instagram) on scheduling: *"it will not affect your reach in one way or another."* **Net: schedulers aren't penalised, and the trending-sound surface we'd have gone in-app for is licence-restricted to non-commercial use — so unattended posting costs us little.**

---

## Document history
- **Initial version** — generated in a Claude Code conversation:
  https://claude.ai/code/session_01MJXj4gGsEHfMAxcKJET6uC
  (merges the original `growth-and-marketing-strategy.md` and
  `growth-option-b-wallpaper-ecosystem-distribution.md` into a single document,
  with the Option B playbook folded in as Appendix A).
- **2026-07-03 — execution status pass** (same session): added per-section 🔨/✅/⏭️/🅿️ status
  tags and updated the roadmap — reflecting what shipped (PostHog, OG cards, mobile
  email-link, the self-report demand probe that replaced the Windows-detect/waitlist idea,
  the `marketing/` asset engine, and `docs/launch-kit.md`).
- **2026-07-03 — multi-agent hub** (same session): moved the live status table out of this
  doc into the canonical shared hub **`docs/GROWTH-PROGRESS.md`** (state + backlog +
  read/claim/log protocol), so multiple context-isolated agents coordinate through one
  committed file. This doc now holds the *reasoning* and points at the hub for *state*.
- **2026-08-02 — post-launch pivot.** The launch bet was executed and failed (PH 2026-07-26:
  5 upvotes, 2 comments, no badge, no measurable traffic; Show HN blocked at submission), so
  **§4.2 was rewritten as a post-mortem** and launch spikes were demoted out of the critical
  path. Added the **0 h/week founder-time constraint** as an explicit planning filter, and
  re-sequenced §16 around it (**automate → compound → batch the human bits**). Expanded **§4.3**
  with the programmatic-SEO opportunity (3 indexed URLs vs. 262 gallery pieces growing ~4/night)
  and **§4.4** with a batchable directory/press/creator playbook. Recorded the shipped
  **$15.99 lifetime tier** in §10 and the on-page SEO work, and added three anti-patterns to
  §14. Throughline: **traffic was the zero input — nothing downstream of it has been tested.**
