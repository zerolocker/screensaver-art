---
name: nano-banana-pro
description: Generate or edit still images with Google's Nano Banana Pro / Gemini 3 Pro Image (google-genai SDK) — text-to-image and image editing/composition from one or more reference images, with aspect-ratio and resolution control. Use this skill whenever the user wants to generate an image, create a still/PNG, edit or combine images, or for the nightly auto-curation's image step — even if they don't say "Nano Banana".
---

# nano-banana-pro (Gemini 3 Pro Image)

A thin, composable CLI over Nano Banana Pro. **Each run is exactly one
`generate_content` call** exposing the building blocks as flags, so you compose by
choosing flags rather than baking in one workflow.

Script: `.claude/skills/nano-banana-pro/scripts/generate.py`
Always run it through the secrets wrapper (loads `curation/.env`, fails fast if
`GEMINI_API_KEY` is missing). Requires the `google-genai` SDK + Pillow. Output is a
real PNG (the API may return JPEG bytes; the script re-encodes). Prints the output
path on the **last stdout line**.

## Building blocks (one call each)

**Text-to-image:**
```bash
bash curation/with-secrets.sh GEMINI_API_KEY -- \
  python .claude/skills/nano-banana-pro/scripts/generate.py \
    --prompt "A Baroque oil still life, dramatic chiaroscuro, oil on canvas" \
    --out gallery/baroque.png --aspect 16:9 --size 2K
```

**Edit / compose from reference image(s)** — pass one or more `--input-image`
(repeatable). The prompt describes the edit or how to blend them:
```bash
… generate.py --prompt "Restore and colorize this faded photo, keep the composition" \
    --input-image old.png --out restored.png
… generate.py --prompt "Place the subject of the first image into the scene of the second" \
    --input-image subject.png --input-image scene.png --out composite.png
```

## Flags
- `--prompt` (required) — image or edit prompt. For new stills, write it per
  `curation/PROMPT_GUIDANCE.md` (concrete medium/material/era/lighting; one subject).
- `--out` (required) — output PNG path.
- `--input-image PATH` — reference/edit image; repeatable. Omit for pure text-to-image.
- `--aspect` (default `16:9`) — keep 16:9 for gallery stills (the screensaver is
  full-screen 16:9, so a 16:9 still animates without letterboxing).
- `--size` (default `2K`) — `1K` | `2K` | `4K`.
- `--model` — `$GEMINI_IMAGE_MODEL`, default `gemini-3-pro-image`.

## Notes
- **Paid** call. For curation, follow the "self-review the still before animating"
  vision gate in `curation/AUTOMATED_CURATION.md`: generate, look, reroll the prompt
  if it isn't gallery-worthy, then pass it to `veo3-video-gen`.
- Capture the path: `IMG=$(… generate.py --prompt "…" --out gallery/foo.png | tail -1)`.
