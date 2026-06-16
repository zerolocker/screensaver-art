---
name: veo3-video-gen
description: Generate or transform video with Google Veo 3.1 (google-genai SDK) — text-to-video, image-to-video, first/last-frame interpolation (incl. seamless loops), and extending a previously generated video. Use this skill whenever the user wants to animate a still image, make or extend an AI video, create a looping clip, or for the nightly auto-curation's animation step — even if they don't say "Veo".
---

# veo3-video-gen (Google Veo 3.1)

A thin, composable CLI over Veo 3.1. **Each run is exactly one Veo API call** that
exposes the raw building blocks as flags; you compose richer results by choosing
flags and chaining runs. This keeps the tool generic — mix and match rather than
baking one workflow in.

Script: `.claude/skills/veo3-video-gen/scripts/generate.py`
Always run it through the secrets wrapper (loads `curation/.env`, fails fast if
`GEMINI_API_KEY` is missing). Requires the `google-genai` SDK. `--out` gets the MP4
plus a sidecar `<out>.json` (the result video's file URI, used to extend it later).
The script prints the output path on the **last stdout line**.

## Building blocks (one call each)

**Image-to-video** — animate a still (its first frame is the still):
```bash
bash curation/with-secrets.sh GEMINI_API_KEY -- \
  python .claude/skills/veo3-video-gen/scripts/generate.py \
    --prompt "Subtle flickering candlelight, slow motion" \
    --first-frame gallery/baroque.png --out gallery/baroque_animated.mp4
```

**Text-to-video** — no input frame:
```bash
… generate.py --prompt "A cinematic shot of a misty harbor at dawn" --out clip.mp4
```

**First + last frame interpolation** — animate from a start frame to a target end
frame. Set the end frame **equal to** the start for a **seamless loop**:
```bash
… generate.py --prompt "gentle motion, settle back to the opening" \
    --first-frame F.png --last-frame F.png --out loop.mp4
```

**Extend a previous video (two runs).** Veo can only extend a video *it* generated,
referenced by the sidecar from the earlier run — not an arbitrary local file:
```bash
# run 1 — generate (writes v1.mp4 + v1.mp4.json)
… generate.py --prompt "..." --first-frame F.png --out v1.mp4
# run 2 — extend it; --from-video reads v1.mp4.json
… generate.py --prompt "continue the motion" --from-video v1.mp4.json --out v2.mp4
```
`v2.mp4` is the **full cumulative clip** (≈15s after one extend: the original 8s +
~7s), not just the new tail. Extend up to 20× for length.

## Flags
- `--out` (required) — MP4 path (+ `<out>.json` sidecar).
- `--prompt` — motion/scene prompt. Per `curation/PROMPT_GUIDANCE.md`, match motion
  to the scene and keep it physically plausible.
- `--first-frame PATH` — starting frame (image-to-video / interpolation start).
- `--last-frame PATH` — target final frame (interpolation; `== --first-frame` ⇒ loop).
- `--from-video PATH` — sidecar `.json` (or the `.mp4` beside it) to extend.
- `--resolution` `720p`|`1080p` (default `720p`); `--aspect` (default `16:9`, ignored when extending);
  `--negative-prompt`; `--model` (`$VEO_MODEL`, default `veo-3.1-generate-preview`).

## What Veo rejects (don't bother)
- **Extend + `--last-frame` together** → `400 Unsupported video generation request`.
  You can extend, or pin a last frame, but not both in one call.

## Notes
- **Paid + slow** (~1–3 min/call). Generate only from a still that passed the
  vision gate in `curation/AUTOMATED_CURATION.md`.
- Each generated MP4 may contain audio (the screensaver plays muted).
- Compose longer or looping results by chaining the blocks above with `ffmpeg`
  concat when needed — the script itself stays single-call.
