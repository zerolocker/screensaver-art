# Living Art Screensaver — Growth & Marketing Strategy

> **Status:** Living strategy doc. Captures the reasoning from our growth conversation
> plus areas we hadn't yet discussed. The Option B distribution play is folded in as
> **Appendix A**. **See the Progress snapshot below for what's built vs. next** — the
> body sections are the *reasoning*; the snapshot is the *state*.
> **Context:** Solo/indie Mac app, live website, **pre-launch, ~zero users today**.
> Product: a screensaver (and potentially wallpaper) that streams **curated, daily-fresh
> AI art**. Free tier (50 pieces) + **$0.99/mo subscription billed quarterly ($2.97/3mo)**.

---

## 0. TL;DR — the strategy in eight lines

1. **The art is the marketing.** You produce beautiful video daily at ~zero marginal cost — that's an infinite, free content engine. Build everything around it.
2. **Organic-first, not paid.** At $0.99/mo the unit economics make paid ads a money-loser. Earn attention with content; don't rent it.
3. **Your wedge is *curation + freshness*** — the one thing the free incumbents (Aerial, Wallpaper Engine's Workshop, Lively) structurally can't offer.
4. **Validate on Mac before building anything new** (Windows, a wallpaper engine). The Mac app already ships — validation costs *zero* build, just traffic.
5. **Don't pivot to a wallpaper engine.** Bigger market, but commoditized to free/$5 and moated. Instead *distribute your content into it* (Option B).
6. **Fix the funnel so traffic doesn't leak** — device-aware capture ("email me the Mac link"), a self-report platform-demand probe, great link previews, brand-name SEO.
7. **Instrument everything.** You can't improve what you can't see. Set up analytics + a north-star metric before you pour traffic in.
8. **Rethink pricing.** This category pays *one-time*, not subscription — your single biggest untested lever (annual/lifetime tier). See §10.

---

## Progress snapshot (updated 2026-07-03)

**Legend:** ✅ live · 🔨 built, not yet used · ⏭️ next · 🅿️ parked (needs a decision or data).

| Initiative | Status | Where it lives / notes |
|---|---|---|
| PostHog analytics (web + Electron) | ✅ live | events + funnels wired; §3 |
| Open Graph / Twitter social cards | ✅ live | `living-art-screensaver-web/app/opengraph-image.tsx`; §5 |
| Mobile "email me the Mac link" | ✅ live | `components/marketing/download-cta.tsx`; §5–6 |
| Cross-platform **demand probe** (self-report) | ✅ live | `components/marketing/platform-interest.tsx` — **PostHog-only, no backend**; superseded the old "detect Windows + waitlist" idea in §5/§8 |
| Marketing **asset engine** (16:9 → 9:16/1:1 + captions) | 🔨 built | `marketing/make-social-assets.mjs` (+ README); §11 step (A). Not yet run on real art / posted |
| **Launch kit** (Product Hunt / Show HN / Reddit) | 🔨 drafted | `docs/launch-kit.md`; §4.2. Not yet launched |
| **Run the launch** (PH + Show HN) | ⏭️ next — the immediate goal | Human-led; needs real art clips + a demo recording. See `docs/launch-kit.md` |
| Daily social posting + aggregator | ⏭️ next | §4.1 + §11 step (B) — pick upload-post / Postiz; the asset engine feeds it |
| SEO landing pages + brand-name SEO | ⏭️ next | §4.3 ("Aerial alternative", "best Mac screensaver", comparison pages) |
| "Art of the week" email / newsletter | ⏭️ next | §4.6 — needs an email-send path decision |
| Option B ecosystem art packs | 🅿️ later | Appendix A (Wallpaper Engine Workshop / Lively) |
| Retention / lifecycle email | 🅿️ later | §9 |
| **Pricing experiments** (annual / lifetime) | 🅿️ parked — needs founder call | §10 — flagged as the **highest** conversion lever |
| Referral / shareable export | 🅿️ later | §12 |
| Windows / Mac App Store build | 🅿️ parked — pending demand-probe data | §8, §4.7 |
| Paid ads | 🅿️ not now | §13 — revisit only after a higher-value tier + proven funnel |

**What's live right now:** a solid *conversion + analytics foundation* (PostHog, OG cards,
mobile email-link, the platform demand probe) on a site with **essentially no traffic yet**.

