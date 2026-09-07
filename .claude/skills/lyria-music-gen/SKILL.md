---
name: lyria-music-gen
description: Generate instrumental music with Google's Lyria 3 (google-genai SDK) — a text prompt in, an MP3 out. Use this skill whenever the user wants to generate music, a backing track, a background/ambient bed, a soundtrack for a video or social clip, or scoring for the marketing clips — even if they don't say "Lyria".
---

# lyria-music-gen (Google Lyria 3)

A thin CLI over Lyria 3. **Each run is exactly one API call**: a text prompt in,
an MP3 out.

Script: `.claude/skills/lyria-music-gen/scripts/generate.py`
Always run it through the secrets wrapper (loads `curation/.env`, fails fast if
`GEMINI_API_KEY` is missing). Requires the `google-genai` SDK. The script prints
the output path on the **last stdout line**.

## ⚠️ Ask for instrumental, or you will get singing

**Lyria writes and performs lyrics by default.** This is the single thing to get
right. A perfectly innocent prompt:

> "A warm, nostalgic song about a summer evening"

comes back as a **fully sung track**, with the model returning its own lyric
sheet:

```
[0.0:] Long shadows on the uncut lawn
[2.7:] The day is holdin' its last breath
[5.4:] Smell of barbecue on the breeze
```

So **put "instrumental, no vocals" in the prompt** whenever you want a backing
track, a background bed, or anything that sits under other audio or under video.

The script backs this up two ways, but the prompt is your responsibility:
1. It **warns before spending a call** if the prompt has no instrumental wording.
2. It **checks the result** — Lyria's text part reads `<instrumental>` for an
   instrumental take, and returns timestamped lyrics when it sang. If lyrics turn
   up, the audio is still written (the call is already paid for) but the script
   **exits non-zero**, so automation can't ship vocals by accident. Use
   `--allow-vocals` when you genuinely want singing.

## Usage

```bash
bash curation/with-secrets.sh GEMINI_API_KEY -- \
  python .claude/skills/lyria-music-gen/scripts/generate.py \
    --prompt "Sparse, tender solo piano with soft room reverb; slow, warm, unhurried. Instrumental, no vocals." \
    --out bed.mp3
```

### Flags
| Flag | Default | Meaning |
|---|---|---|
| `--prompt <text>` | required | What to generate. **Say "instrumental, no vocals"** unless you want singing. |
| `--out <path>` | required | Output MP3 (192 kbps, 44.1 kHz stereo). |
| `--model clip\|pro` | `clip` | `clip` ≈ 30 s. `pro` ≈ 3 min, arranged into sections. |
| `--allow-vocals` | off | Accept a sung track instead of failing when lyrics are detected. |

### Which model
- **`clip`** (~30 s) — background beds, loops, social-clip scoring. Cheaper and
  faster; loop or trim it to length with ffmpeg.
- **`pro`** (~3 min) — a full arranged piece. Its text part lists section markers
  (`[[A0]] [[B1]] …`), which are structure, not lyrics.

## Writing a good prompt
Describe **instrumentation, mood, tempo and texture** — Lyria responds to
musical direction, not adjectives alone.

- Good: *"Airy sustained string pad, gentle and spacious, like a slow exhale;
  distant soft harp touches. Slow, even dynamics, no build or drop. Instrumental,
  no vocals."*
- Weak: *"Nice calm music."*

For anything playing **under** visuals, ask for **even dynamics with no build,
drop or swell** — a dramatic swell pulls attention off the picture. And say
`instrumental, no vocals` even when it feels obvious; "ambient background music"
alone is **not** enough to stop the singing.

## Repo notes
- **Never commit the generated MP3s** (`CLAUDE.md` → *Repo rules*: media is never
  committed without the founder's explicit approval). Write them to a scratch
  path, or upload to R2 and reference the URL.
- Context for why this exists: `docs/growth-and-marketing-strategy.md` §11.2 —
  the social clips ship silent, and platform trending audio is licence-restricted
  for commercial accounts *and* can't be attached by a posting API, so we score
  the clips with our own music instead.
