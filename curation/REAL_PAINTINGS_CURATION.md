# Living Art Screensaver: Real-Paintings Curation

The nightly runbook when `curation/CURATION_MODE` is **`real-paintings`** (see Step 0 of
[`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md)). Each night it adds **four real,
public-domain paintings, animated with Gemini Omni**: real masterpieces with recognizable names,
brought to life. Nothing is generated except the motion.

> **Why this mode exists (2026-10-03):** four weeks of nightly social posts of AI-generated art
> drove no site visits. A painting people already know stops the scroll, and its name and
> painter are what people search for. So this mode leads with **famous works first**.

Instructions assume the git repo is the current working directory. The fixed video prompt and
the review checklist are in [`curation/REAL_ART_GUIDANCE.md`](REAL_ART_GUIDANCE.md).

## Prerequisites

Same secrets and wrapper as [`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md#prerequisites--credentials):
`GEMINI_API_KEY` (Omni, plus Lyria for the social clip), `CLOUDFLARE_API_TOKEN` (R2, used inside
`publish-piece.mjs`), and `ZERNIO_API_KEY` (social). **No image generation**: `nano-banana-pro` is
not used. Needs `node` ≥ 18 and `ffmpeg`. The museum APIs need no keys. If a museum API is down,
use the others. If **all** are down, abort and report. **Never fall back to an image from
anywhere else** (search engines, Wikimedia, stock): the source's own public-domain flag is our
legal evidence.

## The legal gate (enforced in code)

`curation/real-art/find-paintings.mjs` only passes a painting when **all** of these hold, and
writes the evidence into each record's `clearance`:
1. **The museum itself flags it** Public Domain / CC0. Sources: Art Institute of Chicago,
   Cleveland Museum of Art, the Met.
2. **The artist died at least 71 years ago** (≤ 1955 in 2026), computed from the current year.
   Anonymous works must predate 1900. *Object age is the wrong test*: Hopper's *Nighthawks*
   (1942) is in the same open-access collection, but Hopper died in 1967, so it is blocked
   until 2038.
3. **Flat art only**: painting, print, drawing, watercolour. A photo of a 3-D object can carry
   its own copyright.
4. **At least 2000 px on the long edge.** Never AI-upscale a real artwork.

**Never hand-pick around the gate.** If a painting you want doesn't pass, skip it. Thousands
do pass.

## Steps

1. **Context.** Read the repo-root `README.md`, [`REAL_ART_GUIDANCE.md`](REAL_ART_GUIDANCE.md),
   and the **Gallery tags** and **Music prompts** sections of
   [`PROMPT_GUIDANCE.md`](PROMPT_GUIDANCE.md). Its other rules are for writing AI image and video
   prompts, and this mode writes none.

2. **Find candidates.**
   ```bash
   node curation/real-art/find-paintings.mjs --famous --limit 80 --out /tmp/lart-candidates.json
   ```
   Add `--query "<theme>"` for variety on nights the famous list feels repetitive. If you
   already know a famous eligible work, `--ids aic:<id>` fetches and clears that one painting.
   Everything in the output has passed the gate and isn't already in `gallery.json`.

3. **Pick four.**
   - **Recognizable first.** Prefer the works most people would recognize: a high
     `fame.wikipedia_langs`, plus your own judgement of what a general audience knows. Each
     painting is used once, ever.
   - **Something in it can move**: people, animals, water, sky, smoke, cloth.
   - **Variety:** spread artists, eras, wings and subjects. Look at the last ~12 real-art
     entries in `gallery.json` (`source: "real_artwork"`). Never two works by the same painter
     in one night.
   - **Skip nudity and graphic violence**, however famous the work (e.g. Courbet's *Woman with a
     Parrot*). Pieces get posted to social platforms, and a screensaver plays on screens other
     people can see.
   - If Omni's safety filter refuses a painting, take the next pick.

4. **Frame each pick on the dark wall.**
   ```bash
   node curation/real-art/frame-painting.mjs --candidates /tmp/lart-candidates.json \
     --id aic:20684 --stem caillebotte_paris_street_rainy_day
   ```
   This writes `gallery/<stem>_4k.webp` (the whole painting, centred on a 3840×2160 near-black
   wall; never cropped, never extended) and `gallery/<stem>.provenance.json`. **Look at the
   still.** If the download is soft, discoloured or a detail crop, pick another painting.

5. **Animate with Gemini Omni** (the `omni-video-gen` skill), using the fixed prompt from
   [`REAL_ART_GUIDANCE.md`](REAL_ART_GUIDANCE.md):
   ```bash
   VID_PROMPT="Animate this; keep the camera still."
   bash curation/with-secrets.sh GEMINI_API_KEY -- \
     python .claude/skills/omni-video-gen/scripts/generate.py \
       --prompt "$VID_PROMPT" --image gallery/<stem>_4k.webp --resolution 1080p \
       --out gallery/<stem>_animated.mp4
   ```
   Don't edit the prompt per painting. If Omni's safety filter refuses a painting, take the next
   pick.

6. **Fidelity gate: review the clip before publishing.** Extract the first, middle and last
   frames and check them against the guidance's *Fidelity checklist*. Compare **fixed
   landmarks** (a lamppost, a wall edge, the signature, the frame border) across the frames
   before you describe how anything moved. Reroll once (same prompt) if it fails. If the
   reroll fails too, drop the painting and take the next pick.

7. **Publish.**
   ```bash
   node curation/publish-piece.mjs \
     --still gallery/<stem>_4k.webp --video gallery/<stem>_animated.mp4 \
     --provenance gallery/<stem>.provenance.json \
     --title "<original title> - <artist> (AI Animated)" \
     --tag "19th Century" --video-prompt "$VID_PROMPT"
   ```
   Use the painting's real title and the artist's usual name, e.g. *"Paris Street; Rainy Day -
   Gustave Caillebotte (AI Animated)"*. "AI Animated" is accurate: the painting is real, the
   motion is AI. `--tag` takes exactly one wing from the closed list in `PROMPT_GUIDANCE.md`
   (era for European works, culture/region for the rest). Do not set `free`. Then delete
   `gallery/<stem>.provenance.json`.

8. **Repeat** steps 4–7 until four pieces are published.

9. **Commit and push.**
   ```bash
   git add gallery.json && git commit -m "AUTO_CURATION (real art): Added [Artist — Title, …]" \
     -m "<one line per piece: why it was picked; any reroll/drop and why>" && git push
   ```

10. **Post one to social.** Follow step 8 of [`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md)
    as written, with one change to 8a: **post the most recognizable painting of the four**,
    since recognition is the whole bet. The captions and pin titles credit the painter
    automatically for real-art entries. The music prompt should belong to the painting's own
    time and place.

11. **No round log.** The batch is recorded in the step-9 commit message: list each piece, and
    add a line for anything that was rerolled or dropped, and why. Don't append to the round log in
    `PROMPT_GUIDANCE.md`; it belongs to the human review loop. If a night teaches a genuinely new
    lesson about animating real paint, add it as a rule in
    [`REAL_ART_GUIDANCE.md`](REAL_ART_GUIDANCE.md) and commit that with the batch. Never write a
    narrative entry.
