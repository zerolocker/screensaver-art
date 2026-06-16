# Living Art Screensaver Automated Curation

You are building a screensaver app that showcases classic and modern artworks brought to life using AI animation (Google Veo 3.1). You are working on an automated task to curate a new art collection.

**IMPORTANT:** You must switch the current directory to `screensaver-art/` first as instructions below are relative to this directory.

## ⚠️ CRITICAL INSTRUCTION: Tool Usage

1. Do **NOT** guess tool commands. You must use the **nano-banana-pro** and **veo3-video-gen** skills. If you can't find them, abort.

## Prerequisites & credentials

Secrets live in **`curation/.env`** (gitignored; template `curation/.env.example`).
Run every command that needs a secret through **`curation/with-secrets.sh`**, which
loads `curation/.env`, **verifies the named secret(s) are present**, and errors out
if any is missing — so each call names exactly what it depends on:
- **`GEMINI_API_KEY`** — the image/video skills. They're invoked as
  `bash curation/with-secrets.sh GEMINI_API_KEY -- python .claude/skills/<skill>/scripts/generate.py …`
  (see each skill's `SKILL.md`).
- **`CLOUDFLARE_API_TOKEN`** — the R2 upload (below).

If a required secret is missing the wrapper exits non-zero — **abort** and report
it rather than proceeding.

## Steps to execute

1.  **Gain Context:** Read "README.md". **Also read `curation/PROMPT_GUIDANCE.md`** — it holds prompt-quality rules distilled from human curation of past bad pieces. Follow it when writing the prompts below.

2.  **Still Image Generation:**
    *   Pick a new theme/style. Only pick themes/styles which occur before the 21-th century.
    *   Generate a high-quality **4K** still with the **nano-banana-pro** skill — pass **`--size 4K`** (output is WebP by default, e.g. `--out gallery/<descriptive_name>_4k.webp`). Write the image prompt in line with `curation/PROMPT_GUIDANCE.md` (concrete medium/material/era/lighting; one clear subject).
    *   **Self-review the still before animating it (vision gate).** Look at the generated image and judge it honestly. Regenerate (revising the prompt per `curation/PROMPT_GUIDANCE.md`) if it looks like a **museum-object / catalog photo** (object on a pedestal, glass case, gallery wall, label), shows obvious **AI artifacts** (melted faces, extra limbs, garbled inscriptions, duplicated or warped elements), is compositionally **empty or off-theme**, or simply **wouldn't look good framed on a wall**. Only proceed to animation once the still is genuinely gallery-worthy. This is cheap insurance — it's far better to reroll a still than to spend a video generation on a bad image.

3.  **AI Animation & Upload:**
    *   Animate the still with the **veo3-video-gen** skill, feeding the 4K WebP as the first frame. Write the video prompt in line with `curation/PROMPT_GUIDANCE.md`: **match the motion to the scene** — gentle for a calm subject, genuinely dramatic for a dramatic one (a stormy seascape *should* have crashing waves, lightning and wind) — but keep it physically plausible and don't morph or move what shouldn't move. **Step 5 says which of the 4 pieces are looping vs not:**
        *   **Non-looping piece** — `--first-frame <still.webp>` only (no `--last-frame`, no extend). Name the video `gallery/<descriptive_name>_animated.mp4`.
        *   **Looping piece** — pass the **same** still to both `--first-frame` and `--last-frame` so the clip ends exactly where it began. Name the video `gallery/<descriptive_name>_looping.mp4`.
    *   **Upload BOTH the 4K still and the video to R2** under unique, descriptive keys — and **never overwrite an existing key** (if a key exists, pick a different name and retry). Use this helper:
        ```bash
        upload() {  # upload <local-file> <r2-key> [content-type]
          local f="$1" key="$2" ct="$3"
          if bash curation/with-secrets.sh CLOUDFLARE_API_TOKEN -- npx --yes wrangler r2 object get "screensaver-assets/$key" --file=/dev/null --remote &> /dev/null; then
            echo "Key $key already exists — choose a different name and retry."; return 1
          fi
          bash curation/with-secrets.sh CLOUDFLARE_API_TOKEN -- npx --yes wrangler r2 object put "screensaver-assets/$key" --file="$f" --remote ${ct:+--content-type "$ct"}
        }
        upload "gallery/<descriptive_name>_4k.webp"      "gallery/<descriptive_name>_4k.webp"      "image/webp"
        upload "gallery/<descriptive_name>_animated.mp4" "gallery/<descriptive_name>_animated.mp4"   # use _looping.mp4 for a looping piece
        ```
    *   **Clean up before generating the next piece:** after a successful upload, delete the local image and video.

4.  **Update App:**
    *   `gallery.json` is kept **sorted by `date` ascending** (oldest first, newest last). Use **today's date** for the new piece and **append it to the end of the array** — that keeps the file sorted without re-sorting anything else.
    *   Format: `{ src: 'https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/<name>_animated.mp4', img: 'https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/<name>_4k.webp', title: 'Title - Style (AI Animated)', type: 'video', date: 'YYYY-MM-DD', tags: ['Category'], image_prompt: 'THE_IMAGE_PROMPT_USED', video_prompt: 'THE_VIDEO_PROMPT_USED' }`
        *   **`img`** — the R2 URL of the uploaded 4K still (the `_4k.webp` key). Always include it.
        *   For a **looping** piece, use the `_looping.mp4` filename in `src` **and** add **`looping: true`** to the entry.
    *   Set `tags` to **exactly one** museum "wing" from the closed list in `curation/PROMPT_GUIDANCE.md` ("Gallery tags") — it drives the Gallery filter pills, so **never invent a new tag value**. Assign by culture/region for ancient & non-Western pieces, by era for European ones (e.g. `Egyptian`, `Greek & Roman`, `Japanese`, `Chinese & Korean`, `Islamic`, `Medieval & Byzantine`, `Renaissance & Baroque`, `19th Century`, `Modern`). Never use `Contemporary` (legacy-only).

5.  **Repeat:** Perform steps 2-4 a total of **4 times** to create 4 unique pieces. The **first 2** are **non-looping** (`_animated.mp4`, no `looping` field); the **last 2** are **looping** (`_looping.mp4`, generated with `--first-frame == --last-frame`, and `"looping": true` in the entry).

6.  **Expand Inspiration:** If a style you picked doesn't exist in `curation/ART_STYLES_FOR_INSPIRATION.md`, append it under the section it best fits (the `##` headings are categories, not styles).

7.  **Commit and Push:**
    *   Run: `git add gallery.json curation/ART_STYLES_FOR_INSPIRATION.md && git commit -m "AUTO_CURATION: Added [Style 1, Style 2, Style 3, Style 4] collections"`
    *   Run: `git push` to sync changes to the remote. Remember your task is to curate, so don't push other stuff you generated to the repo.

