// The largest public-domain scan of a painting on Wikimedia Commons. The file
// Wikidata links (P18) is sometimes an old small scan while Commons holds a far
// larger one. Candidates are the files whose structured data says they
// represent (P6243) or depict (P180) the painting, the files in its own Commons
// category, and P18. Only faithful scans of the whole painting are kept:
// structured data that says the file represents this painting (or a known scan
// source), public domain, a bitmap, the painting's shape, and nothing in the
// title, description or categories that says detail, frame, copy and so on.

import { commonsLicence, MIN_LONG_EDGE } from './clearance.mjs'
import { chunk, fold, log } from './lib.mjs'
import { sparql } from './wikidata.mjs'

export const ASPECT_TOLERANCE = 0.03 // a scan trimmed a little differently still matches
// The wall is 3840 px wide: a larger file can't improve the still, so a P18
// this big is kept without a search.
export const ENOUGH_EDGE = 3840
const NEAR_TIE = 0.9 // within 10% of the largest area, a known source wins
const MAX_CHECKED = 12 // licence lookups per painting, largest first
const BITMAPS = new Set(['image/jpeg', 'image/png', 'image/tiff', 'image/webp'])

// Words in a file name that mean it isn't a faithful scan of the whole painting.
// A word also in the painting's own title doesn't count ("Fragment of an Altarpiece").
const NOT_A_SCAN = [
  'details?', 'détails?', 'detalles?', 'detalhes?', 'dettagli[oi]?', 'ausschnitt', 'teilansicht',
  'crop', 'cropped', 'headcrop', 'recadr\\w*', 'fragments?', 'fragmento', 'frammento',
  'frame', 'framed', 'frames', 'cadre', 'encadr\\w*', 'rahmen', 'gerahmt',
  'x-?ray', 'radiograph\\w*', 'röntgen\\w*', 'infra-?red', 'infrarouge', 'irr', 'reflectogra\\w*', 'ultraviolet', 'uv', 'raking',
  'verso', 'reverse', 'rückseite', 'revers',
  'copy', 'copie', 'kopie', 'copia', 'replica', 'réplique', 'réplica', 'd.après',
  'engraving', 'gravure', 'kupferstich', 'lithograph\\w*', 'etching', 'print', 'postcard', 'stamp', 'poster', 'puzzle', 'tapestry', 'mosaic',
  'sketch', 'study', 'étude', 'studie', 'bozzetto',
  'exhibition', 'ausstellung', 'exposition', 'installation', 'in situ', 'room view', 'gallery view', 'visitors',
  'edit', 'edited', 'bearbeitet', 'retouched', 'modified', 'modifié', 'enhanced', 'colou?ri[sz]ed', 'restored', 'restoration', 'digitally',
  'upscaled?', 'ai', 'esrgan', 'waifu2x', 'wallpaper', '4k', '8k',
  'black and white', 'b&w', 'bw', 'gr[ae]yscale', 'monochrome',
]
const NOT_A_SCAN_RE = new RegExp(String.raw`(?<![\p{L}\p{N}])(${NOT_A_SCAN.join('|')})(?![\p{L}\p{N}])`, 'giu')
const TILE = /-x\d+-y\d+\.\w+$/i // a tile of a gigapixel Google Art Project scan
// A gallery snapshot, not a scan: a camera's file name or a date stamp.
const CAMERA = /(^|[^\p{L}])(IMG|DSC[FN]?|PXL|_MG)[_ -]?\d{3,}|^P\d{7}|\b(19|20)\d\d(0[1-9]|1[0-2])[0-3]\d\b|\b[0-3]\d[-.](0[1-9]|1[0-2])[-.](19|20)\d\d\b/iu
const NOT_A_SCAN_DESC = /\b(detail|ausschnitt|détail|detalle|dettaglio)\s+(of|from|de|du|des|aus|di|del|della|dal|dall|dalla)\b|\((detail|crop|cropped)\)|^\s*(detail|crop)\b|\bcropped\b|\b(in|with|including) (its|the|a|original) (original )?frame\b|\bx-?ray\b|\binfrared\b|\breflectogra|\bverso\b|\breverse side\b|\bcopy (after|of)\b|\b(engrav(ing|ed)|gravée?|estampe|lithograph)|\bphotograph of the (room|gallery|exhibition)\b|\b(installation|exhibition) view\b|\bin situ\b|\bdigitally (restored|enhanced|altered|modified)\b|\bupscaled?\b/i
const NOT_A_SCAN_CATEGORY = /^(Copies|Replicas|Details|Crops|Fragments|Reproductions|Derivative works|Digitally (restored|altered|modified|enhanced)( versions)?|Upscaled|X-rays?|X-radiographs?|Infrared|Reflectograms?|Backs|Reverses?|Versos?|Prints|Engravings|Etchings|Lithographs|Drawings|Studies|Sketches|Photographs) (of|after|from|by)\b|^Artworks without Wikidata item$|\b(details of|in frames?|with frames?|framed paintings|exhibitions?|installation views?|in situ)\b|\(book\)|AI-generated|upscaled/i
// A category for many works, not this one ("Paintings by Rembrandt in the Louvre").
const BROAD_CATEGORY = /^(Paintings|Works|Portraits|Artworks|Pictures|Drawings|Images|Files|Media) (by|in|of|from|at)\b/i
const KNOWN_SOURCES = [
  { label: 'Google Art Project', re: /Google Art Project|Google Arts (&|and) Culture/i },
  { label: 'C2RMF', re: /C2RMF/ },
  { label: 'museum', re: /^(Images|Files|Media|Scans) (from|of|provided by|released by|donated by) (the )?.*(museum|museo|musée|museu|gallery|galleria|galerie|rijksmuseum|nationalmuseum|kunst|pinakothek|hermitage|prado|louvre)/i },
]

