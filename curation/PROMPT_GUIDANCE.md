# Prompt guidance for the nightly curation

Read this before writing any image or video prompt in `AUTOMATED_CURATION.md`. These rules come from human reviews of the gallery: what got deleted, and what the reviewer loved. If you follow nothing else, follow the **Hard rules**.

## Brand & taste

The gallery is art history brought to life, across every wing of a great museum. Every piece should be beautiful enough to hang on a gallery wall.

- Range widely. `ART_STYLES_FOR_INSPIRATION.md` is a starting menu, and the wings in *Gallery tags* map the territory. But see *Era mix*: range doesn't mean spreading evenly.
- Contemporary styles are welcome: modern illustration, contemporary fine art, and genre looks like solarpunk, steampunk, dark academia, mid-century modern, noir, eco-brutalism, papercut and Ghibli-esque.
- Off the menu, because they are the default output of every image generator: generative "AI art", glitch art, Y2K, Frutiger Aero.
- **Taste test, for every era:** does it look like something an artist made, the kind of piece you'd find in a serious gallery, a good illustration annual, or an art-history book? Or does it look like the first thing a generator makes when you type the style name? If the latter, pick something else.

## Era mix

**Lean recent. At most 1 of the 4 nightly pieces may have the archaeological look.** The reviewer finds ancient styles less polished and worn out.

What matters is the surface the work survives on, not its age:

| | Surface | Quota |
|---|---|---|
| **Archaeological** | plaster wall, cave rock, fired clay, carved stone, excavated metal | at most 1 of 4 |
| **Intact** | silk, paper, panel, canvas, print, vellum, tapestry | no limit |

A Song silk scroll, a Mughal miniature, a Shin-hanga woodblock and an Ottoman manuscript are old but not archaeological. A Pompeian fresco, a Dunhuang cave mural, a Greek vase and a Moche pot are. When you use the archaeological slot, pick the best-preserved, most colourful example of the style, and follow the freshness rule below.

Favour `19th Century`, `Modern`, `Renaissance & Baroque` and `Contemporary`.

## Hard rules

### Motion (video prompt)

- **Every clip needs a primary mover doing a legible action.** You must be able to say what happens in one sentence with a real actor and verb: "the crane beats its wings and lifts off the marsh", "the paddler pulls a full stroke and the boat surges". If the best you can write is "the water ripples" or "the light shimmers", pick a different subject.
- **What should move, in order of preference.** Start at the top; the last item is garnish only.
  1. People and animals doing something: walking, rowing, dancing, working; birds flying, horses running, fish swimming.
  2. Objects with mechanical motion: boats, carts, wheels, mills, looms, bells, swings, banners, sails, kites.
  3. Cloth and hair in the wind: robes, veils, curtains, flags, manes.
  4. Weather driving the above: a squall that bends the trees and heels the boat over.
  5. Ambient motion alone: ripples, flicker, smoke, drifting cloud. Fine under 1–4, never the whole clip.

  At most about a third of pieces may be led by ambient motion, and only when the scene has no actor (an empty landscape, a still life). Two in a row means you're in a rut.
- **Keep form, not position.** Anti-morph wording protects an object's identity, not its place. Write "the heron keeps its exact painted shape, colours and markings while it beats its wings and glides left", never "the heron stays perfectly still". Never write blanket freeze clauses such as "the courtiers stand still", "the worshippers stand still", "the painted fish and birds stay exactly where they are" or "nothing else moves". If a scene has people or animals, animate them. Architecture, ground, walls and carved ornament should stay put.
- **Light gliding across the art is not motion.** If the only honest motion is a highlight sweeping over the surface, pick another subject. Flat carved reliefs and friezes (Assyrian, Persepolis, Khmer, Borobudur, Maya) are the worst for this; prefer colourful painted scenes with figures.
- **Match the motion's strength to the scene.** A quiet still life wants a small real motion (a candle flame, incense smoke, dust motes). A storm wants crashing waves, rain and torn sails. Keep it physically plausible: wind, water, fire, cloth, never the subject's own form changing. Statues, mosaics and architecture keep their form.
- **One focal action.** Keep one clear centre of attention; three subjects with competing actions collide into artifacts. Secondary figures should still move naturally (a crowd shifts, robes stir). This rule is about focus, not freezing.
- **Never use morph verbs:** morph, melt, teleport, transform, dissolve, regenerate. They produce glitchy "AI soup". Avoid piling up "chaotic, lively" motion for the same reason.
- **Avoid faces, eyes and hands as the animated focus** unless the style renders them cleanly. Expression drift on a portrait looks uncanny.
- **Never write a placeholder prompt** like "Animate this artwork". Always name one concrete motion and the light source.

