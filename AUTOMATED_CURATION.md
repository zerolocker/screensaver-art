# Living Art Screensaver Automated Curation

You are building a screensaver app that showcases classic and modern artworks brought to life using AI animation (Google Veo 3.1). You are working on an automated task to curate a new art collection.

**IMPORTANT:** You must switch the current directory to `screensaver-art/` first as instructions below are relative to this directory.

## ⚠️ CRITICAL INSTRUCTION: Tool Usage

1. Do **NOT** guess tool commands. You must use the **nano-banana-pro** and **veo3-video-gen** skills. If you can't find them, abort.

## Steps to execute

1.  **Gain Context:** Read "README.md". **Also read `curation/PROMPT_GUIDANCE.md`** — it holds prompt-quality rules distilled from human curation of past bad pieces. Follow it when writing the prompts below.

2.  **Still Image Generation:**
    *   Pick a new theme/style. Only pick themes/styles which occur before the 21-th century.
    *   Generate a high-quality PNG using the **nano-banana-pro** skill. Write the image prompt in line with `curation/PROMPT_GUIDANCE.md` (concrete medium/material/era/lighting; one clear subject).
    *   **Self-review the still before animating it (vision gate).** Look at the generated PNG and judge it honestly. Regenerate (revising the prompt per `curation/PROMPT_GUIDANCE.md`) if it looks like a **museum-object / catalog photo** (object on a pedestal, glass case, gallery wall, label), shows obvious **AI artifacts** (melted faces, extra limbs, garbled inscriptions, duplicated or warped elements), is compositionally **empty or off-theme** (or reads as post-1900), or simply **wouldn't look good framed on a wall**. Only proceed to animation once the still is genuinely gallery-worthy. This is cheap insurance — it's far better to reroll a still than to spend a video generation on a bad image.

3.  **AI Animation & Upload:**
    *   Animate your new image using the **veo3-video-gen** skill. Write the video prompt in line with `curation/PROMPT_GUIDANCE.md`: **match the motion to the scene** — gentle for a calm subject, genuinely dramatic for a dramatic one (a stormy seascape *should* have crashing waves, lightning and wind) — but keep it physically plausible and don't morph or move what shouldn't move.
    *   **Upload to R2 under a unique, descriptive filename — and never overwrite an existing key.** Upload only if the key is free; if it already exists, pick a different name and retry:
        ```bash
        KEY="gallery/<descriptive_name>_animated.mp4"
        if wrangler r2 object get "screensaver-assets/$KEY" --file=/dev/null --remote &> /dev/null; then
          echo "Key already exists — choose a different name and retry."
        else
          wrangler r2 object put "screensaver-assets/$KEY" --file="$KEY" --remote
        fi
        ```
    *   **Clean up before generating the next piece:** after a successful upload, delete the local image and video.

4.  **Update App:**
    *   Edit `gallery.json` to include the new video in the beginning of the array.
    *   Format: `{ src: 'https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/filename_animated.mp4', title: 'Title - Style (AI Animated)', type: 'video', date: 'YYYY-MM-DD', tags: ['Category'], image_prompt: 'THE_IMAGE_PROMPT_USED', video_prompt: 'THE_VIDEO_PROMPT_USED' }`
    *   Set `tags` to **exactly one** category from the closed list in `curation/PROMPT_GUIDANCE.md` ("Gallery tags") — it drives the Gallery filter pills, so **never invent a new tag value**. For the styles you curate it'll be one of `Ancient`, `Asian`, `Medieval`, `Renaissance & Baroque`, `19th Century`, or `Modern`.

5.  **Repeat:** Perform steps 2-4 a total of **3 times** to create 3 unique pieces.

6.  **Expand Inspiration:** If a style you picked doesn't exist in `ART_STYLES_FOR_INSPIRATION.md`, append it under the section it best fits (the `##` headings are categories, not styles).

7.  **Commit and Push:**
    *   Run: `git add gallery.json ART_STYLES_FOR_INSPIRATION.md && git commit -m "AUTO_CURATION: Added [Style 1, Style 2, Style 3] collections"`
    *   Run: `git push` to sync changes to the remote. Remember your task is to curate, so don't push other stuff you generated to the repo.

