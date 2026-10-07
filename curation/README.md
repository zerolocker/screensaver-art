# Curation

Everything that fills and maintains `gallery.json`. Two parts feed each other:

1. **The nightly agent** adds four pieces every night.
2. **The review tool** lets a human remove weak pieces, mark great ones, and turn the lessons into rules in `PROMPT_GUIDANCE.md`, which the agent reads before every run.

| File | Purpose |
|---|---|
| `AUTOMATED_CURATION.md` | The nightly runbook. The scheduled job always starts here. |
| `CURATION_MODE` | One word, `ai-generated` or `real-paintings`, that picks the runbook. |
| `REAL_PAINTINGS_CURATION.md`, `REAL_ART_GUIDANCE.md` | The runbook and rules for animating real public-domain paintings. |
| `REAL_PAINTINGS_CATALOG.md` | The monthly refresh of the paintings catalog, its routine, and how to see and veto what's coming. |
| `real-art/` | Scripts that find, legally clear and frame those paintings, and the catalog the nightly picks from. See its README. |
| `PROMPT_GUIDANCE.md` | Prompt rules learned from reviews. |
| `ART_STYLES_FOR_INSPIRATION.md` | Styles for the agent to draw from. |
| `publish-piece.mjs` | Publishes one finished piece: web images, R2 upload, `gallery.json` entry. |
| `with-secrets.sh`, `.env.example` | Load and check secrets from the gitignored `.env`. |
| `cleanup-tool/` | The review tool. |

## The review loop

1. **Flag pieces.** Run `node curation/cleanup-tool/server.mjs`. It opens <http://localhost:4321> with every piece's video, title and prompts. Mark each miss **✕ Undesirable** (it will be removed) and each standout **★ Great** (kept, and the agent should make more like it). Either flag can take a note saying why. Flags autosave to `cleanup-tool/selections.json`.
2. **Process them.** Tell Claude "process curation selections". The [`curate-gallery` skill](../.claude/skills/curate-gallery/SKILL.md) removes the undesirable pieces, builds contact sheets of the flagged pieces' first frames, and updates the rules in `PROMPT_GUIDANCE.md`.

The tool is a zero-dependency Node server (Node 18+) and streams videos straight from R2.

| `cleanup-tool/` file | Purpose |
|---|---|
| `server.mjs`, `index.html` | The review UI |
| `apply.mjs` | Removes undesirable pieces from `gallery.json` (with a backup) and writes `last-removed.json` and `last-loved.json` |
| `contact-sheets.mjs` | Extracts first frames into `.analysis/` and tiles them into labeled contact sheets |

Working files (`selections.json`, `last-*.json`, `.analysis/`, `.backups/`) are gitignored.

- Removing a piece only edits `gallery.json`. The files stay on R2, and the app drops them from caches on the next sync.
- To undo a removal, restore `gallery.json` from `cleanup-tool/.backups/`.
