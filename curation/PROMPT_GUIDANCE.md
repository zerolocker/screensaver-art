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

### 2026-08-23 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces, **all intact-medium** (0 archaeological — well within the ≤1 cap), leaning
recent per the Era-mix rule, each with a legible primary mover:
- **The Bullfight — Spanish Romanticism** (`19th Century`, non-looping) — matador's
  cape pass, bull charges through, crowd waving fans/banners.
- **The Maypole Dance — Flemish Renaissance** (`Renaissance & Baroque`, looping via
  complete circular cycle) — Bruegel-esque ring dance around a beribboned pole.
- **Carnival Parade — Brazilian Modernism** (`Modern`, non-looping) — Portinari/
  Tarsila rounded forms, central samba dancer whirling, drummers striking.
- **The Dog Park — Contemporary Illustration** (`Contemporary`, non-looping) — flat-
  vector editorial look, a pack of dogs bounding after a thrown ball.

**What worked (reinforcing existing rules):**
- All four stills passed the vision gate on the **first** render — the standing
  image rules (positive full-bleed phrasing, "freshly painted… smooth clean
  unbroken surface", bright even daylight, the full negative block incl. no-easel)
  are producing bright, dense, edge-to-edge frames with no museum-object / border /
  patina failures. Median first-frame luminance well above the 133 norm.
- All four videos accepted on the **first** render. The Veo-drift countermeasures
  (motion "on the spot", "stays the same size and in the same place", explicit
  camera-lock + the zoom/pan/reframing negative-prompt block) held drift to a mild
  zoom in every case — no actors lost out of frame, no morphing/popping. Budget the
  usual ~1 reroll/piece, but the current phrasing is landing clips first-try.
- **Animals-as-mover works when count is pinned.** The dog-park pack (4 named dogs)
  bounded freely and kept its exact count with `--no-looping` + "same count" in the
  prompt + "extra dogs appearing / dogs disappearing" in the negatives — the
  non-loop route the 2026-07-19 log prescribes for independent creatures.

### 2026-08-24 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces spread across four wings, **all intact-medium** (0 archaeological — well
within the ≤1 cap), leaning recent, each with a legible primary mover:
- **The Tennis Match — Art Deco** (`Modern`, non-looping) — a Riviera sporting-poster
  look; the server completes a serve on the spot (leap → strike → follow-through).
- **The Cavalry Charge — Napoleonic Romanticism** (`19th Century`, non-looping) —
  Géricault/Meissonier hussars galloping full charge, sabres up, pennant streaming.
- **The Bon Odori Festival — Shin-hanga** (`Japanese`, non-looping) — a daytime ring
  of yukata dancers stepping/swaying with fans, a taiko drummer atop the yagura.
- **The City Marathon — Contemporary Illustration** (`Contemporary`, non-looping) —
  flat-vector editorial look, a dense field of runners running in place toward camera.

**What worked / reinforced:**
- 3 of 4 stills passed the vision gate first try; all four videos accepted first try.
  The standing image rules (positive full-bleed phrasing, "freshly made… smooth
  clean unbroken surface", bright even daylight, full negative block incl.
  no-easel) keep producing bright, dense, edge-to-edge frames. Veo drift stayed a
  mild zoom in every clip with the "on the spot / same size / same place" +
  camera-lock + zoom/pan negative block; no morphing, popping, or lost actors.
- **"Advancing" movers → run/gallop *in place*.** For a marathon field and a cavalry
  charge (both naturally advancing toward the camera), phrasing the motion as
  cycling legs "on the spot… staying the same size within the frame" gave full
  running/galloping strides without a runaway zoom. The mild residual zoom was the
  only drift.
- **New reject pattern — "poster" / "silkscreen poster" summons a poster *object*.**
  The first City Marathon still (image prompt led with "contemporary silkscreen
  sports poster") rendered as a **physical printed poster lying on a wooden desk** —
  white paper margins, oblique 3/4 angle, wood-grain background, and baked-in
  "CITY MARATHON / RACE DAY / OCT 26" headline **text**. Same family as the
  museum-object failure: the word *poster* (like *frame*) is read as an object to
  depict, and *poster* drags in title lettering. Reroll fix that worked: describe it
  as "a contemporary editorial illustration… the illustrated scene itself fills the
  entire image, viewed straight-on and flat to the camera," and add explicit
  negatives — *no text, no lettering, no words, no numbers, no title; not a printed
  sheet or poster object, no paper margins, no desk, no photograph of a print*.
  Takeaway for future graphic/illustration picks: **say "illustration", not
  "poster", and forbid text + the printed-sheet object.**

### 2026-08-25 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four wings, **all intact-medium** (0 archaeological — within the ≤1
cap), leaning bright/dense/colourful, each with a legible primary mover:
- **The Climbers' Ascent — Contemporary Illustration** (`Contemporary`, non-looping) —
  flat-vector editorial look; the lead climber reaches to the next hold and pulls up,
  the lower climber shifts and reaches.
- **The Silk Weavers' Courtyard — Ming Gongbi Painting** (`Chinese & Korean`, looping)
  — the ideal shuttle-crosses-the-loom mover plus a spoked reeling wheel turning one
  full cycle; loop closes via gentle oscillation.
- **The Caravan at the Oasis — Safavid Persian Miniature** (`Islamic`, non-looping) —
  a line of laden camels plods across a bright jewel-toned oasis, drivers alongside;
  non-looping (the 07-19 prescription for a countable set of animals, to avoid the
  seam pop).
- **The Speedboat Race — Art Deco** (`Modern`, non-looping) — streamlined mahogany
  racers throwing a rooster-tail of spray across a sunlit Riviera lake.

**What worked / reinforced:**
- 3 of 4 stills passed the vision gate first try; all four videos accepted first try.
  Standing image rules keep producing bright (luma 128–169, all near/above the 133
  norm), dense, edge-to-edge frames. Veo drift stayed a mild zoom in every clip with
  the "on the spot / same size / same place" + camera-lock + zoom/pan negative block;
  no morphing, popping, or lost actors. Camels strode in place, count preserved;
  weaving/reeling movers read cleanly with no facial-uncanny.
- **Reinforced — "poster"/racing subjects still summon baked-in text.** The first
  speedboat still (Art Deco *racing* boats) rendered legible names on the hulls
  ("THUNDER", "STARFIRE") despite a no-text clause. Same family as the
  [[curation-poster-summons-object]] memory: competitive/vehicle subjects invite
  hull numbers and names. Reroll fix that worked: state positively that **"every hull
  is completely plain and unmarked — bare wood/paint only, no names, numbers or
  letters"** and add an explicit "no writing on the boats or awnings" negative. The
  vision gate caught it; cheap to reroll the still.

### 2026-08-26 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, each with a legible primary mover:
- **The Boxing Match — Ashcan School** (`Modern`, non-looping) — a George Bellows
  register; the boxer in red drives a right cross, both fighters twist with the
  blow, the ringside crowd throws up their hands.
- **The Ploughing Team — French Naturalism** (`19th Century`, non-looping) — a Rosa
  Bonheur register; a yoked ox team plods forward dragging the plough, ploughman
  behind, gulls wheeling over the fresh furrows.
- **The Ice Hockey Game — Contemporary Illustration** (`Contemporary`, non-looping) —
  clean flat-vector editorial look; the attacker drives and rips a shot, ice-spray
  fans, defender and goalie react.
- **Yabusame, the Horseback Archer — Edo Ukiyo-e** (`Japanese`, non-looping) — a
  Kuniyoshi musha-e; the archer at full gallop looses an arrow at the target,
  banners and maple leaves streaming, kimono crowd lining the shrine course.

**What worked / reinforced:**
- All four stills passed the vision gate **first try**; all four videos accepted
  first try. The standing image rules (positive full-bleed phrasing, "smooth clean
  unbroken surface … as on the day it was finished", bright even daylight, full
  negative block) kept producing bright, dense, edge-to-edge frames with no
  museum-object / border / patina failures. Veo drift stayed a **mild zoom/reframe**
  in every clip with the "on the spot / same size / same place" + camera-lock +
  zoom/pan negative block; no morphing, popping, or lost actors.
- **"On the spot" tames advancing movers again.** The ploughing ox team and the
  galloping yabusame horse (both naturally advancing) rode/plodded in place with
  legs cycling — full stride, count preserved, only the usual mild residual zoom.
  Same recipe as the 08-24 marathon/cavalry note.
