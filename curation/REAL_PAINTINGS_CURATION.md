# Nightly curation: real paintings

The runbook when `curation/CURATION_MODE` is `real-paintings`. Each night, add **four famous public-domain paintings, animated with Gemini Omni**. Only the motion is generated. Famous works come first, because people recognize them and search for them by name.

Run every command from the repo root. The fixed animation config and its prompt are in [`REAL_ART_GUIDANCE.md`](REAL_ART_GUIDANCE.md).

## Prerequisites

The same secrets and wrapper as [`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md#prerequisites): `GEMINI_API_KEY` (Omni and the clip's music), `CLOUDFLARE_API_TOKEN` (used by `publish-piece.mjs`), and `ZERNIO_API_KEY` (social). No image generation. Needs Node 18+, `ffmpeg`, and `google-genai` 2.25 or newer for `python3`, because Omni uses the Interactions API. If the Omni script says the SDK is too old, run `python3 -m pip install -U google-genai` and retry.

There are eight sources: seven museums (the Art Institute of Chicago, the Cleveland Museum of Art, the Met, the National Gallery of Art in Washington, the Rijksmuseum, the Getty Museum and SMK in Copenhagen) and Wikimedia Commons. Commons covers famous works in museums that publish no open images, such as the Louvre, the Prado, the National Gallery in London and MoMA. None of them needs a key. **Take images only from the seven museums or Wikimedia Commons under these rules,** never from search engines, stock sites or anywhere else.

The night doesn't search them. A monthly refresh clears their most famous works into a catalog, and the night picks from its queue ([`REAL_PAINTINGS_CATALOG.md`](REAL_PAINTINGS_CATALOG.md)). The founder vetoes works in `curation/real-art/blocklist.txt`.

## The legal gate

The catalog holds only paintings that pass all of these, checked by `curation/real-art/clearance.mjs` at each refresh. Each record keeps the evidence in its `clearance` field:
1. **The image is marked public domain.** For the seven museums, the museum's own Public Domain or CC0 flag on the image. For Commons, the file's own licence must say public domain (PD-Art, PD-old or CC0), with no CC BY, CC BY-SA or other rights claim on the file.
2. **The artist died at least 71 years ago** (1955 or earlier, in 2026). The work's own age doesn't count: Hopper's *Nighthawks* (1942) is open access, but Hopper died in 1967, so it's blocked until 2038.
   - Approximate years count as written: "c. 1880" is 1880.
   - An unknown death year assumes a 70-year life: birth + 70, or with no birth year, the work's date (or the first active year) + 60.
   - "Workshop of Rembrandt" or "After Raphael" is judged on Rembrandt's or Raphael's dates. A work with no identifiable artist is judged from its date, so it must be dated 1895 or earlier.
3. **Flat art only:** paintings, prints, drawings, watercolours. A photo of a 3-D object can carry its own copyright. Commons takes paintings only; a triptych or altarpiece also needs a paint among its materials, because some are carved.
4. **At least 1920 px on the long edge,** the size Omni takes. Never AI-upscale a real artwork.

Commons, Rijksmuseum and SMK works also need:

5. **A date of 1930 or earlier** (in 2026), unless every artist died by 1930. A work published in the US gets 95 years from publication, so only one from 1930 or earlier is safe there; the Rijksmuseum and SMK mark a work public domain once its artist has been dead 70 years, which isn't the US rule. Mondrian died in 1944, so *Broadway Boogie Woogie* (1943) fails. A date after the artist's death is a data error and is ignored; with no date left, an artist who died after 1930 fails.

Commons works also need:

6. **A known holder that isn't an Italian public collection.** That excludes the Uffizi, the Accademia, Brera, the Borghese, and Italy's state, regional and civic museums.
7. **If one of the seven museums holds the work, that museum withholds a usable image of its own:** no public-domain flag, no image, or one under 1920 px. The Met holds Monet's *Garden at Sainte-Adresse* but flags it not public domain and shows no image, so it comes from Commons. The credit still names the Met as the holder and links the Commons file, never implying the Met released it.

**Why Commons needs more rules.** A museum's public-domain flag is the museum's own waiver. A Commons image has none, so we rely on a legal argument: a faithful photo of a flat public-domain painting has no copyright of its own, in the US under *Bridgeman v. Corel* (1999) and in the EU under Article 14 of the DSM Directive (2019). Hence the extra rules: the work must be public domain in the US too (rule 5), and Italy's Cultural Heritage Code still restricts reproductions of works in its public collections (rule 6).

**Prefer museum images.** When one of the seven museums releases a usable image of a work it holds, that image is used, even when Commons has a larger file. *The Night Watch* comes from the Rijksmuseum, not Commons.

**Never work around the gate.** If a painting you want doesn't pass, skip it.

## Steps

1. **Context.** Read the repo-root `README.md`, `REAL_ART_GUIDANCE.md`, and the *Gallery tags* and *Music prompts* sections of `PROMPT_GUIDANCE.md`. Its other rules are for writing AI image and video prompts, and this mode writes none.

2. **Read the queue.**
   ```bash
   node curation/real-art/queue.mjs --out /tmp/lart-candidates.json
   ```
   It writes the next 80 works from the catalog. Every one has passed the gate, isn't in `gallery.json` yet and isn't on the blocklist. It makes no requests.
   - If it fails (no catalog, or no works left), abort the night and report the error. Don't search the museums instead.
   - If it prints a `WARNING` (for example, the catalog is over 34 days old), carry on and put the warning at the top of your final report.
   - Pick only from this file. A work outside it may be vetoed or uncleared.

3. **Pick four.**
   - **Recognizable.** Prefer works a general audience knows: high in the list, plus your own judgement. The list ranks fame within each wing, so a famous Japanese print sits near a more famous European painting; `fame.wikipedia_langs` is the raw count. Each painting is used once.
   - **Something in it can move**: people, animals, water, sky, smoke, cloth.
   - **Variety.** At most two of the four from one wing, and at least one from a non-European wing (`wing` other than Medieval & Byzantine, Renaissance & Baroque, 19th Century, Modern or Contemporary) whenever the list has an eligible one. `wing` is a hint: you still choose the `--tag`. Also spread artists, eras and subjects, and check the last ~12 entries with `source: "real_artwork"`. Never two works by one painter in a night.
   - **No nudity or graphic violence**, however famous. Pieces are posted to social media and play on screens others can see.
   - If Omni's safety filter refuses a painting, take the next pick.
   - **Check a Commons pick's title, artist and date** against its Commons file page. They come from Wikidata, which anyone can edit, and labels are sometimes vandalized.

4. **Prepare each pick.**
   ```bash
   node curation/real-art/frame-painting.mjs --candidates /tmp/lart-candidates.json \
     --id aic:20684 --stem caillebotte_paris_street_rainy_day
   ```
   This writes three files:
   - `gallery/<stem>_src.jpg`: the bare painting at 1920 px. This is what Omni animates.
   - `gallery/<stem>_4k.webp`: the whole painting on a 3840×2160 near-black wall. The web images are cut from this.
   - `gallery/<stem>.provenance.json`: the credit fields.

   Its last line of output also gives `omni_aspect` (16:9 or 9:16). **Look at the stills.** If one is soft, discoloured or a detail crop, pick another painting. If the download fails, the image has moved since the catalog was built: pick another and mention it in your report.

5. **Animate with Omni** (the `omni-video-gen` skill), using the config and prompt in the guidance:
   ```bash
   VID_PROMPT="Animate this artwork in a single unbroken scene. No camera movements or zooms.
   This artwork is titled <title>, by <artist>, completed in the year of <year>."
   bash curation/with-secrets.sh GEMINI_API_KEY -- \
     python .claude/skills/omni-video-gen/scripts/generate.py \
       --prompt "$VID_PROMPT" --image gallery/<stem>_src.jpg --max-edge 1920 \
       --aspect <omni_aspect> --task image_to_video --resolution 1080p \
       --out gallery/<stem>_animated.mp4
   ```
   Fill in only the title, artist and year (rules in the guidance). Don't change anything else.

6. **Check the clip before publishing.** Pull the first, middle and last frames, e.g. `ffmpeg -ss <t> -i clip.mp4 -frames:v 1 f<t>.png`. Reject a clip only for an **obvious** failure, one anyone would see at a glance:
   - **It's no longer this painting.** By the middle or the end it has become a different scene.
   - **The file is broken**: blank, black or garbled frames.

   Don't reject for anything subtler: the camera drifting or reframing, a figure turning or changing expression, a prop, accessory or animal appearing or vanishing, cloth or water moving. Judging fine detail from a few frames is unreliable and rejected good clips. When unsure, publish.

   If a clip fails, reroll once with the same prompt (Omni varies from run to run). If that fails too, drop the painting and take the next pick.

7. **Publish.**
   ```bash
   node curation/publish-piece.mjs \
     --still gallery/<stem>_4k.webp --video gallery/<stem>_animated.mp4 \
     --provenance gallery/<stem>.provenance.json \
     --title "<original title> - <artist> (AI Animated)" \
     --tag "19th Century" --video-prompt "$VID_PROMPT"
   ```
   Use the painting's real title and the artist's usual name, e.g. "Paris Street; Rainy Day - Gustave Caillebotte (AI Animated)". `--tag` takes exactly one wing from *Gallery tags* (era for European works, culture or region for the rest). Don't set `free`. Then delete `gallery/<stem>_src.jpg` and `gallery/<stem>.provenance.json`.

8. **Repeat** steps 4–7 until four pieces are published.

9. **Commit and push.** First refresh the founder's view of the queue, which now skips tonight's four.
   ```bash
   node curation/real-art/queue.mjs --markdown
   git add gallery.json curation/real-art/QUEUE.md && git commit -m "AUTO_CURATION (real art): Added [Artist — Title, …]" \
     -m "<one line per piece: why it was picked; any reroll or drop and why>" && git push
   ```

10. **Post to social.** Follow step 8 of [`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md). Put the most recognizable painting first, because it's what people see before they scroll on. Captions credit the painter automatically. Write music that suits the paintings' own times and places.
