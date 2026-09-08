# Living Art Screensaver Automated Curation

You are building a screensaver app that showcases classic and modern artworks brought to life using AI animation (Google Veo 3.1). You are working on an automated task to curate a new art collection.

Instructions below assume the git repo is the current working directory.

## Prerequisites & credentials

Secrets live in **`curation/.env`** (gitignored; template `curation/.env.example`).
Run every command that needs a secret through **`curation/with-secrets.sh`**, which
loads `curation/.env`, **verifies the named secret(s) are present**, and errors out
if any is missing — so each call names exactly what it depends on:
- **`GEMINI_API_KEY`** — the image/video skills. They're invoked as
  `bash curation/with-secrets.sh GEMINI_API_KEY -- python .claude/skills/<skill>/scripts/generate.py …`
  (see each skill's `SKILL.md`).
- **`CLOUDFLARE_API_TOKEN`** — the R2 upload. `curation/publish-piece.mjs` (step 4)
  wraps itself in `with-secrets.sh`, so you never pass this one by hand.
- **`UPLOADPOST_API_KEY` + `ZERNIO_API_KEY`** — the social posting in step 8. Passed
  explicitly: `bash curation/with-secrets.sh UPLOADPOST_API_KEY ZERNIO_API_KEY -- node
  marketing/post-social.mjs …`. Steps 1-7 don't need them, so a missing key costs the
  night's posts, not the night's art.

If a required secret is missing, **abort** and report it rather than proceeding.

You must use the **nano-banana-pro** and **veo3-video-gen** skills. If you can't find them, abort.
`ffmpeg` must be on `PATH` (step 4 derives the web images with it).

## Steps to execute

1.  **Gain Context:** Read the repo-root `README.md`.

2.  **Still Image Generation:**
    *   Pick a new theme/style, honouring **"Brand & taste"** and the **"Era mix"** cap in `curation/PROMPT_GUIDANCE.md`.
    *   Generate a high-quality **4K** still with the **nano-banana-pro** skill — pass **`--size 4K`** (output is WebP by default, e.g. `--out gallery/<descriptive_name>_4k.webp`). Write the image prompt per the **Hard rules** in `curation/PROMPT_GUIDANCE.md`.
    *   **Self-review the still before animating it (vision gate).** Look at the generated image and judge it honestly, checking it against the **Hard rules**. Regenerate (revising the prompt) if it breaks any of them or simply **wouldn't look good framed on a wall**. Only proceed to animation once the still is genuinely gallery-worthy. This is cheap insurance — it's far better to reroll a still than to spend a video generation on a bad image.

3.  **AI Animation:**
    *   Animate the still with the **veo3-video-gen** skill, feeding the 4K WebP as the first frame. Write the video prompt per the **Hard rules** in `curation/PROMPT_GUIDANCE.md`.
    *   **Motion gate — before you generate, say the clip out loud in one sentence: "<actor> <does what>."** If you can't, the prompt is not ready (see the primary-mover rule). Then **decide per-piece whether it should loop** (see the loop rule) and name the file accordingly:
        *   **Non-looping piece** — `--first-frame <still.webp>` only (no `--last-frame`, no extend). Name the video `gallery/<descriptive_name>_animated.mp4`.
        *   **Looping piece** — pass the **same** still to both `--first-frame` and `--last-frame` so the clip ends exactly where it began. Name the video `gallery/<descriptive_name>_looping.mp4`.

4.  **Publish the piece — one command:**
    ```bash
    node curation/publish-piece.mjs \
      --still gallery/<descriptive_name>_4k.webp \
      --video gallery/<descriptive_name>_animated.mp4 \
      --title "Title - Style (AI Animated)" \
      --tag "Modern" \
      --image-prompt "$IMG_PROMPT" --video-prompt "$VID_PROMPT"
    ```
    It derives the three web images from the 4K still, **uploads the images and the video** to R2 (immutable cache headers, refusing to overwrite an existing key), appends the `gallery.json` entry with today's date, and deletes the local files. Reuse the same shell variables you passed to the two skills so the prompts are recorded verbatim.
    *   **`--tag` takes exactly one** museum "wing" from the closed list in `curation/PROMPT_GUIDANCE.md` ("Gallery tags") — it drives the Gallery filter pills, so **never invent a new value**. The script rejects anything off the list.
    *   `looping` is inferred from the video filename (`_looping.mp4` / `_animated.mp4`); pass `--looping` or `--no-looping` for any other name.
    *   If it reports that a key already exists, **pick a different name** and retry with `--stem <new_name>`. If an upload failed partway, re-run the identical command with `--resume`.
    *   The 4K master is **not** uploaded — the 2K derivative is the archival copy. Run with `--dry-run` first if you want to check the derivation and the entry without publishing.

5.  **Repeat:** Perform steps 2-4 a total of **4 times** to create 4 unique pieces. There is **no fixed loop quota** — a night of all non-looping pieces is fine.

6.  **Expand Inspiration:** If a style you picked doesn't exist in `curation/ART_STYLES_FOR_INSPIRATION.md`, append it under the section it best fits (the `##` headings are categories, not styles).

7.  **Commit and Push:**
    *   Run: `git add gallery.json curation/ART_STYLES_FOR_INSPIRATION.md && git commit -m "AUTO_CURATION: Added [Style 1, Style 2, Style 3, Style 4] collections"`
    *   Run: `git push` to sync changes to the remote. Remember your task is to curate, so don't push other stuff you generated to the repo.

8.  **Post the day's art to social — two commands, no human step:**
    ```bash
    node marketing/make-social-assets.mjs --latest 4 --audio

    bash curation/with-secrets.sh UPLOADPOST_API_KEY ZERNIO_API_KEY -- \
      node marketing/post-social.mjs --latest 4
    ```
    The first renders 9:16 + 1:1 clips with a music bed and a `meta.json`; the second
    publishes **one** of them to all four channels — Instagram + YouTube via upload-post,
    TikTok + Pinterest via Zernio — linking each post to that piece's own
    `/art/<slug>` page. Details in [`marketing/README.md`](../marketing/README.md).
    *   **Order matters:** this runs *after* the push, because each post links to a
        landing page that only exists once Vercel has rebuilt from the new
        `gallery.json`. The poster checks the page is live before publishing (a post's
        destination URL can never be edited) and waits out the deploy.
    *   **One piece a night, not four.** The other three stay rendered and are picked
        up on later nights; a ledger (`marketing/out/.posted.json`) makes re-runs safe.
    *   **Never commit anything from `marketing/out/` or `marketing/beds/`** — clips and
        MP3s are media (repo rules in `CLAUDE.md`), and both paths are gitignored.
    *   If it exits non-zero, report which channel failed and carry on; a missed post is
        not worth failing the curation run over.

