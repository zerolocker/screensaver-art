# Nightly Curation — Prompt Quality Guidance

**Read this before generating any image/video prompt in `AUTOMATED_CURATION.md`.**

This file is the accumulated memory of the human curation loop (see
`curation/README.md`). Each time the gallery is curated, pieces flagged as
**corrupted** or **undesirable** are deleted from `gallery.json`, and the
patterns in their prompts + first frames are distilled here as concrete rules.
The goal: stop the nightly bot from regenerating the same kinds of failures.

> If you (the nightly bot) follow nothing else, follow the **Hard rules** below.

---

## Brand & taste — what belongs in this gallery

**Living Art Screensaver brings the canon of art history to life** — the movements
and traditions you'd meet in a great museum or an art-history survey. The feel is
timeless, high-end, and painterly. Every piece should read as a **museum-grade
artwork**, not a trendy digital render.

Calibrate taste against the marketing site
(`living-art-screensaver-web/components/art-styles-section.tsx`), which conveys the
brand well:
- The style ladder it advertises: Classical → Medieval → Renaissance → Baroque →
  Rococo → Neoclassicism → Romanticism → Impressionism → Post-Impressionism →
  Modern → Contemporary.
- Its four hero exemplars: **Van Gogh "Starry Coast"** (Post-Impressionism), a
  **Romanticism stormy sea**, a **Neoclassicism Roman Forum**, and **Surrealism
  melting clocks** — recognizable, painterly, evocative scenes with real pedigree.

**Fits the brand — pick from these:**
- Recognized art-history movements, through the canonical 20th-century modern
  masters (Impressionism, Symbolism, Art Nouveau, Expressionism, Cubism,
  Surrealism, Bauhaus, Art Deco, Pop Art…).
- The world's great historical & ancient traditions: Ukiyo-e, Chinese ink / Song
  landscape, Mughal miniature, Persian & Islamic art, Egyptian wall painting,
  Greek/Roman/Byzantine mosaic & fresco, illuminated manuscripts, and ancient
  metalwork / pottery / sculpture from across cultures.
- **`ART_STYLES_FOR_INSPIRATION.md` is the curated menu** — pick from it, and only
  append new styles that fit this same museum-canon spirit.

**Off-brand — never generate (reads as AI slop, cheapens the brand):**
- Internet / gaming / digital-subculture aesthetics: cyberpunk, steampunk,
  vaporwave, synthwave, retro/solar/diesel/bio-punk, low-poly, voxel, pixel art,
  glitch art, Y2K, liminal spaces, dreamcore / weirdcore and other "-core" looks,
  neo-Tokyo.
- Screen-native / process art: digital art, AI art, generative art, fractal art.
- Loud graphic-design trends: Memphis design, Frutiger Aero, acid graphics.

These were **removed from `ART_STYLES_FOR_INSPIRATION.md`** for exactly this
reason — don't reintroduce them.

**The taste test:** *Would this hang in a serious art museum, or appear as a
recognizable plate in an art-history book?* If instead it feels like a video-game
asset, a stock vector, a synthwave album cover, or an ArtStation/AI-art trend,
it's off-brand — pick something else.

---

## Hard rules (always apply)

These are stable defaults derived from how Veo 3.1 behaves on this gallery. Keep
them even before any round-specific learnings exist.

- **Match motion intensity to the scene — don't default everything to "subtle".**
  The failure mode isn't *strong* motion, it's *incoherent* motion. A quiet
  still-life wants a gentle drift of light; a stormy seascape *should* have
  crashing waves, lashing rain, forked lightning and wind-torn sails. Make the
  motion as dramatic as the depicted scene genuinely calls for — but keep it
  **physically plausible**: real-world physics (wind, water, fire, smoke, light,
  cloth, dust), never the subject's own form mutating.
- **Never animate anything that should morph, melt, regrow, or teleport.** Avoid
  verbs like *transform, morph, grow, dissolve, spawn, multiply, regenerate*.
  These produce the glitchy "AI soup" look.
- **Don't move what shouldn't move.** Carved stone, statues, mosaics, and
  architecture should hold their form; animate the *environment* (light, dust,
  shadow, atmosphere), not the artifact's geometry.
- **One clear subject, one clear motion.** Multiple simultaneous animated
  subjects tend to collide into artifacts. Describe a single focal motion.
- **Avoid faces/eyes/hands as the animated focus** unless the source style
  renders them cleanly. Subtle expression drift on a portrait is high-risk for
  the uncanny/melting look — prefer animating light or background instead.
- **Anchor the style and era concretely** in the image prompt (medium, material,
  period, lighting). Vague prompts give the model room to invent ugly detail.
- **Render the artwork in-situ, filling the frame — NOT as a museum object.**
  This is the single biggest source of undesirable pieces (see 2026-06-12 round).
  Prompting only the artifact ("a highly detailed bronze plaque, 2nd century BC")
  makes the model default to a sterile **museum catalog photo**: the object
  centred on a pedestal, blurred gallery wall behind it, glass-case reflections,
  a spotlight, sometimes a visible label. It looks like stock photography, not
  "art brought to life", and nothing in it can animate. Instead describe the
  piece **edge-to-edge, in its own world** (carved into a cliff that fills the
  frame; a torch-lit temple interior; a tight raking-light macro of the surface
  with no background).
- **Never write a placeholder video prompt.** "Animate this artwork" / "Animate
  the artwork naturally" produce generic, off-target, or empty results. Always
  name one concrete motion (gentle or dramatic, per the scene) + the light source.

---

## Always-include negative cues

Put these in the **image prompt** to kill the museum-object look:

