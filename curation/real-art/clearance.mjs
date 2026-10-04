// The copyright gate — dumb, strict and auditable on its own (REAL_PAINTINGS_CURATION.md
// §0 + §4). Every candidate gets `clearance: {pass, reasons[], evidence{}}`.
//
//   1. Licence: the museum's own flag is exactly Public Domain / CC0.
//   2. Life+70: every identified artist died <= (this year - 71); an anonymous work
//      must be dated < 1900. Unknown death year -> we only pass if it is *physically
//      certain* the person died by the cutoff (born / active / made the work long
//      enough ago), else reject.
//   3. Flat art only: paintings, prints, drawings, watercolours (no 3-D objects, whose
//      photos can carry their own copyright; no photographs, by product choice).
//   4. Image long edge >= 2000 px.
//
// When in doubt we reject — eligible works are plentiful, a wrong pass is not.

export const TERM_YEARS = 70 // life + 70 (US/EU)
export const ANON_BEFORE = 1900 // anonymous works: object end date must be < this
export const MAX_LIFESPAN = 110 // nobody verifiably outlives this
export const MIN_WORKING_AGE = 10 // nobody made a museum piece younger than this
export const APPROX_MARGIN = 10 // "c. 1950" could be 1960
export const MIN_LONG_EDGE = 2000

/** Life+70 expires at the end of the 70th calendar year: in 2026 -> died <= 1955. */
export const cutoffYear = (year = new Date().getFullYear()) => year - TERM_YEARS - 1

// ---- 1. licence ------------------------------------------------------------

export const LICENSE_RULES = {
  aic: { field: 'is_public_domain', want: 'true', ok: (v) => v === true, label: 'Public Domain' },
  met: { field: 'isPublicDomain', want: 'true', ok: (v) => v === true, label: 'CC0' },
  cma: { field: 'share_license_status', want: '"CC0"', ok: (v) => v === 'CC0', label: 'CC0' },
}

// ---- 2. life dates ---------------------------------------------------------

const QUAL = String.raw`c\.|ca\.|circa|about|approx\.|before|after`
const YR = String.raw`(\d{3,4})(?:\s*\/\s*(\d{1,4}))?` // 1628/29, 1434/5
const UNCERTAIN = String.raw`(\(\?\)|\?)?`

// "1848-1894", "c. 1480-c.1504", "1725 (?)-1770", "ca. 1540-after 1602",
// "active 1449-87", "active from 1427-died 1452", "active by 1465-died 1494",
// "active ca. 742-756", "before 1629-1657"
const SPAN_RE = new RegExp(
  String.raw`(?:\b(active|fl\.|flourished|working)\s+(?:(?:from|by|in)\s+)?)?(?:\b(${QUAL})\s*)?${YR}\s*${UNCERTAIN}` +
  String.raw`\s*-\s*(?:\b(${QUAL}|died|d\.)\s*)?(\d{1,4})(?:\s*\/\s*(\d{1,4}))?\s*${UNCERTAIN}`, 'gi')
