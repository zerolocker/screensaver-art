# Nightly curation: real paintings

The runbook when `curation/CURATION_MODE` is `real-paintings`. Each night, add **four famous public-domain paintings, animated with Gemini Omni**. Only the motion is generated. Famous works come first, because people recognize them and search for them by name.

Run every command from the repo root. The fixed animation config, its prompt and the review checklist are in [`REAL_ART_GUIDANCE.md`](REAL_ART_GUIDANCE.md).

## Prerequisites

The same secrets and wrapper as [`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md#prerequisites): `GEMINI_API_KEY` (Omni and the clip's music), `CLOUDFLARE_API_TOKEN` (used by `publish-piece.mjs`), and `ZERNIO_API_KEY` (social). No image generation. Needs Node 18+ and `ffmpeg`.

The museum APIs need no keys. If one is down, use the others; if all are down, abort and report. **Never take an image from anywhere else** (search engines, Wikimedia, stock sites): the museum's own public-domain flag is our legal evidence.

## The legal gate

`curation/real-art/find-paintings.mjs` passes a painting only if all of these hold, and records the evidence in its `clearance` field:
1. **The museum marks it Public Domain or CC0.** Sources: Art Institute of Chicago, Cleveland Museum of Art, the Met.
2. **The artist died at least 71 years ago** (1955 or earlier, in 2026). Anonymous works must predate 1900. The work's own age doesn't count: Hopper's *Nighthawks* (1942) is open access, but Hopper died in 1967, so it's blocked until 2038.
3. **Flat art only:** paintings, prints, drawings, watercolours. A photo of a 3-D object can carry its own copyright.
4. **At least 2000 px on the long edge.** Never AI-upscale a real artwork.

**Never work around the gate.** If a painting you want doesn't pass, skip it.

## Steps

1. **Context.** Read the repo-root `README.md`, `REAL_ART_GUIDANCE.md`, and the *Gallery tags* and *Music prompts* sections of `PROMPT_GUIDANCE.md`. Its other rules are for writing AI image and video prompts, and this mode writes none.

2. **Find candidates.**
   ```bash
   node curation/real-art/find-paintings.mjs --famous --limit 80 --out /tmp/lart-candidates.json
   ```
   Add `--query "<theme>"` for variety. `--ids aic:<id>` checks one specific work. Everything in the output has passed the gate and isn't in `gallery.json` yet.

3. **Pick four.**
   - **Recognizable.** Prefer works a general audience knows: a high `fame.wikipedia_langs`, plus your own judgement. Each painting is used once.
   - **Something in it can move**: people, animals, water, sky, smoke, cloth.
   - **Variety.** Spread artists, eras, wings and subjects. Check the last ~12 entries with `source: "real_artwork"`. Never two works by one painter in a night.
   - **No nudity or graphic violence**, however famous. Pieces are posted to social media and play on screens others can see.
   - If Omni's safety filter refuses a painting, take the next pick.

4. **Prepare each pick.**
   ```bash
   node curation/real-art/frame-painting.mjs --candidates /tmp/lart-candidates.json \
     --id aic:20684 --stem caillebotte_paris_street_rainy_day
   ```
   This writes three files:
   - `gallery/<stem>_src.jpg`: the bare painting at 1920 px. This is what Omni animates.
   - `gallery/<stem>_4k.webp`: the whole painting on a 3840×2160 near-black wall. The web images are cut from this.
   - `gallery/<stem>.provenance.json`: the credit fields.

   Its last line of output also gives `omni_aspect` (16:9 or 9:16). **Look at the stills.** If one is soft, discoloured or a detail crop, pick another painting.

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

6. **Check the clip before publishing.** Pull the first, middle and last frames and go through the guidance's *Fidelity checklist*. Compare fixed landmarks (a lamppost, a wall edge, the signature, the painting's border) across the frames before you describe how anything moved. If it fails, reroll once with the same prompt. If that fails too, drop the painting and take the next pick.

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

9. **Commit and push.**
   ```bash
   git add gallery.json && git commit -m "AUTO_CURATION (real art): Added [Artist — Title, …]" \
     -m "<one line per piece: why it was picked; any reroll or drop and why>" && git push
   ```

10. **Post one to social.** Follow step 8 of [`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md), except in 8a **post the most recognizable painting** of the four. Captions credit the painter automatically. Write music that belongs to the painting's own time and place.

11. **Lessons.** If a night teaches something genuinely new about animating real paint, add it as a rule in `REAL_ART_GUIDANCE.md` and commit it with the batch. Don't write a narrative log.