- **Reinforced — forbid the medium's baked-in text up front.** Following the
  [[curation-poster-summons-object]] family: the ukiyo-e prompt pre-empted the
  title *cartouche + artist seals* ("no cartouche, no calligraphy, no seals") and
  the hockey prompt pre-empted *jersey numbers / board advertising* ("no numbers,
  no logos, no advertising on the boards; every jersey and board plain and
  unmarked"). Both came back clean — cheaper than a reroll. Only a faint jersey
  marking slipped into the hockey clip's motion (negligible). Sports/vehicle and
  print subjects still invite lettering; naming the specific text to forbid works.

### 2026-08-27 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, each with a legible primary mover:
- **The Snake Boat Race — Kerala Mural** (`South & Southeast Asian`, non-looping) — a
  chundan vallam full of oarsmen pulling one synchronized paddle stroke, helmsman at
  the stern, spectators on both banks; brilliant flat Kerala temple-mural palette.
- **The Mehter Band — Ottoman Miniature** (`Islamic`, non-looping) — a janissary band
  playing in place: cymbals clashing, kettledrums struck, horsetail banners swaying,
  on a dense Iznik-tiled courtyard.
- **The Steeplechase — British Sporting Art** (`19th Century`, non-looping) — a
  Herring/Alken register; the field gallops and clears the brushwood-hedge water jump
  in mid-leap, water and turf flying, top-hatted crowd behind.
- **The Skatepark Bowl — Contemporary Illustration** (`Contemporary`, non-looping) —
  clean flat-vector editorial look; the hero skater completes an aerial and carves
  down into the concrete bowl, two more skaters carving around.

**What worked / reinforced:**
- 3 of 4 stills passed the vision gate first try; all four videos accepted first try.
  Standing image rules keep producing bright, dense, edge-to-edge frames; Veo drift
  stayed a mild zoom/reframe in every clip with the "on the spot / same size / same
  place" + camera-lock + zoom/pan negative block; no morphing, popping, or lost
  actors. Synchronized oarsmen, drum/cymbal strikes, galloping-leap and skate-carve
  all read cleanly.
- **Reinforced — Ottoman/Persian *miniature* prompts default to a paper margin +
  ruled border, and the margin arrives *aged*.** The first Mehter still rendered the
  scene inside a gold-ruled border with cream, foxing-spotted paper margins down the
  sides — both the [[curation-miniature-paper-border]] failure *and* a patina side
  door (the aged paper, not the art, carried the 年代感). Reroll fix that worked:
  lead with **"composed as an EXTREME full-bleed close crop so the painted scene
  bleeds off all four edges"** and spell out the negatives — *no paper margin, no
  cream/beige border, no ruled gold border line, no page edge* — plus "the courtyard
  and figures are cropped by the image edges themselves." Came back edge-to-edge with
  no aged margins (only a faint gold hairline the Veo zoom then crops). Takeaway:
  **for any manuscript/miniature pick, pre-empt the margin up front** — the
  full-bleed clause alone is not enough; name the border parts to forbid.
- **"On the spot" tames advancing movers again** (steeplechase field, snake boat) —
  gallop/row cycling in place gave full stride with only the usual mild residual zoom.

### 2026-08-28 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning recent/bright/dense — and a **deliberate mover-type rut-break**:
the last several rounds were almost all sport/race/match/dance/festival movers, so
this round picked four *different* kinds of primary mover instead:
- **The Station — French Impressionism** (`19th Century`, non-looping) — a *machine*
  mover: a dark-green steam locomotive eases forward into a glass-and-iron train shed
  as steam billows up into the vault and a porter pushes a luggage cart down the
  sunlit platform; Monet Gare-Saint-Lazare register.
- **The River Market — Ming Dynasty Court Painting** (`Chinese & Korean`, non-looping)
  — a *boat + crowd traversal*: a laden cargo junk drifts under a crowded arched
  bridge in a dense full-polychrome Qiu-Ying "prosperous city" riverside town.
- **The Apple Harvest — Contemporary Illustration** (`Contemporary`, non-looping) — a
  *harvest/working* scene: a little red tractor rolls down the orchard lane, pickers
  reach from ladders, a dog trots; clean flat-vector autumn palette.
- **The Builders — Modern** (`Modern`, non-looping) — a *construction* mover: a red
  steel girder rises on its cable while two workers haul the rope hand over hand and
  one climbs the scaffold; bold Léger "The Builders" idiom, primary-colour planes.

**What worked / reinforced:**
- **All four stills passed the vision gate first try; all four videos accepted first
  try.** Standing image rules kept producing bright (luma 113–147; three near/above
  the 133 norm, the Léger a touch lower at 113 from its grey scaffolding/blue sky but
  well above 100 and vividly saturated), dense, edge-to-edge frames — no
  museum-object / border / patina failures.
- **Mover-type variety is a cheap, high-value rut-break.** Machine (locomotive),
  boat-under-bridge, tractor+harvest, hoisted girder all read as clearly as the
  sport movers did, and diversify the gallery's *motion vocabulary* away from
  "someone competes." Worth doing every few rounds when the recent batch skews one
  way. No new rule needed — just a taste reminder.
- **Full-colour Ming genre beats monochrome Song genre for a screensaver.** A
  riverside-market handscroll was the pick; choosing the *Ming Qiu-Ying full mineral
  colour* register (not the Song ink-and-light-tint one) gave a dense, saturated,
  edge-to-edge frame that clears the palette-and-density floor, where a monochrome
  Qingming-style ink scroll would have risked the "empty beige" thinness. The
  full-bleed close-crop + "no paper margin / no ruled border / no page edge" clause
  (per [[curation-miniature-paper-border]]) again killed the silk-margin border; only
  the warm silk ground tone remained, reading as sky/water, not an empty margin.
- **Veo drift note — flat-vector illustration drifted into a slow lateral pan.** With
  the identical camera-lock + zoom/pan negative block that holds painterly pieces to a
  mild zoom, the *Apple Harvest* flat-vector clip still turned "tractor drives toward
  camera on the spot" into a smooth left-to-right pan across the orchard (new trees
  entering frame). It's not a defect — a slow pan is explicitly allowed, no morphing
  or popping, style rock-solid — but note that **the clean-vector illustration style
  seems more prone to reading an advancing-mover cue as a whole-scene pan** than the
  oil/gongbi styles, which stayed near-locked. The other three held to the usual mild
  zoom. If a locked frame is essential for such a piece, consider dropping the
  advancing-mover framing entirely (animate only in-place actions) rather than trusting
  the negative block.

### 2026-08-29 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, each with a **deliberately different
kind of primary mover** (continuing the 08-28 mover-type rut-break):
- **The Balloon Ascent — 19th-Century Romanticism** (`19th Century`, non-looping) — a
  *vehicle-lift-off + crowd* mover: a great striped hot-air balloon strains upward off
  a sunlit fair field while shirt-sleeved crew haul the mooring ropes and a top-hatted
  crowd waves hats and handkerchiefs.
- **The Ice Games on the Palace Moat — Qing Court Painting** (`Chinese & Korean`,
  non-looping) — a *human-formation traversal* mover: scores of
  Manchu bannermen skate in a long serpentine across the frozen moat, dragon banners and
  yellow pennants streaming, archers drawing bows on skates, snow-dusted Forbidden City
  walls behind.
- **The Rice Terraces — Balinese Painting** (`South & Southeast Asian`, non-looping) — an
  *animal-labour* mover: a water buffalo plods through a flooded paddy pulling a wooden
  plough (bright water splashes) while a row of villagers bend transplanting seedlings.
- **The Assembly Line — American Social Realism** (`Modern`, non-looping) — an
  *industrial-machine + workers* mover: line workers swing wrenches, hammer and weld
  while a gleaming red car body edges along the overhead conveyor.

**What worked / reinforced:**
- All four **videos accepted first try**. Veo drift stayed a mild-to-moderate *zoom-out*
  on the two crowd scenes (balloon, ice games) and mild elsewhere, with the "on the spot
  / same size / same place" + camera-lock + zoom/pan negative block; no morphing,
  popping, or lost actors. The **"on the spot" trick tamed the skaters** (advancing
  movers → skate in place, legs cycling), same recipe as the 08-24/26 marathon/cavalry
  notes. The assembly-line conveyor correctly *advanced* (a new car body entered frame)
  — reads as "the line is running," a clean traversal, not a defect.
