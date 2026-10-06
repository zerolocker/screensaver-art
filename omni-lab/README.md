# Omni Lab

A local UI for tuning Gemini Omni settings on real paintings and on your own
images. It runs one config on many artworks at once, keeps every run on disk, and
shows any two runs side by side.

## Run it

```bash
node omni-lab/server.mjs          # http://localhost:4322 (opens the browser)
```

- Needs Node 22 and a `python3` with `google-genai` and `Pillow`. Point it at another
  python with `OMNI_PYTHON=/path/to/python3`. The page shows a red banner if the
  python can't import them.
- The API key comes from `curation/.env` through `curation/with-secrets.sh`. The
  server never reads it. Each job calls
  `.claude/skills/omni-video-gen/scripts/generate.py` through that wrapper.
- Other env vars: `NO_OPEN=1` (don't open the browser), `OMNI_CONCURRENCY` (default
  10), `PORT` (default 4322).
- Fetch the 10 test paintings once: `node omni-lab/fetch-paintings.mjs` (add
  `--refresh` to re-download). It uses `curation/real-art/find-paintings.mjs` for
  metadata and clearance, and stores them unframed at up to 3840 px.

## Your own images

- Upload with **+ Upload images…**, or drop files on the settings panel. New uploads
  are listed first and selected.
- Each upload is stored like the paintings: upright per its EXIF orientation, as a
  JPEG at up to 3840 px, never upscaled. Transparent areas are flattened onto the
  `#0b0b0d` wall. Uploading the same file again gives back the same entry.
- JPEG, PNG, WebP, TIFF, BMP and GIF work. HEIC needs `pip install pillow-heif` in
  the lab's python.
- Each upload has title, artist and year fields for the `{title}`, `{artist}`,
  `{year}` and `{date}` placeholders (`{date}` is the year). The title starts as the
  file name. A warning appears when the prompt uses a placeholder you left blank:
  fill it in, or override the prompt for that image.
- **remove** deletes the upload. Past runs keep their own input and videos, but a
  retry of one needs the file, so it fails.

## Settings

The defaults are the production config.

- **Omni:**
  - prompt, with `{title}`, `{artist}`, `{year}` and `{date}` placeholders
  - optional per-painting prompt overrides
  - optional follow-up edit prompt, sent via `previous_interaction_id`; both clips are kept
  - model, resolution, output aspect (`auto` = 16:9 if wider than tall, else 9:16), task
  - duration and seed. Omni's docs don't list these, but the API honours them: the
    same seed and inputs give a near-identical clip. With no duration Omni makes 10 s.
- **Pre-processing:**
  - framing: `raw` (the whole painting), `center crop` (to the output aspect) or
    `dark wall` (the whole painting centred on a `#0b0b0d` canvas)
  - the input's long edge
  - **Preview inputs** shows the exact images without calling Omni.

Omni has no negative prompt or temperature. Put any "don't" in the prompt.

## How it works

- Each painting in a run is one detached `python3 omni-lab/job.py` process. It
  pre-processes the image, calls the Omni CLI and runs the edit if there is one.
  Ten run at once and the rest wait in a queue.
- Jobs outlive the server, so a restart or Ctrl+C loses nothing. When the server
  comes back it picks up running jobs and resumes queued ones. To stop every job,
  use **Cancel** in the UI or run `pkill -f omni-lab/job.py`.
- Each run is a folder `runs/<run-id>/` with these files:
  - `config.json`: the config, the timestamp and the paintings
  - `meta.json`: the note and the 👍/👎 ratings
  - one folder per painting:
    - `input.jpg`: the exact bytes sent to Omni
    - `video.mp4`, plus `edit.mp4` if the run had an edit prompt, each with a `.json` sidecar holding the interaction id
    - `status.json`
    - `log.txt`: every command run and the CLI's full output
- Uploads live in `uploads/`: `<key>.jpg`, `<key>_thumb.jpg` and `uploads.json`. The
  key is `up_` plus a hash of the file's bytes.
- `runs/`, `paintings/`, `uploads/` and `.preview/` are gitignored. Never commit media from them.
- Old runs may have recorded options that were since removed: crop anchor, wall
  colour and margin, first + last frame, and frame-role tags. History and compare
  show them read-only. Retrying such a run uses the current behaviour.
