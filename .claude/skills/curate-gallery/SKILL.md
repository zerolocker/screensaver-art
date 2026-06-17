---
name: curate-gallery
description: Run the gallery curation loop — launch the local flagging tool, or process the user's flags (delete corrupted/ugly pieces from gallery.json and refine the nightly-curation prompt guidance). Use when the user says "curate the gallery", "process curation selections", "clean up gallery.json", or wants to review/remove bad art pieces.
---

# Gallery Curation

Human-in-the-loop cleanup of `gallery.json` + improvement of the nightly
auto-curation bot. Full docs: `curation/README.md`. Two modes:

## Mode A — launch the tool (user wants to browse/flag)

Start the local server in the background and tell the user to flag pieces:

```bash
node curation/cleanup-tool/server.mjs
```

It opens <http://localhost:4321> in their browser. They flag pieces as
**corrupted** or **undesirable**; flags autosave to `curation/cleanup-tool/selections.json`.
Then stop and wait — they'll come back and ask you to process.

## Mode B — process the user's flags ("process curation selections")

1. **Delete.** Run the deterministic deletion script:
   ```bash
   node curation/cleanup-tool/apply.mjs
   ```
   It backs up `gallery.json` to `curation/cleanup-tool/.backups/`, removes every
   flagged piece, and writes the removed items (with prompts + reason) to
   `curation/cleanup-tool/last-removed.json`. If it reports "no flagged items",
   tell the user to flag some first (Mode A).

2. **Build contact sheets (see the frames).** Run:
   ```bash
   node curation/cleanup-tool/contact-sheets.mjs
   ```
   It extracts the first frame of every **undesirable** piece, tiles them into
   labeled contact sheets under `curation/cleanup-tool/.analysis/sheets/`, and writes
   `curation/cleanup-tool/.analysis/index.json` (tile number → src/title/prompts). Read the
   sheet PNGs with vision — dozens of videos are too many to view one at a time, so
   reading 4-5 tiled sheets is how you actually *see* the pattern.

3. **Analyze prompt + frame together.** For the undesirable items (filter
   `_reason === "undesirable"` in `last-removed.json` / `index.json`), cross-
   reference each `image_prompt`/`video_prompt` against its first frame in the
   contact sheet. Find the **common patterns** that produced bad output (e.g.
   morph/transform verbs, multiple animated subjects, vague style, animating
   geometry that should stay still, risky faces/hands, muddy/oversaturated
   palettes). Corrupted pieces are usually render glitches, not prompt problems —
   skim them but don't over-weight them.

4. **Refine the guidance.** Append a dated round entry to
   `curation/PROMPT_GUIDANCE.md` (newest first, above the `<!-- Claude appends -->`
   marker) using the format already in that file: the patterns you observed and
   the new/reinforced rules. Keep rules concrete and actionable — the nightly bot
   reads this file before generating prompts.

5. **Report back** to the user: how many were removed (by reason), how many
   remain, and a short summary of the prompt patterns + the rules you added.

Don't commit unless the user asks. If they do: stage `gallery.json`,
`curation/PROMPT_GUIDANCE.md` (and any tool changes) — the working files
(`selections.json`, `last-removed.json`, `.backups/`) are gitignored.
