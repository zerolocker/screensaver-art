---
name: video-reply
description: Reply to the user with a narrated video instead of text. Invoke as `/video-reply <message>` — the assistant does whatever the message asks as usual, then delivers its answer as a short infographic slideshow MP4 (slides, Gemini TTS voiceover, burned-in captions) instead of writing it out. Also use whenever the user asks for an answer, update, plan, or explanation "as a video" / "in a video", or has asked for every reply to be a video.
argument-hint: <your message>
---

# video-reply

**The request:** $ARGUMENTS — if that placeholder wasn't filled in, the request is
the user's latest message.

Treat it exactly like a normal message: do the work it asks for (read, run, edit,
research, spawn agents) the same way you would otherwise. **Only the reply
changes**: the answer you would have written as text is delivered as a video.

This applies to the reply to the message that invoked the skill. Keep replying with
videos on later turns only if the user has asked for that ("reply with videos from
now on"), and drop it for any message where they say a video isn't needed.

## Steps

Building the video (spec, renders, contact sheets, layout fixes) is noisy, so it
stays out of the main conversation where possible. The main agent writes only the
script; a sub-agent builds the video from it.

1. **Do the work.** Finish it, or get to a natural stopping point such as a question
   only the user can answer. Then compose the reply.
2. **Write the script**: the narration beats, verbatim, plus a one-line intent for
   each slide (template, the on-screen keywords or data, and any asset paths such as
   images or clips). Format: [Script format](#script-format-hand-off) below. Script
   it as you would have said it in text, restructured for listening:
   - **Lead with the answer or outcome**, then what you did and found, then anything
     that needs the user (decisions, blockers), and end with the next step or ask.
   - **Report faithfully**: failures, skipped steps, open risks and uncertainty go in
     the video exactly as they would in text. A video is not a reason to sound
     more confident.
   - **Size it to the content**: a quick answer is 20–60 s (50–150 words); a plan or
     report is 1.5–3 min (225–450 words). Never over 4 min. Words set the length:
     about 150 words per minute.
   - **Show, don't just tell**: put real artifacts on screen whenever they exist,
     such as screenshots, generated images, video frames or clips, charts, before/after
     comparisons. That's where a video beats text.
   - Decisions → `decision` cards with your recommendation marked. Processes →
     `pipeline`. Old vs new → `compare`. Status → `checklist`.
   - Write for the ear: say identifiers in words ("the gallery file") and show
     the exact name on screen in `` `code` ``.
3. **Build the video.** If your environment supports sub-agents, hand the script to
   one, with the path to this file and the [build steps](#build-steps) below. It
   returns only `path · duration · size`, plus any warnings it couldn't resolve.
   If sub-agents aren't available, do the build steps yourself.
4. **Send** the MP4 to the user with whatever file-sharing mechanism your
   environment has (or give them its path). The caption is one line: the title and
   the duration. Keep it under 30 MB so it can be delivered to a phone.
5. **Text reply: one line at most**, pointing at the video. The exception is
   anything the user must copy or click, which goes in text below that line because
   nobody can copy from a video: commands, URLs, PR links, file paths.

### Build steps

Done by the sub-agent, or by the main agent when there is none.

1. **Write the spec** to `llm-video-replies/NN-<slug>.yaml`, where `NN` is the
   next unused two-digit number in that folder. The format is
   [below](#spec-format-yaml).
2. **Render** it to `NN-<slug>.mp4` beside the spec ([command](#render-command)).
   Use `--preview` first when the spec has custom `html` or dense slides.
3. **QA**: read the contact sheet, fix any clipping or bad reveals, and re-render.
   Re-renders are cheap because audio is cached.
4. **Return** `path · duration · size`, plus any warnings you couldn't resolve.
   Nothing else.

**Keep the narration verbatim.** The builder may split a beat so a reveal lands as
it's spoken, or smooth wording for speech (spelling out a number, say). It must not
add claims, facts, or reassurance that aren't in the script. Layout problems are
fixed by cutting on-screen words, never narration.

**If the renderer itself breaks** (a tool bug, not a typo in the spec), don't debug
it in the main conversation. A build sub-agent may try a quick fix; otherwise hand
the error and the spec path to a separate sub-agent if your environment supports
one. If it can't be fixed quickly, reply in text and say the video failed.

### Script format (hand-off)

A title and a scene list of `template / on-screen / say:` entries. On-screen is the
slide's keywords or data, not the narration. `say:` is the verbatim narration, one
line per beat (each beat reveals the next item).

```yaml
title: Sync bug fixed
scenes:
  - template: title
    on-screen: Sync bug fixed · subtitle "ships in the next release"
    say:
      - Good news. The sync bug is fixed, and it ships in the next release.
  - template: checklist
    on-screen: Pinned the cache key (done) · Added a test (done) · Fresh install checked (done)
    say:
      - The app re-downloaded everything after an update, so I pinned the cache key.
      - I added a test for it,
      - and checked it on a fresh install.
  - template: images
    on-screen: llm-video-replies/assets/sync-log.png, caption "No re-downloads after the update"
    say:
      - Here's the sync log after an update. Nothing gets downloaded again.
```

## Render command

One command renders a spec end-to-end: TTS for each beat in parallel, slides in
headless Chrome, assembly with ffmpeg, and a contact sheet.

```bash
bash curation/with-secrets.sh GEMINI_API_KEY -- python3 \
  .claude/skills/video-reply/scripts/render.py llm-video-replies/NN-slug.yaml \
  --out llm-video-replies/NN-slug.mp4
```

It prints the `video:`, `duration:` and `contact sheet:` paths on stdout, with
warnings on stderr. The whole `llm-video-replies/` folder is gitignored: renders,
specs, and `.cache/` (TTS audio, downloaded images, build files).

- `--preview` renders the slides and `NAME.preview.png` only, with no API key and no
  audio, in about 5 s. Use it to fix layout before spending TTS.
- Captions are **burned into the picture by default**, and the layout reserves room
  for them. Most players hide a soft subtitle track, so it went unseen.
  `--no-burn-captions` falls back to the soft `mov_text` track only.
- `--no-subs`, `--no-verify` (skip the transcription check), `--refresh-audio`.
- Re-renders are cheap. Audio is cached by hash(text, voice, model, style) and Ken
  Burns clips by image, size and duration, so edit visuals freely; only changed
  narration costs API calls.

## Spec format (YAML)

Top level: `title` (MP4 title + default footer), `footer`, `scenes`, and optional
`voice` (default `Leda`), `model` (default `gemini-3.8-flash-tts`; falls back to
`gemini-3.8-flash-lite-tts`), `style` (delivery direction; each model
has a tuned default. For 3.8 models it is a short phrase like `friendly,
warm and engaging`, sent as speech metadata; for the legacy 3.1/2.5 models it is
prose prepended to each beat), `accent` (hex), `pad` (seconds after each beat, default 0.25), `speed` (pitch-preserving speech tempo, default 1.12 — the voice reads slowly at 1.0).

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

- **Length follows the words** (~150 words/min — see step 2 for targets). Budget words, not
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
   in `llm-video-replies/.cache/build/<name>/frames/` if a detail needs a zoom.

## Notes

- **TTS:** the default is `gemini-3.8-flash-tts` with the `Leda` voice, selected by the user. `gemini-3.8-flash-lite-tts` is the fallback. Set `voice` in a spec to override the default for that video.
- 3.8 models use the Interactions API (`store=False`) and read the text as a strict verbatim transcript: any direction in the text gets spoken. So `tts.py` sends `style` as speech metadata; keep narration pure speech. 3.8 sounds flat without a style, and `friendly, warm and engaging` tested best. There's no speaking-rate setting, so `speed` time-stretches the audio.
- Each new clip gets a duration check and a transcription check with `gemini-3.5-transcribe`, and is re-synthesised once on a mismatch. Mishearings of rare words ("Veo", "tarantella") stay within tolerance.
- `video` clips are always muted, normalised to 1080p30, letterboxed (never cropped), and play across all of the scene's beats: looped by default, or frozen on the last frame with `loop: false`. `layout: full` keeps the progress bar and caption on a gradient over the clip.
- Output: 1920×1080 30 fps H.264 + AAC 96k, loudness-normalised to −16 LUFS, with burned-in captions. Plays in QuickTime and on phones. Keep it under 30 MB (about 15 MB for 4 minutes).
- Needs Google Chrome, ffmpeg 7 or newer built with libass (it burns the captions), and Python with `google-genai` ≥ 2.25, `PyYAML` and `Pillow`. Fonts are macOS system fonts (New York, Avenir Next).
