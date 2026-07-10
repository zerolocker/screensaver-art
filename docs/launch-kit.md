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
Pick one and keep it consistent across PH, HN, Reddit, and the site:
- **"A new piece of curated AI art on your Mac, every day — as your screensaver."**
- "Your idle Mac, turned into an ever-changing gallery of animated classic art."
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
- **`A new piece of AI-animated art on your Mac, every day`** (52)
- `Turn your Mac screensaver into a daily art gallery` (50)
- `Classic art, animated by AI — as your Mac screensaver` (54)

### Description (~260 chars)
```
Living Art turns your idle Mac into a gallery. Centuries of art — reimagined and
gently animated by AI — play as your screensaver, with a fresh curated piece added
every night. Browse the whole collection free; subscribe to unlock it all. No ads,
no noise, just beautiful screens.
```

### First comment (the maker's comment — post it immediately)
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
- **Thumbnail/gallery:** lead with *motion*. A looping clip of the art on a Mac
  beats any static shot. Use the 1:1 output from the asset engine, or a screen
  recording of the screensaver running.
- 3–5 images: the screensaver in action, the app's gallery grid, the "new today"
  moment, the System Settings integration.
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
- [ ] **Hero demo clip** (10–20s): the screensaver running, ideally on a real Mac.
      Use `marketing/make-social-assets.mjs` or a screen recording.
- [ ] **1:1 loop** for PH thumbnail / Reddit / social.
- [ ] **3–5 stills**: screensaver, gallery grid, System Settings, "new today".
- [ ] **OG card** verified (already live) — links unfurl nicely.
- [ ] The **one-line pitch** (§0) pasted identically across all channels.
- [ ] A pinned tweet/X post to point launch traffic at (optional).

## 5. After the spike
Launch traffic decays in ~48h. Convert it before it's gone:
- Watch the PostHog funnel (download → activate → subscribe) live during the spike.
- Capture emails (the site's flows) so the spike leaves a list behind.
- Fold the best HN/PH feedback into the roadmap — and quote any nice testimonials
  on the site.
