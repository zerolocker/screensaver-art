#!/usr/bin/env node
// Build (or top up) the social-clip music library — the one-off job behind
// `make-social-assets.mjs --audio`.
//
// For every bed in marketing/beds.json that has no MP3 yet: generate it with the
// `lyria-music-gen` skill, upload it to R2 under an immutable key, and write the
// public URL back into the manifest. Beds are then fetched (and cached) on
// demand by anyone who renders clips — including a fresh clone, which is the
// point of putting them on R2 instead of in git.
//
// This is deliberately NOT part of the nightly run. A handful of beds reused
// across clips is indistinguishable from a fresh track per clip to anyone
// watching, so re-generating nightly would be a standing API bill for nothing.
// Run it once; run it again only to add or replace a bed.
//
//   bash curation/with-secrets.sh GEMINI_API_KEY -- node marketing/make-beds.mjs
//
// (The R2 upload shells out to wrangler through with-secrets.sh itself, so
// CLOUDFLARE_API_TOKEN is picked up without being passed in by hand.)
//
// Flags:
//   --only <id>   just this bed
//   --force       regenerate + re-upload even if the bed already has a URL
//   --dry-run     say what would happen; generate nothing, upload nothing
//   --keep        keep the local MP3 after upload (it is cached there anyway)
//
// Requires: python with the google-genai SDK (the skill's own requirement).
// NEVER commit the MP3s — CLAUDE.md → Repo rules.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { BEDS_CACHE, BEDS_R2_PREFIX, bedCachePath, bedUrl, loadBeds, writeBeds } from './lib/beds.mjs'
import { REPO_ROOT } from './lib/pieces.mjs'

const BUCKET = 'screensaver-assets'
const SKILL = path.join(REPO_ROOT, '.claude/skills/lyria-music-gen/scripts/generate.py')

const argv = process.argv.slice(2)
const opts = { only: null, force: false, dryRun: false, keep: false }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--only') opts.only = argv[++i]
  else if (a === '--force') opts.force = true
  else if (a === '--dry-run') opts.dryRun = true
  else if (a === '--keep') opts.keep = true
  else if (a === '--help' || a === '-h') {
    process.stdout.write('usage: node marketing/make-beds.mjs [--only <id>] [--force] [--dry-run] [--keep]\n')
    process.exit(0)
  } else die(`unexpected argument "${a}"`)
}

function die(msg) {
  process.stderr.write(`make-beds: ${msg}\n`)
  process.exit(1)
}

/** wrangler, wrapped the same way curation/publish-piece.mjs wraps it. */
function wrangler(args) {
  const r = spawnSync('bash', [
    path.join(REPO_ROOT, 'curation/with-secrets.sh'), 'CLOUDFLARE_API_TOKEN', '--',
    'npx', '--yes', 'wrangler', 'r2', 'object', ...args,
  ], { encoding: 'utf8' })
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') }
}

const beds = loadBeds()
if (beds.length === 0) die('marketing/beds.json has no beds to build')

const todo = beds.filter((b) => (opts.only ? b.id === opts.only : true))
if (opts.only && todo.length === 0) die(`no bed with id "${opts.only}"`)

mkdirSync(BEDS_CACHE, { recursive: true })
let built = 0
let failed = 0

for (const bed of todo) {
  const key = `${BEDS_R2_PREFIX}/${bed.id}.mp3`
  const file = bedCachePath(bed.id)

  if (bed.url && !opts.force) {
    process.stdout.write(`• ${bed.id} — already published, skipping (--force to rebuild)\n`)
    continue
  }
  if (!bed.prompt) { process.stderr.write(`✗ ${bed.id} — no prompt in beds.json\n`); failed++; continue }
  // The one thing that must never slip through: Lyria sings by default, and a
  // sung bed under the art would be unusable (and a wasted paid call). The skill
  // enforces this too — belt and braces, because this runs unattended.
  if (!/instrumental/i.test(bed.prompt)) {
    process.stderr.write(`✗ ${bed.id} — prompt must say "instrumental, no vocals" (Lyria sings by default)\n`)
    failed++
    continue
  }

  if (opts.dryRun) {
    process.stdout.write(`• ${bed.id} — would generate → upload to ${BUCKET}/${key}\n`)
    continue
  }

  process.stdout.write(`• ${bed.id} — generating…\n`)
  const gen = spawnSync('bash', [
    path.join(REPO_ROOT, 'curation/with-secrets.sh'), 'GEMINI_API_KEY', '--',
    'python3', SKILL, '--prompt', bed.prompt, '--out', file, '--model', bed.model || 'clip',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  // Non-zero also means "Lyria sang" — the skill writes the audio anyway but
  // fails the run so automation can't ship vocals. Either way, don't publish it.
  if (gen.status !== 0 || !existsSync(file) || statSync(file).size === 0) {
    process.stderr.write(`✗ ${bed.id} — generation failed (exit ${gen.status})\n`)
    failed++
    continue
  }

  const exists = wrangler(['get', `${BUCKET}/${key}`, '--file=/dev/null', '--remote']).ok
  if (exists && !opts.force) {
    process.stderr.write(`✗ ${bed.id} — ${key} already on R2; pick a new id or pass --force\n`)
    failed++
    continue
  }
  const put = wrangler([
    'put', `${BUCKET}/${key}`, `--file=${file}`, '--remote',
    '--cache-control', 'public, max-age=31536000, immutable',
    '--content-type', 'audio/mpeg',
  ])
  if (!put.ok) { process.stderr.write(`✗ ${bed.id} — upload failed:\n${put.out}\n`); failed++; continue }

  bed.url = bedUrl(bed.id)
  bed.bytes = statSync(file).size
  bed.generatedAt = new Date().toISOString()
  writeBeds(beds)
  process.stdout.write(`  ✓ ${bed.url} (${(bed.bytes / 1e3).toFixed(0)} kB)\n`)
  built++
}

process.stdout.write(`Done: ${built} built, ${failed} failed.\n`)
if (failed) process.exit(1)