- **New/reinforced reject pattern — the margin/border failure is not just
  miniatures; ANY "painting on [support]" style can render its physical support with
  margins.** 2 of 4 stills needed a reroll, both for the *same* failure: the Qing
  gongbi-**on-silk** came back inside a cream silk-scroll margin, and the Balinese
  tempera-**on-canvas** came back as a painting floating on a wide unpainted canvas edge.
  This extends [[curation-miniature-paper-border]] beyond manuscripts/miniatures — naming
  a support ("on silk", "on canvas", "on panel") invites the model to depict that support
  *with its margins*. **Identical fix worked for both:** lead the image prompt with
  *"Composed as an EXTREME full-bleed close crop: the painted scene bleeds off all four
  edges and is cropped by the image edges themselves"* and name the specific parts to
  forbid — *no silk margin / no scroll mounting* (silk) or *no unpainted canvas margin /
  no white or cream canvas edge* (canvas), plus the standing "no painted border, no mat,
  no frame." Both rerolled edge-to-edge first try. Takeaway: **for any style you anchor
  as "on canvas/silk/paper", pre-empt the support margin up front**, exactly as for
  manuscripts. The vision gate caught both cheaply.

### 2026-08-30 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, and continuing the 08-28/08-29
**mover-type rut-break** — four *different* kinds of primary mover:
- **The Carousel — Fauvism** (`Modern`, **looping**) — a *rotating-machine* mover: a
  grand fairground carousel turns one full smooth rotation, painted wooden horses
  rising and falling on their poles, children riding; bold Derain/Dufy Fauve colour.
  Loop closes via a **complete rotation cycle** (start == end frame) — the clean way
  to loop a machine, no oscillation-ripple rut.
- **The Kite Festival — Kishangarh Miniature** (`South & Southeast Asian`,
  non-looping) — a *flying-objects + line-haul* mover: dozens of small kites dive and
  climb across a radiant turquoise sky while rooftop figures haul their strings and a
  boy runs the parapet, pigeons wheeling; brilliant Kishangarh mineral palette.
- **The Fishermen's Catch — Dutch Golden Age** (`Renaissance & Baroque`, non-looping)
  — a *synchronized-human-labour-on-water* mover: six fishermen heave a bulging net
  and the silver herring cascades onto the quay, gulls wheeling, fishwives haggling;
  luminous Van de Velde/Bakhuizen silvery marine daylight.
- **The Village Potters — Contemporary Illustration** (`Contemporary`, non-looping) —
  a *craft-rotation* mover: a potter draws up a tall vessel on a spinning kick-wheel,
  an apprentice centres a bowl on a second wheel, a woman traverses with a stack of
  pots, kiln smoking; clean flat-vector editorial look, warm saturated palette.

**What worked / reinforced:**
- **All four stills passed the vision gate first try; all four videos accepted first
  try.** Standing image rules kept producing bright, dense, edge-to-edge frames with
  no museum-object / border / patina failures. The **full-bleed close-crop +
  "no paper margin / no ruled gold border / no page edge" clause worked again** for
  the Kishangarh miniature ([[curation-miniature-paper-border]]) — came back
  edge-to-edge with no cream margin. The Contemporary-illustration piece led with
  "editorial illustration … not a printed sheet or poster object, no paper margins,
  no desk" + "no text/numbers" ([[curation-poster-summons-object]]) and came back
  clean, no baked-in lettering.
- **Rotation is a clean, under-used loop mechanism.** The carousel looped via a full
  rotation cycle (first==last frame) and returned exactly to its opening state with
  real, legible movement (horses bobbing, ring revolving) — no oscillation-ripple
  degeneration. A rotating machine is a good answer to "how do I get a loop with
  actual motion in it," alongside traversal and action-cycle.
- **The net-haul (Fishermen's Catch) is a standout dramatic mover** — the catch
  visibly pours out of the lifted net onto the quay mid-clip, exactly the kind of
  legible primary action the 07-19 rules ask for, with the camera near-locked.
- **Veo drift** stayed a **mild zoom** in all four with the "on the spot / same size /
  same place" + camera-lock + zoom/pan negative block; no morphing, popping, or lost
  actors. Notably the flat-vector *Village Potters* clip did **not** drift into a
  whole-scene lateral pan this round (the 08-28 caution) — only a mild zoom, with the
  intended woman-traversal reading correctly. The reinforced negative block (adding
  "whole-scene pan" for the illustration piece) may have helped; keep it for
  flat-vector picks.
- **Mover-type variety remains a cheap, high-value rut-break.** Rotating carousel,
  flying kites, net-haul, potter's wheel all read as clearly as sport/dance movers and
  keep diversifying the gallery's motion vocabulary. Worth doing every few rounds.

### 2026-08-31 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, and continuing the 08-28→08-30
**mover-type rut-break** with four *different* kinds of primary mover — and a
deliberate step **away from Contemporary flat-vector illustration** (which had grown
very heavy in recent rounds, ~20 titles):
- **The High Dive — American Scene Painting** (`Modern`, non-looping) — a *human
  leap/arc* mover: a diver springs off a tall high board and arcs down into a big
  splash in a crowded 1930s municipal pool; bold Reginald Marsh / Isaac Soyer figures.
- **The Log Drive — American Realism** (`19th Century`, non-looping) — a *riding-
  rushing-water* mover: a red-flannel river-man leaps from one rolling log to the next
  on a white-water spring log drive, peavey braced, spray flying; Winslow-Homer register.
- **The Tightrope Walker — Joseon Genre Painting** (`Chinese & Korean`, non-looping) —
  a *balance-walk* mover: a jultagi rope-walker springs along a single taut rope, fan
  and sash fluttering, a dense laughing crowd and drum/piri musicians below; Kim Hong-do
  (Danwon) register.
- **The Elephant Bath — Pahari (Kangra) Miniature** (`South & Southeast Asian`,
  non-looping) — an *animal water-play* mover: a royal elephant curls its trunk up and
  blows a brilliant arc of water over its own back while mahouts scrub it in a jewel-
  toned river.

**What worked / reinforced:**
- All four **videos accepted first try**; Veo drift stayed a **mild zoom** in every
  clip with the "on the spot / same size / same place" + camera-lock + zoom/pan
  negative block — no morphing, popping, or lost actors. The diver completed a full
  spring→arc→splash action cycle; the log-driver's leap-and-land, the rope-walker's
  springing step, and the elephant's trunk-spray all read cleanly. The mild zoom is a
  quiet ally here: it **cropped the extreme-corner artefacts** out of the log-drive clip.
- **Mover-type variety + dropping Contemporary-illustration for a round = a good
  rut-break.** Leap/dive, water-riding, balance-walk and animal-spray diversify the
  motion vocabulary, and four painterly registers (WPA oil, Homer oil, Joseon ink-and-
  colour, Pahari gouache) read fresher than yet another flat-vector editorial piece.
- **The margin/border pre-empt still needed for BOTH Asian picks, and worked.** Per
  [[curation-miniature-paper-border]]: the first Pahari elephant still came back with a
  gold/yellow **ruled border + margin down the left edge**; the reroll led with
  "EXTREME full-bleed close crop … cropped by the image edges themselves" and named the
  parts to forbid (*no gold or yellow ruled border line, no cream/beige margin, no page
  edge*) and came back edge-to-edge (only a thin dark hairline at the extreme right that
  the Veo zoom crops). The Joseon genre still used the same clause up front and was clean
  first try.

**New reject pattern — naming a real artist summons a real (or faux) SIGNATURE.**
The Log Drive was the whole story this round. First still: image prompt named
*"Winslow Homer"* as the register → the model painted a legible red **"Winslow Homer"
signature** in the bottom-right corner (a real artist's name reproduced *and* forbidden
text). Reroll with the artist's name **removed** (described as *"plein-air outdoor-
realism of the Maine and Adirondack north woods"* instead) still produced a red
**faux-cursive signature squiggle** in the same corner — the *painting-genre itself*
(19th-c. sporting/realist oil) carries a signed-canvas prior, exactly the baked-in-text
family as [[curation-poster-summons-object]]. Takeaways, folded into practice:
- **Never name a real artist in an image prompt.** Anchor the register by
  period + medium + place + technique (school, not signature). Naming the artist is what
  put the name on the canvas.
- **For any easel-painting genre (oil/sporting/portrait/still-life), pre-empt the
  signature up front** the way we pre-empt poster text and miniature margins: add
  *"the painting is completely unsigned, clean bare paint in every corner; no signature,
  no autograph, no cursive mark, no lettering in any corner"* to the negatives. (As with
  "frame"/"cracks", keep it a positive-plus-negative; it did reduce but not fully kill it.)