**The bottleneck is now acquisition, not capture.** So the immediate next step is the
**launch** (execute `docs/launch-kit.md`), which needs real social clips (run the asset
engine, §11/`marketing/`) and a hero demo recording. After the launch spike, the ranked
follow-ons are: daily posting + an aggregator, SEO pages, and the email list — with
**pricing experiments (§10)** the biggest lever to pull whenever conversion (not traffic)
becomes the constraint.

> **For a new agent picking this up:** read `CLAUDE.md` (product), this doc (strategy),
> `docs/launch-kit.md` (launch copy), and `marketing/README.md` (asset engine). The rows
> above marked ⏭️/🅿️ are your backlog; the body sections explain the *why* behind each.

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
- **Platforms, weighted by *durability* (matters for a desktop product — see §6):**
  - **Pinterest** ⭐ — desktop + search-driven, pins live for *months/years*, perfect for
    "desk setup" discovery. Most underrated for your concern about mobile→desktop handoff.
  - **YouTube** ⭐ — Shorts for reach + a real "best Mac screensaver / Aerial alternative"
    video that's searchable forever and watched *on desktops*.
  - **Reddit** — r/macapps, r/apple, r/battlestations, r/AIArt; threads rank in Google for years.
  - **Instagram Reels / TikTok** — top-of-funnel *awareness* (viral lottery tickets), not
    your conversion path. Post daily; cost is ~zero.
- **Volume strategy:** post *every* good piece to *every* platform. Each post is an
  independent shot at virality. Flood the channels — your content is free and infinite.
- **Borrow audiences (the real accelerant):** the slow part is building your *own*
  following. Skip it — get featured by big "aesthetic/AI-art/wallpaper" repost accounts,
  and by "best Mac apps / desk setup" YouTubers/creators. One feature on a 500k account
  ≈ months of your own posting. Send them your best loops, free, credited.

### 4.2 Launch spikes (one-time bursts — schedule deliberately)
> **Status:** 🔨 copy + checklists drafted in **`docs/launch-kit.md`** (Product Hunt / Show
> HN / Reddit). ⏭️ **not yet launched** — this is the immediate next action.

Won't sustain traffic, but seed your first followers, backlinks, testimonials, and SEO base:
- **Product Hunt** — ideal for a polished indie Mac app. Great demo video (you have assets),
  early comments lined up, posted on a planned day.
- **Show HN (Hacker News)** — lead with the *engineering/AI-pipeline story* ("I built a
  screensaver that generates new art daily with Veo/Gemini"), not a sales pitch.
- **Reddit launch posts** — be transparent you made it; lead with a video and the free tier.

### 4.3 SEO & content (compounding, owned)
The traffic that finds you *at their Mac with intent*. High-value targets:
- **"Aerial alternative"** — Aerial is the known free incumbent; alternative-seekers are warm.
- **"best Mac screensaver 2026," "live wallpaper Mac," "AI art wallpaper/screensaver."**
- **Comparison & listicle pages** on your own site (you vs Aerial / Wallpaper Engine — honest,
  highlighting curation + daily-fresh).
- **Brand-name SEO:** ensure searching **"Living Art Screensaver"** lands you #1 (title tags,
  consistent naming) — because recall fires as a *name search*, not a typed URL (§6).

### 4.4 Press & directories
Screensaver apps are rare enough to be newsworthy. Pitch **9to5Mac, MacStories, Cult of Mac,
MacRumors**; get listed on **MacUpdate, alternativeto.net**, and the **Aerial/PaperSaver
community** (your exact audience — you already build on their tooling).

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
- **Favor durable/searchable channels** (Pinterest, YouTube, Reddit) so the content gets
  *re-found* at the desktop, not just glimpsed and gone.
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

## 10. Monetization & pricing — your biggest untested lever (think hard here)
The single clearest signal from all our market research: **this category pays *one-time*,
not subscription.** Wallpaper Engine = $4.99 once (20–50M owners). Lively = free. Aerial =
free. Paid Mac screensavers (Bauhaus Clock $19) = **one-time**. Your **$0.99/mo subscription
is swimming against the category's grain.**

This doesn't mean kill the subscription — it means **test pricing structures**, because it's
likely your highest-impact conversion lever:
- **Add an annual plan** (e.g. ~$9.99/yr) — reads as cheaper, cuts churn, fits "I'll pay once
  a year" psychology.
