# Living Art Screensaver — Real Public-Domain Paintings (Multi-Agent Curation)

A **variant of the nightly curation** in [`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md).
Everything is the same **except Step 2**: instead of *generating* a still with the
`nano-banana-pro` skill, a team of agents **fetches a real, human-made painting**
that this screensaver is legally allowed to use, then animates it with Veo exactly
as before. The animation, upload, `gallery.json`, and commit steps are **reused
unchanged** — read `AUTOMATED_CURATION.md` first; this doc only describes what
replaces the still-generation step.

> **Why:** real masterpieces carry genuine cultural pedigree AI stills can't fake,
> and every one is free to use *if* — and only if — it clears the eligibility gate
> below. The whole risk of this approach is copyright, so the gate is the point.

Instructions assume the git repo is the current working directory.

---

## 0. The eligibility policy (the "allowed to use" spec — this is the hard gate)

A candidate painting is **eligible only if ALL of these hold**. If *any* check is
uncertain, **reject it** — eligible works number in the millions, so there is never
a reason to gamble on a doubtful one.

1. **Approved source.** It comes from one of the vetted **open-access museum
   collections** in §3 — **never** a random Google/Pinterest/stock image. These
   institutions have done the legal clearance and publish a machine-readable rights
   flag; that flag is our evidence.
2. **Explicit free licence.** The source marks it **CC0** or **Public Domain**
   (Met `isPublicDomain: true`; Art Institute `is_public_domain: true`; Cleveland
   `share_license_status: "CC0"`). **Reject** anything marked *CC-BY, CC-BY-SA,
   CC-NC, "No Known Copyright", "rights reserved", or "unknown"* — attribution /
   share-alike / non-commercial terms all encumber a commercial screensaver, so we
   accept **only CC0 / Public Domain Mark**, nothing weaker.
3. **Artist-death age check — NOT an object-age check.** Copyright runs for the
   **artist's life + 70 years** in the US/EU, so *"the painting is 100 years old"
   is the wrong test.* Require **the artist died more than 70 years ago** — for the
   current year 2026 that means **died 1955 or earlier** — **OR** the work is
   anonymous/ancient with an object date clearly **before 1900**. If the artist's
   death year is unknown *and* the object date is after ~1900, **reject** (it could
   be a living-memory or still-in-copyright artist).
   - *Concrete trap to catch:* a 1926 Picasso is ~100 years old but Picasso died in
     **1973**, so it is copyrighted until **2044**. Object age alone would wave it
     through; the death-date check stops it. The same applies to Matisse, Dalí,
     Klimt-era-but-late artists, etc.
4. **2-D painting/drawing/print/fresco only.** The rule that makes the museum's
   *photograph* free is *Bridgeman v. Corel*: a faithful reproduction of a **2-D**
   public-domain work carries **no new copyright**. A photo of a **3-D** object
   (sculpture, vase, artifact) can carry its own separate photo copyright — so we
   take **flat art only** (`classification`/`type` = painting, drawing, print,
   fresco, watercolour, miniature, icon, illuminated page).

**For every accepted piece, record full provenance** (artist, dates, original
title/date, museum credit line, source object URL, licence) — see §6. Even under
CC0 (no legal attribution requirement) we credit the human artist; it is honest,
respectful of moral rights, and lets the app show a proper caption.

---

## 1. The agent team

Model this as a short pipeline of specialised agents sharing one **run manifest**
(a JSON file in the scratchpad, e.g. `curation/.run/candidates.json`). Spawn them
with the Agent/subagent tool. The **Sourcing** stage fans out in parallel (one
agent per museum, independent); the rest are sequential gates.

| Agent | Role | Gate it owns |
|---|---|---|
| **Orchestrator** | Drives the run: creates the manifest, spawns the others, dedups against `gallery.json` + the icon blocklist, enforces the "4 pieces" cadence, does the final commit/push. | — |
| **Sourcing agents** (parallel, 1 per museum) | Query each open-access API, pull painting candidates the source flags CC0/PD, write raw records (metadata + image URL + licence + artist death year) into the manifest. | Source + licence flag (policy §0.1–0.2) |
| **Clearance agent** | The copyright gate. For each candidate independently re-verify the licence flag **and** apply the artist-death / object-age check + 2-D check. Stamp each record `clearance: PASS`/`REJECT` **with a reason**. Nothing proceeds without PASS. | Policy §0.2–0.4 (hard gate) |
| **Curator agent** | The taste + animatability gate — the real-art analogue of Step 2's vision gate. Judges gallery-worthiness, **motion potential**, aspect ratio, dedup/icon-blocklist; assigns the single `tags` wing; writes the **video prompt**. | Brand/taste + motion rules from `PROMPT_GUIDANCE.md` |
| **Prep agent** | Downloads the highest-res image, checks resolution, letterboxes to the display aspect **without AI-extending the artwork**, writes the still Veo will animate. | Resolution + aspect (§5) |
| **Animation agent** | Reused Step 3 of `AUTOMATED_CURATION.md`: Veo `--first-frame` = the real painting still, honest motion prompt, upload **both** assets to R2, append the `gallery.json` entry with provenance. | Motion/loop rules (unchanged) |

Keep the **Clearance** and **Curator** roles as *separate* agents even if one model
could do both — copyright and taste are different failure modes, and you want the
legal gate to be dumb, strict, and auditable on its own.

---

## 2. Prerequisites & credentials

Same secret-handling as `AUTOMATED_CURATION.md` (`curation/with-secrets.sh` +
`curation/.env`). Additional notes:

- **Met, Art Institute of Chicago, Cleveland need NO API key** — plain HTTPS GET.
  Prefer these three; they are the backbone.
- **Optional keyed sources** (Rijksmuseum, Smithsonian, Harvard Art Museums) —
  only if you add their keys to `curation/.env` (`RIJKS_API_KEY`, etc.) and run
  them through `with-secrets.sh`. Not required.
- The `veo3-video-gen` skill and `CLOUDFLARE_API_TOKEN` (R2 upload) are used
  exactly as in the base workflow. **`GEMINI_API_KEY` / `nano-banana-pro` are NOT
  used here** — there is no image generation.

If a required secret or source is unreachable, **abort and report** rather than
falling back to un-vetted images.

---

## 3. Sourcing agents — where to fetch (approved sources + queries)

Each sourcing agent pulls a batch of candidates from ONE source and appends them to
the manifest. Pick fresh subjects (a theme keyword per run keeps variety); pull
generously (say 30–50 raw candidates each) so the downstream gates have room to
reject freely.

### 3a. The Metropolitan Museum of Art (no key) — CC0
```bash
# 1) search: paintings, with images, European Paintings dept (id 11) is a rich seam
curl -s "https://collectionapi.metmuseum.org/public/collection/v1/search?q=harvest&hasImages=true&medium=Paintings" | jq '.objectIDs[:50]'
# 2) fetch each object and keep only public-domain 2-D paintings
curl -s "https://collectionapi.metmuseum.org/public/collection/v1/objects/436535" | jq '{
  title, artist:.artistDisplayName, artistDeathYear:.artistEndDate,
  objectDate, classification, isPublicDomain, primaryImage,   # full-res image URL
  credit:.creditLine, url:.objectURL }'
