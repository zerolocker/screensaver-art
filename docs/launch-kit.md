# Launch Kit — Product Hunt + Show HN (+ Reddit)

> **Coordinating via the hub:** live launch status + who's-doing-what lives in
> [`GROWTH-PROGRESS.md`](GROWTH-PROGRESS.md). Update it when you act on this kit.

Ready-to-use copy and checklists for the one-time launch spikes from the growth
strategy ([`growth-and-marketing-strategy.md`](growth-and-marketing-strategy.md) §4.2).
These give a burst of traffic, backlinks, and first followers — treat them as a
*seeding* event, not a sustaining channel. **Everything here is a draft to make
your own** — the voice should sound like you, an indie maker, not a brand.

> Product: **Living Art Screensaver** — a Mac screensaver that turns your idle
> display into a gallery of AI-animated classic art, with a **new curated piece
> every day**. Free tier; $0.99/mo (billed quarterly) unlocks the full,
> ever-growing collection. Site: **https://living-art-screensaver.com/**.

---

## 0. The one-line pitch (reuse everywhere)
Pick one and keep it consistent across PH, HN, Reddit, and the site. The first
echoes the **live site voice** ("living gallery", "hung on your idle Mac", "new
pieces every night") — safest, since that copy is already yours and shipped:
- **"Turn your Mac's screensaver into a living gallery — centuries of art, animated by AI, refreshed every night."**
- "A new piece of curated AI art on your Mac, every day — as your screensaver."
- "Aerial, but for AI-animated paintings — and it refreshes daily."

---

## 1. Product Hunt

### Timing — **DECIDED: Sunday** ✅
- Launch **12:01 AM PT** (PH's day resets on Pacific). A full day of ranking beats
  a late-morning start. If you can't be up, PH lets you **schedule** it — do that
  the night before.
- **Sunday is a deliberate trade:** fewer launches compete, so a **top-3 badge is
  much more achievable**, but total traffic is lower than Tue–Thu. For a first
  launch that's a good bet — the badge and the "featured" credibility are durable
  assets you can cite forever, whereas a #8 finish on a busy Wednesday isn't.
- Corollary: **the badge is the goal, not raw traffic.** Optimize for ranking
  (early comments, fast replies), and treat the traffic spike as a bonus.
- Line up a handful of friends/early users to comment (not just upvote — PH weights
  genuine discussion) in the **first 2–3 hours**. On a Sunday this matters *more*,
  because a smaller field means a few real comments move you further.

### Name
`Living Art Screensaver`

### Tagline (60 chars max — PH's hard limit)
- **`Turn your Mac screensaver into a living art gallery`** (51) — matches the site
- `A new piece of AI-animated art on your Mac, every day` (52)
- `Classic art, animated by AI — as your Mac screensaver` (54)

### Description (~260 chars)
```
Centuries of art, animated by AI and hung on your idle Mac. Living Art plays a
gallery of gently-animated classic paintings as your screensaver — and quietly adds
a fresh, curated piece every night, so you never see the same wall twice. Browse it
all free; a small subscription unlocks everything and funds the nightly art.
```

### First comment (the maker's comment — post it immediately)
> **Make it yours:** this is a strong draft, but swap in one true detail only you
> know — the moment you decided to build it, a piece that still stops you, the
> weirdest thing the nightly curator rejected. One specific line beats any amount of
> polish for reading as genuinely human.
```
Hi PH! 👋 I'm the maker.

I kept wishing my Mac looked as good idle as it does in use — Apple's aerial
screensavers are gorgeous but I'd seen them a hundred times. So I built the thing I
wanted: a screensaver that shows *classic art, gently animated by AI*, and quietly
adds a new curated piece every single night. You never see the same wall twice.

A few things I sweated:
• Curation over volume — a nightly pass throws out anything that looks like a
  catalog photo or has AI artifacts, so you only get gallery-worthy pieces.
• It's a real macOS ExtensionKit screensaver (Sonoma+), not a wallpaper hack —
  sandboxed, sits in System Settings next to Apple's own.
• The whole gallery is browsable free; a small subscription unlocks everything and
  funds the nightly art.

Happy to answer anything — how the nightly generation/curation pipeline works, the
ExtensionKit sandboxing, the reframing, whatever. Feedback very welcome. 🙏
```

### Media (the make-or-break part)
- **Thumbnail/gallery:** lead with *motion*. Use `marketing/out/hero/living-art-hero-1x1.mp4`
  (or `still_1_starry.png`) as the thumbnail, and `living-art-hero-16x9.mp4` as the **first**
  gallery item. A moving wall of art beats any static shot.
- **3–5 stills:** the four `marketing/out/hero/still_*.png` frames work as-is. Add a shot of
  the app's gallery grid + the System Settings integration if you grab them.
- **Topics:** Mac, Design Tools, Art, Productivity.

### Maker checklist
- [ ] Product Hunt account warmed up (not brand new — PH throttles new accounts).
- [ ] Gallery media exported (motion first).
- [ ] Maker first-comment ready to paste.
- [ ] 5–10 people told the date/time (ask for *comments*, not just upvotes).
- [ ] Reply to every comment within the first few hours.
- [ ] Site's OG card working (shared PH → nice unfurl).

---

## 2. Show HN (Hacker News) — 🅿️ **PARKED for the Sunday launch**

> **Why parked:** HN is currently restricting **new accounts** from posting to
> Show HN, so this can't run alongside the PH launch. **Nothing here is wasted —
> it's deferred, not dropped.** Show HN is a *separate, independent spike*: it
> works just as well weeks after launch (arguably better, since you'll have real
> users and feedback to cite). **Re-entry plan:** age the account and build a
> little karma by commenting genuinely on HN threads in your wheelhouse
> (macOS, Swift, AI pipelines) — then post this exact copy once eligible.
> Do **not** create a throwaway account to get around the limit; HN detects it
> and it would burn the launch permanently.
>
> The founder's own draft (already grammar/fact-checked in conversation) is the
> version to post — it leads with the museum/Harry-Potter origin story, which is
> more human than the copy below.

HN rewards the **engineering story and candor**, not marketing. Lead with how it's
built; let the product be the payoff. Overtly promotional Show HNs get flagged.

### Title
`Show HN: A Mac screensaver that generates new AI-animated art every night`
- Alt: `Show HN: Living Art – nightly AI-curated art as your Mac screensaver`
- Keep it factual. No hype words ("beautiful", "revolutionary"). No emoji.

### The post body / first comment
```
I built a macOS screensaver that plays classic art gently animated by AI, and
regenerates its collection every night.

The parts that were actually interesting to build:

• Nightly pipeline: a scheduled agent picks a pre-1900 style, generates a 4K still
  (Nano Banana / Gemini), then *self-reviews* it against a "vision gate" — it
  re-rolls anything that reads as a museum-catalog photo or has AI artifacts before
  spending a video generation. Then it animates the still (Veo 3.1), uploads to R2,
  and appends to a gallery manifest. The self-review step is what keeps quality up
  without a human in the loop every night.

• It's a real ExtensionKit .appex screensaver (Sonoma+), sandboxed, not a wallpaper
  daemon. The sandbox can't read arbitrary disk, so the (unsandboxed) companion app
  and the screensaver share a cache under /Users/Shared via a temporary-exception
  entitlement — the same trick Aerial uses — to avoid a TCC prompt.

• The cached video is lightly obfuscated (XOR + magic header) so files don't drag
  out of the cache and open in QuickTime — deliberate friction for a $0.99 product,
  explicitly not DRM (both binaries embed the key).

Everyone can browse the whole gallery free; a small subscription unlocks it all and
pays for the nightly generation.

Happy to go deep on any of it — the vision-gate prompt loop, ExtensionKit quirks,
the reframing, the economics of a sub-$1 app. What would you have done differently?
```

### Do / Don't
- **Do** respond fast, technically, and non-defensively. HN engagement drives ranking.
- **Do** admit trade-offs (the obfuscation-isn't-DRM candor plays well here).
- **Don't** ask for upvotes anywhere (fastest way to get flagged).
- **Don't** post the same hour as your PH launch — stagger by a day so you can give
  each its own attention.

---

## 3. Reddit (bonus — free, high-fit, but allergic to ads)

Lead with a *video*, disclose you made it, engage in comments. One subreddit at a
time (don't blast).

- **r/macapps** — `[App] Living Art — a Mac screensaver that adds a new AI-animated
  artwork every night (free tier)`. Mac users hunting for apps; the free tier is the hook.
- **r/apple / r/mac** — softer; frame as "made this" show-and-tell with a clip.
- **r/battlestations, r/desksetup** — pure visual; post a clip of it running on a
  nice setup, minimal text, answer "what's that?" in comments.
- **r/AIArt** — the pipeline/curation angle.

Reddit copy skeleton:
```
I made a Mac screensaver that turns your idle display into a gallery of classic art,
gently animated by AI — and it quietly adds a new curated piece every night.

Free to download and browse the whole collection; a small subscription unlocks it
all. Not trying to spam — genuinely made this and would love feedback. Clip below 👇
```

---

## 4. Shared asset checklist (make once, reuse everywhere)
> **Status: assets produced 2026-07-12.** They live in `marketing/out/` (gitignored —
> build output, regenerate anytime). Re-run the two commands below to refresh from the
> newest gallery pieces.

- [x] ⭐ **THE LAUNCH VIDEO** (37.6s, 1080p 16:9, **with sound**):
      `marketing/out/hero/living-art-launch-video-16x9.mp4` — the hero scene rendered from the real
      site components (enlarged monitor, 84px headline), 7 pieces cycling with their **real gallery
      audio**, ending on the art-backed end-card → living-art-screensaver.com. **This is the PH
      gallery's first item.**
- [x] **Fullscreen art reel** (37.6s): `living-art-hero-16x9.mp4` — same 7 pieces, no monitor
      chrome. Spare for Reddit/social where the site framing isn't needed.
- [x] **1:1 loop** for PH thumbnail / Reddit / social: `living-art-hero-1x1.mp4`.
- [x] **Stills** (1920×1080): `marketing/out/hero/still_1_…`–`still_6_…` (art frames).
- [x] **Site + app images**: `marketing/out/launch-images/` — `01-hero-title`, `02-collection`,
      `03-movements`, `05-app-gallery` (the app's Gallery grid, account email redacted).
- [x] **Per-piece social clips** (9:16 + 1:1 + captions) from the newest 6 pieces:
      `marketing/out/<slug>/` — for daily posting. Regenerate: `node marketing/make-social-assets.mjs --latest 6`.
- [x] **OG card** verified live — unfurls correctly (checked via microlink; §5 step P-1).
- [ ] The **one-line pitch** (§0) pasted identically across all channels.
- [ ] A pinned tweet/X post to point launch traffic at (optional).

Regenerate the social clips: `node marketing/make-social-assets.mjs --latest 6`. The launch video
is rebuilt from a temporary `app/launch-capture` route (headless-Chrome render of the hero + ffmpeg
composite) — see the PR #63 commits for the recipe.

## 5. Launch-day runbook (exact clicks, order, timing)

> Founder owns: the accounts, the actual submit clicks, and the date. Everything below
> is sequenced; timings are the only thing that's rigid (**PH's day resets 12:01 AM PT**).
> **Plan: Day 1 (Sunday) = Product Hunt. Day 2 = Reddit** (promoted into the slot Show HN
> vacated — see §2 for why it's parked). Show HN runs later as its own spike.

### The date — **Sunday** ✅
- Glance at producthunt.com the night before to see what's already leading.
- **Block ~4 focused hours Sunday morning** to reply to comments — reply speed is the single
  biggest ranking lever you control, and it matters more on a quiet Sunday field.
- Because Show HN is parked, **all of Sunday's attention goes to PH** — that's a genuine
  advantage; the original two-front plan always risked splitting focus.

### Use UTM links so PostHog attributes the traffic (§3 of the strategy)
Paste the matching link wherever you post (the demand-probe + funnel events tag onto the session):
- Product Hunt → `https://living-art-screensaver.com/?utm_source=producthunt&utm_medium=launch&utm_campaign=ph`
- Show HN → `https://living-art-screensaver.com/?utm_source=hackernews&utm_medium=launch&utm_campaign=showhn`
- Reddit (per sub) → `…/?utm_source=reddit&utm_medium=social&utm_campaign=r_macapps` (swap the sub name)
- X/Twitter → `…/?utm_source=twitter&utm_medium=social&utm_campaign=launch`

### Pre-launch (T-minus 2–3 days)
- **P-1. OG card** — already verified (title/description/image unfurl; external crawler confirmed). No action.
- **P-2. Download works** — `/download/mac` 302s to the signed **v1.4.5** DMG. Do one real
  end-to-end install from the site on a clean-ish Mac if you can.
- **P-3. Warm the PH account** — make sure it isn't brand-new (PH throttles new accounts):
  log in, complete the profile, upvote/comment on a couple of products this week.
- **P-4. Ship the new-brand app build (recommended).** The site + launch video now use the new
  **swirl** logo, but the downloadable app is still **v1.4.5 with the old icon** — a PH visitor
  who installs on launch day sees the old mark in their Dock. `./scripts/release.sh` (see
  CLAUDE.md) picks up `electron-app/build/icon.png` from master. Not a blocker, but it's the one
  visible brand seam left.
- **P-5. Line up 5–10 people** — DM them the date/time and ask for **a comment** (a genuine
  reaction/question), not just an upvote. PH weights discussion; a pile of silent upvotes looks
  botted. Do **not** post "please upvote" anywhere. On a Sunday a handful of real comments goes
  a long way.
- **P-6. Paste-ready doc** — have the PH tagline/description/first-comment in a scratch note,
  plus the asset files open in Finder.

### Day 1 — Product Hunt
- **12:01 AM PT sharp:** submit the product (Name/Tagline/Description/Topics from §1). If you
  can't be up at 12:01, PH lets you **schedule** the launch — do that the night before.
  - **Media order:** gallery item #1 = ⭐ `living-art-launch-video-16x9.mp4` (the launch video —
    motion + sound). Then `05-app-gallery.png` (shows it's a real app), `02-collection.png`,
    `03-movements.png`, and 1–2 art stills. Thumbnail = `living-art-hero-1x1.mp4` or
    `still_1_starry-coast.png`. **Motion first, always.**
  - **Topics:** Mac, Design Tools, Art, Productivity.
- **12:02 AM (immediately):** post the **maker's first comment** (§1). This is non-negotiable —
  it frames the whole thread.
- **First 2–3 hours:** ping your 5–10 people with the direct PH link (the UTM link above for the
  site, but send them the *PH post* link to comment on). Reply to **every** comment within minutes,
  technical and warm. Ask commenters questions back to keep threads alive.
- **All day:** stay on PH. **Don't** post to Reddit today — it splits your attention and the
  PH thread is where replies actually move ranking. Reddit is tomorrow.
- **All day:** watch the PostHog funnel live (download → install/activate → subscribe). Note the
  drop-off points; they're your post-launch to-do list.

### Day 2 (Monday) — Reddit
_(This slot was Show HN; it's parked — see §2. Reddit gets the day instead.)_
- **Morning:** post to **r/macapps** (title from §3) — lead with the launch video or the
  fullscreen reel, disclose you're the maker, use the r_macapps UTM link. This is the highest-fit
  sub; give it its own day rather than burying it in PH day.
- Reply to every comment. Reddit rewards a maker who actually engages.
- **Do not** cross-post the same day. One sub at a time.

### Days 3–5 — stretch the tail
- One more Reddit post per day, one sub at a time, each led by a **different** clip:
  **r/battlestations / r/desksetup** (pure visual, minimal text), then **r/AIArt** (the pipeline angle).
- Post the day's `marketing/out/<slug>/` social clips to X / Pinterest / Reels (add a trending
  audio natively). This is also the start of the ongoing daily-posting habit (backlog item #2).

## 6. After the spike
Launch traffic decays in ~48h. Convert it before it's gone:
- Watch the PostHog funnel (download → activate → subscribe) live during the spike.
- Capture emails (the site's flows) so the spike leaves a list behind.
- Fold the best PH/Reddit feedback into the roadmap — and quote any nice testimonials
  on the site.
- **If you get a PH badge, put it on the site** (top-5/product-of-the-day badges are
  durable social proof, and PH gives you the embed).
- **Then run Show HN** as its own spike once the account is eligible (§2) — with real
  users and launch feedback in hand, the post gets *better*, not staler.
