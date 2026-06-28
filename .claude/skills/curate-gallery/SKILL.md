---
name: curate-gallery
description: Run the gallery curation loop — launch the local flagging tool, or process the user's flags (delete undesirable pieces from gallery.json, keep the ones they marked great, and refine the nightly-curation prompt guidance from their notes). Use when the user says "curate the gallery", "process curation selections", "clean up gallery.json", or wants to review/remove bad art pieces.
---

# Gallery Curation

Human-in-the-loop cleanup of `gallery.json` + improvement of the nightly
auto-curation bot. Full docs: `curation/README.md`. Two modes:

## Mode A — launch the tool (user wants to browse/flag)

Start the local server in the background and tell the user to flag pieces:

```bash
node curation/cleanup-tool/server.mjs
```

It opens <http://localhost:4321> in their browser. Each piece can be marked
**undesirable** (off-theme / low-quality — *removed*) or **great** ("want more"
— a *positive keep-signal* telling the bot to make more like it); flags autosave
to `curation/cleanup-tool/selections.json`. Either flag reveals an optional
free-form **note** ("why undesirable?" / "why great?") — the reviewer's own
reason, saved as `note` on that flag and carried through to the analysis files
below. Then stop and wait — they'll come back and ask you to process.

## Mode B — process the user's flags ("process curation selections")

1. **Apply.** Run the deterministic script:
   ```bash
   node curation/cleanup-tool/apply.mjs
   ```
   It backs up `gallery.json` to `curation/cleanup-tool/.backups/`, **removes only
   the `undesirable` pieces** (the `great` ones are kept — "great" is a positive
   keep-signal), and writes two records: `last-removed.json` (removed/undesirable,
   with prompts + note → *what to avoid*) and `last-loved.json` (kept/great, with
   prompts + note → *what to make more of*). If it reports "no flagged items",
   tell the user to flag some first (Mode A).

2. **Build contact sheets (see the frames).** Run:
   ```bash
   node curation/cleanup-tool/contact-sheets.mjs
   ```
   It extracts the first frame of every flagged piece — **both** kinds — and tiles
   them into labeled contact sheets under `curation/cleanup-tool/.analysis/sheets/`,
   prefixed by reason (`undesirable_NN.png`, `great_NN.png`), plus
   `.analysis/index.json` and `index.md` (tile number → src/title/**note**/prompts,
   grouped by reason). Read the sheet PNGs with vision — dozens of videos are too
   many to view one at a time, so reading the tiled sheets is how you actually
   *see* the pattern.

3. **Analyze both directions — avoid *and* emulate.** **Lead with the reviewer's
   own note** wherever present (`_note` in `last-removed.json` / `last-loved.json`,
   `note` in `index.json` / burned-in-bold in `index.md`) — it's the human's
   stated reason, so weight it heavily.
   - **Undesirable** (`last-removed.json`, `undesirable_*` sheets): cross-reference
     each `image_prompt`/`video_prompt` against its first frame and find the
     **common failure patterns** (e.g. boring "light glides over a static relief"
     animation, morph/transform verbs, oblique camera angles, museum-object shots,
     painting-in-a-frame, duplicates of icons, vague style, risky faces/hands).
   - **Great** (`last-loved.json`, `great_*` sheets): do the same in reverse —
     identify the **shared traits to reinforce** (subjects/styles/motions/palettes
     the reviewer wants more of). These become positive rules and, where they name
     a style/era/subject, candidates to add to `curation/ART_STYLES_FOR_INSPIRATION.md`.

4. **Refine the guidance.** Append a dated round entry to
   `curation/PROMPT_GUIDANCE.md` (newest first, above the `<!-- Claude appends -->`
   marker) using the format already in that file — capture **both** the patterns
   to avoid and the traits to make more of, plus the new/reinforced rules. If the
   `great` notes point at concrete styles/themes worth repeating, also add them to
   `curation/ART_STYLES_FOR_INSPIRATION.md`. Keep rules concrete and actionable —
   the nightly bot reads these files before generating prompts.

5. **Report back** to the user: how many were removed vs. kept-as-great, how many
   remain, and a short summary of the patterns (avoid + emulate) and the rules you
   added.

Don't commit unless the user asks. If they do: stage `gallery.json`,
`curation/PROMPT_GUIDANCE.md`, `curation/ART_STYLES_FOR_INSPIRATION.md` (and any
tool changes) — the working files (`selections.json`, `last-removed.json`,
`last-loved.json`, `.backups/`, `.analysis/`) are gitignored.
