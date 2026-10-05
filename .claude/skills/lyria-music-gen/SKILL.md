---
name: lyria-music-gen
description: Generate instrumental music with Google's Lyria 3 (google-genai SDK) — a text prompt in, an MP3 out. Use this skill whenever the user wants to generate music, a backing track, a background/ambient bed, a soundtrack for a video or social clip, or scoring for the marketing clips — even if they don't say "Lyria".
---

# lyria-music-gen (Google Lyria 3)

A thin CLI over Lyria 3. Each run is exactly one call: a text prompt in, an MP3 out.

Script: `.claude/skills/lyria-music-gen/scripts/generate.py`. Run it through the secrets wrapper, which fails fast if `GEMINI_API_KEY` is missing. Needs the `google-genai` SDK. The output path is printed on the **last stdout line**.

## Ask for instrumental, or you'll get singing

Lyria writes and sings lyrics by default. "A warm, nostalgic song about a summer evening" comes back fully sung, with a lyric sheet. **Put "instrumental, no vocals" in every prompt** for a backing track or anything under video. "Ambient background music" alone isn't enough.

The script helps: it warns before the call if the prompt has no instrumental wording, and if Lyria returns lyrics it still saves the audio but **exits non-zero**, so automation can't ship vocals by accident. Pass `--allow-vocals` when you want singing.

## Usage

```bash
bash curation/with-secrets.sh GEMINI_API_KEY -- \
  python .claude/skills/lyria-music-gen/scripts/generate.py \
    --prompt "Sparse, tender solo piano with soft room reverb; slow, warm, unhurried. Instrumental, no vocals." \
    --out bed.mp3
```

| Flag | Default | Meaning |
|---|---|---|
| `--prompt <text>` | required | What to generate |
| `--out <path>` | required | Output MP3 (192 kbps, 44.1 kHz stereo) |
| `--model clip\|pro` | `clip` | `clip` is about 30 s; `pro` is about 3 minutes, arranged into sections |
| `--allow-vocals` | off | Accept a sung track |

`clip` suits background music and social clips; trim it with ffmpeg. `pro`'s text output lists section markers (`[[A0]] [[B1]] …`), which aren't lyrics.

## Writing a prompt

Describe instruments, mood, tempo and texture; Lyria follows musical direction better than adjectives.
- Good: "Airy sustained string pad, gentle and spacious, like a slow exhale; distant soft harp touches. Slow, even dynamics, no build or drop. Instrumental, no vocals."
- Weak: "Nice calm music."

For music under visuals, ask for **even dynamics with no build or drop**; a swell pulls attention off the picture.

Never commit the MP3s (media rule in `CLAUDE.md`). Write them to a scratch path.
