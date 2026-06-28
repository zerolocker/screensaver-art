// Living Art Screensaver — apply curation flags to gallery.json
//
// Reads curation/cleanup-tool/selections.json (written by the curation tool) and
// acts on the two flag kinds:
//   - "undesirable" -> DELETED from gallery.json (recorded for "what to avoid")
//   - "great"       -> KEPT in gallery.json (recorded for "what to make more of")
// Only undesirable pieces are removed; great is a positive keep-signal. Safe +
// reversible: the previous gallery.json is backed up under .backups/ first.
//
//   node curation/cleanup-tool/apply.mjs
//
// Outputs:
//   gallery.json                                   -> rewritten without the undesirable pieces
//   curation/cleanup-tool/.backups/gallery.<ts>.json -> backup of the pre-edit gallery
//   curation/cleanup-tool/last-removed.json        -> removed (undesirable) items, with prompts + note
//   curation/cleanup-tool/last-loved.json          -> kept (great) items, with prompts + note

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
const LAST_LOVED = join(HERE, 'last-loved.json');

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
// Optional free-form note the reviewer left on a flag (either kind).
const noteBySrc = new Map(flagged.filter(f => f.note).map(f => [f.src, f.note]));
const gallery = JSON.parse(await readFile(GALLERY, 'utf8'));

const withMeta = (i) => ({
  ...i,
  _reason: reasonBySrc.get(i.src),
  ...(noteBySrc.has(i.src) ? { _note: noteBySrc.get(i.src) } : {}),
});

// Only "undesirable" pieces are deleted. "great" is a positive keep-signal — those
// stay in the gallery and are recorded separately for the "make more of this" pass.
const removed = gallery.filter(i => reasonBySrc.get(i.src) === 'undesirable').map(withMeta);
const loved = gallery.filter(i => reasonBySrc.get(i.src) === 'great').map(withMeta);
const kept = gallery.filter(i => reasonBySrc.get(i.src) !== 'undesirable');

const foundSrc = new Set([...removed, ...loved].map(i => i.src));
const missing = flagged.filter(f => !foundSrc.has(f.src));

// Backup before writing.
await mkdir(BACKUPS, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
await writeFile(join(BACKUPS, `gallery.${ts}.json`), JSON.stringify(gallery, null, 2) + '\n');

// Rewrite gallery.json (2-space indent matches the existing format + the bot's edits).
await writeFile(GALLERY, JSON.stringify(kept, null, 2) + '\n');

// Record removed (undesirable) for the "what to avoid" analysis.
await writeFile(LAST_REMOVED, JSON.stringify({
  removedAt: new Date().toISOString(),
  count: removed.length,
  byReason: tally(removed),
  items: removed,
}, null, 2) + '\n');

// Record loved (great) for the "what to make more of" analysis.
await writeFile(LAST_LOVED, JSON.stringify({
  generatedAt: new Date().toISOString(),
  count: loved.length,
  items: loved,
}, null, 2) + '\n');

function tally(items) {
  return items.reduce((a, i) => { a[i._reason] = (a[i._reason] || 0) + 1; return a; }, {});
}

console.log(`Removed ${removed.length} undesirable item(s).`);
console.log(`Kept ${loved.length} "great" item(s) (recorded to last-loved.json).`);
console.log(`Remaining in gallery.json: ${kept.length}`);
if (missing.length) {
  console.log(`\n  ${missing.length} flagged src not found in gallery.json (already removed?):`);
  for (const m of missing) console.log(`   - ${m.title || m.src}`);
}
console.log(`\nBackup:        curation/cleanup-tool/.backups/gallery.${ts}.json`);
console.log(`Removed items: curation/cleanup-tool/last-removed.json  (Claude reads this — what to avoid)`);
console.log(`Loved items:   curation/cleanup-tool/last-loved.json    (Claude reads this — what to make more of)`);
