// Living Art Screensaver — build labeled contact sheets of "undesirable" pieces
//
// Extracts the first frame of every piece flagged "undesirable" in
// curation/cleanup-tool/selections.json and tiles them into labeled contact
// sheets, so Claude can review dozens of frames in a handful of images (vision
// can't take dozens of stills one at a time). Pure ffmpeg — no extra deps.
//
//   node curation/cleanup-tool/contact-sheets.mjs
//
// Outputs under curation/cleanup-tool/.analysis/:
//   frames/NNN.png         one labeled 16:9 frame per undesirable piece
//   sheets/sheet_NN.png    frames tiled 4x4 (16 per sheet), index burned in
//   index.json             tile number -> { src, title, image_prompt, video_prompt }
//   index.md               same mapping, human/Claude-readable

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const GALLERY = join(ROOT, 'gallery.json');
const SELECTIONS = join(HERE, 'selections.json');
const OUT = join(HERE, '.analysis');
const FRAMES = join(OUT, 'frames');
const SHEETS = join(OUT, 'sheets');

const TILE_W = 480, TILE_H = 270;     // 16:9 tile
const COLS = 4, ROWS = 4;             // 16 frames per sheet
const CONCURRENCY = 6;
const FONT = [
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
].find(existsSync);

const norm = (r) => (r === 'ugly' ? 'undesirable' : r);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(err.slice(-500))));
  });
}

async function pool(items, n, fn) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx).then(() => true).catch((e) => { console.warn(`  frame ${idx} failed: ${e.message}`); return false; });
    }
  }));
  return results;
}

// --- gather undesirable pieces (join selections -> gallery for prompts) ---
if (!existsSync(SELECTIONS)) { console.error('No curation/cleanup-tool/selections.json. Run the tool first.'); process.exit(1); }
const sel = JSON.parse(await readFile(SELECTIONS, 'utf8'));
const gallery = JSON.parse(await readFile(GALLERY, 'utf8'));
const bySrc = new Map(gallery.map((g) => [g.src, g]));

const pieces = (sel.flagged || [])
  .filter((f) => norm(f.reason) === 'undesirable')
  .map((f) => {
    const g = bySrc.get(f.src) || {};
    return { src: f.src, title: g.title || f.title || '', image_prompt: g.image_prompt || '', video_prompt: g.video_prompt || '' };
  });

if (!pieces.length) { console.log('No "undesirable" pieces flagged. Nothing to do.'); process.exit(0); }
console.log(`Building contact sheets for ${pieces.length} undesirable piece(s)…`);

// --- fresh output dirs ---
await rm(OUT, { recursive: true, force: true });
await mkdir(FRAMES, { recursive: true });
await mkdir(SHEETS, { recursive: true });

// --- extract + label first frame of each ---
const pad = (n) => String(n).padStart(3, '0');
const drawtext = (label) => {
  const base = `text='${label}':x=8:y=6:fontsize=34:fontcolor=yellow:box=1:boxcolor=black@0.65:boxborderw=8`;
  return FONT ? `drawtext=fontfile='${FONT}':${base}` : `drawtext=${base}`;
};

const ok = await pool(pieces, CONCURRENCY, async (p, idx) => {
  const vf = [
    `scale=${TILE_W}:${TILE_H}:force_original_aspect_ratio=decrease`,
    `pad=${TILE_W}:${TILE_H}:(ow-iw)/2:(oh-ih)/2:color=black`,
    drawtext(idx),
  ].join(',');
  // -frames:v 1 from the start: ffmpeg reads only enough of the remote stream to
  // decode the first frame, so this does not download the whole MP4.
  await run('ffmpeg', ['-y', '-i', p.src, '-frames:v', '1', '-vf', vf, join(FRAMES, `${pad(idx)}.png`)]);
});
const good = ok.filter(Boolean).length;
console.log(`Extracted ${good}/${pieces.length} frames.`);

// --- tile frames into sheets (image2 sequence -> tile filter) ---
// The tile filter packs consecutive input frames into a grid and emits one image
// per full grid; trailing cells on the last sheet are filled with the pad color.
await run('ffmpeg', [
  '-y', '-framerate', '1', '-start_number', '0', '-i', join(FRAMES, '%03d.png'),
  '-vf', `tile=${COLS}x${ROWS}:padding=10:margin=10:color=0x1d2029`,
  join(SHEETS, 'sheet_%02d.png'),
]);

// --- mapping files ---
// ffmpeg's image2 muxer numbers sheets from 01, so +1 to match sheet_NN.png.
const index = pieces.map((p, n) => ({ n, sheet: Math.floor(n / (COLS * ROWS)) + 1, ...p }));
await writeFile(join(OUT, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), tiling: `${COLS}x${ROWS}`, count: pieces.length, pieces: index }, null, 2) + '\n');

const md = ['# Undesirable pieces — contact-sheet index', '',
  `Tiles are numbered (burned into each frame). ${COLS}×${ROWS} per sheet.`, ''];
for (const p of index) {
  md.push(`### ${p.n} — ${p.title || '(untitled)'}  _(sheet ${p.sheet})_`);
  md.push(`- image_prompt: ${p.image_prompt || '(none)'}`);
  md.push(`- video_prompt: ${p.video_prompt || '(none)'}`);
  md.push('');
}
await writeFile(join(OUT, 'index.md'), md.join('\n'));

console.log(`\nSheets:  curation/cleanup-tool/.analysis/sheets/`);
console.log(`Index:   curation/cleanup-tool/.analysis/index.json  +  index.md`);