- **Salvaging a signed-but-otherwise-perfect still:** the Nano-Banana *edit* endpoint was
  down (repeated 503s during a high-demand window — generation itself also intermittently
  503'd/timed out this round, so budget for retries), and a naive local rectangle-paste
  over the corner left an obvious seam. What worked was a **feathered mirror patch** in
  Pillow: paste a horizontally-flipped copy of the region just left of the corner box
  (mirroring continues the log/water textures across the vertical join) over a box that
  fully covers the artefact, composited through a Gaussian-blurred mask so the inner
  edges blend — no hard rectangle. The Veo zoom then crops the corner anyway. Cheap,
  API-free, good enough for a busy corner. (Keep rejects in the scratchpad per
  [[curation-keep-rejected-renders]] — the seam happened partly because the pre-patch
  still was overwritten.)

### 2026-09-01 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, and continuing the 08-28→08-31
**mover-type rut-break** with four *different* kinds of primary mover — and a second
consecutive round **skipping Contemporary flat-vector illustration** (still heavy):
- **The Paddle Steamer — American Luminism** (`19th Century`, non-looping) — a
  *rotating-machine-on-water* mover: a Mississippi sidewheel paddle steamer steams
  down a bright river, the big red paddlewheel churning white foam, smoke and steam
  billowing from the stacks. (New style added to `ART_STYLES_FOR_INSPIRATION.md`.)
- **The Printing House — Dutch Golden Age** (`Renaissance & Baroque`, non-looping) — a
  *machine + coordinated-labour* mover: a master printer hauls the long wooden bar of
  an oak hand press (platen screws down), an apprentice inks the type with leather
  ink-balls, a boy carries a sheet to the drying line; bright leaded-window daylight.
- **The Rodeo — American Regionalism** (`Modern`, non-looping) — an *animal-buck*
  mover: a cowboy rides a wildly bucking chestnut bronco, hind legs kicking high, dust
  flying, a mounted pickup rider behind, dense grandstand crowd; Benton-esque rolling
  forms, luminous prairie sky.
- **Mochi Pounding at the New Year — Shin-hanga** (`Japanese`, non-looping) — a
  *rhythmic alternating-strike* mover: two men swing kine mallets in turn onto the
  white rice in the usu mortar while a woman folds the dough between strikes; bright
  festive village courtyard with kadomatsu and plum blossom.

**What worked / reinforced:**
- **All four videos accepted first try.** Veo drift stayed a mild-to-moderate zoom in
  every clip with the "on the spot / same size / same place" + camera-lock + zoom/pan
  negative block; no morphing, popping, lost actors, or count changes. The paddlewheel
  churn, the press bar-pull → platen → tympan cycle, the full bronco buck cycle
  (rear → land → forward), and the two-man alternating mochi pounding all read
  cleanly as legible primary actions.
- **Two-actor coordinated strikes (mochi) held up** — the alternating mallets and the
  woman's hands darting into the mortar between strikes did not collide or morph, with
  "extra arms / extra mallets / hands passing through the mallet / figures merging" in
  the negative block. A good template for coordinated-tool movers.
- **Reinforced — "on canvas / oil painting" summons a raw canvas margin, not just a
  border.** The first Rodeo still (led with "American Regionalist **oil painting**")
  came back floating inside a **frayed, unpainted tan canvas edge on all four sides**
  — the [[curation-miniature-paper-border]] failure extended to plain easel oil, exactly
  the 08-29 "any painting-on-[support] style renders its support with margins" note.
  Reroll fix that worked: lead with **"Composed as an EXTREME full-bleed close crop:
  the painted scene bleeds off all four edges and is cropped by the image edges
  themselves"** + name the parts to forbid (*no unpainted canvas margin, no raw or
  frayed canvas edge, no tan/cream border strip, no visible edge of the canvas*).
  Came back edge-to-edge first try. Takeaway: **use the full-bleed close-crop clause on
  EVERY painterly pick, not only miniatures/silk/print** — "oil painting" alone is
  enough to summon a canvas edge.
- **Reinforced — Shin-hanga / woodblock prints summon a signature block + red hanko
  seals AND coat kanji.** The first mochi still (despite a standing no-cartouche/seal
  clause) put **vertical calligraphy + two red hanko seals in the bottom-right corner**
  *and* **kanji lettering on the lead pounder's happi coat** ([[curation-poster-summons-object]]
  family). Because one text zone was on the *primary mover* (a patch there would not
  survive Veo), a **reroll beat patching** — added *"every garment is plain solid colour
  with NO characters/kanji/writing on it"* + *"absolutely no red seal stamp, no hanko,
  no artist seal, no signature block in any corner or margin."* Came back fully clean
  first try. Takeaway: **for ukiyo-e/Shin-hanga picks, forbid clothing text explicitly,
  not just the corner cartouche/seal** — happi coats and banners carry a kanji prior.
- **Patch salvage worked for a background-only text element (printing house).** A framed
  broadsheet of gibberish text hung on the back wall (an easy, static, non-mover zone);
  a feathered Pillow paste of a flat sampled wall/paper tone through a Gaussian-blurred
  mask erased the text to a blank framed panel — no reroll needed. Rule of thumb this
  round: **background/static text → cheap feathered patch; text on a moving actor →
  reroll.** (Note: sample the fill colour from *inside* the blank paper, not the frame —
  a first sample hit the wooden frame and painted a brown blotch.)
- **Transient-503 note:** `gemini-3-pro-image` was under heavy load all night —
  most stills needed 1–3 built-in retries and two full re-invocations after the
  wrapper exhausted its retries. Budget extra wall-clock time; the generations
  themselves were fine once they landed.

### 2026-09-02 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, continuing the **mover-type rut-break**
with four *different* kinds of primary mover — and a deliberate push into **two
under-used wings** (`Medieval & Byzantine`, empty until now; `Islamic`):
- **The Joust — International Gothic** (`Medieval & Byzantine`, non-looping) — a
  *combat / horse-charge* mover: two armoured knights gallop the tilt and the near
  lance shatters into flying splinters; caparisoned destriers, a timber gallery of
  scarf-waving lords and ladies, heralds' trumpet pennants. Jewel-bright
  illuminated-manuscript register on vellum (intact-medium, not archaeological).
- **The Festival Acrobats — Ottoman Miniature** (`Islamic`, non-looping) — an
  *acrobatics/tumbling* mover: a central acrobat somersaults over a carpet while two
  tumblers roll, a janissary kettledrum-and-cymbal band keeping the beat; dense
  Iznik-tiled palace courtyard, festival lamps, Levni/Surname register.
- **The Sailing Regatta — American Impressionism** (`19th Century`, non-looping) — a
  *wind-sailing* mover: a fleet of gaff-rigged sloops heels and surges in a fresh
  breeze, spray off the bows, signal-flag lines streaming; sparkling high-key
  Hassam-esque coastal light. (New style added to `ART_STYLES_FOR_INSPIRATION.md`.)
- **The Roller Coaster — American Scene Painting** (`Modern`, non-looping) — a
  *machine-thrill plunge* mover: a wooden coaster train plunges the first drop,
  riders' arms up and hair flying, a turning Ferris wheel and striped fairground
  behind; bold Marsh/Coney-Island Regionalist realism.

**What worked / reinforced:**
- **All four stills passed the vision gate first try; all four videos accepted first
  try.** Standing image rules kept producing bright, dense, edge-to-edge frames with
  no museum-object / border / patina failures. The full-bleed close-crop + margin/
  border pre-empt held the manuscript (joust) and miniature (acrobats) edge-to-edge
  with no vellum/paper margin ([[curation-miniature-paper-border]]), and the
  unsigned/plain pre-empt kept both oil pieces free of a signature or hull/sail
  lettering ([[curation-artist-name-summons-signature]], [[curation-poster-summons-object]]).
- **Under-used wings are a cheap, high-value rut-break too** — same idea as mover-type
  variety, applied to the *wing* axis. `Medieval & Byzantine` was empty and
  `Islamic` sparse; both took bright, dense, jewel-toned intact-medium pieces
  (International Gothic manuscript, Ottoman court miniature) that clear the palette-
  and-density floor easily — the manuscript/miniature look is "old" but pristine and
  colourful, **not** the worn-out archaeological register the reviewer dislikes.
  Worth checking the wing distribution, not just the mover distribution, each round.
