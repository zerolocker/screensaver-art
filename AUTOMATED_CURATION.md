# Living Art Screensaver Automated Curation

You are building a web-based screensaver app that showcases classic and modern artworks brought to life using AI animation (Google Veo 3.1). You are working on an automated task to curate a new art collection. All the files below are relative to the directory "screensaver/". 

## ⚠️ CRITICAL INSTRUCTION: Tool Usage

Do **NOT** guess tool commands. You must use the **nano-banana-pro** and **veo3-video-gen** skills.
1.  **Read the skill documentation first**:
    *   `read /home/clawd/.npm-global/lib/node_modules/clawdbot/skills/nano-banana-pro/SKILL.md`
    *   `read /home/clawd/clawd/skills/veo3-video-gen/SKILL.md`
2.  **Follow the usage instructions** in those files exactly (using `uv run ...` as documented). Do not try to run `nano-banana-pro` as a standalone binary.

## Steps to execute

1.  **Gain Context:** Load "README.md" into your context. List and read files in `screensaver/` to understand the structure.

2.  **Still Image Generation:**
    *   Pick a new theme/style (check `ART_STYLES_FOR_INSPIRATION.md`).
    *   Generate a high-quality PNG using the **nano-banana-pro** skill.

3.  **AI Animation:**
    *   Animate your new image using the **veo3-video-gen** skill.

4.  **Update App:**
    *   Edit `screensaver/index.html` to include the new video in the `items` array.
    *   Format: `{ src: 'gallery/filename_animated.mp4', title: 'Title - Style Collection (AI Animated)', type: 'video' }`

5.  **Repeat:** Perform steps 2-4 a total of **3 times** to create 3 unique pieces.

6.  **Expand Inspiration:** Append 1-2 new styles to `screensaver/ART_STYLES_FOR_INSPIRATION.md`.

7.  **Commit:**
    *   **IMPORTANT:** You must be inside the `screensaver/` directory for git operations.
    *   Run: `cd screensaver && git add . && git commit -m "AUTO_CURATION: Added [Style 1, Style 2, Style 3] collections"`
