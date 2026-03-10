# Living Art Screensaver Automated Curation

You are building a web-based screensaver app that showcases classic and modern artworks brought to life using AI animation (Google Veo 3.1). You are working on an automated task to curate a new art collection. All the files below are relative to the directory "screensaver/". 

## ⚠️ CRITICAL INSTRUCTION: Tool Usage

Do **NOT** guess tool commands. You must use the **nano-banana-pro** and **veo3-video-gen** skills.
1.  **Read the skill documentation first**:
    *   `read /home/clawd/.npm-global/lib/node_modules/openclaw/skills/nano-banana-pro/SKILL.md`
    *   `read /home/clawd/.openclaw/workspace/skills/veo3-video-gen/SKILL.md`
2.  **Follow the usage instructions** in those files exactly (using `uv run ...` as documented). Do not try to run `nano-banana-pro` as a standalone binary.

## Steps to execute

1.  **Gain Context:** Load "README.md" into your context. List and read files in `screensaver/` to understand the structure.

2.  **Still Image Generation:**
    *   Pick a new theme/style. Only pick themes/styles which occur before the 21-th century. Ignore the art styles in `screensaver/ART_STYLES_FOR_INSPIRATION.txt` for now, because they are too modern and too focused on the art styles in the digital area.
    *   Generate a high-quality PNG using the **nano-banana-pro** skill.

3.  **AI Animation:**
    *   Animate your new image using the **veo3-video-gen** skill.
    *   After the video is successfully generated, **delete the source PNG file** (e.g., `gallery/filename.png`) as it is an intermediate artifact.

4.  **Update App:**
    *   Edit `gallery.json` to include the new video in the beginning of the array.
    *   Format: `{ src: 'gallery/filename_animated.mp4', title: 'Title - Style (AI Animated)', type: 'video', date: 'YYYY-MM-DD', image_prompt: 'THE_IMAGE_PROMPT_USED', video_prompt: 'THE_VIDEO_PROMPT_USED' }`

5.  **Repeat:** Perform steps 2-4 a total of **3 times** to create 3 unique pieces.

6.  **Expand Inspiration:** If the art styles you picked doesn't exist in `screensaver/ART_STYLES_FOR_INSPIRATION.txt`, append them.

7.  **Commit and Push:**
    *   **IMPORTANT:** You must be inside the `screensaver/` directory for git operations.
    *   Run: `cd screensaver && git add . && git commit -m "AUTO_CURATION: Added [Style 1, Style 2, Style 3] collections"`
    *   Run: `git push` to sync changes to the remote.
