---
name: explainer-video
description: Turn a short video brief (a YAML spec of scenes + narration beats) into a narrated slideshow MP4 — animated-infographic slides (title, bullets/steps, stats, pipeline, compare, images with Ken Burns, decision, checklist, timeline, raw HTML) with Gemini TTS voiceover, burned-in captions and a QA contact sheet. Use this skill whenever the user wants a reply, explanation, update, or summary delivered as a video, an explainer/narrated slideshow, or a "video instead of text" — even if they don't say "explainer".
---

# explainer-video

One command renders a spec end-to-end (TTS per beat in parallel, slides in
headless Chrome, ffmpeg assembly, contact sheet):

```bash
bash curation/with-secrets.sh GEMINI_API_KEY -- python3 \
  .claude/skills/explainer-video/scripts/render.py SPEC.yaml --out .claude/video-replies/NAME.mp4
```

It prints `video:`, `duration:` and `contact sheet:` paths on stdout (warnings on
stderr). Write specs to `.claude/video-replies/` too — the whole folder is
gitignored (renders, specs, `.cache/` with TTS audio, downloaded images, build files).

- `--preview` — slides + `NAME.preview.png` only: no API key, no audio, ~5 s. Use
  it to iterate on layout before spending TTS.
- Captions are **burned into the picture by default** (the layout reserves room for
  them) — most players hide a soft subtitle track, so it went unseen.
  `--no-burn-captions` falls back to the soft `mov_text` track only.
- `--no-subs`, `--no-verify` (skip transcription check), `--refresh-audio`.
- Re-renders are cheap: audio is cached by hash(text, voice, model, style) and
  Ken Burns clips by image+size+duration — edit visuals freely, only changed
  narration costs API calls.

## Spec format (YAML)

Top level: `title` (MP4 title + default footer), `footer`, `scenes`, and optional
`voice` (default `Vindemiatrix`), `model` (default `gemini-3.1-flash-tts-preview`;
falls back to `gemini-2.5-pro-preview-tts`), `style` (voice direction prepended to
each beat), `accent` (hex), `pad` (seconds after each beat, default 0.25), `speed` (pitch-preserving speech tempo, default 1.12 — the voice reads slowly at 1.0).

Each scene: `template`, its fields, optional `kicker` (small accent caps line) and
`say:` — the narration, a list of **beats**. Beat 1 shows the slide's fixed parts
plus its first item; **each further beat reveals the next item**. A beat written
`{text: "...", hold: true}` reveals nothing new (intro/aside); `{text: "...", show: 3}`
sets exactly how many items are visible (e.g. all decision options up front, then the
badge lands on the next beat); `pause: 0.8` adds silence after a beat. Leftover items appear on the last beat, so a one-beat scene
shows everything at once. `reveal: all` (lists/pipeline/timeline) shows every
item up front and walks the highlight instead. In any text, `**word**` = accent
colour, `` `code` `` = mono.

| template | fields (items are strings or mappings) | reveal unit |
|---|---|---|
| `title` | `title`, `subtitle` | subtitle |
| `bullets` / `steps` | `heading`, `items: [text \| {text, note}]` (`steps` = numbered) | item |
| `stats` | `heading`, `items: [{value, label, note}]` (1–4) | tile |
| `pipeline` | `heading`, `steps: [text \| {text, note}]` (≤6), `direction: row\|column` | step (active one glows) |
| `compare` | `heading`, `left`/`right: {title, tag, items}`, `winner: left\|right` | column |
| `images` | `heading`, `images: [{src, caption}]` (1–3; local path — relative to the spec — or https URL) | image (gentle Ken Burns) |
| `decision` | `question`, `options: [{text, note, recommended}]` (2–4) | option, then the "Recommended" badge |
| `checklist` | `heading`, `items: [{text, status: done\|doing\|todo, note}]` | item |
| `timeline` | `heading`, `items: [{when, text, note}]` (≤6) | event |
| `video` | `src` (MP4/MOV, local or https), `caption`, `layout: full\|framed` (framed takes `heading`), `loop: true\|false` | — (clip plays across all beats) |
| `html` | `html`, `css` (theme vars: `--accent --ink --ink2 --serif --sans`) | each `.reveal` element, in order |

Complete worked example covering every template: [`examples/demo.yaml`](examples/demo.yaml)
(12 scenes, ~75 s). A minimal scene:

```yaml
- template: pipeline
  heading: Every night, four steps
  steps: [{text: Curate, note: pick one still}, Animate, Publish, Sync]
  say:
    - First, we pick one strong still.
    - Veo animates it.
    - We publish it to the gallery,
    - and your app syncs it overnight.
```

## Authoring guidance

- **1.5–3 min total** (~150 words/min ≈ 225–450 words). Budget words, not
  scenes: 717 words rendered to 5:22, so cut hard before rendering. One idea per scene;
  ≤ ~5 elements per slide (the validator warns above that).
- **Narration is conversational** — write it to be heard: short sentences,
  contractions, numbers spelled the way you'd say them ("four eighty-seven").
  Give the answer/recommendation early.
- **On-screen text is keywords, not the narration**: 2–6 word items, headings
  under ~8 words. The voice carries the sentence; the slide carries the anchor.
- One beat per revealed item, so the reveal lands as it's spoken. Beats of
  one short clause sound fine; avoid 1–2 word beats.
- Text auto-shrinks to fit (down to a legible floor) and is clipped + warned past
  that — treat any `WARNING … clipped` / `outside safe area` as a bug to fix by
  cutting words, not by ignoring it.

## QA (do this before sharing)

1. Read the `contact sheet` PNG (one frame per beat, taken from the finished MP4,
   labelled `scene.beat  time` + narration). Check for clipped/overlapping text,
   empty-looking slides, wrong reveal order, images that read badly.
2. Fix the spec, re-run (cached audio makes this fast). Full-res slide PNGs live
   in `.claude/video-replies/.cache/build/<name>/frames/` if a detail needs a zoom.

## Notes

- TTS: `gemini-3.1-flash-tts-preview` + `Vindemiatrix` won blind listening
  comparisons (judged by Gemini pro) against `gemini-2.5-pro-preview-tts` (stiffer)
  and `gemini-3.8-flash-tts` (**reads the style direction aloud and drops
  sentences — don't use it**). Each new clip gets a duration sanity check and a
  transcription check (re-synthesised once on mismatch; warns if still off).
- `video` clips are always **muted** (narration is the only audio), normalised to
  1080p30 whatever their fps/size/rotation, letterboxed (never cropped), and play
  continuously across the scene's beats: looped by default when the narration runs
  longer (`loop: false` freezes on the last frame). `layout: full` keeps the scene
  progress bar and caption on a gradient over the clip.
- Output: 1920×1080 30 fps H.264 (yuv420p, faststart, CRF 30 `stillimage`) + AAC
  96k, loudness-normalised to −16 LUFS, burned-in captions — plays in
  QuickTime and on phones. Keep the file **under 30 MB**: that's the limit for
  delivering it to the user's phone (≈15 MB for 4 min at these settings).
- Needs Google Chrome, ffmpeg, Python with `google-genai`, `PyYAML`, `Pillow`.
  Fonts are macOS system fonts (New York, Avenir Next) — no network fonts.
