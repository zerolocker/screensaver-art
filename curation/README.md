# Gallery Curation

Everything that fills and maintains `gallery.json` lives here. There are **two
distinct pieces**, and together they form a feedback loop:

1. **The nightly curation agent** — generates four new pieces every night.
2. **The cleanup tool** (`cleanup-tool/`) — a human-in-the-loop pass that removes
   the misses and teaches the agent to make fewer of them.

They're connected by **`PROMPT_GUIDANCE.md`**: the cleanup loop *writes* it, the
nightly agent *reads* it before generating. So every cleanup round makes the next
night's batch better.

```
curation/
├── AUTOMATED_CURATION.md         # the nightly agent's runbook — the source of truth for §1
├── publish-piece.mjs             # derive → upload → gallery.json entry, for one piece
├── PROMPT_GUIDANCE.md            # shared: written by cleanup, read by the agent
├── ART_STYLES_FOR_INSPIRATION.md # style ideas the agent draws from
├── with-secrets.sh               # loads + verifies curation/.env for the agent
├── .env / .env.example           # GEMINI_API_KEY, CLOUDFLARE_API_TOKEN
└── cleanup-tool/                 # the human-in-the-loop review tool (§2)
```

**This file is a map.** The two runnable procedures are documented once each, and
not repeated here:

| To do this | Read |
|---|---|
| Run / change the nightly agent | [`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md) |
| Process a round of human flags | [`.claude/skills/curate-gallery/SKILL.md`](../.claude/skills/curate-gallery/SKILL.md) |

---

## 1. The nightly curation agent

A scheduled AI agent that commissions **four new pieces every night** so the
gallery always has fresh art. For each piece it picks a theme, generates a 4K
still, self-reviews it (the "vision gate") before spending a video generation,
animates it, and publishes it with `publish-piece.mjs`. The step-by-step is
[`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md) — **edit that, not this section.**

**Two modes, one switch.** `curation/CURATION_MODE` holds one word, and Step 0 of
`AUTOMATED_CURATION.md` routes on it:
- `ai-generated` is the original runbook above, where AI generates the still and Veo animates it.
- `real-paintings` follows [`REAL_PAINTINGS_CURATION.md`](REAL_PAINTINGS_CURATION.md): famous
  public-domain paintings from museum open-access collections, cleared by
  `real-art/find-paintings.mjs`, framed on a dark wall, then animated. Its prompt rules live in
  [`REAL_ART_GUIDANCE.md`](REAL_ART_GUIDANCE.md).

The scheduled job always enters through `AUTOMATED_CURATION.md`, so switching modes is a
one-word commit; nothing changes on the machine that runs it.

**Inputs it depends on — all kept here at the `curation/` root:**

| File | Purpose |
|---|---|
| `AUTOMATED_CURATION.md` | The step-by-step runbook the agent follows. **Committed.** |
| `PROMPT_GUIDANCE.md` | Accumulated prompt-quality rules. The agent reads this **before** writing prompts. **Committed.** |
| `ART_STYLES_FOR_INSPIRATION.md` | A growing list of styles/themes to draw from. **Committed.** |
| `publish-piece.mjs` | One command per finished piece: derives the three web images from the 4K still, uploads them + the video to R2 under never-overwritten keys, appends the `gallery.json` entry, cleans up the local files. **Committed.** |
| `with-secrets.sh` | Loads `curation/.env`, verifies the named secret(s) exist, then runs the command. |
| `.env` / `.env.example` | `GEMINI_API_KEY` (image/video) + `CLOUDFLARE_API_TOKEN` (R2 upload). `.env` is **gitignored**. |

Secrets are required — the image/video skills and the R2 upload all go through
`with-secrets.sh`. Also needs `ffmpeg` on `PATH`.

---

## 2. The cleanup tool (`cleanup-tool/`)

A small human-in-the-loop tool for cleaning up `gallery.json` and improving the
nightly agent over time.

**The problem it solves:** the nightly agent already self-reviews each still, but
some pieces still land **undesirable** (off-theme / low-quality / glitchy). This
tool lets you sweep the gallery and give two-way feedback: mark the misses
**undesirable** (removed), and mark the standouts **great** ("want more" — a
positive keep-signal). Both — with your optional notes — feed back into
`PROMPT_GUIDANCE.md` so the agent makes fewer misses *and* more of what you love.

It's a loop between **you** (judging what's good or bad) and **Claude** (applying
the deletions and distilling the patterns to avoid + to emulate).