const STOP = new Set(['the', 'and', 'with', 'from', 'of', 'des', 'der', 'die', 'das', 'les', 'del', 'della', 'portrait', 'painting'])
const words = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !STOP.has(w))
const fileWords = (f) => fold(f.replace(/\.\w+$/, '')).split(/[^\p{L}\p{N}]+/u)
const area = (i) => (i.width || 0) * (i.height || 0)
const longEdge = (i) => Math.max(i.width || 0, i.height || 0)
const px = (n) => `${n.toLocaleString('en-US')} px`

/** The first of these shapes ({of, aspect}, width / height) that w×h has, within the tolerance, or null. */
export function aspectMatch(width, height, refs, tol = ASPECT_TOLERANCE) {
  if (!width || !height) return null
  const a = width / height
  return refs.find((r) => r.aspect > 0 && Math.abs(Math.log(a / r.aspect)) <= Math.log(1 + tol)) || null
}

/** The painting's shapes: its P18 file's, and its recorded size (P2049 width / P2048 height). */
export function referenceAspects(p18, dims = {}) {
  const refs = p18?.width && p18?.height ? [{ of: 'P18', aspect: p18.width / p18.height }] : []
  for (const w of dims.widths || []) for (const h of dims.heights || []) if (w > 0 && h > 0) refs.push({ of: 'recorded size', aspect: w / h })
  return refs
}

/** Why a file name says it isn't a whole-painting scan, or null. */
export function titleProblem(file, label = '') {
  if (TILE.test(file)) return 'a tile of a larger scan'
  if (CAMERA.test(file)) return 'a camera snapshot'
  const own = new Set(fileWords(label || ''))
  const name = file.replace(/\.\w+$/, '').replace(/[_]+/g, ' ')
  for (const m of name.matchAll(NOT_A_SCAN_RE)) {
    const w = fold(m[1])
    if (!w.split(/\s+/).every((x) => own.has(x))) return `its name says "${m[1]}"`
  }
  return null
}

/**
 * The cheap screen on name, format, size and shape, before any licence lookup.
 * c = {file, width, height, mime}. Returns why it's out, or null.
 */
export function screen(c, { refs, label, minArea = 0 }) {
  if (!BITMAPS.has(c.mime)) return `not a bitmap (${c.mime || 'unknown type'})`
  if (longEdge(c) < MIN_LONG_EDGE) return `${px(longEdge(c))}, under ${MIN_LONG_EDGE}`
  if (area(c) <= minArea) return 'no larger than P18'
  if (!aspectMatch(c.width, c.height, refs)) return `shape ${(c.width / c.height).toFixed(3)} isn't the painting's (${refs.map((r) => r.aspect.toFixed(3)).join(', ') || 'unknown'})`
  return titleProblem(c.file, label)
}

/**
 * After the lookups: what the file's structured data says it represents
 * (P6243, `info.represents`), its licence, categories and description.
 * Returns why it's out, or null.
 */
