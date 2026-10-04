---
name: veo3-video-gen
description: Generate or transform video with Google Veo 3.1 (google-genai SDK) — text-to-video, image-to-video, first/last-frame interpolation (incl. seamless loops), and extending a previously generated video. Use this skill whenever the user wants to animate a still image, make or extend an AI video, create a looping clip, or for the nightly auto-curation's animation step — even if they don't say "Veo".
---

# veo3-video-gen (Google Veo 3.1)

A thin CLI over Veo 3.1. Each run is exactly one Veo call; chain runs for richer results.

Script: `.claude/skills/veo3-video-gen/scripts/generate.py`. Run it through the secrets wrapper, which fails fast if `GEMINI_API_KEY` is missing. Needs the `google-genai` SDK. `--out` gets the MP4 plus a sidecar `<out>.json` holding the video's file URI, used to extend it later. The output path is printed on the **last stdout line**.

**Image to video** (the still is the first frame):
```bash
bash curation/with-secrets.sh GEMINI_API_KEY -- \
  python .claude/skills/veo3-video-gen/scripts/generate.py \
    --prompt "Subtle flickering candlelight, slow motion" \
    --first-frame gallery/baroque.png --out gallery/baroque_animated.mp4
```

**Text to video:**
```bash
… generate.py --prompt "A cinematic shot of a misty harbor at dawn" --out clip.mp4
```

**First and last frame.** Use the same image for both to get a seamless loop:
```bash
… generate.py --prompt "gentle motion, settle back to the opening" \
    --first-frame F.png --last-frame F.png --out loop.mp4
```

**Extend a video.** Veo can only extend a video it generated, referenced by its sidecar:
```bash
… generate.py --prompt "..." --first-frame F.png --out v1.mp4                 # writes v1.mp4 + v1.mp4.json
… generate.py --prompt "continue the motion" --from-video v1.mp4.json --out v2.mp4
```
`v2.mp4` is the whole clip (about 15 s after one extension), not just the new part. You can extend up to 20 times.

## Flags
- `--out` (required): the MP4 path.
- `--prompt`: for gallery clips, follow `curation/PROMPT_GUIDANCE.md`.
- `--first-frame PATH`: any image format; it's converted to PNG and scaled to at most 2048 px.
- `--last-frame PATH`: the final frame. Same as `--first-frame` means a loop.
- `--from-video PATH`: the sidecar `.json` (or the `.mp4` next to it) to extend.
- `--resolution` `720p` (default) or `1080p`; `--aspect` (default `16:9`, ignored when extending); `--negative-prompt`; `--model` (default `$VEO_MODEL` or `veo-3.1-generate-preview`).

## Notes
- Extending and `--last-frame` can't be combined in one call (`400 Unsupported video generation request`).
- Paid and slow (1–3 minutes per call). For curation, only animate a still that passed review.
- The MP4 may contain audio; the screensaver plays muted.