const BORN_RE = new RegExp(String.raw`\b(?:born|b\.(?=\s*\d))[^\d\n;]{0,80}?(?:\b(${QUAL})\s*)?${YR}`, 'gi')
const DIED_RE = new RegExp(String.raw`\b(?:died|d\.(?=\s*\d))[^\d\n;]{0,80}?(?:\b(${QUAL})\s*)?${YR}\s*${UNCERTAIN}`, 'gi')
const ACTIVE_RE = new RegExp(String.raw`\b(?:active|fl\.|flourished|working)\s+(?:(?:from|by|in)\s+)?(?:\b(${QUAL})\s*)?(\d{3,4})s?`, 'gi')
const ACTIVE_CENTURY_RE = /\b(?:active|fl\.|flourished)\s+(?:in\s+(?:the\s+)?)?(?:(?:early|mid|late|first|second|third|last)[\s-]+(?:half|quarter)?[\s-]*(?:of\s+(?:the\s+)?)?)?(\d{1,2})(?:st|nd|rd|th)[\s-]+century/gi
// A span right after one of these is an era, not a lifetime: "Edo period (1615-1868)".
const ERA_BEFORE = /(period|dynasty|era|reign|kingdom|empire|shogunate|sultanate|style)[\s,:]*\(?\s*$/i

/** "1449" + "87" -> 1487; "1434" + "5" -> 1435. */
function expand(base, short) {
  if (short == null) return null
  const b = String(base)
  const n = short.length >= b.length ? Number(short) : Number(b.slice(0, b.length - short.length) + short)
  return n < Number(base) ? n + 10 ** short.length : n
}
const maxYear = (y, alt) => Math.max(Number(y), expand(y, alt) ?? Number(y))
const isApprox = (q, unc) => /^(c\.|ca\.|circa|about|approx\.)$/i.test(q || '') || !!unc

export const normLife = (s) =>
  String(s ?? '').replace(/[‐-―−]/g, '-').replace(/ /g, ' ')

/**
 * Pull every lifetime out of free text (AIC artist_display, Met artistDisplayBio,
 * CMA creators[].description). Each returned fact is one person:
 * {text, birth, birthApprox, death, deathApprox, deathAfter, floruit}.
 */
export function parseLifeFacts(raw) {
  const text = normLife(raw)
  const toks = []
  const scan = (re, kind) => {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      if (m[0].length === 0) { re.lastIndex++; continue }
      toks.push({ kind, m, start: m.index, end: m.index + m[0].length })
    }
  }
  scan(SPAN_RE, 'span')
  scan(DIED_RE, 'died')
  scan(BORN_RE, 'born')
  scan(ACTIVE_RE, 'active')
  scan(ACTIVE_CENTURY_RE, 'century')
  // Spans outrank everything ("born Newfoundland, 1858–1924" is a lifetime, not
  // a birth), then died/born/active; a token overlapping a kept one is dropped.
  const order = { span: 0, died: 1, born: 2, active: 3, century: 4 }
  toks.sort((a, b) => order[a.kind] - order[b.kind] || a.start - b.start)
  const kept = []
  for (const t of toks) {
    if (kept.some((k) => t.start < k.end && k.start < t.end)) continue
    if (t.kind === 'span' && ERA_BEFORE.test(text.slice(Math.max(0, t.start - 30), t.start))) continue
    kept.push(t)
  }
  kept.sort((a, b) => a.start - b.start)

  // Who a lifetime belongs to, for audit reasons: its line, plus the line above when
  // the lifetime sits on a bare "Japanese, 1760-1849" line under the name.
  const contextOf = (t) => {
    let s = text.lastIndexOf('\n', t.start - 1) + 1
    if (s > 0 && /^[^()]*,\s*$/.test(text.slice(s, t.start))) s = text.lastIndexOf('\n', s - 2) + 1
    const e = text[t.end] === ')' ? t.end + 1 : t.end
    return text.slice(s, e).replace(/\s*\n\s*/g, ' · ').replace(/[\s·]+$/, '').trim()
  }
  const people = []
  let prev = null
  const sameLine = (a, b) => !/\n/.test(text.slice(a.end, b.start))
  for (const t of kept) {
    const m = t.m
    const f = { text: m[0].trim(), context: contextOf(t), birth: null, birthApprox: false, death: null, deathApprox: false, deathAfter: null, floruit: null, floruitApprox: false, floruitEnd: null }
    if (t.kind === 'span') {
      const [, active, bq, b, b2, bunc, dq, d, d2, dunc] = m
      const dy = maxYear(expand(b, d), d2)
      // "1628/29", "1475/76": the gate uses the later year; the label keeps both.
      const dLabel = d2 != null ? `${expand(b, d)}/${d2}` : null
      if (active) {
        // A floruit span is a working life, not a lifetime: its end is no death.
        f.floruit = Number(b)
        f.floruitApprox = isApprox(bq, bunc)
        f.floruitBy = /\s+by\s/i.test(m[0])
        if (/^(died|d\.)$/i.test(dq || '')) { f.death = dy; f.deathApprox = isApprox(null, dunc); f.deathLabel = dLabel }
        else f.floruitEnd = dy
      } else {
        if (!/^after$/i.test(bq || '')) {
          f.birth = maxYear(b, b2); f.birthApprox = isApprox(bq, bunc)
          if (b2 != null) f.birthLabel = `${b}/${b2}`
        }
        if (/^after$/i.test(dq || '')) f.deathAfter = dy
        else { f.death = dy; f.deathApprox = isApprox(dq, dunc); f.deathLabel = dLabel }
      }
      people.push(f)
      prev = { f, tok: t }
      continue
    }
    if (t.kind === 'died') {
      const [, q, y, y2, unc] = m
      const target = prev && prev.f.death == null && prev.f.deathAfter == null && sameLine(prev.tok, t) ? prev.f : f
      if (/^after$/i.test(q || '')) target.deathAfter = maxYear(y, y2)
      else { target.death = maxYear(y, y2); target.deathApprox = isApprox(q, unc); target.deathLabel = y2 != null ? `${y}/${y2}` : null }
      if (target === f) { people.push(f); prev = { f, tok: t } } else { target.text += ` ${m[0].trim()}`; prev.tok = t }
      continue
    }
    if (t.kind === 'born') {
      const [, q, y, y2] = m
      if (!/^after$/i.test(q || '')) { f.birth = maxYear(y, y2); f.birthApprox = isApprox(q) }
    } else if (t.kind === 'active') {
      f.floruit = Number(m[2])
      f.floruitApprox = isApprox(m[1])
    } else {
      f.floruit = (Number(m[1]) - 1) * 100
    }
    people.push(f)
    prev = { f, tok: t }
  }
  return people
}

