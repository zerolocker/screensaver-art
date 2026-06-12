# Living Art Screensaver Automated Curation

You are building a screensaver app that showcases classic and modern artworks brought to life using AI animation (Google Veo 3.1). You are working on an automated task to curate a new art collection.

**IMPORTANT:** You must switch the current directory to `screensaver-art/` first as instructions below are relative to this directory.

## ⚠️ CRITICAL INSTRUCTION: Tool Usage

1. Do **NOT** guess tool commands. You must use the **nano-banana-pro** and **veo3-video-gen** skills.

## Steps to execute

1.  **Gain Context:** Read "README.md". **Also read `curation/PROMPT_GUIDANCE.md`** — it holds prompt-quality rules distilled from human curation of past bad pieces. Follow it when writing the prompts below.

2.  **Still Image Generation:**
    *   Pick a new theme/style. Only pick themes/styles which occur before the 21-th century. Ignore the art styles in `ART_STYLES_FOR_INSPIRATION.txt` for now, because they are too modern and too focused on the art styles in the digital area.
    *   Generate a high-quality PNG using the **nano-banana-pro** skill. Write the image prompt in line with `curation/PROMPT_GUIDANCE.md` (concrete medium/material/era/lighting; one clear subject).
    *   **Self-review the still before animating it (vision gate).** Look at the generated PNG and judge it honestly. Regenerate (revising the prompt per `curation/PROMPT_GUIDANCE.md`) if it looks like a **museum-object / catalog photo** (object on a pedestal, glass case, gallery wall, label), shows obvious **AI artifacts** (melted faces, extra limbs, garbled inscriptions, duplicated or warped elements), is compositionally **empty or off-theme** (or reads as post-1900), or simply **wouldn't look good framed on a wall**. Only proceed to animation once the still is genuinely gallery-worthy. This is cheap insurance — it's far better to reroll a still than to spend a video generation on a bad image.

3.  **AI Animation & Upload:**
    *   Animate your new image using the **veo3-video-gen** skill. Write the video prompt in line with `curation/PROMPT_GUIDANCE.md`: **match the motion to the scene** — gentle for a calm subject, genuinely dramatic for a dramatic one (a stormy seascape *should* have crashing waves, lightning and wind) — but keep it physically plausible and don't morph or move what shouldn't move.
    *   **Confirm veo actually produced a fresh file**, then check it's different from the previous piece's video this session (e.g. compare byte sizes — identical sizes ⇒ the gen probably failed and you're about to ship a stale duplicate; regenerate). *(Past rounds shipped the same MP4 under three different titles exactly this way.)*
    *   **Upload to R2 under a unique, descriptive filename — and never overwrite an existing key.** Upload only if the key is free; if it already exists, pick a different name and retry:
        ```bash
        KEY="gallery/<descriptive_name>_animated.mp4"
        if wrangler r2 object get "screensaver-assets/$KEY" --file=/dev/null --remote &> /dev/null; then
          echo "Key already exists — choose a different name and retry."
        else
          wrangler r2 object put "screensaver-assets/$KEY" --file="$KEY" --remote
        fi
        ```
    *   **Clean up before generating the next piece:** after a successful upload, delete the local image and video. This is the guard that actually prevents the stale-duplicate bug — if the *next* veo run silently fails, there's no leftover file lying around for its upload step to grab and re-ship.

4.  **Update App:**
    *   Edit `gallery.json` to include the new video in the beginning of the array.
    *   Format: `{ src: 'https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/filename_animated.mp4', title: 'Title - Style (AI Animated)', type: 'video', date: 'YYYY-MM-DD', image_prompt: 'THE_IMAGE_PROMPT_USED', video_prompt: 'THE_VIDEO_PROMPT_USED' }`

5.  **Repeat:** Perform steps 2-4 a total of **3 times** to create 3 unique pieces.

6.  **Expand Inspiration:** If the art styles you picked doesn't exist in `ART_STYLES_FOR_INSPIRATION.txt`, append them.

7.  **Commit and Push:**
    *   Run: `git add gallery.json ART_STYLES_FOR_INSPIRATION.txt && git commit -m "AUTO_CURATION: Added [Style 1, Style 2, Style 3] collections"`
    *   Run: `git push` to sync changes to the remote. Remember your task is to curate, so don't push other stuff you generated to the repo.

