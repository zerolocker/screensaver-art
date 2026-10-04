#!/usr/bin/env python3
"""omni-video-gen: a thin CLI over Gemini Omni video generation (google-genai SDK).

Each run makes ONE Omni call, through the Interactions API:

  text-to-video         : --prompt "..."
  image-guided video    : --prompt "..." --image F.jpg
  first + last frame    : --prompt "..." --image F.jpg --image L.jpg
                          (a seamless LOOP when L == F)
  edit a prior result   : --prompt "make the boats stay still" --edit PRIOR.mp4.json

Omni treats input images as *guides* ordered by position, not as a hard first-frame
slot the way Veo does. So the prompt should say what each image is ("The video begins
exactly on this image…").

On success it writes the MP4 to --out plus a sidecar `<out>.json` holding the
interaction id, so a later run can edit the result with --edit (multi-turn,
`previous_interaction_id`).

Run it through the secrets wrapper so GEMINI_API_KEY is present:

  bash curation/with-secrets.sh GEMINI_API_KEY -- \\
    python .claude/skills/omni-video-gen/scripts/generate.py \\
      --prompt "..." --image still.webp --out clip.mp4

Follows https://ai.google.dev/gemini-api/docs/omni . The output path is printed on
the last stdout line.
"""
import argparse
import base64
import json
import os
import sys
import time
from io import BytesIO

from google import genai
from google.genai import errors
from PIL import Image

MODEL = os.environ.get("OMNI_MODEL", "gemini-omni-1.1-flash")
# Long edge we send per output resolution. A bigger seed only bloats the request.
SEND_EDGE = {"360p": 1280, "720p": 1280, "1080p": 1920, "4k": 3840}


def with_retry(fn, attempts=4, base=15):
    """Retry transient API errors (429/5xx) with exponential backoff."""
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


def image_part(path, resolution):
    if not os.path.exists(path):
        sys.exit(f"image not found: {path}")
    im = Image.open(path).convert("RGB")
    edge = SEND_EDGE[resolution]
    if max(im.size) > edge:
        im.thumbnail((edge, edge), Image.LANCZOS)
    buf = BytesIO()
    im.save(buf, "JPEG", quality=93)
    return {"type": "image", "data": base64.b64encode(buf.getvalue()).decode(), "mime_type": "image/jpeg"}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True, help="output MP4 path (+ <out>.json sidecar)")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--image", action="append", default=[],
                    help="input image, repeatable; order matters (first, last)")
    ap.add_argument("--edit", help="sidecar .json (or the .mp4 beside it) of a prior result to edit")
    ap.add_argument("--resolution", default="1080p", choices=list(SEND_EDGE))
    ap.add_argument("--aspect", default="16:9", choices=["16:9", "9:16"])
    ap.add_argument("--model", default=MODEL)
    args = ap.parse_args()

    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("GEMINI_API_KEY not set (run via curation/with-secrets.sh GEMINI_API_KEY -- …)")
    client = genai.Client(http_options={"timeout": 900_000})

    body = {
        "model": args.model,
        "input": [image_part(p, args.resolution) for p in args.image] + [{"type": "text", "text": args.prompt}],
        "response_format": {"type": "video", "aspect_ratio": args.aspect,
                            "resolution": args.resolution, "delivery": "uri"},
    }
    if args.edit:
        side = args.edit if args.edit.endswith(".json") else args.edit + ".json"
        with open(side) as f:
            body["previous_interaction_id"] = json.load(f)["interaction_id"]

    t0 = time.time()
    print(f"omni[{args.model}] {args.resolution} {args.aspect}, {len(args.image)} image(s)"
          f"{', editing ' + body['previous_interaction_id'] if args.edit else ''} …", file=sys.stderr)
    it = with_retry(lambda: client.interactions.create(**body))
    video = getattr(it, "output_video", None)
    if video is None:
        sys.exit(f"no video in response (status={getattr(it, 'status', None)})")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if getattr(video, "uri", None):
        print(f"  video uri: {video.uri}", file=sys.stderr)
        name = "files/" + video.uri.split("/files/")[-1].split(":")[0].split("?")[0]
        for _ in range(120):  # the file may still be processing; wait up to ~10 min
            try:
                if client.files.get(name=name).state.name == "ACTIVE":
                    break
            except (errors.APIError, ValueError) as e:
                print(f"  waiting for {name}: {type(e).__name__}", file=sys.stderr)
            time.sleep(5)
        data = client.files.download(file=name)
        with open(args.out, "wb") as f:
            f.write(data)
    else:
        with open(args.out, "wb") as f:
            f.write(base64.b64decode(video.data))

    with open(args.out + ".json", "w") as f:
        json.dump({"interaction_id": it.id, "model": args.model, "prompt": args.prompt,
                   "images": args.image, "resolution": args.resolution,
                   "edited_from": body.get("previous_interaction_id")}, f, indent=1)
    print(f"done in {time.time() - t0:.0f}s", file=sys.stderr)
    print(args.out)


if __name__ == "__main__":
    main()