```
- **Take only** `isPublicDomain == true` **and** `classification` containing
  "Painting"/"Drawing"/"Print". `artistEndDate` is the artist's **death year** —
  hand it straight to the Clearance agent. `primaryImage` is full resolution.

### 3b. Art Institute of Chicago (no key) — Public Domain
```bash
# keyword search → ids, then hydrate with the fields we need
curl -s "https://api.artic.edu/api/v1/artworks/search?q=river%20landscape&limit=50&fields=id" | jq '.data[].id'
curl -s "https://api.artic.edu/api/v1/artworks?ids=27992,20684&fields=id,title,artist_title,artist_display,date_display,date_end,classification_title,image_id,is_public_domain,dimensions,credit_line" \
  | jq '.data[] | select(.is_public_domain==true and (.classification_title|test("painting|drawing|print";"i")))'
# high-res IIIF image (base comes from the response's config.iiif_url):
#   https://www.artic.edu/iiif/2/{image_id}/full/full/0/default.jpg   (max res)
#   .../full/1686,/0/default.jpg                                      (capped width)
```
- `artist_display` often embeds birth–death years (e.g. "…, 1796–1875"); parse the
  death year from it for the Clearance check. `date_end` is the **object** date,
  not the artist's death — don't confuse the two.

### 3c. Cleveland Museum of Art (no key) — CC0 only
```bash
curl -s "https://openaccess-api.clevelandart.org/api/artworks/?q=still%20life&cc0=1&type=Painting&has_image=1&limit=50" \
  | jq '.data[] | {title, creators:[.creators[].description], type,
      image:.images.print.url, cc0:.share_license_status, credit:.tombstone, url:.url}'
