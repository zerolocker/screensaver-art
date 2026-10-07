// node --test curation/real-art/
// Offline tests for the catalog the nightly reads: the blocklist, gallery dedup,
// the queue's order, staleness, and the QUEUE.md view.

import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  blockedBy, CatalogError, catalogWarnings, MAX_AGE_DAYS, parseBlocklist, queueMarkdown, queueTable, readCatalog, thumbUrl, upcoming,
} from './catalog.mjs'

const work = (object_id, extra = {}) => ({
  source: 'real_artwork', artist: 'Some Painter', artist_dates: '1800–1870', original_title: `Work ${object_id}`, original_date: '1850',
  museum: 'A Museum', credit_line: null, source_url: `https://example.org/${object_id}`, license: 'Public Domain',
  object_id, image_url: null, width: 4000, height: 3000, aspect: 1.333, classification: 'Painting', medium: 'oil on canvas',
  wing: '19th Century', fame: { wikipedia_langs: 0, highlight: false }, clearance: { pass: true, reasons: [], evidence: {} }, qid: null,
  ...extra,
})
const cat = (works, extra = {}) => ({ built_at: '2026-10-01T09:00:00.000Z', gate: { clearance_sha256: 'abc' }, works, ...extra })
const DAY = 24 * 60 * 60 * 1000

test('the blocklist: object IDs, Wikidata QIDs and URLs, each with a reason', () => {
  const { entries, bad } = parseBlocklist([
    '# Works the nightly never picks.',
    '',
    'rijks:SK-C-5   # too dark for the wall',
    'wd:q12418',
    'Q151047 # nudity',
    'https://www.artic.edu/artworks/27992/a-sunday-on-la-grande-jatte-1884  # done better elsewhere',
    'the scream',
  ].join('\n'))
  assert.equal(entries.get('rijks:SK-C-5'), 'too dark for the wall')
  assert.equal(entries.get('wd:Q12418'), 'no reason given')
  assert.equal(entries.get('wd:Q151047'), 'nudity')
  assert.equal(entries.get('url:artic.edu/artworks/27992'), 'done better elsewhere')
  assert.deepEqual(bad, ['line 7: "the scream"'])
})

test('a wd: entry also blocks museum copies of the same work', () => {
  const { entries } = parseBlocklist('wd:Q12418 # no\nhttps://example.org/aic:1 # by URL')
  assert.equal(blockedBy(work('wd:Q12418'), entries), 'no')
  assert.equal(blockedBy(work('met:436535', { qid: 'Q12418' }), entries), 'no')
  assert.equal(blockedBy(work('aic:1'), entries), 'by URL')
  assert.equal(blockedBy(work('met:1', { qid: 'Q1' }), entries), null)
})

test('the queue skips works in the gallery or blocked, and re-ranks the rest by wing', () => {
  const works = [
    work('aic:1', { fame: { wikipedia_langs: 40, highlight: false }, wing: '19th Century' }),
    work('aic:2', { fame: { wikipedia_langs: 30, highlight: false }, wing: '19th Century' }),
    work('aic:3', { fame: { wikipedia_langs: 20, highlight: false }, wing: '19th Century' }),
    work('aic:4', { fame: { wikipedia_langs: 12, highlight: false }, wing: 'Japanese' }),
    work('aic:5', { fame: { wikipedia_langs: 11, highlight: false }, wing: 'Japanese' }),
    work('aic:6', { fame: { wikipedia_langs: 2, highlight: false }, wing: 'Japanese' }),
    // Taken from Commons; the gallery has the same work from a museum.
    work('wd:Q9', { artist: 'Katsushika Hokusai', original_title: 'The Great Wave off Kanagawa', fame: { wikipedia_langs: 90, highlight: false }, wing: 'Japanese' }),
  ]
  const gallery = [
    { source: 'real_artwork', source_url: 'https://example.org/aic:1', artist: 'Some Painter', original_title: 'Work aic:1' },
    { source: 'real_artwork', source_url: 'https://www.metmuseum.org/art/collection/search/45434', artist: 'Katsushika Hokusai', original_title: 'The Great Wave off Kanagawa' },
  ]
  const { entries } = parseBlocklist('aic:3 # no')
  const { queue, used, blocked } = upcoming(cat(works), { gallery, blocklist: entries })
  // aic:1 is used, so aic:2 is now its wing's best and leads round 1 with aic:4.
  assert.deepEqual(queue.map((w) => w.object_id), ['aic:2', 'aic:4', 'aic:5', 'aic:6'])
  assert.deepEqual(queue.map((w) => w.fame.wing_rank), [1, 1, 2, 3])
  assert.deepEqual(used.map((u) => [u.work.object_id, u.why]), [['aic:1', 'already in gallery.json'], ['wd:Q9', 'same work as a gallery.json piece']])
  assert.deepEqual(blocked.map((b) => b.work.object_id), ['aic:3'])
  // The catalog itself is untouched.
  assert.equal(works[1].fame.wing_rank, undefined)
})