### Tech

A **zero-dependency Node server** (`server.mjs`) + a single static page
(`index.html`). No build step, no `npm install` — it uses only Node's built-in
modules. Videos stream straight from the public R2 bucket, so nothing is
downloaded. Requires Node 18+ (the repo uses Node 22).

### The loop

#### Step 1 — Browse & flag (your turn)

From the repo root:

```bash
node curation/cleanup-tool/server.mjs
```

This serves the tool at <http://localhost:4321> and opens your browser. You'll see
every piece in `gallery.json` as a card with its **video, title, date, and both
prompts**. On each card, click:

- **★ Great, want more** — a standout; tells the bot to make more like it (kept)
- **✕ Undesirable** — off-theme / low-quality / glitchy / not wanted (removed)

**Either** button reveals an optional free-form note box — jot down *why* (e.g.
"muddy palette, broken hands" for undesirable; "love the dramatic motion and rich
palette" for great). It's saved with the flag and surfaces in Claude's analysis,
so the prompt-guidance round leans on your stated reasons instead of guessing from
the frame alone.

Click again to unflag. Use the **All / Flagged / Unflagged** filters to review.
Your flags **autosave** to `curation/cleanup-tool/selections.json` as you go (no
need to click Save). Stop the server with `Ctrl+C` when done.

#### Step 2 — Process (Claude's turn)

Return to Claude and say:

> **process curation selections**

Claude applies the deletions (`apply.mjs`), builds labeled contact sheets of both
kinds' first frames so it can *see* the patterns, and appends a dated round entry
to [`PROMPT_GUIDANCE.md`](PROMPT_GUIDANCE.md). The exact procedure is
[`.claude/skills/curate-gallery/SKILL.md`](../.claude/skills/curate-gallery/SKILL.md)
— **edit that, not this section.**

> The deletion is mechanical and safe (it's just `apply.mjs`); Claude's real
> value is the prompt + frame pattern analysis. You can also run
> `node curation/cleanup-tool/apply.mjs` yourself if you only want the deletion.

#### Step 3 — The agent improves itself

[`AUTOMATED_CURATION.md`](AUTOMATED_CURATION.md) instructs the nightly agent to
**read `PROMPT_GUIDANCE.md` before generating prompts**. So every cleanup round
tightens the guidance, and the agent produces fewer bad pieces.

### Files (all under `cleanup-tool/`)

| File | Purpose |
|---|---|
| `server.mjs` | Zero-dep local server. `node curation/cleanup-tool/server.mjs` to launch. |
| `index.html` | The browse + flag UI. |
| `apply.mjs` | Removes `undesirable` pieces from `gallery.json` (with backup); records removed + kept-great. |
| `contact-sheets.mjs` | Extracts both kinds' first frames (full-res, under `.analysis/frames/`) + tiles downscaled copies into labeled contact sheets (ffmpeg, `undesirable_*` / `great_*`) for Claude's vision analysis. |
| `selections.json` | Your current flags (autosaved by the UI), each `{ src, title, reason, note? }` — `reason` is `undesirable` or `great`; `note` is the optional free-form reason on either. *Gitignored.* |
| `last-removed.json` | The most recent removed (undesirable) items — what to avoid. *Gitignored.* |
| `last-loved.json` | The most recent kept (great) items — what to make more of. *Gitignored.* |
| `.analysis/` | Extracted frames, contact sheets + index from the last analysis. *Gitignored.* |
| `.backups/` | Timestamped `gallery.json` backups from each `apply.mjs` run. *Gitignored.* |

`PROMPT_GUIDANCE.md` (one level up, in `curation/`) is the durable output of this
loop and is committed alongside the `gallery.json` change. The tool's working
files (`selections.json`, `last-removed.json`, `last-loved.json`, `.analysis/`,
`.backups/`) are gitignored.

### Notes

- **R2 objects are left in place.** This workflow only edits `gallery.json`.
  Orphaned MP4s on R2 are harmless (subscribers' local caches drop any `.bin`
  not referenced by the latest gallery on next sync). Delete them manually with
  `wrangler` if you want to reclaim storage.
- **Resuming:** flags persist in `selections.json`, so you can stop and restart
  the server and your flags reload. They're cleared the next time you flag from
  scratch (the UI overwrites the file on each change).
- **Undo a deletion:** restore the relevant file from `curation/cleanup-tool/.backups/`.
