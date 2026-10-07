#!/usr/bin/env node
// The upcoming real paintings, read from the monthly catalog (catalog.json): the
// works not yet in gallery.json and not vetoed in blocklist.txt, ranked by fame
// taking turns by wing. No network. See curation/real-art/README.md.
//
//   node curation/real-art/queue.mjs                                  # print the next 40
//   node curation/real-art/queue.mjs --out /tmp/lart-candidates.json  # the nightly's candidates
//   node curation/real-art/queue.mjs --markdown                       # rewrite QUEUE.md
//
// Fails when the catalog is missing or unreadable. Warns, and carries on, when
// it's older than 34 days or was built under an older legal gate.

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  ageDays, CatalogError, catalogWarnings, QUEUE_MD, queueLine, queueMarkdown, readBlocklist, readCatalog, upcoming,
} from './catalog.mjs'
import { log, parseArgs } from './lib.mjs'
import { GALLERY, readGallery, ROOT } from './search.mjs'

const USAGE = `usage: node curation/real-art/queue.mjs [--out <file.json>] [--limit N] [--markdown]

  (no flags)   print the next --limit works (default 40).
  --out        write the next --limit works (default 80) as a JSON array, the
               candidates file frame-painting.mjs reads.
  --markdown   rewrite curation/real-art/QUEUE.md.`

function die(msg) {
  process.stderr.write(`queue: ${msg}\n`)
  process.exit(1)
}

const opts = parseArgs(process.argv.slice(2), new Set(['markdown']), USAGE, die)
const limit = Number(opts.limit ?? (opts.out ? 80 : 40))
if (!Number.isInteger(limit) || limit < 1) die('--limit must be a positive integer')

let cat
try {
  cat = readCatalog()
} catch (e) {
  if (e instanceof CatalogError) die(`${e.message}. The nightly can't pick paintings without it: build it (curation/REAL_PAINTINGS_CATALOG.md).`)
  throw e
}
let gallery
try {
  gallery = readGallery()
} catch (e) {
  die(`can't read ${GALLERY}: ${e.message}`)
}
const { entries, bad } = readBlocklist()
const { queue, used, blocked } = upcoming(cat, { gallery, blocklist: entries })

const warnings = catalogWarnings(cat)
for (const b of bad) warnings.push(`blocklist.txt ${b} isn't an object_id, a Wikidata QID or a URL, so it blocks nothing.`)
if (queue.length < 40) warnings.push(`only ${queue.length} works are left in the catalog. Refresh it: see curation/REAL_PAINTINGS_CATALOG.md.`)
if (!queue.length) die('no works are left in the catalog: every one is in the gallery or blocked. Refresh it.')
const warn = () => { for (const w of warnings) log(`WARNING: ${w}`) }

warn()
log(`queue: catalog of ${cat.built_at.slice(0, 10)} (${Math.floor(ageDays(cat))} days old), ${cat.works.length} works: ${used.length} in the gallery, ${blocked.length} blocked, ${queue.length} to come`)

if (opts.markdown) {
  writeFileSync(QUEUE_MD, queueMarkdown(cat, { queue, used, blocked }))
  log(`  wrote ${path.relative(ROOT, QUEUE_MD)}`)
}
if (opts.out) {
  writeFileSync(path.resolve(opts.out), `${JSON.stringify(queue.slice(0, limit), null, 2)}\n`)
  log(`  wrote the next ${Math.min(limit, queue.length)} to ${opts.out}`)
  for (const [i, c] of queue.slice(0, 15).entries()) log(queueLine(c, i))
} else if (!opts.markdown) {
  for (const [i, c] of queue.slice(0, limit).entries()) process.stdout.write(`${queueLine(c, i)}\n`)
}
// Say it again at the end, where a long listing can't bury it.
if (warnings.length && (opts.out || !opts.markdown)) warn()