test('a museum work matches a gallery piece taken from Commons', () => {
  const gallery = [{ source: 'real_artwork', source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', artist: 'Claude Monet', original_title: 'Garden at Sainte-Adresse' }]
  const { queue, used } = upcoming(cat([work('met:437133', { artist: 'Claude Monet', original_title: 'Garden at Sainte-Adresse' })]), { gallery })
  assert.equal(queue.length, 0)
  assert.equal(used[0].why, 'same work as a gallery.json piece')
})

test('a missing or broken catalog fails; an old one only warns', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lart-catalog-test-'))
  assert.throws(() => readCatalog(path.join(dir, 'catalog.json')), (e) => e instanceof CatalogError && /no catalog/.test(e.message))
  writeFileSync(path.join(dir, 'broken.json'), '{"works": [')
  assert.throws(() => readCatalog(path.join(dir, 'broken.json')), (e) => e instanceof CatalogError && /valid JSON/.test(e.message))
  writeFileSync(path.join(dir, 'empty.json'), '{}')
  assert.throws(() => readCatalog(path.join(dir, 'empty.json')), CatalogError)

  const c = cat([])
  const built = Date.parse(c.built_at)
  assert.deepEqual(catalogWarnings(c, { now: built + MAX_AGE_DAYS * DAY, gate: 'abc' }), [])
  const old = catalogWarnings(c, { now: built + (MAX_AGE_DAYS + 1) * DAY, gate: 'abc' })
  assert.equal(old.length, 1)
  assert.match(old[0], /35 days old \(built 2026-10-01\), over the 34-day limit/)
  assert.match(catalogWarnings(c, { now: built, gate: 'def' })[0], /clearance\.mjs has changed/)
})

test('thumbnails come from each source\'s own small rendition', () => {
  const t = (object_id, image_url, source_url) => thumbUrl(work(object_id, { image_url, source_url }))
  assert.equal(t('aic:27992', 'https://www.artic.edu/iiif/2/abc/full/3000,/0/default.jpg'), 'https://www.artic.edu/iiif/2/abc/full/330,/0/default.jpg')
  assert.equal(t('nga:1', 'https://api.nga.gov/iiif/x/full/full/0/default.jpg'), 'https://api.nga.gov/iiif/x/full/330,/0/default.jpg')
  assert.equal(t('met:1', 'https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg'), 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg')
  assert.equal(t('cma:1', 'https://openaccess-cdn.clevelandart.org/1958.31/1958.31_print.jpg'), 'https://openaccess-cdn.clevelandart.org/1958.31/1958.31_web.jpg')
  assert.equal(t('wd:Q1', 'https://upload.wikimedia.org/x.jpg', 'https://commons.wikimedia.org/wiki/File:A_(1889).jpg'),
    'https://commons.wikimedia.org/wiki/Special:FilePath/A_(1889).jpg?width=330')
  assert.equal(t('aic:2', null), null)
})

test('QUEUE.md escapes text from museums and Wikidata', () => {
  const w = work('wd:Q1', {
    original_title: 'A | B <script>', artist: 'X_Y [Z]', source_url: 'https://commons.wikimedia.org/wiki/File:A_(1).jpg', image_url: 'https://upload.wikimedia.org/a.jpg',
    fame: { wikipedia_langs: 12, highlight: true },
  })
  const row = queueTable([w]).split('\n')[2]
  assert.match(row, /A \\\| B &lt;script&gt;/)
  assert.match(row, /X\\_Y \\\[Z\\\]/)
  assert.match(row, /\(https:\/\/commons\.wikimedia\.org\/wiki\/File:A_%281%29\.jpg\)/)
  assert.match(row, /\| 12 ★ \| `wd:Q1` \|$/)
  const page = queueMarkdown(cat([w]), { queue: [w], used: [], blocked: [] })
  assert.match(page, /1 works to come\. The catalog was built on 2026-10-01 and holds 1 works/)
})
