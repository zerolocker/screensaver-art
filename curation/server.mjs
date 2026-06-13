// Living Art Screensaver — Gallery Curation Tool (local server)
//
// Zero-dependency Node HTTP server. Serves a local web UI that lets you browse
// every piece in gallery.json (video + prompts) and flag the ones that look
// corrupted or ugly. Your flags are written to curation/selections.json, which
// Claude then processes (delete from gallery.json + refine the nightly-curation
// prompt guidance).
//
//   node curation/server.mjs           # serve + open browser
//   PORT=5000 node curation/server.mjs # custom port
//   NO_OPEN=1 node curation/server.mjs # don't auto-open the browser
//
// Videos stream directly from the public R2 bucket, so nothing is downloaded.

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const GALLERY = join(ROOT, 'gallery.json');
const SELECTIONS = join(HERE, 'selections.json');
const INDEX = join(HERE, 'index.html');
const PORT = Number(process.env.PORT) || 4321;

const noCache = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json', ...noCache });
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // --- UI ---
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = await readFile(INDEX, 'utf8');
      return send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', ...noCache });
    }

    // --- The full gallery (read fresh every time) ---
    if (req.method === 'GET' && url.pathname === '/api/gallery') {
      const items = JSON.parse(await readFile(GALLERY, 'utf8'));
      return sendJson(res, 200, { items });
    }

    // --- Previously-saved flags (so you can resume a session) ---
    if (req.method === 'GET' && url.pathname === '/api/selections') {
      if (!existsSync(SELECTIONS)) return sendJson(res, 200, { flagged: [] });
      const data = JSON.parse(await readFile(SELECTIONS, 'utf8'));
      return sendJson(res, 200, data);
    }

    // --- Persist flags (autosaved by the UI on every change) ---
    if (req.method === 'POST' && url.pathname === '/api/save') {
      const body = JSON.parse(await readBody(req));
      const flagged = Array.isArray(body.flagged) ? body.flagged : [];
      const payload = { generatedAt: new Date().toISOString(), flagged };
      await writeFile(SELECTIONS, JSON.stringify(payload, null, 2) + '\n');
      return sendJson(res, 200, { ok: true, count: flagged.length });
    }

    return sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: String(err && err.message || err) });
  }
});

server.listen(PORT, () => {
  const link = `http://localhost:${PORT}`;
  console.log(`\n  Gallery Curation Tool running at ${link}`);
  console.log('  Browse the gallery, flag corrupted/ugly pieces, then return to Claude.');
  console.log('  Your flags autosave to curation/selections.json.\n');
  console.log('  Press Ctrl+C to stop.\n');
  if (!process.env.NO_OPEN) openBrowser(link);
});

function openBrowser(link) {
  const cmd = platform() === 'darwin' ? 'open'
    : platform() === 'win32' ? 'cmd'
    : 'xdg-open';
  const args = platform() === 'win32' ? ['/c', 'start', '', link] : [link];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    // Non-fatal — just open the link yourself.
  }
}
