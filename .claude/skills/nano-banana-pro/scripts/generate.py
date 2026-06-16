#!/usr/bin/env python3
"""nano-banana-pro — thin CLI over Google's Nano Banana Pro / Gemini 3 Pro Image
(google-genai SDK).

ONE generate_content call. Building blocks, composable via flags:

  text-to-image        : --prompt "..."
  edit / compose       : --prompt "..." --input-image a.png [--input-image b.png ...]
                         (reference / edit / blend one or more input images)

Controls: --aspect (16:9 default), --size (1K|2K|4K). Writes a real PNG to --out
(the API may return JPEG bytes; this re-encodes so the extension is honest).

Run through the secrets wrapper so GEMINI_API_KEY is present:

  bash curation/with-secrets.sh GEMINI_API_KEY -- \
    python .claude/skills/nano-banana-pro/scripts/generate.py \
      --prompt "A Song-dynasty ink landscape" --out still.png --aspect 16:9 --size 2K

Follows https://ai.google.dev/gemini-api/docs/image-generation . Prints the
output path on the last stdout line.
"""
import argparse
import os
import sys
import time
from io import BytesIO

from google import genai
from google.genai import errors, types
from PIL import Image


def with_retry(fn, attempts=4, base=15):
    """Retry transient API errors (429/5xx demand spikes) with exponential backoff.
    Lets the nightly bot ride out 'high demand' blips instead of failing the run."""
    for i in range(attempts):
        try:
            return fn()
        except errors.APIError as e:
            code = getattr(e, "code", None)
            if code not in (429, 500, 502, 503, 504) or i == attempts - 1:
                raise
            wait = base * (2 ** i)
            print(f"  API {code} (transient); retry {i + 1}/{attempts} in {wait}s…", file=sys.stderr)
            time.sleep(wait)


def main() -> int:
    ap = argparse.ArgumentParser(description="One Nano Banana Pro call: text-to-image or image edit/compose.")
    ap.add_argument("--prompt", required=True, help="image / edit prompt")
    ap.add_argument("--out", required=True, help="output path (its extension is replaced to match --format)")
    ap.add_argument("--format", default="webp", choices=["webp", "png"],
                    help="output format (default webp — ~1/8 the size of png at q90; use png for lossless)")
    ap.add_argument("--quality", type=int, default=90, help="webp quality 1-100 (default 90)")
    ap.add_argument("--input-image", dest="input_images", action="append", default=[],
                    help="optional reference/edit image (repeatable)")
    ap.add_argument("--aspect", default="16:9", help="aspect ratio (default 16:9)")
    ap.add_argument("--size", default="2K", help="image size: 1K | 2K | 4K (default 2K)")
    ap.add_argument("--model", default=os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3-pro-image"))
    args = ap.parse_args()

    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
        print("GEMINI_API_KEY is not set. Run via: "
              "bash curation/with-secrets.sh GEMINI_API_KEY -- python …", file=sys.stderr)
        return 1

    client = genai.Client()

    contents = [args.prompt]
    for p in args.input_images:
        if not os.path.exists(p):
            print(f"input image not found: {p}", file=sys.stderr)
            return 1
        contents.append(Image.open(p))       # the SDK accepts PIL images directly

    try:
        response = with_retry(lambda: client.models.generate_content(
            model=args.model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
                image_config=types.ImageConfig(aspect_ratio=args.aspect, image_size=args.size),
            ),
        ))
    except errors.APIError as e:
        print(f"Gemini image API error {getattr(e, 'code', '?')}: {e}", file=sys.stderr)
        return 1

    image_part = next(
        (p for p in (response.parts or []) if getattr(p, "inline_data", None) and p.inline_data.data),
        None)
    if image_part is None:
        print(f"No image returned. prompt_feedback={getattr(response, 'prompt_feedback', None)}", file=sys.stderr)
        return 1

    # --format decides the real container (default webp); the --out extension is
    # replaced to match, so an existing `--out foo.png` keeps working and only the
    # format changes. webp at q90 is ~1/8 the size of png with negligible loss.
    base, _ = os.path.splitext(os.path.abspath(args.out))
    out = f"{base}.{args.format}"
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    img = Image.open(BytesIO(image_part.inline_data.data))
    if args.format == "webp":
        img.save(out, "WEBP", quality=args.quality, method=6)
    else:
        img.save(out, "PNG")

    detail = f"q{args.quality}" if args.format == "webp" else "lossless"
    print(f"Wrote {out} (aspect {args.aspect}, size {args.size}, {args.format} {detail}, "
          f"{len(args.input_images)} input image(s)).", file=sys.stderr)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
