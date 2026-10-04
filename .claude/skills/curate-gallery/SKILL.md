---
name: curate-gallery
description: Run the gallery curation loop — launch the local flagging tool, or process the user's flags (delete undesirable pieces from gallery.json, keep the ones they marked great, and refine the nightly-curation prompt guidance from their notes). Use when the user says "curate the gallery", "process curation selections", "clean up gallery.json", or wants to review/remove bad art pieces.
---

# Gallery curation

The human review loop for `gallery.json`. Background: `curation/README.md`.

## Launch the tool (the user wants to flag pieces)

Start the server in the background:

```bash
node curation/cleanup-tool/server.mjs
```

It opens <http://localhost:4321>. The user marks pieces **undesirable** (removed) or **great** (kept, and the bot should make more like them), optionally with a note, and flags autosave to `curation/cleanup-tool/selections.json`. Then wait for them to ask you to process.

## Process the flags ("process curation selections")

1. **Apply.**
   ```bash
   node curation/cleanup-tool/apply.mjs
   ```
   It backs up `gallery.json`, removes only the undesirable pieces, and writes `last-removed.json` (what to avoid) and `last-loved.json` (what to make more of), each with prompts and notes. If it reports no flagged items, ask the user to flag some first.

2. **Look at the frames.**
   ```bash
   node curation/cleanup-tool/contact-sheets.mjs
   ```
   It writes contact sheets of every flagged piece's first frame to `curation/cleanup-tool/.analysis/sheets/` (`undesirable_NN.png`, `great_NN.png`), plus `index.md` mapping tiles to titles, notes and prompts. Full-resolution frames are in `.analysis/frames/`. Read the sheets; that's how you see the patterns.

3. **Find the patterns.** Start from the reviewer's notes; they are the stated reasons, so weight them heavily.
   - **Undesirable:** compare each piece's prompts with its frame and find the common failures.
   - **Great:** find the shared traits worth repeating.

4. **Update the rules.** Edit the rules in `curation/PROMPT_GUIDANCE.md`: add a rule for each new pattern, and sharpen existing rules the round reinforced. Keep rules short and concrete, and don't write up the round itself. If the great pieces point at styles worth repeating, add them to `curation/ART_STYLES_FOR_INSPIRATION.md`.

5. **Report** how many pieces were removed and kept, how many remain, the patterns you found, and the rules you changed.

Don't commit unless asked. If asked, stage `gallery.json`, `curation/PROMPT_GUIDANCE.md`, `curation/ART_STYLES_FOR_INSPIRATION.md` and any tool changes, and summarize the round in the commit message. The tool's working files are gitignored.
