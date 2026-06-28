# Nightly Curation — Prompt Quality Guidance

**Read this before generating any image/video prompt in `AUTOMATED_CURATION.md`.**

This file is the accumulated memory of the human curation loop (see
`curation/README.md`). Each time the gallery is curated, the reviewer marks
pieces **undesirable** (deleted from `gallery.json`) or **great** ("want more" —
kept as a positive signal), each with an optional note. The patterns in their
prompts + first frames + notes are distilled here as concrete rules — both the
failures to **avoid** and the traits to **make more of**. The goal: stop the
nightly bot from regenerating the misses, and steer it toward what the reviewer
loves.

> If you (the nightly bot) follow nothing else, follow the **Hard rules** below.

---

## Brand & taste

This gallery is **art history brought to life** — the full breadth you'd find
walking the wings of a great encyclopedic museum, from prehistoric cave paintings
and bronze-age artifacts through Ukiyo-e, Persian miniatures, Renaissance frescoes
and Impressionism to the modern masters. Aim for **museum-grade** work: pieces with
real cultural and historical pedigree, beautiful enough to hang on a gallery wall.

**Range widely and be creative** — every culture and era is fair game, and variety
is good. `ART_STYLES_FOR_INSPIRATION.md` is a starting menu, not a cage; the Gallery
"wings" (see *Gallery tags* below) are a good map of the territory worth exploring.

The one thing to avoid: **internet / gaming / digital-subculture aesthetics**
(cyberpunk, vaporwave, synthwave, pixel/voxel/low-poly, glitch, Y2K, "-core" looks,
AI/fractal/generative art) and loud graphic-design trends — they read as AI slop and
were deliberately cut from the menu.

**Taste test:** would this look at home in a serious museum, or as a plate in an
art-history book? If it instead feels like a video-game asset, a stock vector, or an
album cover, pick something else.

---

## Hard rules (always apply)

These are stable defaults derived from how Veo 3.1 behaves on this gallery. Keep
them even before any round-specific learnings exist.

- **Pick subjects that genuinely move — "light glides across the artwork" is NOT
  motion.** This was *half* of the 2026-06-28 round's rejects: a static carved
  relief, mural, or flat painting with nothing animated but a slow highlight
  sweeping over it ("uninteresting animation — just lights"). Before committing to
  a subject, ask *what in this scene actually moves?* and favour **intrinsic
  motion**: water (waves, rivers, waterfalls, rain), fire (flames, embers,
  torches), smoke/incense, clouds/sky, wind in foliage/grass/banners/cloth,
  falling petals or snow, fountains, birds, fish. **Flat carved-stone reliefs and
  architectural friezes** (Assyrian, Persepolis, Babylonian, Khmer, Borobudur,
  Maya…) were the worst offenders — monochrome, monotonous, light-sweep-only — so
  lean away from them toward colourful, compositionally dynamic painted works. If
  the only honest motion is the light, **choose a different subject.**
- **Match motion intensity to the scene — don't default everything to "subtle".**
  The failure mode isn't *strong* motion, it's *incoherent* motion. A quiet
  still-life still wants a small but *real* motion (a guttering candle flame, a
  curl of incense smoke, drifting dust motes) — not a bare light sweep; a stormy
  seascape *should* have crashing waves, lashing rain, forked lightning and
  wind-torn sails. Make the motion as dramatic as the depicted scene genuinely
  calls for — but keep it **physically plausible**: real-world physics (e.g. wind,
  water, fire, smoke, light, cloth, dust), never the subject's own form mutating.
  Statues, mosaics, and architecture should hold their form.
- **Frame the artwork straight-on, flat to the camera.** Several rejects were shot
  at an oblique 3/4 angle with the wall/relief receding to a vanishing point.
  Present the art **frontal and parallel to the picture plane**, as if looking
  straight at it — not a perspective view down a wall. A slow camera push or pan
  is fine; a skewed 3D angle is not.
- **Don't regenerate famous icons or anything the gallery already has.** Repeats
  this round included a second Hokusai "Great Wave" and another Gothic rose window
  — both already in the gallery and among the most over-reproduced images in
  existence. Skip the obvious greatest-hits (Great Wave, Starry Night, Mona Lisa,
  generic rose windows, Birth of Venus…); pick a fresher, lesser-known work, and
  when a subject feels iconic enough to already be in the gallery, choose
  something else.
