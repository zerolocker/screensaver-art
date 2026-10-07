# Animating real paintings

How [`REAL_PAINTINGS_CURATION.md`](REAL_PAINTINGS_CURATION.md) animates a painting, and how to review the result.

## The config

Fixed for every painting. The founder chose it after iterating side by side on 10 paintings.

- **Model:** Gemini Omni (`gemini-omni-1.1-flash`, the `omni-video-gen` skill), task `image_to_video`, 1080p.
- **Input:** the bare painting (`gallery/<stem>_src.jpg`, 1920 px long edge), one image, no dark wall and no crop of ours.
- **Shape:** 16:9 if the painting is wider than tall, otherwise 9:16. Omni only makes these two, and crops the painting to fit.
- **Unset:** duration (Omni makes 10 s), seed, and frame-role tags.
- **Prompt**, with the painting's details filled in:

> Animate this artwork in a single unbroken scene. No camera movements or zooms.
> This artwork is titled {title}, by {artist}, completed in the year of {year}.

  - `{title}`: the common name, as in the gallery title (*The Great Wave*, not the museum's full catalogue title).
  - `{artist}`: the usual name, as in the gallery title (*El Greco*).
  - `{year}`: the first year in `original_date` (*c. 1830–32* gives 1830). If it has no year, use it as written (*8th century*).

  Don't add anything else to the prompt.

**Why this config:** Omni invents, morphs and drops far fewer objects than Veo. Short prompts gave more natural motion than detailed ones. Framing the painting on a dark wall before animating made Omni paint over the wall or redraw the scene.

**9:16 results are expected** for tall paintings. The screensaver, the app and the website hang them on a dark wall, and social posts use them as-is.

## Fidelity checklist

Step 6 of the runbook. Pull the first, middle and last frames, e.g. `ffmpeg -ss <t> -i clip.mp4 -frames:v 1 f<t>.png`.
- [ ] **Landmarks line up** across the frames (a lamppost, a building edge, the signature). If they don't, the camera moved.
- [ ] **It's still this painting at the end**: same composition, nothing repainted into a different scene.
- [ ] **Omni's crop keeps the subject**: no cut-off heads, and the focal point is in frame.
- [ ] **No new people or objects** have appeared, and none have vanished.
- [ ] **Faces and hands are intact**: no melting, no extra limbs.

If a check fails, reroll once with the same prompt (Omni varies from run to run). If it fails again, drop the painting and take the next pick.
