#!/usr/bin/env python3
"""veo3-video-gen — thin CLI over Google Veo 3.1 (google-genai SDK).

ONE Veo call per run. It exposes the raw Veo building blocks as flags so the
caller composes higher-level results by mixing parameters / chaining runs:

  text-to-video        : --prompt "..."
  image-to-video       : --prompt "..." --first-frame F.png
  first+last frame      : --prompt "..." --first-frame F.png --last-frame L.png
                          (a seamless LOOP when L == F)
  extend a prior video  : --from-video PRIOR.mp4.json [--prompt "..."]

Not every combination is accepted by Veo (e.g. extend + last_frame is rejected) —
the API error is surfaced verbatim.

On success it writes the MP4 to --out AND a sidecar `<out>.json` holding the
result video's file URI, so a later, separate run can extend it via --from-video
(Veo can only extend a video it generated, referenced by that URI — not arbitrary
local bytes).

Run through the secrets wrapper so GEMINI_API_KEY is present:

  bash curation/with-secrets.sh GEMINI_API_KEY -- \
    python .claude/skills/veo3-video-gen/scripts/generate.py \
      --prompt "gentle motion" --first-frame still.png --out clip.mp4

Follows https://ai.google.dev/gemini-api/docs/video . Prints the output path on
the last stdout line.
"""
import argparse
import json
import os
import sys
import time
from io import BytesIO

from google import genai
from google.genai import errors, types
from PIL import Image


def with_retry(fn, attempts=4, base=15):
    """Retry transient API errors (429/5xx demand spikes) with exponential backoff."""
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


def load_image(path):
    if not os.path.exists(path):
        sys.exit(f"image not found: {path}")
    # Re-encode to PNG via PIL so any input format (incl. webp) is accepted, and cap
    # the seed-frame size — Veo outputs <=1080p, so a 4K still just bloats the request.
    img = Image.open(path).convert("RGB")
    if max(img.size) > 2048:
        img.thumbnail((2048, 2048), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "PNG")
    return types.Image(image_bytes=buf.getvalue(), mime_type="image/png")


def main() -> int:
    ap = argparse.ArgumentParser(description="One Veo 3.1 call: text/image-to-video, first+last frame, or extend.")
    ap.add_argument("--out", required=True, help="output MP4 path")
    ap.add_argument("--prompt", default=None, help="motion/scene prompt")
    ap.add_argument("--first-frame", dest="first_frame", help="starting frame image (image-to-video / interpolation start)")
    ap.add_argument("--last-frame", dest="last_frame", help="final frame image (interpolation target; == first-frame for a loop)")
    ap.add_argument("--from-video", dest="from_video",
                    help="sidecar .json (or the .mp4 whose .json sits beside it) from a prior run — extends that video")
    ap.add_argument("--resolution", default="720p", help="720p | 1080p (default 720p)")
    ap.add_argument("--aspect", default="16:9", help="aspect ratio for new generations (ignored when extending)")
    ap.add_argument("--negative-prompt", dest="negative_prompt", default=None)
    ap.add_argument("--model", default=os.environ.get("VEO_MODEL", "veo-3.1-generate-preview"))
    args = ap.parse_args()

    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
        print("GEMINI_API_KEY is not set. Run via: "
              "bash curation/with-secrets.sh GEMINI_API_KEY -- python …", file=sys.stderr)
        return 1

    client = genai.Client()
    kwargs = {"model": args.model}
    if args.prompt:
        kwargs["prompt"] = args.prompt

    # Extend a prior video: reconstruct the Video from the saved file URI.
    if args.from_video:
        side = args.from_video
        if side.endswith(".mp4"):
            side += ".json"
        with open(side) as f:
            meta = json.load(f)
        if not meta.get("uri"):
            print(f"sidecar {side} has no video URI — cannot extend.", file=sys.stderr)
            return 1
        kwargs["video"] = types.Video(uri=meta["uri"], mime_type=meta.get("mime_type", "video/mp4"))

    if args.first_frame:
        kwargs["image"] = load_image(args.first_frame)

    cfg = {"resolution": args.resolution}
    if not args.from_video:                 # aspect derives from source when extending
        cfg["aspect_ratio"] = args.aspect
    if args.last_frame:
        cfg["last_frame"] = load_image(args.last_frame)
    if args.negative_prompt:
        cfg["negative_prompt"] = args.negative_prompt
    kwargs["config"] = types.GenerateVideosConfig(**cfg)

    if not any(k in kwargs for k in ("prompt", "image", "video")):
        print("Provide at least one of --prompt / --first-frame / --from-video.", file=sys.stderr)
        return 2

    err = sys.stderr
    print(f"Veo {args.model} ({args.resolution})"
          f"{' extend' if args.from_video else ''}"
          f"{' +first' if args.first_frame else ''}"
          f"{' +last' if args.last_frame else ''}…", file=err)
    try:
        op = with_retry(lambda: client.models.generate_videos(**kwargs))
    except errors.APIError as e:
        print(f"Veo API error {getattr(e, 'code', '?')}: {e}", file=err)
        return 1
    t0 = time.time()
    while not op.done:
        time.sleep(10)
        op = client.operations.get(op)
        print(f"  …{int(time.time() - t0)}s", file=err)
    if getattr(op, "error", None):
        print(f"Veo failed: {op.error}", file=err)
        return 1

    video = op.response.generated_videos[0].video
    uri = getattr(video, "uri", None)        # capture before download mutates the object
    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    client.files.download(file=video)
    video.save(out)

    # Sidecar so a later run can extend this video.
    with open(out + ".json", "w") as f:
        json.dump({"uri": uri, "mime_type": getattr(video, "mime_type", "video/mp4")}, f)

    print(f"Wrote {out} in {int(time.time() - t0)}s (sidecar: {out}.json).", file=err)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
