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
walking the wings of a great encyclopedic museum. Aim for **museum-grade** work:
pieces beautiful enough to hang on a gallery wall.

**Range widely and be creative** — `ART_STYLES_FOR_INSPIRATION.md` is a starting
menu, not a cage; the Gallery "wings" (see *Gallery tags* below) are a good map of
the territory worth exploring. But range is **not** a mandate to spread evenly
across all of art history — see **Era mix** immediately below, which is now a hard
constraint.

**Recent and contemporary styles are allowed** (rule lifted 2026-07-25). The old
"pre-21st-century only" ban is gone: the reviewer looked at the `Contemporary` wing
and judged those pieces genuinely beautiful. Modern illustration, contemporary fine
art, and atmospheric genre looks (solarpunk, steampunk, dark academia, mid-century
modern, noir, eco-brutalism, papercut, Ghibli-esque…) are **on the menu**.

The bar is no longer *era*, it's **AI-cliché**. What was actually wrong with the
banned list was never its recency — it was that a handful of those looks are the
default output of every AI image generator. Still off the menu:

> generative / "AI art", 
> glitch art / Y2K / Frutiger Aero

**Taste test (apply to every era equally):** does this look like a piece an artist
made — something you'd find in a serious gallery, a good illustration annual, or an
art-history plate? Or does it look like the first thing an image generator produces
when you type the style name? If the latter, pick something else. A contemporary
piece that passes this test is worth more than an ancient one that doesn't.

---

## Era mix (hard constraint — added 2026-07-25)

**Lean recent. Cap the archaeological look at ~1 piece in 4.**

The reviewer's standing note: recent rounds featured too many ancient styles, and
they read as *"less polished, kind of worn out, less sophisticated."* Six of the
seven pieces cut on 2026-07-25 were ancient/traditional. Fewer of them — **not
zero**, they're still part of the museum's breadth, but they must earn their slot.

The useful split is **not** the tag or the century — it's **what the work survives
on**, because the support is where the decay lives:

| | Support | Reads as | Quota |
|---|---|---|---|
| **Archaeological** | plaster wall, cave rock, fired clay/pot, carved stone, excavated metal | cracked, pitted, faded, dug-up | **≤1 of the 4 nightly pieces** |
| **Intact-medium** | silk, paper, panel, canvas, print, manuscript vellum, tapestry | as the artist left it | unlimited |

So a Song silk handscroll, a Mughal miniature on paper, a Shin-hanga woodblock and
an Ottoman illuminated manuscript are all "old" but **not** archaeological — they
arrive pristine and don't trip this rule. A Pompeian fresco, a Dunhuang cave mural,
a Greek vase painting and a Moche pot **do**.

When you do spend the archaeological slot, pick the **best-preserved, most
polychrome** example of the style, and follow the *patina* rule below.

Beyond the cap, actively favour: `19th Century`, `Modern`, `Renaissance & Baroque`,
`Contemporary`.

---

## Hard rules (always apply)

These are stable defaults derived from how Veo 3.1 behaves on this gallery. Keep
them even before any round-specific learnings exist.

- **Every clip needs a PRIMARY MOVER that performs a legible action.** You must be
  able to describe what happens in one sentence with a real verb and a real actor:
  *"the crane beats its wings and lifts off the marsh"*, *"the paddler pulls a full
  stroke and the boat surges"*, *"the weaver's shuttle crosses the loom"*. If the
  only sentence you can write is *"the light shimmers"* / *"the water ripples"* /
  *"the flame flickers"*, **you do not have a clip yet — pick a different subject.**
  This was the whole 2026-07-19 round: 11 rejects, 11 of them ambient-only, the
  reviewer's note being *"the animation is mostly only ripples, which is very
  uninteresting — there are way more objects that can be animated than ripples."*