- **Multi-acrobat extreme poses animated cleanly when anchored to a reliable
  rhythmic mover.** The acrobats still had three figures in inverted/tumbling poses
  (normally a collision/morph risk); pinning the count ("exactly three acrobats, no
  extra limbs/arms/heads") and leaning the clip on the drum-and-cymbal band (a safe
  mechanical strike, like the mochi/mehter movers) gave a legible "acrobats tumble
  while the band plays" with figures completing their rolls and no soup. Template for
  risky-body picks: **give the clip a low-risk mechanical anchor and pin the count.**
- **Veo drift** stayed a mild zoom in all four with the "on the spot / same size /
  same place" + camera-lock + zoom/pan negative block; no morphing, popping, or lost
  actors. The **coaster plunge read as a clean traversal** — the front train rushed
  down and off the bottom while a fresh train crested the hill (new cars entering,
  none popping), the trestle and Ferris wheel rock-solid; a good template for a
  fast-advancing vehicle that can't stay "on the spot" (let it traverse and refill
  rather than fighting the motion).
- **ffmpeg-libwebp gotcha recurred** ([[curation-ffmpeg-no-libwebp]]) — `publish-piece.mjs`
  webp derivation failed on the system ffmpeg; prepending `curation/.ffmpeg-shim` to
  PATH (Pillow-backed webp encode) and re-running with `--resume` fixed it. Do this
  from the first publish next round.

### 2026-09-03 — interrupted round, 3 pieces recovered (committed 2026-09-04)

Not a human-review round; no removals. **This run was interrupted after publishing
3 of the intended 4 pieces** — the three below were already uploaded to R2 (verified
live) and appended to `gallery.json`, but the run never committed, never wrote this
log entry, and never produced a 4th piece. Recovered and committed on 2026-09-04 (the
next nightly run found the uncommitted work). No 4th piece was backfilled — that round
is closed; a full fresh 4-piece round follows for 2026-09-04. The three, all
intact-medium (0 archaeological), each with a legible primary mover:
- **The Tug of War — Joseon Genre Painting** (`Chinese & Korean`, non-looping) — a
  *synchronized two-team pull* mover: two village teams haul a colossal straw rope in
  opposite directions at a juldarigi festival, bodies leaning back, drummer and banner.
- **The Barn Raising — American Regionalism** (`Modern`, non-looping) — a
  *coordinated-labour lift* mover: a rural crew hauls a great timber barn-wall frame up
  toward vertical on ropes and pike poles; Benton-esque rounded Midwestern realism.
- **The Sledding Hill — Contemporary Illustration** (`Contemporary`, non-looping) — a
  *downhill-slide* mover: bundled children ride toboggans and saucer sleds down a sunny
  snowy hill, powder spraying. Deliberately a **gouache-and-coloured-pencil** editorial
  register (explicitly "NOT flat vector") to vary the heavy recent flat-vector look.

All three prompts follow the standing rules (full-bleed close-crop margin pre-empt,
unsigned/no-text pre-empt, bright even daylight, "on the spot / same size / same place"
+ locked camera). Recorded from the committed prompts for continuity; per-piece reroll
notes were lost with the interrupted run.

### 2026-09-04 — nightly generation round (4 pieces added)

Not a human-review round; no removals. (This run first **recovered the interrupted
2026-09-03 round** — 3 already-published pieces committed, see the entry above — then
generated the 4 below.) Four pieces across four distinct wings, **all intact-medium**
(0 archaeological — within the ≤1 cap), leaning bright/dense/colourful, continuing the
**mover-type rut-break** with four *different* kinds of primary mover, and hitting the
**most under-used wing** (`Arts of Africa & Oceania`, only 3 pieces before this):
- **The Masquerade — Contemporary West African Painting** (`Arts of Africa & Oceania`,
  non-looping) — a *whirling-dance* mover: a great Egungun masquerade spins on the spot,
  its layered cloth-strip costume flaring out, while drummers strike talking drums and a
  bright wax-print crowd claps. Vivid modern Nigerian/Ghanaian festival-painting register
  (new style added to `ART_STYLES_FOR_INSPIRATION.md`).
- **The Highland Games — Victorian Scottish Genre Painting** (`19th Century`,
  non-looping) — a *heavy-throw* mover: a kilted athlete heaves the caber and the great
  pole flips end over end; piper, Highland dancers, tartan crowd, tents, castle behind
  (new style added).
- **The Speedway — Art Deco** (`Modern`, non-looping) — a *machine-slide* mover: four
  leaned-over riders broadside their motorcycles round the cinder bend, back wheels
  throwing huge fan-tails of dust, packed Deco grandstand.
- **The Cheese Market — Dutch Golden Age** (`Renaissance & Baroque`, non-looping) — a
  *coordinated-human-traversal* mover: pairs of white-clad porters trot in step with
  loaded cheese-barrows swaying between them across a sunlit square carpeted with golden
  cheeses, weigh-house and canal barge behind.

**What worked / reinforced:**
- **All four stills passed the vision gate first try; all four videos accepted first
  try.** Standing image rules kept producing bright, dense, edge-to-edge frames with no
  museum-object / border / patina failures. Veo drift stayed a mild zoom/reframe in every
  clip with the "on the spot / same size / same place" + camera-lock + zoom/pan negative
  block; no morphing, popping, lost actors, or count changes.
- **Caber toss = a clean rigid-object throw mover.** The tapering pole flipped end over
  end holding its exact straight rigid shape (no bending/rubberiness), completed the toss
  and dropped out of frame as it landed while the thrower followed through — the mild
  reframe read as "the toss finishing." A good template for a *heavy thrown object* action
  (name the object rigid, let it leave frame on landing).
- **Speedway: fast small vehicles animate cleanly when told to hold form + ride "on the
  spot around the bend."** Four rigid motorcycles kept their shape and count through the
  corner slide (no merging), wheels spun and threw dramatic dust fan-tails, only a mild
  zoom. Pre-empting the racing-numbers/lettering up front worked again
  ([[curation-poster-summons-object]]): anchored as an "Art Deco sporting **painting**"
  (not "poster"), with "every bike/suit plain and unmarked, no numbers/logos" + "not a
  printed poster object" — came back with zero baked-in text.
- **Under-used-wing rut-break again** (per the 09-02 note): `Arts of Africa & Oceania`
  was the sparsest wing (3), and a bright contemporary West African **festival painting**
  filled it with a jewel-bright, dense, intact-medium piece that clears the palette/density
  floor and dodges the worn archaeological register entirely. Check the wing distribution,
  not just the mover distribution, each round — the low wings that work best are the
  *pristine-and-colourful* ones (manuscript, miniature, contemporary regional painting),
  not the excavated ones.
- **The full-title grep ([[curation-check-full-title-list]]) earned its keep hard this
  round.** The gallery is now ~387 pieces, and *most* of the first-draft picks were
  already taken — Egyptian marsh-fowling (×3!), Dutch windmills (×3), wrestling (×2),
  Grand Prix Futurism, a Flying Trapeze, a polo match, the Glassblowers of Murano, an
  ocean liner — plus Safavid Persian miniature is now over-used (8). Lesson reinforced:
  at this catalog size, grep the **whole** `gallery.json` for every candidate subject +
  a few synonyms *before* writing a prompt; a "fresh" idea is more likely taken than not.

### 2026-09-05 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, continuing the **mover-type rut-break**
with four *different* kinds of primary mover, and again hitting an **under-used
wing** (`Arts of Africa & Oceania`, only 4 before this):
- **The Flamingo Lake — Tingatinga Painting** (`Arts of Africa & Oceania`,
  non-looping) — a *birds-take-flight* mover: a flock of pink flamingos beats its
  wings and lifts off a brilliant turquoise soda lake while hundreds more wade and
  feed. Vivid high-gloss enamel Tanzanian Tingatinga register (new style added to
  `ART_STYLES_FOR_INSPIRATION.md`).
- **The Ski Jump — Art Deco** (`Modern`, non-looping) — a *human-flight/soar* mover:
  a lone ski jumper springs off the take-off ramp and soars forward in the flight
  position over a dazzling snow slope, crowd waving pennants below; streamlined 1930s
  Art Deco sporting register.
- **The Archery Contest — Flemish Baroque** (`Renaissance & Baroque`, non-looping) —
  a *draw-and-loose* mover: a guild archer at a village popinjay-shoot (papegaai-
  schieten) looses his arrow up at the wooden bird atop a tall pole and the crowd
  throws up their hands; bright Teniers-tradition festival square.