const ANON_NAME = /\b(unknown|unidentified|anonymous)\b/i
const QUALIFIER = /\b(attributed to|attributed|workshop|studio|school of|circle of|followers? of|manner of|style of|imitator of|copy after|copy of|possibly|probably)\b|\bafter\s+(?![\d(]|c\.|ca\.)\p{Lu}|(^|\s)\?(\s|$)/iu
// Contributors named in free text. Creative ones (whose own copyright would count)
// need a lifetime; production ones (printer, publisher, block cutter — execution,
// often a firm) are not authors, but an undated one still pulls in the
// anonymous-work rule, to stay conservative.
const CREATIVE_PHRASES = /\b(after|engraved by|engraver|etched by|designed by|painted by|drawn by|lithographed by|inscribed by|calligraphy by)\b(?!\s*(\d|c\.|ca\.))/gi
const PRODUCTION_PHRASES = /\b(published by|publisher|printed by|printer|carved by|cut by)\b/gi
// Structured roles (Met constituents[].role, CMA creators[].role).
const NOT_AUTHOR_ROLE = /\b(sitter|subject|owner|former attribution|formerly attributed|patron|dedicatee|donor|commissioner|lender|depicted|honou?ree|recipient)\b/i
const PRODUCTION_ROLE = /\b(printer|publisher|manufacturer|retailer|distributor|foundry|block ?cutter|cutter|carver)\b/i

const toYear = (v) => {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) && n !== 0 && String(v ?? '').trim() !== '' ? n : null
}

/** AIC: parse artist_display; corroborate with /agents birth_date/death_date. */
export function peopleFromAic(a, agentsById = new Map()) {
  const display = a.artist_display || ''
  const nameLine = normLife(display.split('\n')[0]).trim() // same dash folding as the contexts
  const facts = parseLifeFacts(display).map((f, i) => ({
    ...f, from: 'artist_display',
    name: i === 0 && nameLine && !f.context.includes(nameLine) ? `${nameLine} · ${f.context}` : f.context,
  }))
  const ids = a.artist_ids || []
  const agents = ids.map((id) => agentsById.get(id)).filter(Boolean)
  // Unresolved ids count as individuals: unknown is never treated as anonymous.
  const individuals = ids.filter((id) => agentsById.get(id)?.agent_type_title !== 'Culture')
  const people = [...facts]
  for (const ag of agents) {
    if (ag.agent_type_title === 'Culture') continue
    // The agent record corroborates artist_display; it only adds a check when it
    // says something different (e.g. a later death year than the label).
    const same = facts.some((f) => (f.death ?? null) === (ag.death_date ?? null) && (ag.death_date != null || f.birth === ag.birth_date))
    if (!same && (ag.death_date != null || ag.birth_date != null)) {
      people.push({ name: ag.title, from: 'aic agent', ...UNDATED, birth: ag.birth_date ?? null, death: ag.death_date ?? null })
    }
  }
  // Everyone we can see named (agents + "after X"/"engraved by Y" phrases) must be
  // covered by a dated lifetime; any shortfall is an undated person, bounded by
  // the object's date. Lifetimes beyond that cover printers/publishers.
  const creative = (display.match(CREATIVE_PHRASES) || []).length
  const production = (display.match(PRODUCTION_PHRASES) || []).length
  const anonymous = ANON_NAME.test(display) || (individuals.length === 0 && facts.length === 0)
  const expected = (anonymous && individuals.length === 0 ? 0 : Math.max(individuals.length, 1)) + creative
  const flat = display.replace(/\s+/g, ' ').trim()
  for (let i = facts.length; i < expected; i++) {
    people.push({ name: `undated contributor in "${flat}"`, from: 'artist_display', ...UNDATED })
  }
  const undatedProduction = facts.length < expected + production ? [`printer/publisher in "${flat}"`] : []
  return { people, anonymous, undatedProduction, qualified: (display.match(QUALIFIER) || [null])[0], raw: display }
}

