# Nightly curation

You are adding four new pieces to the Living Art Screensaver gallery: artworks brought to life with AI animation. Run every command from the repo root.

## Step 0: pick the mode

Read `curation/CURATION_MODE`. It holds one word:
- **`real-paintings`**: stop here and follow [`REAL_PAINTINGS_CURATION.md`](REAL_PAINTINGS_CURATION.md) instead. It reuses this file's publish and social steps.
- **`ai-generated`**: continue below.

To switch modes, change that word and push to `master`.

## Prerequisites

Secrets live in `curation/.env` (template: `curation/.env.example`). Run any command that needs one through `curation/with-secrets.sh`, which loads the file and fails if a named secret is missing:
- `GEMINI_API_KEY` for the image, video and music skills: `bash curation/with-secrets.sh GEMINI_API_KEY -- python .claude/skills/<skill>/scripts/generate.py …`
- `CLOUDFLARE_API_TOKEN` for R2. `publish-piece.mjs` loads it itself.
- `ZERNIO_API_KEY` for social posting in step 8 only. If it's missing, you lose the night's post, not the night's art.

If a required secret is missing, abort and report it. You must use the **nano-banana-pro** and **veo3-video-gen** skills; abort if they're missing. `ffmpeg` must be on `PATH`.

The only files you change are `gallery.json`, `curation/ART_STYLES_FOR_INSPIRATION.md` (step 6), and, only for a genuinely new failure pattern, the Hard rules in `curation/PROMPT_GUIDANCE.md`. Record the night's batch in the commit message.

## Steps

1. **Context.** Read the repo-root `README.md` and `curation/PROMPT_GUIDANCE.md`.

2. **Make the still.**
   - Pick a new style, following *Brand & taste* and the *Era mix* cap in `PROMPT_GUIDANCE.md`.
   - Generate a 4K still with **nano-banana-pro**: `--size 4K --out gallery/<name>_4k.webp`. Write the prompt per the Hard rules.
   - **Review the still before animating it.** Look at it honestly against the Hard rules. If it breaks one, or simply wouldn't look good framed on a wall, revise the prompt and regenerate. A reroll is far cheaper than a wasted video.

3. **Animate it** with **veo3-video-gen**, using the 4K still as the first frame. Write the video prompt per the Hard rules.
   - **Before generating, say the clip in one sentence: "<actor> <does what>."** If you can't, the prompt isn't ready.
   - Decide whether this piece should loop (see *Loops* in the Hard rules):
     - **Non-looping:** `--first-frame <still>` only. Name the video `gallery/<name>_animated.mp4`.
     - **Looping:** pass the same still as `--first-frame` and `--last-frame`. Name it `gallery/<name>_looping.mp4`.

4. **Publish.**
   ```bash
   node curation/publish-piece.mjs \
     --still gallery/<name>_4k.webp \
     --video gallery/<name>_animated.mp4 \
     --title "Title - Style (AI Animated)" \
     --tag "Modern" \
     --image-prompt "$IMG_PROMPT" --video-prompt "$VID_PROMPT"
   ```
   It makes the three web images from the still, uploads them and the video to R2, adds the `gallery.json` entry with today's date, and deletes the local files. Pass the same prompt variables you gave the skills so they're recorded exactly.
   - `--tag` takes exactly one wing from *Gallery tags* in `PROMPT_GUIDANCE.md`. The script rejects anything else.
   - Looping is read from the filename; use `--looping` or `--no-looping` for other names.
   - If a key already exists, retry with a new `--stem <name>`. If an upload failed partway, rerun the same command with `--resume`. Use `--dry-run` to check without publishing.

5. **Repeat** steps 2–4 until you have **4** pieces. There's no loop quota.

6. **New styles.** If a style you used isn't in `curation/ART_STYLES_FOR_INSPIRATION.md`, add it under the best-fitting `##` category.

7. **Commit and push.**
   ```bash
   git add gallery.json curation/ART_STYLES_FOR_INSPIRATION.md
   git commit -m "AUTO_CURATION: Added [Style 1, Style 2, Style 3, Style 4] collections"
   git push
   ```
   Don't commit anything else you generated.

8. **Post one piece to social.**

   **8a. Pick the piece** most likely to work as a muted vertical clip seen for three seconds on a phone:
   - One clear subject in the middle two-thirds of the width. The clip zooms the art 1.5× and crops the sides, so detail spread across a wide scene, or a subject near an edge, gets lost.
   - Colour and light that stand out in a feed. This is a brighter, higher-contrast bar than "looks good on a wall".
   - Something different from the last few nights. `marketing/out/.posted.json` lists past posts; avoid a third misty landscape in a row.

   **8b. Write its music prompt** following *Music prompts* in `PROMPT_GUIDANCE.md`.

   **8c. Render and post.**
   ```bash
   MUSIC_PROMPT="Bright, playful summer daytime music: pizzicato strings and warm marimba …
   Even dynamics, no build or drop. Instrumental, no vocals."

   node marketing/make-social-assets.mjs --title "<the piece>" --music-prompt "$MUSIC_PROMPT"

   bash curation/with-secrets.sh ZERNIO_API_KEY -- \
     node marketing/post-social.mjs --slug <slug from the render>
   ```
   The first command generates the music, renders the clips and captions, and records `music_prompt` on the piece's `gallery.json` entry. The second posts to Instagram, YouTube, TikTok and Pinterest. Details: [`marketing/README.md`](../marketing/README.md).

   **8d. Commit the music prompt.**
   ```bash
   git add gallery.json && git commit -m "AUTO_CURATION: music_prompt for <piece>" && git push
   ```

   Notes:
   - Step 8 must run after step 7's push. The pin links to the piece's web page, which exists only after Vercel rebuilds; the poster waits for it.
   - Only the posted piece gets a music prompt. `make-social-assets.mjs` refuses `--music-prompt` if more than one piece matches.
   - Never commit anything from `marketing/out/`.
   - If posting fails, report which channel failed and carry on. Still do 8d.