- **The Floating Market — Thai Folk Painting** (`South & Southeast Asian`,
  non-looping) — a *boat-traversal* mover: fruit vendors paddle laden sampans through
  a crowded klong past teak stilt-houses and a gilded chedi; bright, extremely dense,
  saturated contemporary Thai folk register (new style added — deliberately brighter
  and denser than the muted Vietnamese-silk register, which is already used twice and
  would risk the palette/density floor).

**What worked / reinforced:**
- **All four videos accepted** (archery on a retry — see below); Veo drift stayed a
  mild zoom in every clip with the "on the spot / same size / same place" +
  camera-lock + zoom/pan negative block. No morphing, popping, lost actors, or count
  changes. The flamingo flock lifted off cleanly (birds keep shape/markings), the ski
  jumper held his rigid flight shape (one jumper, skis intact), the archer completed a
  legible draw→release→arrow-in-flight→crowd-reacts cycle, and the market boats/water
  moved gently — a legible boat-traversal, not bare ambient shimmer.
- **New reject pattern — "enamel/paint on board" (Tingatinga) summons the painted
  *object*, tilted in 3D against a real background.** The first Flamingo Lake still
  rendered as a **physical glossy board propped at an oblique angle in a garden** —
  visible board top/right edges, blurred trees behind it — the museum-object /
  support-margin failure, triggered here by "high-gloss enamel **on smooth board**"
  (the model's prior for Tingatinga is a photo of the painted panel). This is the
  [[curation-miniature-paper-border]] family widened once more: a *glossy enamel
  board* photographs as an object just like silk/canvas/paper margins do. Reroll fix
  that worked first try: drop the "on board" object cue, lead with **"THE PAINTED
  SCENE ITSELF FILLS THE ENTIRE IMAGE, flat and straight-on … viewed perfectly
  straight-on and flat to the camera"** and name the object to forbid — *"this is NOT
  a photograph of a painting: no board, no panel, no easel, no visible edge of any
  board, no oblique/tilted angle, no background behind the artwork, no garden, no
  grass or trees around it."* Takeaway: **for any bright folk style named by its
  physical support (enamel-on-board, tempera-on-cloth, lacquer-on-panel), pre-empt
  the painted *object/3D-tilt* up front, not just the margin.**
- **Banner/flag text — cheap feathered patch on a static banner.** The archery still
  came back with the word **"GUILD"** lettered on two static guild banners
  ([[curation-poster-summons-object]] family — heraldic banners carry a text prior).
  Both banners are background, non-mover zones, so a Pillow feathered patch
  (column-fill from the clean banner row just above the text, composited through a
  Gaussian-blurred mask) erased both words to plain banner field with no seam — no
  reroll needed. **Gotcha:** feather radius must be *small* relative to the box height
  (a 14 px feather on a ~60 px-tall box never reached full opacity, so the text bled
  through; feather 6 fixed it). Rule of thumb holds: **background/static text → cheap
  feathered patch; text on a moving actor → reroll.**
- **Veo returned an empty result once (`generated_videos` was None → TypeError).** The
  archery clip failed on the first call (~70 s in) with no video — a transient/empty
  response (possibly the safety filter on an aimed bow). A plain retry with the verb
  softened slightly ("releases … a slender arrow rises" instead of "looses … streaks")
  succeeded first try. Budget for the occasional empty Veo response; retry (and, for
  weapon/combat subjects, soften the violence verbs) rather than abandoning the piece.
- **Under-used-wing + mover-type variety remain the cheap rut-breaks** (per 09-02/09-04):
  `Arts of Africa & Oceania` (the second-sparsest wing) took a jewel-bright,
  intact-medium Tingatinga piece that clears the density floor easily, and the four
  movers (bird flight / human soar / draw-and-loose / boat traversal) were all distinct
  from each other and from the recent sport-heavy batches.

### 2026-09-06 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, continuing the **mover-type rut-break**
with four *deliberately different* kinds of primary mover, and a global spread
(India / Japan / Ottoman / Australia) that touches the under-used `Islamic` wing:
- **Holi, the Festival of Colours — Rajput Painting** (`South & Southeast Asian`,
  non-looping) — a *powder/liquid-throw* mover: courtyard revellers fling bursting
  clouds of magenta/saffron/green gulal and squirt brass pichkari water-jets; dholak
  drummers, marble pavilions, peacocks. A genuinely fresh mover class — nothing else
  in the gallery throws powder — and an extremely bright, dense, saturated frame.
- **The Mikoshi Procession — Shin-hanga** (`Japanese`, non-looping) — a
  *coordinated-crowd-hoist* mover: a dense crowd heaves and bounces a great golden
  mikoshi (portable shrine) on shoulder-poles through a lantern-strung summer street.
- **The Carpet Bazaar — Ottoman Miniature** (`Islamic`, non-looping) — a *cloth-unfurl*
  mover: two merchants flap a big medallion carpet open mid-air, a kneeler smooths a
  rug, tea pours, pigeons flutter; jewel-toned rugs fill the arcaded stalls. Fills the
  sparse `Islamic` wing with a bright pristine piece and a non-horse mover (Islamic
  kept pushing toward horse-charge/caravan/night-fire — all used — so a carpet-market
  was the fresh escape).
- **The Shearing Shed — Australian Impressionism** (`19th Century`, non-looping) — a
  *shearing/blade-work* mover: a Heidelberg-School woolshed, foreground shearer running
  the blades so the fleece peels off, rouseabout boy carrying the fleece, back row
  bent to their sheep. A work-scene contrast to the three festival/market crowds.

**What worked / reinforced:**
- **3 of 4 stills passed the vision gate first try; all 4 videos accepted** (mikoshi
  video on one retry — see below). Standing image rules kept producing bright, dense,
  edge-to-edge frames; the full-bleed close-crop + margin/border pre-empt held the
  Rajput gouache-on-paper and Ottoman miniature-on-paper edge-to-edge with no
  paper margin ([[curation-miniature-paper-border]]). Veo drift stayed a mild
  zoom/reframe in every clip with the "on the spot / same size / same place" +
  camera-lock + zoom/pan negative block; no morphing, popping, or lost actors. The
  gulal clouds burst and bloomed as a legible primary action (a strong new mover),
  the carpet visibly billowed open mid-clip, the shearer's fleece peeled, and the
  mikoshi crowd heaved and bounced the shrine.
- **Reinforced hard — Shin-hanga/matsuri scenes summon dense kanji on the moving
  bearer crowd; when the text is on the primary movers, RE-ROLL, don't patch.** The
  first mikoshi still came back with big white back-crest kanji on nearly every
  happi coat, small repeating-character textile patterns on the coats and sashes,
  and kanji on background shop signs/noren — the [[curation-poster-summons-object]] /
  09-01 mochi-coat family, but far denser because the coats *are* the whole animated
  crowd (a patch there would not survive Veo). A standing "no characters on coats"
  clause was **not enough**. The reroll that worked stated the coats positively as
  *"a plain happi coat in a single flat solid colour … a completely blank flat colour
  field"* AND piled on an explicit exhaustive block — *"ABSOLUTELY NO writing of any
  kind: no kanji, no Japanese characters … no shop signs, no banners with writing, no
  noren with text; every happi coat, sash, headband, lantern, wall and sign completely
  blank with no characters, no crest and no repeating character pattern."* Came back
  fully clean (only a small decorative circular *mon* on one background noren, which
  is a crest emblem, not writing — left as-is). Takeaway: **for matsuri/happi-coat
  picks, describe the coats as plain flat solid colour AND forbid the repeating-kanji
  textile pattern + back crest + all signage explicitly, not just "no text".**
- **Signature on a plain-floor corner → cheap feathered patch (not a reroll).** The
  Shearing Shed oil (a realist/sporting easel genre, the
  [[curation-artist-name-summons-signature]] prior) came back with a faint reddish
  cursive signature at the extreme bottom edge on plain floorboards — a static,
  non-mover zone. A feathered Pillow patch (copy the floorboard strip just above,
  paste over the box through a Gaussian-blurred mask) erased it with only a faint
  board-on-board seam the Veo zoom crops. Confirms the rule of thumb: **corner
  signature on a static area → patch; text on a moving actor → reroll.**
- **Veo empty-result retry recurred** (per 09-05): the mikoshi video failed the first
  call with `'NoneType' object is not subscriptable` (empty `generated_videos`) — a
  transient empty response on a benign crowd scene. A plain retry (verbs softened
  slightly to "gently bouncing and rocking") succeeded first try. Budget for the
  occasional empty Veo response and just retry.
- **Under-used-wing + mover-type variety remain the cheap rut-breaks** (per 09-02→09-05).
  `Islamic` (15, sparse among the favoured wings) took a bright pristine carpet-bazaar
  miniature, and the four movers (powder-throw / crowd-hoist / cloth-unfurl / shearing)
  were all distinct from each other and from the recent sport/race-heavy batches. The
  powder-throw (Holi) is a genuinely new mover class worth reusing.

### 2026-09-07 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, continuing the **mover-type rut-break**
with four *different* kinds of primary mover, and hitting **two under-used wings**
(`Islamic` 16, `Medieval & Byzantine` 18):
- **The Dyers' Courtyard — Deccan Painting** (`Islamic`, non-looping) — a *lift-and-
  wring / splash* mover: dyers heave dripping skeins of freshly dyed yarn up out of
  brilliant indigo/crimson/saffron/emerald vats onto drying rails of rainbow hanks,
  dye water streaming; a boy stirs a vat. A genuinely fresh mover class (nothing else
  dyes) and one of the most saturated frames the gallery has — rainbow skeins fill it.
- **Hawking in the Meadow — International Gothic** (`Medieval & Byzantine`,
  non-looping) — a *bird-launch + ride* mover: the lead falconer's white gyrfalcon
  beats up off the raised gauntlet as an elegant Très-Riches-Heures hawking party
  rides out across a mille-fleurs meadow, hounds coursing, gold sky, blue château.
- **The Stilt-Walkers' Parade — Qing New Year Folk Painting** (`Chinese & Korean`,
  non-looping) — a *stilt-walk/sway* mover (fresh): a troupe of opera-costumed gaoqiao
  performers strides and sways down a lantern-strung holiday street, streamers flying,
  drummers and cymbal-players striking below, a dense delighted crowd. Yangliuqing
  nianhua register — brilliant, extremely dense.
