---
name: omni-video-gen
description: Generate or edit video with Google's Gemini Omni (gemini-omni-1.1-flash, google-genai Interactions API): text-to-video, image-guided video, first + last frame interpolation (incl. seamless loops), and multi-turn edits of a previous result. Use whenever the user wants to animate a still or painting with Omni, or when Omni is the chosen video model for curation, even if they don't say "Omni".
---

# omni-video-gen (Gemini Omni)

A thin CLI over Gemini Omni. **Each run is exactly one Omni call** through the Interactions API
(`client.interactions.create`). Docs: https://ai.google.dev/gemini-api/docs/omni

Script: `.claude/skills/omni-video-gen/scripts/generate.py`. Run it through the secrets wrapper.
`--out` gets the MP4 plus a sidecar `<out>.json` holding the interaction id, which `--edit`
uses later. The output path is printed on the **last stdout line**.

```bash
bash curation/with-secrets.sh GEMINI_API_KEY -- \
  python .claude/skills/omni-video-gen/scripts/generate.py \
    --prompt "The video begins exactly on this image …" --image still.webp --out clip.mp4
```

## Building blocks
- **Image-guided:** `--image F`. Omni treats images as **guides**, not a hard first-frame
  slot like Veo's, so say in the prompt what the image is: *"The video begins exactly on this
  image."*
- **First + last frame:** `--image F --image L`, in that order. Pass the same image twice for a
  **seamless loop**, and say so: *"begins exactly on the first image and ends exactly on the
  second, identical image"*.
- **Edit a result:** `--edit prior.mp4.json --prompt "keep the boats exactly as in the image"`.
  This is a multi-turn edit of the previous interaction (`previous_interaction_id`).
- **Text-to-video:** `--prompt` only.

## Flags
`--resolution` `360p|720p|1080p|4k` (default `1080p`; `360p` is a cheap smoke test) ·
`--aspect` `16:9|9:16` · `--model` (`$OMNI_MODEL`, default `gemini-omni-1.1-flash`) ·
`--task image_to_video|reference_to_video|…` (`generation_config.video_config.task`) ·
`--image-as-is` (send pre-sized images untouched) · `--max-edge N`.
Undocumented but honoured by the API (checked 2026-10-04): `--duration 4s` (`response_format.duration`;
without it Omni made 10 s clips) and `--seed N` (`generation_config.seed`: same seed + inputs → near-identical clip).

## Differences from Veo
- **There is no negative prompt** (Omni rejects one), so put every "don't" in the prompt in
  plain language: *"No new people… No scene cuts, no music, no dialogue."*
- **Length is set in the prompt** ("8 seconds long"); Omni makes 3–10 s.
- **Audio is set in the prompt**: there's no on/off flag, so say *"no music, no dialogue"*.
- **Results** come back as a Files API URI. The script waits for the file and downloads it.