### Loops

- A loop must end where it began, but that doesn't mean barely moving. It can close three ways:
  - **Swing:** something goes out and back: a bell, a rocking boat, a swaying dancer, a breathing sail. At low amplitude this decays into ripples, so don't default to it.
  - **Stream:** a steady flow crosses the frame, one subject leaving as another enters: a caravan, boats drifting past, birds crossing the sky. The best way to get real movement into a loop.
  - **Full cycle:** the actor completes one whole cycle back to its start pose: one paddle stroke, one wingbeat, one turn of a wheel, one bow.
- **Drop the loop rather than weaken the motion.** A few independent creatures (ducks, fish) pop in and out at a loop seam. Make that piece non-looping and let them swim; don't freeze them and animate the water.

### Framing (image prompt)

- **Show the art itself, filling the whole image, not as a museum object.** Prompts that name only the artifact ("a bronze plaque, 2nd century BC") produce catalog photos: pedestal, glass case, spotlight, blurred gallery wall. Describe the work edge to edge in its own world, brightly lit.
- **Say "fills the entire image, extending to all four edges". Don't use the word "frame".** The image model reads "frame" as something to draw. Add "no painted border, no mat, no decorative frame".
- **Straight-on and flat to the camera.** No oblique view down a receding wall. A slow camera push or pan is fine.
- **Anchor the style and era concretely:** medium, material, period, lighting. Vague prompts let the model invent ugly detail.
- **Don't repeat famous icons or anything already in the gallery** (the Great Wave, Starry Night, the Mona Lisa, the Birth of Venus, generic rose windows). Pick a fresher, lesser-known work.

### Freshness (image prompt)

- **Depict every work as freshly made.** Name the medium ("oil on canvas, Utrecht Caravaggist tenebrism") but never its condition. Banned words: craquelure; cracked, crazed, aged or yellowed varnish; cupping; flaking; "visible brushwork"; impasto texture; canvas, silk or panel weave; weathered, pitted, worn or distressed surface. The model renders these as a bright net of cracks, worst on dark scenes.
- **Don't write "no cracks" either.** Naming the texture tends to summon it. Just never mention surface condition.
- **Some style names carry decay on their own** ("Pompeian fresco", "Mogao cave mural", "black-figure amphora"). For these, state freshness positively: "freshly painted, pigments brilliant and unfaded, the painted surface smooth, clean and unbroken, as on the day it was finished."
- **Keep the surface the work survives on out of the picture:** no rough rock edges, crumbling plaster margins, pot curvature, excavation lighting, or lamps set in front of the art. The painted scene fills all four edges.

### Light (image prompt)

- **Light the art, not the room.** The product shows off the artwork; atmosphere is never worth hiding it. Default to bright, even light: full daylight, broad window light, a well-lit interior. If a still comes back murky, reroll it brighter.
- **Never make the light source the subject.** No candles, oil lamps, torches, braziers or lanterns as the only light; they render as bright dots in a dark field.
- **Night scenes are allowed** (a Baroque fire, a night festival) only if faces, colour and detail read across the whole frame. If you can't have both, choose the daylit subject.
- Avoid "dim", "flickering", "devotional", "raking" and "moody". Prefer "bright even daylight", "clear soft daylight filling the scene", "luminous and evenly lit". Prompts with lamplight, candlelight, torchlight, moonlight or firelight are reliably the darkest in the gallery.