- **Order of preference for what moves.** Reach for the top of this list first;
  the bottom of the list is **garnish, never the main course**:
  1. **People and animals doing something** — walking, rowing, dancing, working,
     playing, drinking, bowing, fighting, hunting; birds flying, horses running,
     fish swimming, camels plodding, dogs bounding.
  2. **Objects with mechanical motion** — boats, carts, wheels, mills, looms,
     bells, swings, banners, sails, kites, spinning tops, pouring vessels.
  3. **Cloth and hair in wind** — robes, veils, curtains, flags, manes, tassels.
  4. **Weather and elements as the *driver* of the above** — a squall that bends
     the trees *and* heels the boat over.
  5. **Bare ambient shimmer** — ripples, flicker, smoke, drifting cloud. Fine as a
     supporting layer under 1–4. **Never the only thing in the clip.**
  **Cap: at most ~1/3 of new pieces may be ambient-led**, and only where the scene
  genuinely has no actor (an empty landscape, a pure still life). Two consecutive
  ambient-led pieces is a signal you are back in the rut.
- **"Holds its form" ≠ "holds still".** The anti-morph rules below protect an
  object's *identity*, not its *position*. Write **"the heron keeps its exact
  painted shape, colours and markings while it beats its wings and glides left"** —
  never *"the heron stays perfectly still"*. **Do not write blanket freeze
  clauses.** These specific strings caused the 2026-07-19 rejects and are banned:
  *"the courtiers stand still"*, *"the worshippers stand still"*, *"the painted
  fish and birds stay exactly where they are"*, *"nothing else moves"*. If a scene
  contains people or animals, **animating them is the default expectation** —
  freezing them is the thing that needs justifying. Architecture, ground, walls and
  carved ornament *should* stay put; that is what the static clause is for.