const UNDATED = { birth: null, birthApprox: false, death: null, deathApprox: false, deathAfter: null, floruit: null, floruitApprox: false, floruitEnd: null }
const ANON_MET = /\b(unidentified|unknown|anonymous)\b|\bpainters?$|^$/i
const splitPipe = (s) => String(s ?? '').split('|').map((x) => x.trim())
const stripPrefix = (n) => n.replace(/^(after|attributed to|workshop of|follower of|circle of|copy after|inscribed by|etched( with aquatint)? by|engraved by|published by|printed by|designed by|\?)\s+/i, '').trim()

/** Met: artistDisplayName/Bio/BeginDate/EndDate/Prefix (+ dateless constituents). */
export function peopleFromMet(o) {
  const names = splitPipe(o.artistDisplayName)
  const bios = splitPipe(o.artistDisplayBio)
  const begins = splitPipe(o.artistBeginDate)
  const ends = splitPipe(o.artistEndDate)
  const prefixes = splitPipe(o.artistPrefix)
  const people = []
  let anonymous = false
  let qualified = null
  names.forEach((name, i) => {
    const prefix = prefixes[i] || ''
    if (QUALIFIER.test(prefix) || /\band (workshop|studio|assistants?)\b/i.test(name)) qualified ||= prefix || 'and workshop'
    if (ANON_MET.test(name)) { anonymous = true; return }
    const end = toYear(ends[i])
    const facts = parseLifeFacts(bios[i] || '')
    // 9999 = still living, per the Met.
    if (end === 9999) { people.push({ name, from: 'artistEndDate = 9999', ...UNDATED, living: true }); return }
    if (facts.length) {
      for (const f of facts) {
        // artistEndDate corroborates a death the bio states; it is NOT a death
        // when the bio only says "active"/"after" (then it is a floruit bound).
        if (f.death != null && end != null) f.death = Math.max(f.death, end)
        people.push({ ...f, name, from: 'artistDisplayBio' })
      }
    } else if (end != null) {
      people.push({ name, from: 'artistEndDate', ...UNDATED, birth: toYear(begins[i]), death: end, deathApprox: true })
    } else {
      people.push({ name, from: 'artistDisplayName (no dates)', ...UNDATED })
    }
  })
  // Other constituents carry no dates in the API: creators are bounded by the
  // object's date; printers/publishers pull in the anonymous rule; sitters,
  // owners and former attributions aren't authors at all.
  const primary = names.filter(Boolean).map((n) => n.toLowerCase())
  const undatedProduction = []
  for (const c of o.constituents || []) {
    const bare = stripPrefix(c.name || '')
    const lc = bare.toLowerCase()
    if (primary.some((p) => p === lc || p.endsWith(lc) || lc.endsWith(p) || p.includes(lc))) continue
    if (NOT_AUTHOR_ROLE.test(c.role || '')) continue
    if (PRODUCTION_ROLE.test(c.role || '')) { undatedProduction.push(`${c.role}: ${c.name}`); continue }
    if (ANON_MET.test(bare)) { anonymous = true; continue }
    people.push({ name: `${c.role || 'constituent'}: ${c.name}`, from: 'constituents (no dates)', ...UNDATED })
  }
  if (!names.filter(Boolean).length && !people.length) anonymous = true
  return { people, anonymous, undatedProduction, qualified, raw: [o.artistPrefix, o.artistDisplayName, o.artistDisplayBio].filter(Boolean).join(' ') }
}

