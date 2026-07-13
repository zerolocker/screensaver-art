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

### Timing
- Launch **12:01 AM PT** (PH's day resets on Pacific). A full day of ranking beats
  a late-morning start.
- **Tuesday–Thursday** are competitive but high-traffic; **weekends** are quieter
  (easier to rank #1-3, fewer eyeballs). For a small indie, a weekday is usually
  worth it.
- Line up a handful of friends/early users to comment (not just upvote — PH weights
  genuine discussion) in the **first 2–3 hours**.

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

## 2. Show HN (Hacker News)

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

- [x] **Literal screensaver capture** (20s, 1080p, from a 4K original):
      `marketing/out/hero/living-art-screensaver-REAL-1080p.mp4` (+ `…-REAL-4k.mov`) — an actual
      ScreenSaverEngine recording of Living Art running fullscreen on the Mac (Serene Village ·
      Fruit and Silver · Organic Flow · Solarpunk City). **The most authentic hero** — lead with this.
- [x] **Hero demo clip** (19.5s, 1080p 16:9): `marketing/out/hero/living-art-hero-16x9.mp4`
      — 4 pieces (Starry Coast · Cathedral Light · Neon City · Snow at the Shrine) at the
      screensaver's real cadence (1.5s crossfade) + the frosted title pill. Faithful
      reproduction from the gallery; a clean alt/backup to the literal capture above.
- [x] **1:1 loop** for PH thumbnail / Reddit / social: `marketing/out/hero/living-art-hero-1x1.mp4`.
- [x] **3–5 stills** (1920×1080): `marketing/out/hero/still_{1_starry,2_cathedral,3_neon,4_snow}.png`.
- [x] **Per-piece social clips** (9:16 + 1:1 + captions) from the newest 6 pieces:
      `marketing/out/<slug>/` — for daily posting. Regenerate: `node marketing/make-social-assets.mjs --latest 6`.
- [x] **OG card** verified live — unfurls correctly (checked via microlink; §5 step P-1).
- [ ] The **one-line pitch** (§0) pasted identically across all channels.
- [ ] A pinned tweet/X post to point launch traffic at (optional).

Regenerate the hero: `bash <the build script committed alongside, or rerun make-social-assets>`;
regenerate the social clips: `node marketing/make-social-assets.mjs --latest 6`.

## 5. Launch-day runbook (exact clicks, order, timing)

> Founder owns: the accounts, the actual submit clicks, and the date. Everything below
> is sequenced; timings are the only thing that's rigid (**PH's day resets 12:01 AM PT**).
> Two-day plan: **Day 1 = Product Hunt**, **Day 2 = Show HN** (stagger so each gets your
> full attention — never same hour). Reddit threaded through both.

### Pick the date
- **Tue / Wed / Thu.** Avoid Mon (backlog) and Fri–Sun (low traffic, though easier to rank).
- Confirm nothing big is already leading PH that day (glance at producthunt.com the night before).
- Block ~4 focused hours on Day 1 morning to reply to comments — reply speed drives ranking.

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
- **P-4. (Optional) Literal screensaver screen-capture** — if you want a *real* ScreenSaverEngine
  recording on top of the faithful hero: System Settings → Screen Saver → pick **Living Art** →
  start a QuickTime **New Screen Recording** → trigger the saver (`open -a ScreenSaverEngine`
  in Terminal, or just wait for idle) → **don't touch the mouse/keyboard for ~25s** (any input
  dismisses it) → stop the recording → trim to 15–20s. (Or tell me when you'll be away from the
  Mac for 30s and I'll capture it for you.)
- **P-5. Line up 5–10 people** — DM them the date/time and ask for **a comment** (a genuine
  reaction/question), not just an upvote. PH weights discussion; a pile of silent upvotes looks
  botted. Do **not** post "please upvote" anywhere.
- **P-6. Paste-ready doc** — have the PH tagline/description/first-comment and the Show HN
  title/body in a scratch note, plus the asset files open in Finder.

### Day 1 — Product Hunt
- **12:01 AM PT sharp:** submit the product (Name/Tagline/Description/Topics from §1). If you
  can't be up at 12:01, PH lets you **schedule** the launch — do that the night before.
  - **Media order:** thumbnail = `living-art-hero-1x1.mp4` (motion) or `still_1_starry.png`;
    gallery = `living-art-hero-16x9.mp4` **first**, then the 4 stills. Motion first, always.
  - **Topics:** Mac, Design Tools, Art, Productivity.
- **12:02 AM (immediately):** post the **maker's first comment** (§1). This is non-negotiable —
  it frames the whole thread.
- **First 2–3 hours:** ping your 5–10 people with the direct PH link (the UTM link above for the
  site, but send them the *PH post* link to comment on). Reply to **every** comment within minutes,
  technical and warm. Ask commenters questions back to keep threads alive.
- **Midday:** post to **one** subreddit — **r/macapps**, title from §3, lead with the hero clip,
  disclose you're the maker, link the UTM'd site. Engage in the thread; don't cross-post the same hour.
- **All day:** watch the PostHog funnel live (download → install/activate → subscribe). Note the
  drop-off points; they're your post-launch to-do list.

### Day 2 — Show HN
- **~8:00–9:30 AM ET** (HN's high-traffic window). Submit **Show HN** (title from §2, URL =
  the Show-HN UTM link). Immediately post **the body as the first comment** (§2).
- Reply **fast, technical, non-defensive.** Lead with how it's built (the nightly vision-gate
  loop, ExtensionKit sandbox, the honest "obfuscation ≠ DRM"). Candor ranks on HN.
- **Never** ask for upvotes (fastest way to get flagged/killed). Let the engineering story carry it.

### Days 3–5 — stretch the tail
- One more Reddit post per day, one sub at a time, each led by a **different** clip:
  **r/battlestations / r/desksetup** (pure visual, minimal text), then **r/AIArt** (the pipeline angle).
- Post the day's `marketing/out/<slug>/` social clips to X / Pinterest / Reels (add a trending
  audio natively). This is also the start of the ongoing daily-posting habit (backlog item #2).

## 6. After the spike
Launch traffic decays in ~48h. Convert it before it's gone:
- Watch the PostHog funnel (download → activate → subscribe) live during the spike.
- Capture emails (the site's flows) so the spike leaves a list behind.
- Fold the best HN/PH feedback into the roadmap — and quote any nice testimonials
  on the site.
