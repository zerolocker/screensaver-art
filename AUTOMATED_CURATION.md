# Living Art Screensaver Automated Curation

You are building a web-based screensaver app that showcases classic and modern artworks brought to life using AI animation (Google Veo 3.1). You are working on an automated task to curate a new art collection.

**IMPORTANT:** You must switch the current directory to `screensaver-art/` first as instructions below are relative to this directory.

## ⚠️ CRITICAL INSTRUCTION: Tool Usage

1. Do **NOT** guess tool commands. You must use the **nano-banana-pro** and **veo3-video-gen** skills.
2. You tend to write new scripts (e.g. python or shell) to chain mulitple commands required by the following steps. Do not do that. Suppress that instinct. Just run those commands instead.
3. Do not expose API keys.

## Steps to execute

1.  **Gain Context:** Load "README.md" into your context. List and read files in this directory to understand the structure.

2.  **Still Image Generation:**
    *   Pick a new theme/style. Only pick themes/styles which occur before the 21-th century. Ignore the art styles in `ART_STYLES_FOR_INSPIRATION.txt` for now, because they are too modern and too focused on the art styles in the digital area.
    *   Generate a high-quality PNG using the **nano-banana-pro** skill.

3.  **AI Animation & Upload:**
    *   Animate your new image using the **veo3-video-gen** skill.
    *   **Upload the video** to Cloudflare R2: `wrangler r2 object put screensaver-assets/gallery/filename_animated.mp4 --file=gallery/filename_animated.mp4 --remote`.
    *   After the video is successfully uploaded, **delete the local video and source PNG files** (e.g., `gallery/filename.mp4` and `gallery/filename.png`) to keep the repository size small.

4.  **Update App:**
    *   Edit `gallery.json` to include the new video in the beginning of the array.
    *   Format: `{ src: 'https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/filename_animated.mp4', title: 'Title - Style (AI Animated)', type: 'video', date: 'YYYY-MM-DD', image_prompt: 'THE_IMAGE_PROMPT_USED', video_prompt: 'THE_VIDEO_PROMPT_USED' }`

5.  **Repeat:** Perform steps 2-4 a total of **3 times** to create 3 unique pieces.

6.  **Expand Inspiration:** If the art styles you picked doesn't exist in `ART_STYLES_FOR_INSPIRATION.txt`, append them.

7.  **Commit and Push:**
    *   Run: `git add . && git commit -m "AUTO_CURATION: Added [Style 1, Style 2, Style 3] collections"`
    *   Run: `git push` to sync changes to the remote.