- **The Splash Fountain — Contemporary Illustration** (`Contemporary`, non-looping) —
  a *run/leap-through-water* mover: children leap and splash through erupting arcing
  jets of a summer city-plaza splash fountain, one child leaping up through a bursting
  water column, a dog shaking off. Deliberately a **painterly gouache-and-coloured-
  pencil** register (explicitly "NOT flat vector") to keep varying the heavy recent
  flat-vector look.

**What worked / reinforced:**
- **All four videos accepted first try; 3 of 4 stills passed the vision gate first
  try.** Standing image rules kept producing bright, dense, edge-to-edge frames.
  Veo drift stayed a mild zoom in every clip with the "on the spot / same size / same
  place" + camera-lock + zoom/pan negative block; no morphing, popping, lost actors,
  or count changes. The crimson-skein heave (with dye water streaming into the vat),
  the gyrfalcon beating up off the gauntlet keeping its exact white form, the lead
  stilt-walker's big striding step on rigid stilts, and the central child's leap
  through the erupting water column all read as clean legible primary actions.
- **Under-used-wing + mover-type variety remain the cheap rut-breaks** (per 09-02→09-06).
  Hitting `Islamic` and `Medieval & Byzantine` (both sparse among the favoured wings)
  with a jewel-bright Deccan dyers' yard and an International Gothic hawking party —
  both "old" but pristine, intact-medium and hyper-colourful, dodging the worn
  archaeological register entirely. And the four movers (dye-lift/splash /
  bird-launch+ride / stilt-walk / kids-through-water-jets) were all distinct from each
  other and from the recent sport/festival-crowd batches. The dyers' rainbow-skein
  scene is a genuinely new mover *and* a palette-and-density standout worth reusing.