### Fullness (image prompt)

- **Give the screen something to look at.** Two-colour line-on-ground styles (black- or red-figure vases, Moche fineline, bare ink outline) and pale, low-colour grounds leave most of a 4K screen empty. If you use one, fill the frame with figures and ornament. Prefer full-colour palettes with real tonal range.

## Always-include negative cues

Put these in every image prompt:

> no museum, no display case, no glass, no vitrine, no pedestal or plinth, no gallery wall, no spotlight, no museum label, no plain studio background, no painted border, no mat, no decorative frame; the scene fills the entire image edge to edge, viewed straight-on.

## Gallery tags

Each `gallery.json` entry has a `tags` array with **exactly one** tag from this closed list. Each tag is a filter pill in the app, so never invent a new one. Use culture or region for ancient and non-Western art, and era for European art.

| Tag | Use for |
|---|---|
| `Prehistoric` | Paleolithic and Neolithic cave and rock art, megaliths |
| `Egyptian` | Ancient Egypt, Amarna, Fayum, Coptic |
| `Ancient Near East` | Mesopotamia, Persia (Achaemenid, Sasanian), Scythian and steppe |
| `Greek & Roman` | Classical antiquity and the Aegean: Minoan, Mycenaean, Cycladic, Etruscan, Hellenistic |
| `Arts of the Americas` | Pre-Columbian: Aztec, Maya, Inca, Olmec, Nazca, Moche, Mississippian |
| `Arts of Africa & Oceania` | Sub-Saharan African and Pacific traditions |
| `Japanese` | Ukiyo-e, sumi-e, Nanga, Kano, Edo screens, Kamakura, Jōmon, Kofun |
| `Chinese & Korean` | Chinese dynastic painting and bronzes, Goryeo, Joseon |
| `South & Southeast Asian` | India and Southeast Asia: Mughal, Gandhāran, Gupta, Chola, Khmer |
| `Islamic` | Persian, Arab, Ottoman, Fatimid, Islamic geometric |
| `Medieval & Byzantine` | European art, about 5th–14th century: Byzantine, Gothic, Romanesque, Carolingian, Viking, Celtic, illumination |
| `Renaissance & Baroque` | European art, 15th–18th century: Renaissance, Mannerism, Flemish and Dutch, Baroque, Rococo |
| `19th Century` | Neoclassicism, Romanticism, Realism, Barbizon, Hudson River, Impressionism, Symbolism, Art Nouveau |
| `Modern` | 20th-century movements: Cubism, Surrealism, Bauhaus, Expressionism, Futurism, Art Deco |
| `Contemporary` | Recent fine art and genre or illustration looks (solarpunk, steampunk, noir, papercut, Ghibli-esque…). Subject to the exclusions in *Brand & taste*. |

## Music prompts

The `music_prompt` field, for the one piece posted to social each night. 10–35 words.

**The music must belong to the picture.** Match:
- **Era and culture**, without tipping into pastiche: koto, shakuhachi and sparse percussion for ukiyo-e; harpsichord and a small string group for Baroque; warm brass and upright bass for Art Deco; marimba, pizzicato strings and glockenspiel for bright contemporary illustration; low drones and bone flute for Prehistoric.
- **Mood and energy, read from the scene** rather than the movement label. A joyful crowd wants buoyancy; a snowy shrine at dusk wants stillness; a storm wants weight without drama.
- **Palette.** Bright, saturated colour suggests major and airy; muted earth tones and low light suggest minor, warm and sparse.

Add "Even dynamics, no build or drop." A crescendo pulls attention off the art.

**End every prompt with "Instrumental, no vocals."** Lyria sings by default. `make-social-assets.mjs` refuses a prompt without it, and the skill fails if it hears lyrics.

## Updating this file

When a human review (`/curate-gallery`) shows a new failure or a trait worth repeating, add or edit a rule above. The nightly run may add a rule too, but only for a genuinely new failure pattern. Keep rules short and concrete, and don't record the story behind them; the commit message is the place for that.