export function vet(info, qid) {
  const reps = info.represents || []
  // "Digital representation of" (P6243) is Commons' claim that the file is a
  // faithful reproduction of exactly this work. Without it, depicts (P180) and
  // the category also catch photos of rooms, other versions and prints after it.
  if (reps.length && !reps.includes(qid)) return `its structured data says it represents ${reps.join(', ')}`
  if (!reps.length && !knownSource(info)) return `its structured data doesn't say it represents ${qid}, and it isn't from a known scan source`
  const lic = commonsLicence(info)
  if (!lic.ok) return lic.why
  const cat = (info.categories || []).find((x) => NOT_A_SCAN_CATEGORY.test(x))
  if (cat) return `it's in "Category:${cat}"`
  const d = String(info.description || '').match(NOT_A_SCAN_DESC)
  if (d) return `its description says "${d[0]}"`
  return null
}

export function knownSource(info) {
  const text = [info.file, ...(info.categories || [])]
  return KNOWN_SOURCES.find((s) => text.some((t) => s.re.test(t)))?.label || null
}

/**
 * Pick the scan of painting `qid`. p18 = the P18 file's imageinfo (or null);
 * candidates = other files with full imageinfo and `represents`, already
 * screened. The largest that passes vet() wins; within NEAR_TIE of it, a known
 * source, then P18, comes first. Returns {info, why, upgraded, rejected[]}.
 */
export function pickScan({ qid, p18, candidates }) {
  const rejected = []
  const ok = []
  const p18ok = p18 ? commonsLicence(p18).ok : false
  if (p18 && p18ok) ok.push(p18)
  for (const c of candidates) {
    const why = vet(c, qid)
    if (why) rejected.push({ file: c.file, why })
    else ok.push(c)
  }
  if (!ok.length) return { info: p18, why: `no public-domain scan of the whole painting among ${candidates.length + (p18 ? 1 : 0)} checked`, upgraded: false, rejected }
  const top = Math.max(...ok.map(area))
  const rank = (i) => (knownSource(i) ? 2 : i === p18 ? 1 : 0)
  const near = ok.filter((i) => area(i) >= NEAR_TIE * top).sort((a, b) => rank(b) - rank(a) || area(b) - area(a))
  const info = near[0]
  if (info === p18) return { info, why: `P18 (${px(longEdge(p18))}) is the largest public-domain scan`, upgraded: false, rejected }
  const src = knownSource(info)
  const scan = `a ${px(longEdge(info))} ${src ? `${src} ` : ''}scan`
  const was = !p18 ? 'no P18 file' : !p18ok ? `P18 isn't public domain (${p18.LicenseShortName || p18.License || 'no licence'})` : `P18 is ${px(longEdge(p18))}`
  return { info, why: `${was}; using ${scan}`, upgraded: true, rejected }
}

// ---- Commons and Wikidata --------------------------------------------------