/** CMA: creators[] — parse description, corroborate with birth_year/death_year. */
export function peopleFromCma(a) {
  const people = []
  const undatedProduction = []
  let anonymous = !(a.creators || []).length
  let qualified = null
  for (const c of a.creators || []) {
    const desc = c.description || ''
    const q = c.qualifier || ''
    if (NOT_AUTHOR_ROLE.test(c.role || '')) continue
    if (QUALIFIER.test(q)) qualified ||= q
    if (ANON_NAME.test(desc) || /^(studio|workshop|assistants?|circle|school|followers?)\b/i.test(desc.trim())) {
      anonymous = true
      if (/^(studio|workshop|assistants?|circle|school|followers?)\b/i.test(desc.trim())) qualified ||= desc.trim()
      continue
    }
    const facts = parseLifeFacts(desc)
    const dy = toYear(c.death_year)
    if (facts.length) {
      for (const f of facts) {
        if (f.death != null && dy != null) f.death = Math.max(f.death, dy)
        people.push({ ...f, name: desc, from: 'creators[].description' })
      }
    } else if (dy != null || toYear(c.birth_year) != null) {
      people.push({ name: desc, from: 'creators[].birth_year/death_year', ...UNDATED, birth: toYear(c.birth_year), death: dy, deathApprox: dy != null })
    } else if (PRODUCTION_ROLE.test(c.role || '')) {
      undatedProduction.push(`${c.role}: ${desc}`)
    } else {
      people.push({ name: desc, from: 'creators[].description (no dates)', ...UNDATED })
    }
  }
  return { people, anonymous, undatedProduction, qualified, raw: (a.creators || []).map((c) => [c.role, c.qualifier, c.description].filter(Boolean).join(' ')).join('; ') }
}

/** The latest year by which this person is certainly dead, and why. */
function diedBy(p, objectEnd) {
  if (p.living) return { by: Infinity, why: 'listed as living' }
  if (p.death != null) {
    return { by: p.death + (p.deathApprox ? APPROX_MARGIN : 0), why: `died ${p.deathApprox ? 'c. ' : ''}${p.death}` }
  }
  const after = p.deathAfter != null ? `died after ${p.deathAfter}; ` : ''
  if (p.birth != null) {
    const by = p.birth + (p.birthApprox ? APPROX_MARGIN : 0) + MAX_LIFESPAN
    return { by: Math.max(by, p.deathAfter ?? -Infinity), why: `${after}death year unknown, born ${p.birth} -> dead by ${by}` }
  }
  if (p.floruit != null) {
    const by = p.floruit + (p.floruitApprox ? APPROX_MARGIN : 0) - MIN_WORKING_AGE + MAX_LIFESPAN
    return { by: Math.max(by, p.deathAfter ?? -Infinity), why: `${after}death year unknown, active from ${p.floruit} -> dead by ${by}` }
  }
  if (objectEnd != null) {
    const by = objectEnd - MIN_WORKING_AGE + MAX_LIFESPAN
    return { by: Math.max(by, p.deathAfter ?? -Infinity), why: `${after}no life dates, object dated ${objectEnd} -> dead by ${by}` }
  }
  return { by: Infinity, why: 'no life dates and no object date' }
}

// ---- 3. flat art -----------------------------------------------------------

const PHOTO = /photo|gelatin silver|albumen|daguerreotype|ambrotype|tintype|cyanotype|platinum print|palladium print|salted paper|chromogenic|carbon print|inkjet/i
// "Paintings-Panels" is the Cloisters' class for panel paintings (e.g. the Merode
// Altarpiece triptych), flat like any other painting.
const MET_FLAT = new Set(['Paintings', 'Paintings-Panels', 'Prints', 'Drawings', 'Miniatures'])
// Only consulted when the Met leaves classification empty. No screens: a carved,
// lacquered or Coromandel screen is a 3-D object (painted byōbu are "Paintings").
const MET_FLAT_NAME = /\b(painting|print|drawing|watercolou?r|pastel|hanging scroll|handscroll|album leaf)\b/i
export const FLAT_RULES = {
  aic: { field: 'artwork_type_title', ok: (t) => ['Painting', 'Print', 'Drawing and Watercolor', 'Miniature Painting'].includes(t) },
  cma: { field: 'type', ok: (t) => ['Painting', 'Print', 'Drawing'].includes(t) },
  met: {
    field: 'classification / objectName',
    ok: (t) => {
      const [cls = '', name = ''] = t.split(' / ')
      if (cls) return MET_FLAT.has(cls.split('|')[0]) && !PHOTO.test(cls)
      return MET_FLAT_NAME.test(name)
    },
  },
}