- **"Light glides across the artwork" is NOT motion.** This was *half* of the
  2026-06-28 round's rejects: a static carved relief, mural, or flat painting with
  nothing animated but a slow highlight sweeping over it ("uninteresting animation
  — just lights"). **Flat carved-stone reliefs and architectural friezes**
  (Assyrian, Persepolis, Babylonian, Khmer, Borobudur, Maya…) were the worst
  offenders — monochrome, monotonous, light-sweep-only — so lean away from them
  toward colourful, compositionally dynamic painted works **with figures in them**.
  If the only honest motion is the light, **choose a different subject.**
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
- **One clear FOCAL action — not a frozen tableau.** Keep one thing as the clear
  centre of attention so the motion reads; a dozen independently choreographed
  subjects collide into artifacts. But this is a rule about **focus, not
  suppression**: secondary figures may move naturally and *should* (a crowd shifts
  its weight, bystanders' robes stir) — just don't give three subjects competing
  hero actions. Misreading this rule as "freeze everything but one element"
  produced the entire 2026-07-19 reject batch.
- **Seamless loops (`looping: true`) may close three different ways.** A loop must
  return to its opening state — but "return to the opening state" is *not* a
  synonym for "barely move". Pick whichever fits:
  - **Oscillation** — something swings out and back: ripples, flames, a swinging
    bell, a rocking boat, a breathing sail, a swaying dancer. (Careful: this is the
    lazy default, and at low amplitude it degenerates into the ripple rut.)
  - **Traversal** — a steady stream crosses the image, one subject leaving as
    another enters, so the *aggregate* opening state is unchanged: a caravan
    crossing, boats drifting past, birds streaming across a sky, a river of
    pilgrims. This is the best way to get real movement into a loop.
  - **Complete action cycle** — the actor finishes a full cycle back to its own
    start pose: one whole paddle stroke, one wingbeat, one turn of a wheel or
    mill, one bow, one hammer swing, one pass of a weaver's shuttle.
- **Don't downgrade the motion just to make it loop — drop the loop instead.** If
  the honest motion is a **countable set of independent creatures** wandering
  freely (a few ducks, a school of fish), a loop seam makes them **pop out and
  reappear** ("the ducks and the fish disappeared and reappeared" — a finding from
  a curation). The fix is to set **`looping: false`** and let them swim, **not** to
  freeze the ducks and animate the water. Non-looping is cheap; a boring clip is not.
- **Avoid faces/eyes/hands as the animated focus** unless the source style
  renders them cleanly. Subtle expression drift on a portrait is high-risk for
  the uncanny/melting look — prefer animating light or background instead.
- **Anchor the style and era concretely** in the image prompt (medium, material,
  period, lighting). Vague prompts give the model room to invent ugly detail.
- **Depict every artwork as if freshly made — never prompt surface aging or paint
  texture.** Name the medium and style ("oil on canvas, Utrecht Caravaggist
  tenebrism"; "distemper on cloth") but **stop at the medium — do not describe its
  physical condition or surface**. Banned descriptors: *craquelure, cracked /
  crazed / aged / yellowed varnish, cupping, flaking, "visible brushwork", impasto
  texture, canvas / silk / panel weave, weathered / pitted / worn / distressed
  surface*. Image models render fine repetitive texture far too densely and too
  bright, turning "aged cracked oil surface" into a glaring spider-web of light
  cracks — **worst on dark / tenebrist scenes**, where the cracks vanish on the lit
  areas but scream against the near-black shadows. (The 2026-07-20 "Village Forge
  at Night" reject: its entire dark left half was a bright crack-net, straight from
  the prompt's *"aged varnish, cracked oil-paint surface"* + *"craquelure remain
  visible"*.) And **don't "fix" it with a negative cue** — writing *"no craquelure
  / no cracks"* risks summoning the very texture you named, the same backfire that
  made "frame" draw a frame (2026-06-28). The fix is simply to **never mention
  surface condition at all**; the step-2 self-review vision gate is the backstop
  for any aging the model adds unbidden.
- **The patina must never upstage the art.** (The 2026-07-25 round; the reviewer's
  words: the piece feels *"too old, too worn out"*, and the **年代感** — the *look
  of age* — *"currently feels more prominent than the art itself"*, 喧宾夺主, the
  guest upstaging the host.) The rule above bans *describing* aging, and these
  prompts obeyed it — yet decay still arrived, through **two side doors the rule
  didn't close**:
  1. **The style name itself carries ruin.** "Pompeian fresco", "Mogao cave mural",
     "black-figure amphora" — the model's prior for these *is* the excavated,
     damaged survivor. Naming the style is enough to summon cracks and grime; you
     do not have to ask for them.
  2. **The in-situ rule dragged the support into frame.** Written to kill
     museum-catalog shots, it pushed prompts toward "a villa triclinium wall", "a
     cave wall", "the pot surface" — and the rough rock, broken plaster margins and
     mottled terracotta *are* the decay. The art was fine; its backing ruined it.

  **The fix — show the painted image, not the object it survives on.** State
  positively that the work is **new**: *"freshly painted, pigments brilliant and
  unfaded, the painted surface smooth, clean and unbroken, as on the day it was
  finished."* Then **keep the support out of frame**: no rough rock edges, no
  broken or crumbling plaster margins, no exposed pot curvature, no excavation
  lighting, no votive candles or oil lamps set in front of the art. The painted
  scene fills all four edges by itself. (Positive phrasing, not negative — per the
  rule above, naming "no cracks" risks summoning cracks.)
- **Light the art, not the room. The product showcases the artwork — atmosphere is
  never worth losing it to.** (Reviewer, 2026-07-25, on the Dunhuang reject: *"it's
  too dark, not very well lit. I know this might be due to the intention of creating
  the 'atmosphere' of being old (using only 3 oil lamps). But the main product need
  of this app is to showcase the art, not the atmosphere."*)

  **The numbers.** Mean luminance (0–255) of the first frame, across 40 recent
  pieces: **median 133**. Six sat under 100 — and **five of those six** had explicit
  dim-light vocabulary in the image prompt (*lamplight, candlelit, torch-lit,
  nocturne, moonlit, firelight, brazier*). The two pieces the reviewer called worn
  out were also the two darkest of the round: Dunhuang **79**, Pompeian **85**.
  Writing "lit by oil lamps" reliably costs ~50 luma against the gallery norm.

  **The rule:** the default is **bright, generous, even illumination** — full
  daylight, broad window light, or simply a well-lit interior. Dimness is not a
  style choice here; if the still comes back murky, reroll it brighter.
  - **Do not make the light source a subject.** No candles, oil lamps, torches,
    braziers or lanterns placed in the scene as the only illumination — those
    render as small bright blobs in a dark field, and everything you actually came
    to look at falls into shadow.
  - **Genuinely nocturnal subjects are still allowed** (a Baroque fire scene, a
    Shin-hanga night festival, a Dutch nocturne) — but the *painted surface must
    still read*: faces, colour and detail legible across the whole frame, not just
    in a pool around the flame. If you cannot have both, choose the daylit subject.
  - Avoid *"dim"*, *"flickering"*, *"devotional"*, *"raking"* and *"moody"* as
    lighting descriptors. Prefer *"bright even daylight"*, *"clear soft daylight
    filling the scene"*, *"luminous and evenly lit"*.
- **Give the screen something to look at — mind palette and density.** Three of the
  2026-07-25 rejects (Moche fineline runners, Greek black-figure chariot, Song
  sericulture) failed on visual *thinness*: two-tone line-on-ground styles and pale
  washed grounds leave most of a 4K screen as empty beige. This is the same
  complaint as the earlier *"not much stuff, wouldn't say it's art"*. So:
  **two-colour line-on-ground styles** (black-figure / red-figure vase painting,
  Moche fineline slip painting, bare monochrome ink outline) and **pale, low-chroma
  grounds** are weak choices for a full-screen screensaver. If you use one anyway,
  it must be **densely composed** — figures and ornament filling the frame — never
  a sparse frieze floating on empty ground. Prefer full polychrome palettes with
  real tonal range.
- **Render the artwork in-situ, filling the whole image — NOT as a museum object.**
  This is the single biggest source of undesirable pieces (see 2026-06-12 round).
  Prompting only the artifact ("a highly detailed bronze plaque, 2nd century BC")
  makes the model default to a sterile **museum catalog photo**: the object
  centred on a pedestal, blurred gallery wall behind it, glass-case reflections,
  a spotlight, sometimes a visible label. It looks like stock photography, not
  "art brought to life", and nothing in it can animate. Instead describe the
  piece **edge-to-edge, in its own world** (carved into a cliff that fills the
  whole image; a temple interior in full daylight; a tight macro of the surface
  with no background). Keep the setting **brightly and evenly lit** — see the
  lighting rule below; the old wording here suggested a *"torch-lit"* interior and
  was directly feeding the too-dark failure.
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
| `Contemporary` | Recent / contemporary fine art + atmospheric genre and illustration looks — solarpunk, steampunk, dark academia, mid-century modern, noir, eco-brutalism, papercut, Ghibli-esque, contemporary realism/abstraction. **Open for new pieces as of 2026-07-25.** Subject to the AI-cliché exclusions in *Brand & taste*. |

Rule of thumb: **assign by culture/region for ancient & non-Western pieces, by era
for European ones.** Pick the single best-fitting wing. Some wings have few or no
pieces yet (`Ancient Near East`, `Arts of Africa & Oceania`, `Islamic`) — that's
fine, they fill as you curate. `Contemporary` is **no longer legacy-only**: it was
reopened on 2026-07-25 and new pieces may use it.

---

## Music prompts (the `music_prompt` field)

### The rule: the music must belong to the picture
Match **era/culture, mood, and energy**. ~10-35 words.

- **Era/culture** — let the instruments live in the piece's world without tipping
  into pastiche: koto/shakuhachi and sparse percussion for Ukiyo-e; harpsichord and
  small string consort for Baroque; warm brass and upright bass for Art Deco;
  marimba, pizzicato strings and glockenspiel for a bright contemporary
  illustration; low drones and bone flute for Prehistoric.
- **Mood + energy** — read them off the *scene*, not the movement label. A joyful
  crowd wants buoyancy; a snow-lit shrine at dusk wants stillness; a storm wants
  weight without drama.
- **Palette has a sound** — luminous saturated colour and bright daylight suggest
  major, light, airy; muted earth and low light suggest minor, warm, sparse.

### Append "Instrumental, no vocals." to prompt
Without this, Lyria sings by default.
The skill warns before the call and fails after it if it hears lyrics, and
`make-social-assets.mjs` refuses a prompt that doesn't say this at all.

---

## Round log (newest first)

> **This log is for the human review loop only** (the `/curate-gallery` skill /
> `curation/README.md`). Append here **only** when a human has flagged pieces and you
> are processing that review. **The nightly automated run (`AUTOMATED_CURATION.md`)
> must NOT append to this log** — it added 36 "nightly generation round (N pieces
> added)" entries that bloated this file to ~2,950 lines with no new signal (all the
> real lessons live in the **Hard rules** above and in Claude's memory), so they were
> pruned on 2026-10-03. Nightly runs record their batch in the git commit message, not
> here. If you discover a genuinely new reject/fix pattern on a nightly run, fold it
> into the **Hard rules** section (and memory) — do not open a round-log entry for it.

Each entry (a human-review round) is appended by Claude after processing flags. Format:

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

### 2026-07-19 — removed 11 undesirable, kept 0 great

**The frames were fine. The motion was the problem.** Every one of the 11 rejects
is a genuinely handsome first frame (see `undesirable_01.png`) — no museum-object
shots, no oblique angles, no painted borders, no icon duplicates. The last three
rounds' image-side rules are *working*. This round is entirely a **video-prompt
failure**, and it is one this file caused.

**Reviewer's note (the whole round in one line):** *"the animation is mostly only
ripples, which is very uninteresting. There are way more objects that can be
animated other than ripples."*

**Avoid (undesirable — patterns from prompts + frames + note):**
- **Ambient-only motion — 11 of 11.** Tally what actually moves in each reject:
  water ripples/pours (7), flame/ember flicker (5), smoke curl (3), drifting
  clouds (3), foliage stirring (4). That is the entire list. Not one clip has a
  subject that *performs an action*.
- **The prompts explicitly freeze every living thing — 8 of 11 carry a freeze
  clause.** These are the actual strings: *"The ranked courtiers stand still"*
  (a whole Ottoman crowd), *"The worshippers stand still with their hands pressed
  together"*, *"the painted saints, their halos, robes and faces… stay perfectly
  still"*, *"the painted fish, the birds, the goddess… stay exactly in place"*,
  *"The painted fish, crabs and long-beaked birds stay exactly where they are"*.
  The bot repeatedly **chose scenes full of animatable actors and then forbade all
  of them from moving**, leaving only the water to animate. Nowruz Bonfire is the
  purest case: dozens of courtiers around a fire, and only the fire moves.
- **Not a few bad apples — it's the house style.** All **57** pieces generated
  since 2026-07-01 use the same ambient vocabulary (ripple/shimmer/flicker/drift/
  sway/smoke/clouds). The 11 removed are just the ones dull enough to notice.

**Root cause — three existing rules compounded into "only ripples":**
1. The 06-28 **intrinsic-motion menu** ("water, fire, smoke/incense, clouds/sky,
   wind in foliage, falling petals, fountains, birds, fish") is **8/10 elemental**.
   The bot read a menu of *examples* as the *complete permitted set*.
2. The **loop rule** then deleted the only two non-elemental entries: birds and
   fish are exactly the "several independent animals" the rule says pop at the
   seam. 8 of 11 rejects are `looping: true`. Menu minus animals = fluids and fire.
3. **"Statues, mosaics and architecture should hold their form"** + **"one clear
   subject, one clear motion"** generalized into *freeze every figure in the
   scene*, because the earlier "ducks and fish disappeared/reappeared" scare
   taught the bot that a moving creature is a liability.
   Net effect: the anti-morph guardrails were doing their job, but the bot
   satisfied them the cheap way — by assigning motion only to things that have no
   fixed identity to violate. Technically clean, dramatically dead.

**The distinction the guidance was missing:** *holding form ≠ holding position.*
- **Identity-preserving motion (want):** a crane beats its wings and glides across;
  a paddler pulls a full stroke; a horse strides; a dancer completes a turn; a
  weaver's shuttle crosses; a bell swings; a cart wheel turns; a curtain billows
  out and falls. The object keeps its exact painted shape, colours and count — it
  **translates, rotates, or articulates**.
- **Identity-destroying motion (still banned):** things appearing/disappearing,
  counts changing, features sliding around, melting/morphing. That was the real
  complaint behind "the ducks and the fish disappeared" — the *popping*, not the
  swimming.

**Loop mechanics — why the constraint itself manufactures ripples:** "must return
exactly to its opening frame" mathematically selects for **oscillation**, and
low-amplitude oscillation *is* shimmer and flicker. Ripples aren't the bot's taste,
they're the only thing that trivially satisfies the constraint. Fixed by allowing
loops to close two other ways (see the rewritten rule): **continuous traversal**
(a steady stream of subjects crossing frame — one exits as another enters, so the
aggregate state is unchanged) and **complete action cycles** (a full paddle stroke,
a full wingbeat, a full bow returns the body to its own start pose).

**New / reinforced rules** (folded into the sections above):
- New hard rule: **every clip needs a primary mover that performs a legible
  action** — you must be able to say what happens in a sentence with a real verb
  ("the crane takes off", not "the light shimmers"). Ambient motion is demoted to
  **garnish, never the main course**.
- New hard rule: **hold form ≠ hold still.** Banned the blanket freeze clause;
  write *"keeps its exact painted shape and colours while it moves"* instead of
  *"stays perfectly still"*. If a scene contains people/animals, animating them is
  now the **default expectation**, not a risk to avoid.
- Rewrote the **loop rule**: loops may close via oscillation, traversal, **or** a
  complete action cycle; and when the honest motion is an actor doing something,
  **prefer non-looping** rather than downgrading the motion to fit a loop.
- Rewrote the **intrinsic-motion menu** to lead with actors (people, animals,
  vehicles, machines, cloth) and list elements second, with an explicit cap.
- Clarified **"one clear subject, one clear motion"**: one *focal action*, not a
  frozen tableau — secondary figures may move naturally.

### 2026-07-25 — removed 7 undesirable, kept 0 great

A small round, but it came with a **standing direction from the reviewer that
outweighs the seven pieces**: too much ancient art lately, and the ban on
contemporary styles should go. Both are now encoded as rules above (*Era mix*;
*Brand & taste*).

**Reviewer's direction (verbatim, the important part of this round):**
> *"Recent curations feature too many 'ancient art styles' — that's why I marked a
> lot of them undesirable. We should create fewer of them (but not completely
> zero), because they look less polished, kind of 'worn out', and less
> sophisticated. Maybe lean into more recent art styles. […] I think it's now a
> good time to remove the rule forbidding contemporary art styles. The existing
> pieces in the 'Contemporary' tab are kind of beautiful art. We shouldn't shy away
> from them as long as it doesn't give the 'AI slop' / 'AI cliché' feeling."*

**Avoid (undesirable — patterns from prompts + frames + notes):**
- **Patina upstaging the art — 3 of 7** (Pompeian maenads, Dunhuang apsaras, Greek
  black-figure). Notes: *"too much dirt / cracks on the 2 women's face… this entire
  painting is too deep in a state of decay"*; *"the painting feels too old, too worn
  out… the 年代感 feels more prominent than the art itself"*, 喧宾夺主. **Neither
  prompt asked for aging** — the existing "freshly made" rule was obeyed to the
  letter. Decay came in through the *style name* (the model's prior for "Pompeian
  fresco" / "Mogao cave mural" is the damaged survivor) and through the *in-situ
  rule* dragging the support into frame (rough cave rock, broken plaster margins,
  mottled terracotta, votive lamps set in front of the art). Fixed by the new
  **patina** hard rule: assert freshness positively, keep the support out of frame.
- **Too dark — the reviewer's primary reason for the Dunhuang reject**, and it
  turned out to be measurable and systemic. *"It's too dark, not very well lit. I
  know this might be due to the intention of creating the 'atmosphere' of being old
  (using only 3 oil lamps). But the main product need of this app is to showcase
  the art, not the atmosphere."* Mean first-frame luminance across 40 recent
  pieces: **median 133/255**; 6 under 100, **5 of those 6** carrying explicit
  dim-light vocabulary in the prompt (58 *Burning of Troy*, 61 *Rainy Night on the
  Waterfront*, 61 *Rose Garden Fountain at Night*, 76 *Night Fire Festival*, 77
  *Diwali Lamps on the River*). This round's two decay rejects were also its two
  darkest — **Dunhuang 79, Pompeian 85**. Note the overlap with the patina finding:
  *the same prompt move causes both.* "Render it in situ, lit by period light
  sources" simultaneously drags the ruined support into frame **and** drops the
  scene 50 luma below the gallery norm. And the in-situ rule was recommending a
  *"torch-lit temple interior"* as a positive example — the same
  guidance-caused-the-failure pattern as the 2026-07-19 round. Fixed by the new
  **lighting** hard rule. (The luminance figures above are recorded as *evidence*
  for the rule — the bot is not asked to measure anything; a numeric brightness
  gate was tried and dropped as over-engineering.)
- **Visually thin — 3 of 7** (Moche fineline runners, Greek black-figure chariot,
  Song sericulture). Two-tone line-on-ground styles and pale silk-toned grounds
  leave most of a 4K screen as empty beige. Same complaint as the earlier *"not
  much stuff, wouldn't say it's art"*. Fixed by the new **palette & density** rule.
- **Era fatigue — 6 of 7 were ancient/traditional**, and the single non-ancient
  reject (Pre-Raphaelite) was cut for a *technical* defect, not its looks. The
  numbers back the reviewer's read exactly. Fixed by the new **Era mix** cap.
- **One-off render defect — 1 of 7** (Pre-Raphaelite woodland brook). Note:
  *"white semi-transparent overlay on the sides of the video in the first 1 second
  for no apparent reason."* Diagnosed by pulling the source still: the defect is in
  the 4K still, not Veo — Nano Banana composed a narrow centre panel and outpainted
  hazy filler to reach 16:9, which Veo then dissolved in over the first ~1 s. From
  ~2 s on the clip is genuinely beautiful. **Recorded as a one-off, deliberately
  not turned into a rule** (reviewer's call — don't over-generalize a single render
  glitch); the existing vision gate already covers "reroll a bad still".
- **No note, no obvious defect — 2 of 7** (Ottoman whirling dervishes, and the
  Song piece above beyond its paleness). Clean frames, rules all followed. Read
  these as the era-fatigue signal rather than craft failures: flat court-miniature
  and muted court-painting looks are exactly the *"less polished, less
  sophisticated"* register the reviewer is tired of.

**Make more of (great — traits the reviewer wants repeated):**
- Nothing was flagged `great` this round, so there is no new positive signal from
  frames. The **stated** positive direction is the era shift: more recent work,
  more polish, more colour — and the `Contemporary` wing reopened.

**New / reinforced rules** (folded into the sections above):
- **Lifted the "pre-21st-century only" ban.** `Contemporary` is reopened for new
  pieces; `AUTOMATED_CURATION.md` step 2 no longer restricts the era. The bar moved
  from *recency* to *AI-cliché* — a short, specific exclusion list replaces the blanket ban, plus a taste test applied equally to every era.
- **New hard constraint — Era mix.** Cap the *archaeological look* at **≤1 of the 4
  nightly pieces**, split by **support**, not by century: plaster/rock/fired
  clay/stone/excavated metal is capped; silk, paper, panel, canvas, print, vellum
  and tapestry are not (a Song handscroll is old but arrives pristine). Favour
  `19th Century`, `Modern`, `Renaissance & Baroque`, `Contemporary`, and the later
  refined end of the Asian/Islamic traditions.
- **New hard rule — the patina must never upstage the art.** Positively assert a
  freshly-finished surface; keep the support (rock edges, broken plaster, pot
  curvature, excavation lighting, lamps in front of the art) out of frame.
- **New hard rule — light the art, not the room.** Bright, even, generous
  illumination is the default. The light source is never a subject (no
  candle/lamp/torch-lit-only scenes). Nocturnal subjects stay allowed only when the
  painted surface still reads across the whole frame. Removed *"torch-lit temple
  interior"* from the in-situ rule's positive examples, which had been endorsing
  the failure.
- **New hard rule — palette & density floor.** Two-colour line-on-ground styles and
  pale low-chroma grounds are weak full-screen choices; if used, compose densely.
- **Tool fix:** `contact-sheets.mjs` joined flags against `gallery.json`, which
  `apply.mjs` has *already* stripped by the time it runs — so `image_prompt` /
  `video_prompt` came back empty for every undesirable piece, exactly the ones whose
  prompts matter. It now reads `last-removed.json` / `last-loved.json` first and
  falls back to the gallery. Every round before this one analysed the undesirable
  pieces with **no prompt text at all**.
- **Tool fix — frame resolution.** Frames were extracted straight to 480×270 tile
  size, so detail was destroyed *before* the sheet was built and a note like
  *"too much dirt / cracks on the 2 women's face"* could not be verified, only
  taken on trust. Now each first frame is written at **full resolution**
  (`frames/<reason>/NNN.png`, 1920×1080) for close reading, and the sheet is a
  separate downscale at **2×2 / 768px tiles**. Two columns is the useful maximum:
  vision downsamples any image to ~1568px on its long edge, so per-tile detail is
  `1568/COLS` no matter what size the tiles are rendered at.

<!-- Claude appends new rounds above this line. -->
