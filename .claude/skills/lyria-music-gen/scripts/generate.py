#!/usr/bin/env python3
"""lyria-music-gen — thin CLI over Google's Lyria 3 music model (google-genai SDK).

ONE generate_content call: a text prompt in, an MP3 out.

  --model clip   models/lyria-3-clip-preview   ~30s   (default)
  --model pro    models/lyria-3-pro-preview    ~3min, arranged in sections

THE VOCALS TRAP: Lyria writes and sings LYRICS unless the prompt says not to.
An innocuous prompt like "a warm, nostalgic song about a summer evening" comes
back as a fully sung track. So say **"instrumental, no vocals"** in the prompt.

This script defends that twice over:
  1. Before spending a call, it warns if the prompt has no instrumental wording.
  2. After, it inspects the response's text part, which is the model's own lyric
     sheet: it reads "<instrumental>" for an instrumental take, and timestamped
     lines like "[0.0:] Long shadows on the uncut lawn" when it sang. If lyrics
     are found the audio is still written (the call is already paid for) but the
     script exits non-zero so an automated caller cannot ship vocals by accident.
     Pass --allow-vocals when you actually want singing.

Run through the secrets wrapper so GEMINI_API_KEY is present:

  bash curation/with-secrets.sh GEMINI_API_KEY -- \
    python .claude/skills/lyria-music-gen/scripts/generate.py \
      --prompt "Calm ambient piano, instrumental, no vocals" --out bed.mp3

Prints the output path on the last stdout line.
"""
import argparse
import os
import re
import sys
import time

from google import genai
from google.genai import errors

MODELS = {
    "clip": "models/lyria-3-clip-preview",
    "pro": "models/lyria-3-pro-preview",
}

# Wording that signals the caller asked for no singing.
INSTRUMENTAL_HINTS = ("instrumental", "no vocal", "no vocals", "no singing",
                      "without vocals", "no lyrics", "wordless")


def with_retry(fn, attempts=4, base=15):
    """Retry transient API errors (429/5xx demand spikes) with exponential backoff,
    so a nightly run rides out 'high demand' blips instead of failing."""
    for i in range(attempts):
        try:
            return fn()
        except errors.APIError as e:
            code = getattr(e, "code", None)
            if code not in (429, 500, 502, 503, 504) or i == attempts - 1:
                raise
            wait = base * (2 ** i)
            print(f"  … {code}, retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)


def looks_like_lyrics(text: str) -> bool:
    """True if the model's text part is a lyric sheet rather than an instrumental marker.

    Instrumental takes return "<instrumental>". The pro model also emits bare
    section markers like "[[A0]] [[B1]]", which are structure, not singing — so
    strip both, plus "[12.3:]" timestamps, and see if real words remain.
    """
    if not text:
        return False
    t = text.replace("<instrumental>", " ")
    t = re.sub(r"\[\[[^\]]*\]\]", " ", t)      # [[A0]] section markers
    t = re.sub(r"\[[\d.:\s]*\]", " ", t)        # [0.0:] / [24.3:27.0] timestamps
    return len(re.findall(r"[A-Za-z']{2,}", t)) >= 3


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--prompt", required=True,
                    help='What to generate. SAY "instrumental, no vocals" unless you want singing.')
    ap.add_argument("--out", required=True, help="Output .mp3 path")
    ap.add_argument("--model", choices=sorted(MODELS), default="clip",
                    help="clip ≈30s (default), pro ≈3min in sections")
    ap.add_argument("--allow-vocals", action="store_true",
                    help="Accept a sung track instead of failing on detected lyrics")
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY missing — run via: bash curation/with-secrets.sh GEMINI_API_KEY -- python3 …")

    asked_instrumental = any(h in args.prompt.lower() for h in INSTRUMENTAL_HINTS)
    if not asked_instrumental and not args.allow_vocals:
        print('⚠️  Your prompt does not ask for instrumental music. Lyria sings by '
              'default — add "instrumental, no vocals" unless you want lyrics.',
              file=sys.stderr)

    client = genai.Client(api_key=key)
    resp = with_retry(lambda: client.models.generate_content(
        model=MODELS[args.model], contents=args.prompt))

    audio, text = None, ""
    for part in resp.candidates[0].content.parts:
        blob = getattr(part, "inline_data", None)
        if blob and (blob.mime_type or "").startswith("audio/"):
            audio = blob.data
        if getattr(part, "text", None):
            text += part.text

    if audio is None:
        sys.exit(f"No audio in the response (parts: {resp.candidates[0].content.parts})")

    with open(args.out, "wb") as f:
        f.write(audio)

    sung = looks_like_lyrics(text)
    print(f"model: {MODELS[args.model]}  ·  {len(audio) // 1024} KB  ·  "
          f"{'VOCALS DETECTED' if sung else 'instrumental'}")

    if sung and not args.allow_vocals:
        preview = " / ".join(text.split("\n")[:3])[:200]
        print(f"\n❌ The track has vocals. The model returned lyrics: {preview}…\n"
              f"   The audio was still written to {args.out} so the call isn't wasted.\n"
              '   Fix: add "instrumental, no vocals" to --prompt and re-run, '
              "or pass --allow-vocals if you want singing.", file=sys.stderr)
        print(args.out)
        sys.exit(1)

    print(args.out)


if __name__ == "__main__":
    main()