/** Each painting's own Commons categories and recorded size, from Wikidata. */
async function paintingRefs(qids) {
  const out = new Map(qids.map((q) => [q, { categories: new Set(), heights: [], widths: [] }]))
  for (const part of chunk(qids, 100)) {
    // P518 ("applies to part") marks a frame's or a support's size.
    for (const r of await sparql(`SELECT ?item ?cat ?h ?w WHERE { VALUES ?item { ${part.map((q) => `wd:${q}`).join(' ')} }
  { ?item wdt:P373 ?cat }
  UNION { ?sl schema:about ?item ; schema:isPartOf <https://commons.wikimedia.org/> ; schema:name ?n . FILTER(STRSTARTS(?n, "Category:")) BIND(STRAFTER(?n, "Category:") AS ?cat) }
  UNION { ?item p:P2048 ?hs . ?hs psn:P2048/wikibase:quantityAmount ?h . FILTER NOT EXISTS { ?hs pq:P518 [] } }
  UNION { ?item p:P2049 ?ws . ?ws psn:P2049/wikibase:quantityAmount ?w . FILTER NOT EXISTS { ?ws pq:P518 [] } }
}`)) {
      const ref = out.get(r.item.replace(/^.*\//, ''))
      if (!ref) continue
      if (r.cat && !BROAD_CATEGORY.test(r.cat)) ref.categories.add(r.cat)
      if (r.h) ref.heights.push(Number(r.h))
      if (r.w) ref.widths.push(Number(r.w))
    }
  }
  return out
}

/** Files (with size and type) from a generator query; at most one page of them. */
async function filesFrom(api, params) {
  const d = await api({ action: 'query', prop: 'imageinfo', iiprop: 'size|mime', ...params })
  return (d.query?.pages || []).filter((p) => p.imageinfo?.[0]).map((p) => ({
    file: p.title.replace(/^File:/, ''), pageid: p.pageid, width: p.imageinfo[0].width, height: p.imageinfo[0].height, mime: p.imageinfo[0].mime,
  }))
}

/** What each file's structured data says it is a digital representation of (P6243), by page ID. */
async function representations(api, pageids) {
  const out = new Map()
  for (const part of chunk([...new Set(pageids)], 50)) {
    const d = await api({ action: 'wbgetentities', ids: part.map((id) => `M${id}`).join('|'), props: 'claims' })
    for (const id of part) {
      const e = d.entities?.[`M${id}`]
      const st = e?.statements || e?.claims || {}
      out.set(id, (st.P6243 || []).map((s) => s.mainsnak?.datavalue?.value?.id).filter(Boolean))
    }
  }
  return out
}

/**
 * items = [{qid, label, p18: imageinfo or null}]. `api` is a Commons API call and
 * `imageInfo` the cached imageinfo lookup (commons.mjs). Returns
 * Map(qid -> {info, scan}) for every item searched.
 */
export async function findScans(items, { api, imageInfo }) {
  const out = new Map()
  if (!items.length) return out
  const refs = await paintingRefs(items.map((it) => it.qid))
  const pending = []
  for (const it of items) {
    const ref = refs.get(it.qid)
    const shapes = referenceAspects(it.p18, ref)
    const found = new Map()
    const add = (list, via) => {
      for (const f of list) {
        if (f.file === it.p18?.file) continue
        const prev = found.get(f.file)
        if (prev) prev.via.add(via)
        else found.set(f.file, { ...f, via: new Set([via]) })
      }
    }
    // WCQS needs a login, so search Commons' structured data directly.
    add(await filesFrom(api, { generator: 'search', gsrnamespace: '6', gsrlimit: '100', gsrsearch: `haswbstatement:P6243=${it.qid}|P180=${it.qid}` }), 'structured data')
    for (const cat of ref.categories) {
      add(await filesFrom(api, { generator: 'categorymembers', gcmtitle: `Category:${cat}`, gcmtype: 'file', gcmlimit: '500' }), 'category')
    }
    const minArea = it.p18 && commonsLicence(it.p18).ok ? area(it.p18) : 0
    const own = new Set(words(it.label || ''))
    const screened = []
    for (const c of found.values()) {
      let why = screen(c, { refs: shapes, label: it.label, minArea })
      // Structured data names the painting; a category file must at least name it too.
      if (!why && !c.via.has('structured data') && own.size && !fileWords(c.file).some((w) => own.has(w))) why = "its name doesn't mention the painting"
      if (!why) screened.push(c)
    }
    screened.sort((a, b) => area(b) - area(a))
    pending.push({ it, shapes, found: found.size, screened: screened.slice(0, MAX_CHECKED) })
  }
  const screened = pending.flatMap((p) => p.screened)
  const reps = await representations(api, screened.map((c) => c.pageid))
  const infos = await imageInfo(screened.map((c) => c.file))
  for (const { it, shapes, found, screened: mine } of pending) {
    const candidates = mine.map((c) => {
      const info = infos.get(c.file)
      return info && { ...info, via: [...c.via], represents: reps.get(c.pageid) || [] }
    }).filter(Boolean)
    const pick = pickScan({ qid: it.qid, p18: it.p18, candidates })
    if (!pick.info) continue
    const chosen = pick.upgraded ? candidates.find((c) => c.file === pick.info.file) : null
    out.set(it.qid, {
      info: pick.info,
      scan: {
        file: pick.info.file, why: pick.why, upgraded: pick.upgraded, via: chosen ? chosen.via : ['P18'],
        represents: chosen ? chosen.represents : null,
        shape_of: pick.upgraded ? aspectMatch(pick.info.width, pick.info.height, shapes).of : 'P18',
        p18: it.p18 ? { file: it.p18.file, width: it.p18.width, height: it.p18.height } : null,
        candidates: found, checked: candidates.length,
        shapes: shapes.map((s) => ({ of: s.of, aspect: Number(s.aspect.toFixed(3)) })),
        rejected: pick.rejected.slice(0, 5),
      },
    })
  }
  const up = [...out.values()].filter((s) => s.scan.upgraded).length
  log(`  commons: searched ${items.length} paintings for a larger scan; ${up} upgraded`)
  return out
}