- **Never animate anything that should morph, melt, or teleport.** Avoid
  verbs like *morph, melt, teleport, transform, dissolve, regenerate*.
  These produce the glitchy "AI soup" look. 
- **One clear subject, one clear motion.** Multiple simultaneous animated
  subjects tend to collide into artifacts. Describe a single focal motion.
- **Avoid faces/eyes/hands as the animated focus** unless the source style
  renders them cleanly. Subtle expression drift on a portrait is high-risk for
  the uncanny/melting look — prefer animating light or background instead.
- **Anchor the style and era concretely** in the image prompt (medium, material,
  period, lighting). Vague prompts give the model room to invent ugly detail.
- **Render the artwork in-situ, filling the whole image — NOT as a museum object.**
  This is the single biggest source of undesirable pieces (see 2026-06-12 round).
  Prompting only the artifact ("a highly detailed bronze plaque, 2nd century BC")
  makes the model default to a sterile **museum catalog photo**: the object
  centred on a pedestal, blurred gallery wall behind it, glass-case reflections,
  a spotlight, sometimes a visible label. It looks like stock photography, not
  "art brought to life", and nothing in it can animate. Instead describe the
  piece **edge-to-edge, in its own world** (carved into a cliff that fills the
  whole image; a torch-lit temple interior; a tight raking-light macro of the
  surface with no background).
- **Say "fills the whole image / edge to edge" — avoid the word "frame", and
  forbid a painted border.** Image prompts that piled on "fills the frame" were
  producing the literal opposite (2026-06-28 round): the painting rendered *small,
  inside a decorative border/mat/frame* — Gemini reads "frame" as an object to
  draw. Write "the scene fills the entire image, extending to all four edges" and
  explicitly add **"no painted border, no mat, no decorative frame around it."**
- **Never write a placeholder video prompt.** "Animate this artwork" / "Animate
  the artwork naturally" produce generic, off-target, or empty results. Always
  name one concrete motion (gentle or dramatic, per the scene) + the light source.

---

## Always-include negative cues

Put these in the **image prompt** to kill the museum-object look:

> no museum, no display case, no glass, no vitrine, no pedestal or plinth, no
> gallery wall, no spotlight, no museum label, no plain studio background, **no
> painted border, no mat, no decorative frame**; the scene fills the entire image
> edge to edge, viewed straight-on.

Avoid prompts that pile up many "chaotic / lively" motion — they collapse into
incoherent soup.

---

## Gallery tags (the `tags` field)

Every `gallery.json` entry carries a **`tags` array** that drives the filter pills
in the Electron app's Gallery. Each pill is a **museum "wing"**, modelled on how
encyclopedic museums (the Met, Louvre, British Museum…) organize their collections:
**culture/region for ancient & non-Western art, era for the Western timeline.**
Each distinct tag becomes a pill, so the vocabulary is **closed** — set **exactly
one** tag from this list, and **never invent a new value**:

| Tag (wing) | Use for |
|---|---|
| `Prehistoric` | Paleolithic/Neolithic cave & rock art, megalithic |
| `Egyptian` | Ancient Egypt, Amarna, Fayum, Coptic |
| `Ancient Near East` | Mesopotamia (Sumer/Assyria), Persia (Achaemenid/Sasanian), Scythian & steppe |
| `Greek & Roman` | Classical antiquity + Aegean — Minoan, Mycenaean, Cycladic, Etruscan, Hellenistic |
| `Arts of the Americas` | Pre-Columbian (Aztec, Maya, Inca, Olmec, Nazca, Moche, Mississippian…) |
| `Arts of Africa & Oceania` | Sub-Saharan African & Pacific traditions |
| `Japanese` | Ukiyo-e, Sumi-e, Nanga, Kano, Edo screens, Kamakura, Jōmon/Kofun |
| `Chinese & Korean` | Chinese dynastic painting & bronzes (Han/Tang/Song/Ming…), Goryeo/Joseon |
| `South & Southeast Asian` | India & SE Asia — Mughal, Gandhāran, Gupta, Chola, Khmer |
| `Islamic` | Persian, Arab, Ottoman, Fatimid, Islamic geometric |
| `Medieval & Byzantine` | ~5th–14th c. European — Byzantine, Gothic, Romanesque, Carolingian, Viking, illumination, Celtic |
| `Renaissance & Baroque` | 15th–18th c. European — Renaissance, Mannerism, Flemish/Dutch, Baroque, Rococo |
| `19th Century` | Neoclassicism, Romanticism, Realism, Barbizon/Hudson River, Impressionism, Symbolism, Art Nouveau |
| `Modern` | 20th-c. movements — Cubism, Surrealism, Bauhaus, Abstract/Expressionism, Futurism, Art Deco |
| `Contemporary` | Recent / digital / genre looks. **Legacy only** — those styles were cut from the menu, so you won't generate them; the tag stays for pieces already in the gallery. |