> no museum, no display case, no glass, no vitrine, no pedestal or plinth, no
> gallery wall, no spotlight, no museum label, no plain studio background, the
> artwork fills the frame.

Banned **motion** verbs for the subject (carvings, statues, reliefs, metalwork,
figures): *morph, shift, writhe, march, roar, transform, melt, grow, dissolve,
pulse, sway, move.* Animate the **environment / physics** instead — which can be
as dramatic as the scene warrants (light, shadow, dust, smoke, fire, wind, rain,
lightning, water, waves, shimmer). Avoid prompts that pile up many
fantastical/organic creatures plus "chaotic / lively" motion — they collapse into
incoherent soup.

---

## Gallery tags (the `tags` field)

Every `gallery.json` entry carries a **`tags` array** that drives the filter pills
in the Electron app's Gallery. **Each distinct tag becomes its own pill on a single
row**, so the vocabulary is **closed and intentionally small** — set exactly one
tag from this list, and **never invent a new value** (a new one silently adds a
pill and bloats the row):

| Tag | Use for |
|---|---|
| `Ancient` | Prehistory & antiquity, non-Asian (Egypt, Mesopotamia, Greece/Rome, Etruscan, Scythian, pre-Columbian Americas, Minoan/Mycenaean, Hellenistic…) |
| `Asian` | East & South Asian traditions of **any** era (Ukiyo-e, Chinese/Japanese ink & dynastic painting, Mughal, Buddhist sculpture, Joseon, Han/Tang artifacts…) |
| `Medieval` | ~5th–14th c. European / Christian / Insular (Byzantine, Gothic, Romanesque, Carolingian, Viking, illuminated manuscripts, Celtic knotwork) |
| `Renaissance & Baroque` | 15th–18th c. European (Renaissance, Mannerism, Flemish/Dutch, Baroque, Rococo, Caravaggism, chiaroscuro/tenebrism) |
| `19th Century` | Neoclassicism, Romanticism, Realism, Barbizon/Hudson River, Impressionism, Post-Impressionism, Symbolism, Art Nouveau |
| `Modern` | 20th-c. movements (Cubism, Surrealism, Bauhaus, Abstract/Expressionism, Futurism, Art Deco, Minimalism…) |
| `Contemporary` | Recent / digital / genre looks. **Legacy only** — those styles were cut from the menu, so you won't generate them; the tag stays for pieces already in the gallery. |

Rule of thumb: **tag by era, except** East/South-Asian traditions always get
`Asian` (Western era labels fit them poorly). Pick the single best fit — a new
piece you curate will be one of the first six tags, never `Contemporary`.

---

## Round log (newest first)

Each entry is appended by Claude after a curation round. Format:

```
### YYYY-MM-DD — removed N (C corrupted, U undesirable)
**Patterns observed (prompts + first frames):**
- …
**New / reinforced rules:**
- …
```

### 2026-06-12 — removed 59 (3 corrupted, 56 undesirable)

Analyzed each undesirable piece's `image_prompt`/`video_prompt` **and** its
extracted first frame (contact sheets).

**Patterns observed (prompts + first frames):**
- **Museum-object shots dominated (~25 of 56).** Image prompts that named only
  the artifact (e.g. "A highly detailed Xiongnu bronze plaque… green patina, 2nd
  century BC"; the Bactrian gold, Etruscan chalice, Fatimid ewer, Scythian stag,
  Gandharan Buddha, Tang camel…) rendered as objects in vitrines / on pedestals
  against blurred gallery walls, with glass reflections and spotlights. Sterile,
  static, modern-museum context breaking the illusion.
- **Lazy/placeholder prompts → generic or empty frames.** `video_prompt`
  "Animate this artwork" / "Animate the artwork naturally" (Celtic, Cycladic,
  Carolingian, Viking) and ultra-terse image prompts produced off-target frames —
  e.g. Cycladic was a tiny figure lost in a vast empty room; the Viking
  "runestone" was just a plain rock in a field.
- **Asking carved/static figures to physically move → melting.** "patterns
  morphing and shifting" (Anasazi), "figures march… beasts roar" (Mesopotamian
  seal), "the king drawing his bow and the lions moving" (Assyrian relief),
  animals "shift and writhe" (Scythian).
- **Chaotic many-creature surreal scenes → AI soup.** The Bosch "fantastical
  creatures… pulse and sway… lively and chaotic" prompt produced a red hell-blob
  mess.
- **Modern/digital-era styles** (Synthwave, Vaporwave, Glitch, Voxel, Y2K, Low
  Poly, Liminal, Pop Art — the older prompt-less hand-added pieces) were all
  flagged, confirming the "pre-21st-century only" theme rule.

**Data-integrity bug (NOT a prompt issue) — flagged for the bot:**
- Three entries with different titles/prompts — *Hieronymus Bosch surreal
  garden*, *Pre-Raphaelite forest*, *Byzantine golden angel* — serve a
  **byte-identical** video (all 10,379,826 bytes; identical first frame). The
  nightly bot uploaded the **same MP4 under three names**, i.e. the veo step was
  skipped/failed and a stale local file was re-uploaded. Added an upload-integrity
  guardrail to `AUTOMATED_CURATION.md`.

**New / reinforced rules** (folded into the sections above):
- Added the **"render in-situ, not as a museum object"** hard rule + an
  always-include negative-cue block (no museum/glass/pedestal/label…).
- Banned **placeholder video prompts**; require one concrete motion matched to the scene.
- Expanded the banned **subject-motion verb** list (march, roar, writhe, pulse,
  sway, shift…).

<!-- Claude appends new rounds above this line. -->
