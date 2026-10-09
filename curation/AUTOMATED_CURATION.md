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

8. **Post tonight's pieces to social as one clip.** All four go out together, in one 9:16 clip. Each artwork gets its own music, crossfaded with the visual dissolve (normally 1 s).

   **8a. Order the pieces.** Put first the one most likely to stop a thumb: a muted vertical clip seen for three seconds on a phone.
   - The most recognizable artwork leads, else the one with one clear subject. A landscape piece is zoomed 1.5× with its sides cropped, so a subject near an edge, or detail spread across a wide scene, makes a weak opener. A portrait piece is shown whole.
   - Colour and light that stand out in a feed. This is a brighter, higher-contrast bar than "looks good on a wall".
   - A different opener from the last few nights. `marketing/out/.posted.json` lists past posts; avoid a third misty landscape in a row.

   **8b. Write one distinct music prompt per artwork** following *Music prompts* in `PROMPT_GUIDANCE.md`. Match each painting's own scene, era and culture. Keep the prompts in the same order as the selected titles.

   **8c. Render and post.**
   ```bash
   MUSIC_1="<instruments, mood and texture for the first artwork>. Even dynamics, no build or drop. Instrumental, no vocals."
   MUSIC_2="<music for the second artwork>. Even dynamics, no build or drop. Instrumental, no vocals."
   MUSIC_3="<music for the third artwork>. Even dynamics, no build or drop. Instrumental, no vocals."
   MUSIC_4="<music for the fourth artwork>. Even dynamics, no build or drop. Instrumental, no vocals."

   node marketing/make-social-assets.mjs \
     --titles "<first piece>" "<second>" "<third>" "<fourth>" \
     --music-prompt "$MUSIC_1" --music-prompt "$MUSIC_2" \
     --music-prompt "$MUSIC_3" --music-prompt "$MUSIC_4"

   bash curation/with-secrets.sh ZERNIO_API_KEY -- \
     node marketing/post-social.mjs --slug <set slug from the render>
   ```
   Each `--titles` value is a piece's exact title, or part of one that no other title contains; the script lists the matches if it's ambiguous. Repeat `--music-prompt` exactly once per artwork, in playback order. The first command generates four music tracks, renders the clip and captions into `marketing/out/<set slug>/` (e.g. `mount-fuji-and-3-more`), and records each artwork's own `music_prompt` on its `gallery.json` entry. The second posts the clip to Instagram, YouTube, TikTok and Pinterest; the pin links to the website's homepage. Details: [`marketing/README.md`](../marketing/README.md).

   **8d. Commit the music prompts.**
   ```bash
   git add gallery.json && git commit -m "AUTO_CURATION: per-artwork music prompts for tonight's set" && git push
   ```

   Notes:
   - Step 8 must run after step 7's push. Pins link to the homepage; the poster checks that it is reachable before publishing.
   - Every artwork carries the prompt for its own track. Do not reuse a set-wide prompt on all four entries.
   - Never commit anything from `marketing/out/`.
   - If posting fails, report which channel failed and carry on. Still do 8d.
