# Nightly Art Curation Plan

## Objective
Automatically expand the "Living Art" gallery every night at 2:00 AM. The goal is to ensure the user discovers new, unexpected visuals on their screensaver without manual intervention.

## The Workflow

### 1. The Curator (Selection)
- **Role:** Select a new theme/style for the night.
- **Logic:**
    - Maintain a list of "Used Themes" to avoid repetition.
    - Pick from a diverse palette: *Cyberpunk, Art Nouveau, Ukiyo-e, brutalism, solarpunk, vaporwave, baroque, sketching, oil painting, claymation.*
    - Define a specific subject (e.g., "A lonely astronaut at a bus stop", "A futuristic greenhouse").

### 2. The Artist (Generation)
- **Tool:** `nano-banana-pro` (Gemini 3 Image)
- **Action:** Generate a high-resolution (16:9 or 1K/2K) static image.
- **Prompting:** Focus on texture, lighting, and composition.
- **Output:** `surprise_build/gallery/YYYY-MM-DD_theme_name.png`

### 3. The Animator (Motion)
- **Tool:** `veo3-video-gen` (Google Veo)
- **Action:** Convert the static image to a 5-8s video loop.
- **Parameters:**
    - `--input-image`: The PNG from Step 2.
    - `--prompt`: Describe the *motion* (e.g., "The neon lights flicker, rain falls softly, the clouds drift slowly").
- **Output:** `surprise_build/gallery/YYYY-MM-DD_theme_name_animated.mp4`

### 4. The Gallery Manager (Publication)
- **Tool:** `edit` or `sed` (File Manipulation)
- **Action:**
    1. Read `surprise_build/index.html`.
    2. Inject the new entry into the `const items = [...]` array.
    3. **Entry Format:**
       ```javascript
       { 
         src: 'gallery/YYYY-MM-DD_theme_name_animated.mp4', 
         title: 'Subject - Style Collection (AI Animated)', 
         type: 'video' 
       }
       ```
    4. (Optional) If `items.length > 50`, remove the oldest entry to save disk space.

## Technical Requirements
- **Cron Schedule:** `0 2 * * *` (Run once daily).
- **Environment:** Needs `GEMINI_API_KEY`.
- **Compute:** Background process (video generation takes ~2-5 mins).

## Failure Handling
- If video generation fails, fallback to adding just the static image to the gallery.
- Log errors to `memory/YYYY-MM-DD.md`.
