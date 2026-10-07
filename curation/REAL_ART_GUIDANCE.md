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

## Checking the clip

Step 6 of the runbook. Pull the first, middle and last frames, e.g. `ffmpeg -ss <t> -i clip.mp4 -frames:v 1 f<t>.png`.

Reject a clip only for an **obvious** failure, one anyone would see at a glance:
- **It's no longer this painting.** By the middle or the end it has become a different scene, e.g. Degas's *Millinery Shop* turning into another, photoreal shop with a different room, props and woman.
- **The file is broken**: blank, black or garbled frames.

Don't reject for anything subtler: the camera drifting or reframing, a figure turning or changing expression, a prop, accessory or animal appearing or vanishing, cloth or water moving. Judging fine detail from a few frames is unreliable and rejected good clips. When unsure, publish.

If a clip fails, reroll once with the same prompt (Omni varies from run to run). If it fails again, drop the painting and take the next pick.
