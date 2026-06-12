# Gallery Curation Workflow

A small human-in-the-loop tool for cleaning up `gallery.json` and improving the
nightly auto-curation bot over time.

**The problem it solves:** the nightly bot (see [`../AUTOMATED_CURATION.md`](../AUTOMATED_CURATION.md))
adds 3 new AI-animated pieces every night, and some come out **corrupted**
(glitchy / single-color / broken) or **undesirable** (off-theme / low-quality).
This workflow lets you sweep
the gallery, flag the bad ones, remove them, and feed the lessons back into the
bot's prompt guidance so it makes fewer of them next time.

It's a loop between **you** (judging what looks bad) and **Claude** (applying the
deletions and distilling prompt patterns).

---

## Tech

A **zero-dependency Node server** (`server.mjs`) + a single static page
(`index.html`). No build step, no `npm install` — it uses only Node's built-in
modules. Videos stream straight from the public R2 bucket, so nothing is
downloaded. Requires Node 18+ (the repo uses Node 22).

---

## The loop

### 1. Browse & flag — your turn

From the repo root:

```bash
node curation/server.mjs
```

This serves the tool at <http://localhost:4321> and opens your browser. You'll
see every piece in `gallery.json` as a card with its **video, title, date, and
both prompts**. For anything that looks bad, click:

- **⚠ Corrupted** — glitchy, single-color, broken render
- **✕ Undesirable** — renders fine but off-theme / low-quality / not wanted

Click again to unflag. Use the **All / Flagged / Unflagged** filters to review.
Your flags **autosave** to `curation/selections.json` as you go (no need to click
Save). Stop the server with `Ctrl+C` when done.

### 2. Process — Claude's turn

Return to Claude and say:

> **process curation selections**

Claude then:

1. Runs `node curation/apply.mjs`, which:
   - backs up the current `gallery.json` to `curation/.backups/`,
   - removes every flagged piece from `gallery.json`,
   - writes the removed items (with their prompts + reason) to
     `curation/last-removed.json`.
2. Builds **labeled contact sheets** of the undesirable pieces' first frames
   (`node curation/contact-sheets.mjs`) so it can *see* the pattern — 56 videos
   is too many to view one-by-one, so their frames are tiled 16-per-image.
3. Cross-references each undesirable piece's **prompt + first frame**, summarizes
   the common pattern, and appends a dated entry to
   [`PROMPT_GUIDANCE.md`](PROMPT_GUIDANCE.md) with concrete new/reinforced rules.

> The deletion is mechanical and safe (it's just `apply.mjs`); Claude's real
> value is the prompt + frame pattern analysis. You can also run
> `node curation/apply.mjs` yourself if you only want the deletion.

### 3. The bot improves itself

[`AUTOMATED_CURATION.md`](../AUTOMATED_CURATION.md) instructs the nightly bot to
**read `curation/PROMPT_GUIDANCE.md` before generating prompts**. So every
curation round tightens the guidance, and the bot produces fewer bad pieces.

---

## Files

| File | Purpose |
|---|---|
| `server.mjs` | Zero-dep local server. `node curation/server.mjs` to launch. |
| `index.html` | The browse + flag UI. |
| `apply.mjs` | Deletes flagged pieces from `gallery.json` (with backup). |
| `contact-sheets.mjs` | Extracts undesirable pieces' first frames + tiles them into labeled contact sheets (ffmpeg) for Claude's vision analysis. |
| `PROMPT_GUIDANCE.md` | Accumulated prompt rules the nightly bot reads. **Committed.** |
| `selections.json` | Your current flags (autosaved by the UI). *Gitignored.* |
| `last-removed.json` | The most recent removed items, for Claude's analysis. *Gitignored.* |
| `.analysis/` | Extracted frames, contact sheets + index from the last analysis. *Gitignored.* |
| `.backups/` | Timestamped `gallery.json` backups from each `apply.mjs` run. *Gitignored.* |

`PROMPT_GUIDANCE.md` is the durable output and is committed alongside the
`gallery.json` change. The working files (`selections.json`, `last-removed.json`,
`.backups/`) are gitignored.

---

## Notes

- **R2 objects are left in place.** This workflow only edits `gallery.json`.
  Orphaned MP4s on R2 are harmless (subscribers' local caches drop any `.bin`
  not referenced by the latest gallery on next sync). Delete them manually with
  `wrangler` if you want to reclaim storage.
- **Resuming:** flags persist in `selections.json`, so you can stop and restart
  the server and your flags reload. They're cleared the next time you flag from
  scratch (the UI overwrites the file on each change).
- **Undo a deletion:** restore the relevant file from `curation/.backups/`.
