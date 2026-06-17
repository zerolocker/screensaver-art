// Living Art Screensaver — apply curation flags to gallery.json
//
// Reads curation/cleanup-tool/selections.json (written by the curation tool),
// removes every flagged piece from gallery.json, and records what was removed so
// Claude can analyse the "undesirable" prompts afterwards. Safe + reversible: the
// previous gallery.json is backed up under curation/cleanup-tool/.backups/ first.
//
//   node curation/cleanup-tool/apply.mjs
//
// Outputs:
//   gallery.json                                   -> rewritten without the flagged pieces
//   curation/cleanup-tool/.backups/gallery.<ts>.json -> backup of the pre-edit gallery
//   curation/cleanup-tool/last-removed.json        -> the removed items (with prompts + reason)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const GALLERY = join(ROOT, 'gallery.json');
const SELECTIONS = join(HERE, 'selections.json');
const BACKUPS = join(HERE, '.backups');
const LAST_REMOVED = join(HERE, 'last-removed.json');

if (!existsSync(SELECTIONS)) {
  console.error('No curation/cleanup-tool/selections.json found. Run the tool and flag some pieces first:');
  console.error('  node curation/cleanup-tool/server.mjs');
  process.exit(1);
}

const sel = JSON.parse(await readFile(SELECTIONS, 'utf8'));
const flagged = Array.isArray(sel.flagged) ? sel.flagged : [];
if (!flagged.length) {
  console.log('selections.json has no flagged items. Nothing to delete.');
  process.exit(0);
}

// Normalise legacy "ugly" flags (pre-rename) to "undesirable".
const norm = (r) => (r === 'ugly' ? 'undesirable' : r);
const reasonBySrc = new Map(flagged.map(f => [f.src, norm(f.reason)]));
const gallery = JSON.parse(await readFile(GALLERY, 'utf8'));

const removed = gallery.filter(i => reasonBySrc.has(i.src)).map(i => ({ ...i, _reason: reasonBySrc.get(i.src) }));
const kept = gallery.filter(i => !reasonBySrc.has(i.src));
const foundSrc = new Set(removed.map(i => i.src));
const missing = flagged.filter(f => !foundSrc.has(f.src));

// Backup before writing.
await mkdir(BACKUPS, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
await writeFile(join(BACKUPS, `gallery.${ts}.json`), JSON.stringify(gallery, null, 2) + '\n');

// Rewrite gallery.json (2-space indent matches the existing format + the bot's edits).
await writeFile(GALLERY, JSON.stringify(kept, null, 2) + '\n');

// Record what was removed (with prompts) for Claude's prompt analysis.
await writeFile(LAST_REMOVED, JSON.stringify({
  removedAt: new Date().toISOString(),
  count: removed.length,
  byReason: tally(removed),
  items: removed,
}, null, 2) + '\n');

function tally(items) {
  return items.reduce((a, i) => { a[i._reason] = (a[i._reason] || 0) + 1; return a; }, {});
}

console.log(`Removed ${removed.length} item(s):`, tally(removed));
console.log(`Remaining in gallery.json: ${kept.length}`);
if (missing.length) {
  console.log(`\n  ${missing.length} flagged src not found in gallery.json (already removed?):`);
  for (const m of missing) console.log(`   - ${m.title || m.src}`);
}
console.log(`\nBackup:        curation/cleanup-tool/.backups/gallery.${ts}.json`);
console.log(`Removed items: curation/cleanup-tool/last-removed.json  (Claude reads this to refine prompts)`);