- **Add a lifetime / one-time tier** (e.g. ~$29 one-time) — *matches the category's mental
  model*. Many who'd never start a subscription will happily pay once. (Yes, it forgoes
  recurring revenue from those users — but you may capture buyers you'd otherwise lose
  entirely. Test it.)
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
- **(B) Distribution — BUY.** Use a posting aggregator (upload-post, **Ayrshare**, or
  self-hosted **Postiz**) — one API call fans out to TikTok/Reels/Shorts/Pinterest.
  **~$0–40/mo.** *Critical reason to buy, not build:* platforms gate posting behind
  **audits/app-review** (TikTok forces unaudited apps to private-only; Instagram/YouTube/
  Pinterest need app review) — the aggregators have already passed these. Building the raw
  posting/OAuth layer = months of compliance for one app's marketing. Don't.
- **(C) Agentic layer — optional BUILD.** A nightly Claude call picks the best clip and writes
  per-platform captions/hashtags. ~1 day.
- **Total: ~3–4 days of build + ~$0–40/mo**, hanging off the nightly job → near-unattended
  daily multi-platform marketing.
- **Keep a human in the loop ~2 min/day** (reply to comments, ride trending audio) — native
  engagement materially boosts reach for almost no effort.

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

---

## 16. Phased roadmap (sequencing — impact × effort)
_(✅ done · 🔨 built, not used · ⏭️ next · 🅿️ parked — mirrors the Progress snapshot.)_

**Phase 0 — Foundations (days, do first, highest ROI):** — ✅ **essentially complete**
- ✅ Analytics + north-star (§3). ⏭️ *still todo:* a consistent UTM convention on outbound links.
- ✅ Conversion capture: device-aware CTAs, "email me the Mac link", the self-report demand
  probe (replaced the Windows-waitlist idea), OG cards (§5–6).
- ⏭️ Brand-name SEO basics (§4.3).

**Phase 1 — Turn on organic (weeks):** — ⏭️ **current focus**
- 🔨→⏭️ Content flywheel: the asset engine is built (§11); *start posting* (manual first),
  Pinterest + YouTube + Reddit emphasis (§4.1).
- 🔨→⏭️ Launch spikes: copy drafted in `docs/launch-kit.md`; **execute** Product Hunt + Show HN (§4.2).
- ⏭️ Start the email list / "art of the week" (§4.6).

**Phase 2 — Automate & distribute (weeks):**
- ⏭️ Agentic marketing engine: asset step ✅ built (§11 A) → add **aggregator posting** (§11 B).
- 🅿️ Option B ecosystem packs (Appendix A).
- 🅿️ Lifecycle/retention email + win-back (§9).

**Phase 3 — Optimize & expand (data-driven):**
- 🅿️ **Pricing experiments** (annual/lifetime/trial) — arguably pull *earlier* if conversion is
  the bottleneck (§10). Needs a founder decision.
- 🅿️ Referral program + shareable export (§12).
- 🅿️ Evaluate Mac App Store discovery (§4.7).
- 🅿️ Build **Windows** *iff* the demand-probe data justifies it (§8).
- 🅿️ Consider paid-ads test *only* after a higher-value tier + proven funnel (§13).

---

## 17. Open decisions for the founder
1. **Pricing:** add an annual and/or lifetime tier? (Strong recommend to test — §10.)
2. **Email infra:** existing path (Supabase/Resend/other) to hook capture flows into, or set one up?
3. **Aggregator choice:** upload-post (cheapest) vs Ayrshare (established) vs self-hosted Postiz?
4. **Brand mark in art:** how visible? (virality vs. purity tradeoff — §12.)
5. **North-star metric:** confirm "weekly active subscribers" or pick another.

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
- Posting/asset tooling: [Ayrshare](https://www.ayrshare.com/), [Postiz alternatives](https://woopsocial.com/blog/postiz-alternatives), [upload-post](https://www.upload-post.com/), [TikTok API audit rules](https://www.postpeer.dev/blog/best-tiktok-posting-api), [Buffer: best social APIs](https://buffer.com/resources/best-social-media-apis/)

---

## Document history
- **Initial version** — generated in a Claude Code conversation:
  https://claude.ai/code/session_01MJXj4gGsEHfMAxcKJET6uC
  (merges the original `growth-and-marketing-strategy.md` and
  `growth-option-b-wallpaper-ecosystem-distribution.md` into a single document,
  with the Option B playbook folded in as Appendix A).
- **2026-07-03 — execution status pass** (same session): added the **Progress snapshot**,
  per-section 🔨/✅/⏭️/🅿️ status tags, and updated the roadmap — reflecting what shipped
  (PostHog, OG cards, mobile email-link, the self-report demand probe that replaced the
  Windows-detect/waitlist idea, the `marketing/` asset engine, and `docs/launch-kit.md`).
  Intended so a fresh session can pick up execution from the current state.