```
- `cc0=1` returns **only** CC0 works. `images.print.url` is the high-res file.
  `creators[].description` usually carries the artist's dates; parse the death year.

**Sourcing agents must NOT decide eligibility** beyond the source's own flag — they
just harvest and record. The Clearance agent is the authority.

---

## 4. Clearance agent — the copyright gate

For each raw candidate, independently stamp `PASS`/`REJECT` + reason by re-checking
policy §0:

1. **Licence** is exactly CC0 / Public Domain (per that source's flag). Else REJECT.
2. **Artist death year > 70 years ago** (2026 → **≤ 1955**), OR anonymous/ancient
   with object date **< 1900**. Unknown death year + post-1900 object → REJECT.
3. **2-D medium** (painting/drawing/print/fresco/miniature/icon). 3-D object →
   REJECT (photo may carry its own copyright).
4. Write the verdict + the exact evidence (`isPublicDomain:true`,
   `artistEndDate:1851`, source URL) into the manifest so the run is auditable.

Only `PASS` records flow to the Curator.

---

## 5. Curator + Prep — taste, motion, and framing

The Curator applies the **same brand/taste and motion rules** as the base workflow
(read `curation/PROMPT_GUIDANCE.md`), now against a *real* image:

- **Motion gate (unchanged, and the #1 filter here).** Keep only paintings with a
  real **primary mover** — people/animals doing something, boats/mills/looms, cloth
  in wind, dramatic sky/water. A flat, figureless still that can only "shimmer" is a
  reject, exactly as in the AI workflow. Say the one-sentence clip out loud first.
- **Dedup + icon blocklist.** Skip anything already in `gallery.json` (match on
  artist + title) and the over-reproduced greatest-hits called out in
  `PROMPT_GUIDANCE.md` (Great Wave, Starry Night, Mona Lisa, Birth of Venus, generic
  rose windows…). Prefer a fresher, lesser-known work by the same master.
- **Faces caveat (unchanged).** Don't make a single portrait's face the animated
  focus — high uncanny/melt risk. Prefer works where the movers are figures-in-a-
  scene, water, sky, or cloth.
- **Assign exactly one `tags` wing** from the closed list in `PROMPT_GUIDANCE.md`
  (by culture/region for ancient & non-Western, by era for European). Never invent a
  tag; never use `Contemporary`.
- **Write the video prompt** per `PROMPT_GUIDANCE.md` (concrete primary mover +
  light source; per-piece loop decision). See §7 for the extra fidelity rules that
  apply *only* to animating real paint.

The **Prep agent** then produces the still Veo animates:

- **Download the highest-res image** the source offers (Met `primaryImage`, AIC
  `…/full/full/…`, Cleveland `images.print.url`) to `gallery/<slug>_src.<ext>`.
- **Resolution floor:** reject if the long edge is **< 2000 px** (won't hold up on a
  4K display). **Never AI-upscale a real artwork** — that fabricates detail the
  artist never made. If it's too small, drop it and pick another.
- **Aspect handling — no AI outpainting.** Screens are landscape. If the painting is
  roughly landscape, use it near-full-bleed. If it's portrait/square, **letterbox it
  onto a dark neutral field** at the display aspect — do **not** have Veo invent
  canvas around it. This looks like a framed piece on a gallery wall and keeps the
  real artwork intact:
  ```bash
  # center the painting on a 3840x2160 near-black field, preserving it whole
  magick "gallery/<slug>_src.jpg" -resize 3840x2160 \
    -background '#0b0b0d' -gravity center -extent 3840x2160 \
    "gallery/<slug>_painting.webp"
  ```
  Feed `gallery/<slug>_painting.webp` to Veo as `--first-frame`.

---

## 6. gallery.json entry — with provenance

Same append/date/tag rules as `AUTOMATED_CURATION.md` Step 4, but the entry
**drops `image_prompt`** (there is no prompt — it's a real painting) and **adds
provenance fields**. These extra keys ride along harmlessly (the `/api/gallery`
route passes raw JSON through; `ArtItem` ignores unknown fields) and let the app
show a caption later.

```json
{
  "src":  "https://screensaver-assets.living-art-asset.com/gallery/<slug>_animated.mp4",
  "img":  "https://screensaver-assets.living-art-asset.com/gallery/<slug>_painting.webp",
  "title": "The Fighting Temeraire — J.M.W. Turner (Animated)",
  "type": "video",
  "date": "YYYY-MM-DD",
  "tags": ["19th Century"],
  "source": "real_artwork",
  "artist": "Joseph Mallord William Turner",
  "artist_dates": "1775–1851",
  "original_title": "The Fighting Temeraire",
  "original_date": "1839",
  "credit": "The National Gallery, London",
  "source_url": "https://www.nationalgallery.org.uk/paintings/...",
  "license": "Public Domain",
  "video_prompt": "THE_VIDEO_PROMPT_USED",
  "looping": false
}
```
- **Title convention:** credit the human artist; use **"(Animated)"** — *not*
  "(AI Animated)", which would imply the artwork itself is AI. The motion is AI, the
  painting is real; `source: "real_artwork"` + `video_prompt` records that honestly.
- **`free`:** omit it → new pieces default to subscriber-locked, same as AI pieces.

---

## 7. Extra rule: animating *real* paint (fidelity)

Real old-master surfaces have craquelure and visible brushwork — the very texture
the AI workflow forbids in its *image* prompt. Here we can't avoid it (it's the real
painting), so the mitigation moves to the **video** side. This is the top quality
risk, so:

- **Confine motion to a subregion** (sky, water, a figure, cloth) and keep the paint
  body of the rest **locked** — a whole-canvas motion makes the crack pattern crawl.
- **Modest amplitude.** Real brushwork shimmers unpleasantly under large motion; keep
  it as gentle as the scene honestly allows (still a *real* mover, never a bare light
  sweep — the base motion rules stand).
- **Never** use morph/melt/dissolve verbs (already banned) — doubly damaging on a
  real artwork you're meant to preserve.
- The Curator's self-review after generation still applies: if Veo warped the
  brushwork, faces, or forms of the real painting, **discard and reroll or drop it**.

---

## 8. Cadence, cleanup, commit (reused)

- **4 pieces per run**, per-piece loop decision — identical to `AUTOMATED_CURATION.md`
  Steps 3–5. Upload **both** the still and the video with the `upload()` helper
  (unique keys, never overwrite), then **delete the local files**.
- Commit: `git add gallery.json && git commit -m "AUTO_CURATION (real art): Added [Artist — Title, …]"` then `git push`. Do not commit the run manifest or downloaded originals.

---

## 9. Open decisions (defaults chosen — change here if you disagree)

1. **Runs alongside, not instead of, the AI workflow.** This is a *variant* of
   Step 2; the AI pipeline stays. Flip to replacement only if the real-art pieces
   clearly win in curation.
2. **Non-landscape works are letterboxed, not AI-extended** (§5). Alternative:
   restrict sourcing to landscape-only paintings and skip letterboxing — simpler,
   but throws away most of the catalogue (most paintings are portrait).
3. **Only CC0 / Public-Domain-Mark accepted** (§0.2). Accepting CC-BY would roughly
   double the pool but forces a visible attribution requirement into the app UI.
4. **Attribution display is a follow-up.** The provenance fields (§6) are written now
   but the Electron/website Gallery doesn't render them yet — a small UI change to
   show "Painting by <artist>, <credit> · public domain · animation AI-assisted"
   would make the credit visible. Out of scope for this workflow; worth doing.

---

## 10. One-line summary of the gate

> **Fetch only from Met / Art Institute / Cleveland open access, take only CC0 /
> Public-Domain 2-D paintings whose artist died before 1955 (2026 → life+70), record
> provenance, letterbox (never AI-extend), then animate exactly as the base
> workflow does.** When in doubt, reject — eligible works are effectively infinite.
