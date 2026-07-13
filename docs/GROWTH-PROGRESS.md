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
| `docs/launch-kit.md` | Product Hunt / Show HN / Reddit copy + checklists |
| `marketing/README.md` | The social asset engine (`marketing/make-social-assets.mjs`) |

---

## Status (canonical)
Legend: ✅ live · 🔨 built, not yet used · ⏭️ next · 🅿️ parked (needs a decision/data)

| Initiative | Status | Where it lives / notes |
|---|---|---|
| PostHog analytics (web + Electron) | ✅ live | events + funnels; strategy §3 |
| Open Graph / Twitter social cards | ✅ live | `living-art-screensaver-web/app/opengraph-image.tsx`; §5 |
| Mobile "email me the Mac link" | ✅ live | `components/marketing/download-cta.tsx`; §5–6 |
| Cross-platform **demand probe** (self-report) | ✅ live | `components/marketing/platform-interest.tsx` — **PostHog-only, no backend**; superseded the old "detect Windows + waitlist" idea (§5/§8) |
| Marketing **asset engine** (16:9 → 9:16/1:1 + captions) | ✅ run | `marketing/make-social-assets.mjs`; **run 2026-07-12** on newest 6 → `marketing/out/<slug>/` (12 clips + captions). Not yet posted. §11 (A) |
| **Hero demo clip** (19.5s 1080p + 1:1 + 4 stills) | ✅ produced | `marketing/out/hero/` — faithful reproduction from the real gallery (screensaver cadence + title pill). Literal ScreenSaverEngine capture needs the Mac idle (recipe in launch-kit §5 P-4). |
| **Launch kit** (Product Hunt / Show HN / Reddit) | ✅ finalized | `docs/launch-kit.md` — copy aligned to live-site voice + **launch-day runbook** (exact clicks/timing/UTMs) added 2026-07-12. |
| **Run the launch** (PH + Show HN) | ⏭️ ready — founder-led | Assets + copy + runbook all done. Founder owns: PH account warm-up, the **date**, 5–10 commenters, and the submit clicks. |
| Daily social posting + aggregator | ⏭️ next | §4.1 + §11 (B) — pick upload-post / Postiz; asset engine feeds it |
| SEO landing pages + brand-name SEO | ⏭️ next | §4.3 ("Aerial alternative", "best Mac screensaver", comparison pages) |
| "Art of the week" email / newsletter | ⏭️ next | §4.6 — needs an email-send path decision |
| Option B ecosystem art packs | 🅿️ later | Appendix A (Wallpaper Engine Workshop / Lively) |
| Retention / lifecycle email | 🅿️ later | §9 |
| **Pricing experiments** (annual / lifetime) | 🅿️ needs founder call | §10 — flagged as the **highest** conversion lever |
| Referral / shareable export | 🅿️ later | §12 |
| Windows / Mac App Store build | 🅿️ pending demand-probe data | §8, §4.7 |
| Paid ads | 🅿️ not now | §13 — only after a higher-value tier + proven funnel |

**One-liner:** the *conversion + analytics foundation* is live; the site has
**~zero traffic**. **The bottleneck is acquisition, not capture** → the next move is the
**launch**, then daily posting, SEO, and the email list.

## In progress (claim here before starting)
| Task | Agent / branch / PR | Started | Notes |
|---|---|---|---|
| _(none)_ | | | |

**Launch-prep done (2026-07-12, branch `growth/launch-execution`):** ✅ social clips (newest 6), ✅ hero demo (16:9 + 1:1 + 4 stills, `marketing/out/hero/`), ✅ live-site verified (OG unfurls, `/download/mac`→v1.4.5 DMG, demand-probe + mobile email-link healthy — nothing broken), ✅ launch copy finalized + runbook. **Handoff = founder executes the launch** (see the two founder-decisions below + launch-kit §5).

## Next up (prioritized backlog)
1. **Execute the launch** — run `node marketing/make-social-assets.mjs --latest 6` for real
   clips, record a hero demo, finalize `docs/launch-kit.md` copy, then Product Hunt + Show HN.
2. **Daily social posting** — wire an aggregator (upload-post / Postiz) so the asset engine's
   output auto-posts; Pinterest + YouTube + Reddit emphasis (§4.1).
3. **SEO landing pages** — "Aerial alternative", "best Mac screensaver", comparison pages (§4.3).
4. **Email list / "art of the week"** — pick a send path, add capture + a simple send (§4.6).

## Decisions needed from the founder (blockers on parked items)
- **Pricing tiers** — add annual (~$9.99/yr) and/or lifetime (~$29)? The category pays
  one-time; this is the biggest conversion lever (§10).
- **Email-send path** — Supabase mailer / Resend / other — for the newsletter + lifecycle email.
- **Aggregator choice** — upload-post (cheapest) vs Postiz (self-host) vs Ayrshare (§11 B).

---

## Activity log (append-only — newest first)
- **2026-07-12** — **Launch prep executed** (branch `growth/launch-execution`): ran the asset
  engine on the newest 6 pieces (12 social clips + captions in `marketing/out/`); produced a
  faithful **hero demo** (16:9 19.5s + 1:1 + 4 stills in `marketing/out/hero/`) from the real
  gallery at the screensaver's cadence; **verified the live site** — OG card unfurls (external
  crawler confirmed), `/download/mac` 302s to the signed **v1.4.5** DMG, demand-probe dialog +
  mobile "email me the link" (`/api/download-link`) both healthy, **nothing broken**; **finalized
  `docs/launch-kit.md`** — copy aligned to the live-site voice + a full **launch-day runbook**
  (exact clicks, PH 12:01 AM PT timing, Show HN Day-2 stagger, per-channel UTM links). Remaining =
  founder-owned submit clicks + date.
- **2026-07-03** — Established this hub; moved live status out of the strategy doc into here.
- **2026-07-03** — Strategy doc execution-status pass (snapshot, per-section tags, roadmap). _(PR #61)_
- **2026-07-03** — Marketing asset engine (`marketing/make-social-assets.mjs`) + launch kit
  (`docs/launch-kit.md`). _(PR #61)_
- **2026-07-03** — OG social cards, mobile "email me the link", and the self-report demand
  probe (replaced the Windows-detect/waitlist idea; PostHog-only). _(PR #59, merged)_
- **2026-07-03** — Growth & marketing strategy doc created. _(merged to master)_