Rule of thumb: **assign by culture/region for ancient & non-Western pieces, by era
for European ones.** Pick the single best-fitting wing. Some wings have few or no
pieces yet (`Ancient Near East`, `Arts of Africa & Oceania`, `Islamic`) — that's
fine, they fill as you curate. A new piece you curate is never `Contemporary`.

---

## Round log (newest first)

Each entry is appended by Claude after a curation round. Format:

```
### YYYY-MM-DD — removed U undesirable, kept G great
**Avoid (undesirable — patterns from prompts + frames + notes):**
- …
**Make more of (great — traits the reviewer wants repeated):**
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
- **Chaotic many-creature surreal scenes → AI soup.** The Bosch "fantastical
  creatures… pulse and sway… lively and chaotic" prompt produced a red hell-blob
  mess.
- **Modern/digital-era styles** (Synthwave, Vaporwave, Glitch, Voxel, Y2K, Low
  Poly, Liminal, Pop Art — the older prompt-less hand-added pieces) were all
  flagged, confirming the "pre-21st-century only" theme rule.

**New / reinforced rules** (folded into the sections above):
- Added the **"render in-situ, not as a museum object"** hard rule + an
  always-include negative-cue block (no museum/glass/pedestal/label…).
- Banned **placeholder video prompts**; require one concrete motion matched to the scene.

### 2026-06-28 — removed 20 (0 corrupted, 20 undesirable)

These pieces had **no recorded prompts** (older AUTO_CURATION entries), so analysis
leaned on the extracted first frames + the reviewer's free-form notes.

**Patterns observed (frames + reviewer notes):**
- **Boring "light-glide" animation dominated (~11 of 20).** Notes: "uninteresting
  animation — just lights", "a warm soft highlight glides slowly across the
  artwork". The subjects were static carved reliefs, murals, and flat paintings
  whose only motion was a slow highlight sweeping over them. The previous
  guidance's "a quiet still-life wants a gentle drift of light" was actively
  endorsing this failure.
- **Static stone reliefs / architecture = boring content (~4).** Persepolis
  tribute-bearers, Lalibela rock church, Lamassu gateway: "boring content".
  Monochrome, monotonous, and animatable only by a light sweep — overlapping the
  point above.
- **Oblique camera angle (3): Dunhuang, Bonampak, Borobudur.** "Camera angle is
  not facing straight at the artwork" — the relief wall recedes at a 3/4 angle
  instead of a frontal view.
- **Painting-in-a-frame / not edge-to-edge (2): Safavid & Mughal miniatures.**
  Rendered small inside a decorative border. Reviewer's hypothesis (worth acting
  on): the prevalence of "fills the frame / edge to edge" instructions may make
  Nano Banana draw a literal **frame** — the word "frame" itself is the trigger.
- **Duplicates of icons (3): two Hokusai "Great Wave" prints + a second Gothic
  rose window.** Already in the gallery; also "neither image nor video followed
  the prompt (no Mount Fuji)" and "animation is unrealistic" on the waves.

**New / reinforced rules** (folded into the sections above):
- New hard rule: **subject must have intrinsic motion** — "light glides across the
  artwork" is not motion; lean away from flat stone reliefs/friezes.
- Softened the motion rule: a quiet scene wants a *small real* motion (candle
  flame, incense, dust), not a bare light sweep.
- New hard rule: **frame the art straight-on, flat to the camera** (no oblique
  receding-wall angle).
- New hard rule: **don't regenerate famous icons or gallery duplicates.**
- Reworded the in-situ rule + negative cues to **avoid the word "frame"** and add
  **"no painted border / mat / decorative frame"**, per the reviewer's hypothesis.

<!-- Claude appends new rounds above this line. -->