- **International Gothic manuscript still summons a ruled page border on the LEFT
  and RIGHT edges — and the full-bleed close-crop clause only got 3 of 4 edges.** The
  Hawking still came back edge-to-edge top/bottom but with a gold+maroon ruled border
  strip (~110 px native) down *both* the left and right edges (the
  [[curation-miniature-paper-border]] family — vellum/manuscript carries a ruled-frame
  prior just like silk/paper miniatures). This time I **patched rather than rerolled**
  (the composition was otherwise perfect and a locked-camera clip won't crop the edges
  the way the usual mild zoom does): a **feathered mirror patch** per
  [[curation-artist-name-summons-signature]]'s technique — for each side, paste a
  horizontally-flipped copy of the ~120 px column just inboard of the border over the
  border box, composited through a Gaussian-blurred mask that feathers to 0 at the
  inner seam (the flip makes the seam self-match, so it's invisible; the thin residual
  verticals read as the party's lances). Clean both sides first try. Takeaway:
  **for a manuscript/miniature pick, expect a border on *both* side edges, and if the
  camera is locked (so Veo won't crop it) patch both edges rather than trusting the
  zoom.** Kept the pre-patch original in the scratchpad per
  [[curation-keep-rejected-renders]].
- **Ottoman is now the crowded corner of the `Islamic` wing** (5 Ottoman miniatures:
  Mehter, Festival Acrobats, Carpet Bazaar, Fireworks Bosphorus, Iznik) and Persian
  heavier still (12) — so the Deccan (Golconda) register was chosen deliberately to
  fill `Islamic` without another Ottoman/Persian court miniature. When picking for
  `Islamic`, check *which* sub-tradition is over-used, not just the wing count.

### 2026-09-08 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four distinct wings, **all intact-medium** (0 archaeological — within
the ≤1 cap), leaning bright/dense/colourful, continuing the **mover-type rut-break**
with four *different* kinds of primary mover, and hitting the two sparsest workable
wings (`Arts of Africa & Oceania` 5, `Islamic` 17) plus `Medieval & Byzantine` (19):
- **The Sing-sing — Papua New Guinea Highlands Painting** (`Arts of Africa & Oceania`,
  non-looping) — a *stamp-dance + drum* mover: a central dancer leaps and stamps on the
  spot while two front kundu drummers strike and dozens of plumed dancers stamp in place,
  bird-of-paradise headdresses shaking. Vivid bold-outlined Melanesian folk-painting
  register (new style added to `ART_STYLES_FOR_INSPIRATION.md`), fills the sparsest wing.
- **The Building of the Palace — Mughal Miniature** (`Islamic`, non-looping) — a fresh
  *construction* mover (Akbarnama register): stonemasons chisel blocks, a labourer climbs
  a scaffold ladder with a basket, porters carry stone, an architect directs. Dense
  jewel-toned paper miniature — a non-Ottoman/Persian-court pick to fill `Islamic`.
- **Treading the Grapes — Medieval Book of Hours** (`Medieval & Byzantine`, non-looping)
  — a fresh *grape-treading* mover: barefoot peasants stamp grapes in a wooden vat, purple
  must splashing, basket-carriers alongside. International Gothic Labours-of-the-Months
  illumination — burnished gold sky, blue château, mille-fleurs (new styles added).
- **The Winnowing — French Rural Naturalism** (`19th Century`, non-looping) — a fresh
  *grain-toss* mover: a winnower tosses a great golden arc of grain into the air, chaff
  streaming on the breeze, harvesters gathering across a luminous sunlit field. Jules-
  Breton/Bastien-Lepage register (new style added).

**What worked / reinforced:**
- **All four videos accepted first try; Veo drift stayed a mild zoom/reframe** with the
  "on the spot / same size / same place" + camera-lock + zoom/pan negative block — no
  morphing, popping, lost actors, or count changes. The leaping sing-sing dancer + drum
  strikes, the masons' chiselling + ladder-climb, the must-splashing grape-tread, and the
  full winnowing toss→settle cycle all read as clean legible primary actions. On the two
  miniatures/manuscripts the mild Veo reframe helpfully *revealed* edge figures (a zoom-out
  traversal, not popping) and cropped the extreme top corners.
- **Fresh mover classes + sparse-wing picks remain the cheap rut-breaks** (per 09-02→09-07).
  Grape-treading, grain-toss and palace-construction are all new movers; the Sing-sing is
  a genuinely new register and mover that filled the gallery's *sparsest* wing.

**MAJOR TOOL EVENT — `gemini-3-pro-image` was effectively DOWN for ~1 h (sustained 503),
so stills 2–4 were generated on the `gemini-2.5-flash-image` fallback model.**
- **What happened.** Piece 1's still slipped through an early lucky window on Pro
  (~05:28). After that, **~50 straight 503s** across ~1 h of patient retry loops (8+15
  full invocations, each with the wrapper's own 4 internal retries) — the Pro image model
  returned `503 UNAVAILABLE … high demand` on *every* call. This is the [[curation-ffmpeg-no-libwebp]]-adjacent
  09-01 "heavy 503 load" note, but far worse: not intermittent, a solid multi-hour wall.
- **The fix that unblocked the night: `--model gemini-2.5-flash-image`.** The non-Pro
  Nano-Banana image model had ample capacity and returned a still on the *first* call
  every time. The skill's `--model` flag makes this a one-word switch. Stills 2, 3 and 4
  were all generated on flash; piece 1 is the only Pro still tonight.
- **Flash-model quality notes (what the vision gate caught).** Flash output is softer /
  lower-detail than Pro (files ~300–450 kB vs Pro's ~3 MB at "4K"; it seems to cap
  resolution regardless of `--size 4K`). It also leans **muted/sparse and stronger on the
  bordered-page / signature priors** than Pro:
  - Piece 2 first flash still came back **muted and sparse** (big empty terracotta floor,
    a black central-arch void) — the "visually thin / too dark" register. A reroll pushing
    *"extremely dense, crowded … no empty ground, bright blue sky, jewel-toned, no large
    dark doorway"* fixed it (bright dense courtyard). **Lesson: on flash, explicitly
    demand density + brightness + "no dark void" — it under-fills and under-lights by
    default more than Pro does.**
  - Piece 3 (Book of Hours) hit the [[curation-miniature-paper-border]] prior **hard and
    twice** — even with the full-bleed close-crop clause, flash drew a full ruled
    manuscript border (maroon/gold rules on 3 edges + gothic **corner spandrels** over the
    gold sky). Rerolling didn't shake it. **Feathered mirror-patch fixed it deterministically**
    (per [[curation-artist-name-summons-signature]]'s technique): mirror the inboard
    foliage columns over the L/R vertical borders (≈135 px each), a thin vertical-mirror
    over the top rule, and two small **vertical-mirror corner boxes** for the spandrels —
    kept *clear of the castle* (x<180 left, x>W−235 right) so nothing duplicated the
    turrets. Takeaway: **for a manuscript pick on flash, expect a border on ~3 edges incl.
    corner spandrels; patch (don't loop rerolls) — verticals by horizontal mirror, top
    rule + corner spandrels by short vertical-mirror boxes that avoid tall foreground/
    skyline objects.**
  - Piece 4 (rural-naturalist oil) came back with the expected corner **signature**
    ([[curation-artist-name-summons-signature]]) on static straw ground → cheap feathered
    vertical-mirror patch, per the standing "corner signature on a static area → patch"
    rule. Clean, no seam.
- **Operational takeaway for a Pro outage.** Don't burn an hour on Pro retry loops when
  the wall is solid — **probe `gemini-2.5-flash-image` early**, and if it works, finish the
  round on it while applying the vision gate strictly (demand density+brightness up front,
  and budget a patch for the border/signature priors, which flash trips harder). Note in
  the round log which stills used the fallback. (Numpy is **not** installed on this
  machine — write patch scripts in **pure Pillow**, not numpy.)

**Step 8 (social post) SKIPPED — missing secrets.** `UPLOADPOST_API_KEY` and
`ZERNIO_API_KEY` are both absent from `curation/.env`, so the day's art was not posted to
social (per AUTOMATED_CURATION step 8, a missing key costs the night's posts, not the
night's art). No piece was scored (`music_prompt`), by design. The four pieces are
published and committed.

### 2026-09-09 — nightly generation round (4 pieces added)

Not a human-review round; no removals. Recording the batch for continuity. Four
pieces across four favoured, non-archaeological wings deliberately chosen to *avoid*
the wings hammered the last three nights (Islamic ×3, Medieval & Byzantine ×2), all
intact-medium (0 archaeological — within the ≤1 cap), bright/dense/colourful, with
four *distinct* primary movers:
- **Blind Man's Buff — Rococo** (`Renaissance & Baroque`, non-looping) — a *game
  grope-and-scatter* mover: a blindfolded woman in pale-rose silk gropes forward while
  a ring of pastel-silk guests duck, dodge and lean away. Fragonard/Lancret fête-galante,
  luminous, dense. **Pro** still, first-try vision-gate pass.
- **The Bandstand Concert — American Scene Painting** (`Modern`, non-looping) — a *live
  brass-band* mover: conductor beating time (back to camera — no facial risk), trombone
  slides working, bass drum struck, bunting and flags snapping, a dense picnic crowd on
  the green. Bright wholesome regionalist register. **Pro** still, first-try pass.
- **The Kemari Match — Yamato-e** (`Japanese`, non-looping) — a fresh *keepy-uppy kick*
  mover: Heian courtiers ring a raked-sand court keeping a white deerskin ball aloft with
  their feet, the central player mid-kick. Gold-clouded Tosa-handscroll register with a
  vermilion veranda of watching court ladies. **flash** still.
- **The Sheepdog Trial — Contemporary Folk Illustration** (`Contemporary`, non-looping) —
  a *herding-dog-drives-flowing-flock* mover: a border collie streaks low and circles to
  push a bunched flock through a gate, shepherd whistling. Warm painterly folk register
  (NOT flat vector, to vary the heavy recent flat-vector Contemporary look). **flash** still.

**What worked / reinforced:**
- **All four videos accepted first try.** Veo drift stayed a mild zoom/reframe with the
  "on the spot / same size / same place" + camera-lock + zoom/pan negative block — no
  morphing, popping, lost actors, or count changes. Notably the figure-dense Rococo animated
  cleanly (many faces) because the motion was assigned to *groping/dodging/skirts*, not to
  facial expression — the standing "avoid faces as the animated focus" rule satisfied by
  choosing a body-action mover in a crowd scene.
- **The full-title scan is doing real work** ([[curation-check-full-title-list]]). The
  gallery is now dense (407→411). My first four ideas — Dutch ice-skating, a Fauvist
  carousel, a Sorolla fishing-haul, a kite festival — were **all already in the gallery**
  (some multiple times). Scanning every title + image_prompt for candidate keywords before
  committing caught all four collisions; the replacements above are genuinely absent.
  Takeaway: at 400+ pieces, assume your first instinct is already taken and grep the full
  list for the *subject and the mover* before generating.

**TOOL EVENT — `gemini-3-pro-image` 503s escalated from intermittent to a wall mid-round;
finished pieces 3 & 4 on `gemini-2.5-flash-image` (the [[curation-pro-image-outage-flash-fallback]]
/ 09-08 playbook).** Pieces 1 & 2 landed on Pro with one 503 retry each; then piece 4
exhausted all 4 retries (solid 503) and piece 3 hung mid-retry. Killed the stuck Pro task,
switched 3 & 4 to `--model gemini-2.5-flash-image` — both returned on the first call.
- **Density demand fixes flash's under-fill/under-light, again.** Prepending
  *"EXTREMELY DENSE … richly saturated … NO empty ground, NO dark areas, bright and colourful
  edge to edge"* to the flash prompts gave a well-filled, bright sheepdog scene and an
  acceptable kemari (only a mild pale-court centre — characteristic of the raked-sand subject,
  carried by the dense colourful ring + gold sky). Reinforces the 09-08 lesson.
- **NEW flash+Veo finding — flash stills are 1344×768 (1.75), not true 16:9, so Veo
  pillarboxes them → ~10 px black bars on the LEFT and RIGHT of the clip.** (Pro stills are a
  true-16:9 5504×3072 and don't do this.) `cropdetect` missed it — the bars are only 10 px and
  its rounding skips them — so **measure the edge pixels directly** (a few-line Pillow script:
  count near-black columns in from each edge at several heights). Fix that worked on both flash
  clips: crop 12 px per side and rescale back to 1280×720 with the real ffmpeg
  (`crop=1256:720:12:0,scale=1280:720:flags=lanczos`, `libx264 -crf 18`, `-c:a copy`), done
  **before** publish (publish uploads the MP4 as-is; the still's web derivatives are unaffected).
  Originals kept in the scratchpad per [[curation-keep-rejected-renders]]. **Takeaway for any
  flash-fallback night: after animating a flash still, check for ~10 px L/R black bars and
  crop+rescale before publishing** — or pre-crop the flash still to exact 16:9 before feeding Veo.
- **Operational takeaway (reaffirmed):** don't burn time on Pro retry loops once the 503s are a
  wall — probe flash early, finish on it, apply the vision gate strictly (density+brightness up
  front), and budget for the pillarbox crop. Pure-Pillow only (no numpy on this machine).

<!-- Claude appends new rounds above this line. -->
