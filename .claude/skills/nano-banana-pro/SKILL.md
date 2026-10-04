---
name: nano-banana-pro
description: Generate or edit still images with Google's Nano Banana Pro / Gemini 3 Pro Image (google-genai SDK) — text-to-image and image editing/composition from one or more reference images, with aspect-ratio and resolution control. Use this skill whenever the user wants to generate an image, create a still/PNG, edit or combine images, or for the nightly auto-curation's image step — even if they don't say "Nano Banana".
---

# nano-banana-pro (Gemini 3 Pro Image)

A thin CLI over Nano Banana Pro. Each run is exactly one `generate_content` call.

Script: `.claude/skills/nano-banana-pro/scripts/generate.py`. Run it through the secrets wrapper, which fails fast if `GEMINI_API_KEY` is missing. Needs the `google-genai` SDK and Pillow. The output path is printed on the **last stdout line**.

**Text to image:**
```bash
bash curation/with-secrets.sh GEMINI_API_KEY -- \
  python .claude/skills/nano-banana-pro/scripts/generate.py \
    --prompt "A Baroque oil still life, dramatic chiaroscuro, oil on canvas" \
    --out gallery/baroque.png --aspect 16:9 --size 4K
```
Output is WebP by default, so this writes `gallery/baroque.webp`: the `--out` extension is replaced to match `--format`.

**Edit or combine images:** pass one or more `--input-image`, and describe the edit in the prompt.
```bash
… generate.py --prompt "Restore and colorize this faded photo, keep the composition" \
    --input-image old.png --out restored.png
… generate.py --prompt "Place the subject of the first image into the scene of the second" \
    --input-image subject.png --input-image scene.png --out composite.png
```

## Flags
- `--prompt` (required). For gallery stills, follow `curation/PROMPT_GUIDANCE.md`.
- `--out` (required). Its extension is replaced to match `--format`.
- `--format` `webp` (default, about 1/8 the size) or `png` (lossless).
- `--quality` WebP quality, default `90`.
- `--input-image PATH`, repeatable.
- `--aspect`, default `16:9`. Keep 16:9 for gallery stills; the screensaver is full-screen 16:9.
- `--size` `1K`, `2K` (default) or `4K`.
- `--model`, default `$GEMINI_IMAGE_MODEL` or `gemini-3-pro-image`.

## Notes
- Paid. For curation, look at the still and reroll it if it isn't gallery-worthy before animating it (`curation/AUTOMATED_CURATION.md`).
- Capture the path with `IMG=$(… generate.py --prompt "…" --out gallery/foo.png | tail -1)`.