// ---- the gate --------------------------------------------------------------

/**
 * c = { source, license_value, type_label, medium, object_end, who: {people,
 *       anonymous, qualified, raw}, width, height }
 * opts.skipSize: run checks 1-3 only (to decide whether a size probe is worth it).
 */
export function clear(c, { cutoff = cutoffYear(), skipSize = false } = {}) {
  const fails = []
  const passes = []
  const ev = { cutoff_year: cutoff }

  // 1. licence
  const lic = LICENSE_RULES[c.source]
  ev.license_flag = { [lic.field]: c.license_value ?? null }
  if (lic.ok(c.license_value)) passes.push(`licence: ${lic.field} = ${JSON.stringify(c.license_value)}`)
  else fails.push(`licence: ${lic.field} = ${JSON.stringify(c.license_value ?? null)} (need ${lic.want})`)

  // 2. life + 70
  const { people = [], anonymous = false, qualified = null, undatedProduction = [], raw = '' } = c.who || {}
  const oe = Number.isFinite(c.object_end) ? c.object_end : null
  ev.artist_text = raw || null
  ev.object_end_date = oe
  ev.anonymous = anonymous
  ev.attribution_qualifier = qualified
  ev.undated_printers_publishers = undatedProduction
  ev.people = people.map((p) => {
    const d = diedBy(p, oe)
    const exact = p.death != null && !p.deathApprox && !p.living
    return { name: p.name, from: p.from, death: p.death ?? null, birth: p.birth ?? null, floruit: p.floruit ?? null, died_by: Number.isFinite(d.by) ? d.by : null, ok: d.by <= cutoff, why: d.why, exact }
  })
  if (!people.length && !anonymous) fails.push('artist: no artist information to establish a death date')
  for (const { exact, ...p } of ev.people) {
    if (p.ok) passes.push(`artist ${p.name}: ${p.why} <= ${cutoff}`)
    else if (exact) fails.push(`artist ${p.name}: ${p.why} > ${cutoff} — still in copyright (life+${TERM_YEARS})`)
    else fails.push(`artist ${p.name}: ${p.why}${p.died_by ? ` > ${cutoff}` : ''} — can't establish life+${TERM_YEARS} has run`)
  }
  ev.people = ev.people.map(({ exact, ...p }) => p)
  // Anonymous hands, any "attributed to / workshop of / after / ?" — where the real
  // hand may be unknown — and undated printers/publishers must also clear the
  // anonymous-work rule.
  if (anonymous || qualified || undatedProduction.length) {
    const why = anonymous ? 'anonymous/unidentified hand'
      : qualified ? `attribution "${qualified}"`
      : `undated ${undatedProduction.join('; ')}`
    if (oe != null && oe < ANON_BEFORE) passes.push(`${why}: object dated ${oe} < ${ANON_BEFORE}`)
    else fails.push(`${why}: object date ${oe ?? 'unknown'} is not < ${ANON_BEFORE}`)
  }

  // 3. flat art
  const flat = FLAT_RULES[c.source]
  ev.classification = { [flat.field]: c.type_label ?? null, medium: c.medium ?? null }
  if (!flat.ok(c.type_label || '')) fails.push(`medium: ${flat.field} "${c.type_label}" is not a painting/print/drawing`)
  else if (PHOTO.test(c.medium || '') || PHOTO.test(c.type_label || '')) fails.push(`medium: photographic ("${c.medium}") — excluded by product choice`)
  else passes.push(`flat art: ${c.type_label}`)

  // 4. resolution
  if (!skipSize) {
    const long = Math.max(c.width || 0, c.height || 0)
    ev.image = { width: c.width ?? null, height: c.height ?? null, long_edge: long || null }
    if (!long) fails.push('image: no image / size unknown')
    else if (long < MIN_LONG_EDGE) fails.push(`image: long edge ${long}px < ${MIN_LONG_EDGE}px`)
    else passes.push(`image: long edge ${long}px >= ${MIN_LONG_EDGE}px`)
  }

  return { pass: fails.length === 0, reasons: fails.length ? fails : passes, evidence: ev }
}
