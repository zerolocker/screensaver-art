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

<!-- Claude appends new rounds above this line. -->
