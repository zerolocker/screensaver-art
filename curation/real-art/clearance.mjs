// The copyright gate: strict and auditable. Every candidate gets
// `clearance: {pass, reasons[], evidence{}}`.
//
//   1. Licence: the museum's own flag is exactly Public Domain / CC0.
//   2. Life+70: every identified artist died <= (this year - 71). An unknown
//      death year assumes a 70-year life: birth + 70, else (work date or
//      floruit) + 60. A work with no identifiable artist is judged the same way
//      from its date. Approximate years count as written.
//   3. Flat art only: paintings, prints, drawings, watercolours (no 3-D objects, whose
//      photos can carry their own copyright; no photographs, by product choice).
//   4. Image long edge >= 1920 px.
//
// Wikimedia Commons, the Rijksmuseum and SMK also need:
//   5. US safety: unless every artist died by (this year - 96), 1930 in 2026,
//      the work is dated by then. Dates after the artist's death are ignored.
// Commons images (see "Wikimedia Commons" below) also need:
//   6. A known holder that isn't an Italian public collection.
//   7. If a museum we source directly holds it, that museum withholds a usable
//      image of its own (no open flag, no image, or under 1920 px). Otherwise use theirs.
//
// When in doubt, reject: eligible works are plentiful.

export const TERM_YEARS = 70 // life + 70 (US/EU)
export const LIFESPAN = 70 // assumed when a death year is unknown
export const MIN_WORKING_AGE = 10 // born this long before the work or the first active year
export const APPROX_MARGIN = 0 // approximate years count as written: "c. 1880" is 1880
export const MIN_LONG_EDGE = 1920 // Omni's input size

/** Life+70 expires at the end of the 70th calendar year: in 2026 -> died <= 1955. */
export const cutoffYear = (year = new Date().getFullYear()) => year - TERM_YEARS - 1

export const US_TERM_YEARS = 95 // US works published before 1978: 95 years from publication
/** In 2026 -> dated <= 1930. */
export const usCutoffYear = (year = new Date().getFullYear()) => year - US_TERM_YEARS - 1
// Sources whose public-domain mark only means life+70 has run (the EU rule), so
// a work published after 1930 may still be in US copyright: check 5.
export const US_DATE_RULE = new Set(['commons', 'rijks', 'smk'])

// ---- Wikimedia Commons -----------------------------------------------------
//
// For works whose holders publish no open images (the Louvre, the Prado, MoMA…),
// the image comes from Commons. The legal basis is an argument, not the museum's
// own waiver: a faithful photo of a 2-D public-domain work adds no new copyright
// (US: Bridgeman v. Corel, 1999; EU: DSM Directive Art. 14). Hence the extra
// rules: Commons itself must mark the file public domain, the work must be old
// enough for the US (check 5), and Italy is out (check 6), because its Cultural
// Heritage Code restricts reproductions of works in public collections even
// after copyright ends.

const COMMONS_PD_LICENSES = new Set(['pd', 'cc0'])
const COMMONS_PD_CATEGORY = /^(PD-Art|PD-old|PD-scan|CC-PD-Mark|CC-Zero)\b/i
// Any of these on the file is a rights claim, e.g. a photographer's CC BY-SA
// beside a PD-Art tag ("Licensed-PD-Art"): reject.
const COMMONS_NONFREE_CATEGORY = /^(CC-BY|GFDL|FAL\b|Free Art License|Copyrighted free use|Attribution only)/i

/**
 * v = imageinfo extmetadata of the Commons file:
 * {file, License, LicenseShortName, Copyrighted, categories[]}.
 */
export function commonsLicence(v) {
  if (!v?.file) return { ok: false, why: 'no Commons image file (P18)', evidence: null }
  const code = String(v.License ?? '').trim().toLowerCase()
  const short = String(v.LicenseShortName ?? '').trim()
  const cats = v.categories || []
  const pdCats = cats.filter((c) => COMMONS_PD_CATEGORY.test(c))
  const nonfree = cats.filter((c) => COMMONS_NONFREE_CATEGORY.test(c))
  const evidence = { file: v.file, License: v.License ?? null, LicenseShortName: v.LicenseShortName ?? null, Copyrighted: v.Copyrighted ?? null, categories: [...pdCats, ...nonfree] }
  const said = `License "${v.License ?? ''}", LicenseShortName "${short}"`
  if (code && !COMMONS_PD_LICENSES.has(code)) return { ok: false, why: `Commons licence is not public domain (${said})`, evidence }
  if (nonfree.length) return { ok: false, why: `the file also carries ${nonfree.join(', ')}`, evidence }
  // Commons marks CC0 files Copyrighted (a rights holder waived them); that's fine.
  if (v.Copyrighted === 'True' && code !== 'cc0') return { ok: false, why: `Commons marks the file Copyrighted (${said})`, evidence }
  const pd = COMMONS_PD_LICENSES.has(code) || /^(public domain|cc0)\b/i.test(short) || pdCats.length
  if (!pd) return { ok: false, why: `no public-domain licence on the file (${said})`, evidence }
  return { ok: true, why: `${said}${pdCats.length ? `; ${pdCats.join(', ')}` : ''}`, evidence }
}

// ---- 1. licence ------------------------------------------------------------

const PD_MARK_URL = /^https?:\/\/creativecommons\.org\/publicdomain\/mark\/1\.0\/?$/
const CC0_URL = /^https?:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/?$/
const pdOrCc0 = (u) => PD_MARK_URL.test(u) || CC0_URL.test(u)
const markLabel = (u) => (CC0_URL.test(u) ? 'CC0' : 'Public Domain')

// `label` is the gallery licence; a function when the museum uses both marks.
export const LICENSE_RULES = {
  aic: { field: 'is_public_domain', want: 'true', ok: (v) => v === true, label: 'Public Domain' },
  met: { field: 'isPublicDomain', want: 'true', ok: (v) => v === true, label: 'CC0' },
  cma: { field: 'share_license_status', want: '"CC0"', ok: (v) => v === 'CC0', label: 'CC0' },
  // The primary published image's flag; NGA releases open-access images as CC0.
  nga: { field: 'published_images.openaccess', want: '"1"', ok: (v) => v === '1', label: 'CC0' },
  // The image's own right (its VisualItem), not the metadata's.
  rijks: { field: 'image rights', want: 'Public Domain Mark 1.0 or CC0 1.0', ok: (v) => pdOrCc0(String(v ?? '')), label: markLabel },
  getty: { field: 'rights (object and IIIF manifest)', want: 'CC0 1.0', ok: (v) => CC0_URL.test(String(v ?? '')), label: 'CC0' },
  smk: {
    field: 'public_domain, rights', want: 'true and Public Domain Mark 1.0 or CC0 1.0',
    ok: (v) => v?.public_domain === true && pdOrCc0(String(v.rights ?? '')), label: (v) => markLabel(String(v?.rights ?? '')),
  },
  commons: { field: 'Commons file licence', ok: (v) => commonsLicence(v).ok, check: commonsLicence, label: 'Public Domain' },
}

/** The gallery licence for a passing flag ("Public Domain" / "CC0"), else null. */
export function licenceLabel(source, v) {
  const lic = LICENSE_RULES[source]
  if (!lic.ok(v)) return null
  return typeof lic.label === 'function' ? lic.label(v) : lic.label
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
/** Does this artist text carry an attribution qualifier ("Workshop of X", "after X")? */
export const isQualified = (s) => QUALIFIER.test(String(s ?? ''))
// Contributors named in free text whose own copyright would count. Production
// roles (printer, publisher, block cutter: execution, often a firm) are not authors.
const CREATIVE_PHRASES = /\b(after|engraved by|engraver|etched by|designed by|painted by|drawn by|lithographed by|inscribed by|calligraphy by)\b(?!\s*(\d|c\.|ca\.))/gi
// Structured roles (Met constituents[].role, CMA creators[].role).
const NOT_AUTHOR_ROLE = /\b(sitter|subject|owner|former attribution|formerly( attributed)?|earlier ascribed|rejected attribution|patron|dedicatee|donor|commissioner|lender|depicted|honou?ree|recipient)\b/i
const PRODUCTION_ROLE = /\b(printer|publisher|manufacturer|retailer|distributor|foundry|block ?cutter|cutter|carver)\b/i

// A structured life year outside this range is a placeholder, so it counts as unknown and
// the conservative rules apply. AIC's undated agents carry birth = death = 4713
// (apparently Julian Day 0, 4713 BC): as a date it rejects wrongly, and a negative
// one would pass wrongly.
export const MIN_LIFE_YEAR = -3000
export const toYear = (v, now = new Date().getFullYear()) => {
  const s = String(v ?? '').trim()
  const n = Number(s)
  return s !== '' && Number.isInteger(n) && n !== 0 && n >= MIN_LIFE_YEAR && n <= now ? n : null
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
    const birth = toYear(ag.birth_date)
    const death = toYear(ag.death_date)
    const same = facts.some((f) => (f.death ?? null) === death && (death != null || f.birth === birth))
    if (!same && (death != null || birth != null)) {
      people.push({ name: ag.title, from: 'aic agent', ...UNDATED, birth, death })
    }
  }
  // Everyone we can see named (agents + "after X"/"engraved by Y" phrases) must be
  // covered by a dated lifetime; any shortfall is an undated person, judged from
  // the object's date. A leading "After X" qualifies the main artist and names
  // no one new.
  const creative = [...display.matchAll(CREATIVE_PHRASES)]
    .filter((m) => /\S/.test(display.slice(display.lastIndexOf('\n', m.index - 1) + 1, m.index))).length
  const anonymous = ANON_NAME.test(display) || (individuals.length === 0 && facts.length === 0)
  const expected = (anonymous && individuals.length === 0 ? 0 : Math.max(individuals.length, 1)) + creative
  const flat = display.replace(/\s+/g, ' ').trim()
  for (let i = facts.length; i < expected; i++) {
    people.push({ name: `undated contributor in "${flat}"`, from: 'artist_display', ...UNDATED })
  }
  // The qualifier can sit on the agent alone ("Workshop of Paolo Veneziano" over a
  // plain "Paolo Veneziano" label); the artist field shows it, so the gate sees it too.
  const qualified = (display.match(QUALIFIER) || String(a.artist_title ?? '').match(QUALIFIER) || [null])[0]
  return { people, anonymous, qualified, raw: display }
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
    if (QUALIFIER.test(prefix)) qualified ||= prefix
    else if (/\band (workshop|studio|assistants?)\b/i.test(name)) qualified ||= 'and workshop'
    // The Met also writes it into the name alone: "Workshop of Fra Filippo Lippi".
    else if (QUALIFIER.test(name)) qualified ||= name
    if (ANON_MET.test(name)) { anonymous = true; return }
    // 9999 = still living, per the Met (checked before toYear, which drops it as implausible).
    if (Number(ends[i]) === 9999) { people.push({ name, from: 'artistEndDate = 9999', ...UNDATED, living: true }); return }
    const end = toYear(ends[i])
    const facts = parseLifeFacts(bios[i] || '')
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
  // Other constituents carry no dates in the API: creators are judged from the
  // object's date; printers, publishers, sitters, owners and former
  // attributions aren't authors.
  const primary = names.filter(Boolean).map((n) => n.toLowerCase())
  for (const c of o.constituents || []) {
    const bare = stripPrefix(c.name || '')
    const lc = bare.toLowerCase()
    if (primary.some((p) => p === lc || p.endsWith(lc) || lc.endsWith(p) || p.includes(lc))) continue
    if (NOT_AUTHOR_ROLE.test(c.role || '') || PRODUCTION_ROLE.test(c.role || '')) continue
    if (ANON_MET.test(bare)) { anonymous = true; continue }
    people.push({ name: `${c.role || 'constituent'}: ${c.name}`, from: 'constituents (no dates)', ...UNDATED })
  }
  if (!names.filter(Boolean).length && !people.length) anonymous = true
  return { people, anonymous, qualified, raw: [o.artistPrefix, o.artistDisplayName, o.artistDisplayBio].filter(Boolean).join(' ') }
}

/** CMA: creators[] — parse description, corroborate with birth_year/death_year. */
export function peopleFromCma(a) {
  const people = []
  let anonymous = !(a.creators || []).length
  let qualified = null
  for (const c of a.creators || []) {
    const desc = c.description || ''
    const q = c.qualifier || ''
    if (NOT_AUTHOR_ROLE.test(c.role || '')) continue
    const bare = desc.replace(/\s*\(.*$/s, '').trim()
    if (QUALIFIER.test(q)) qualified ||= q
    else if (QUALIFIER.test(bare)) qualified ||= bare // "Attributed to X (…)" with no qualifier field
    if (/^(studio|workshop|assistants?|circle|school|followers?)\b/i.test(desc.trim())) qualified ||= desc.trim()
    if (ANON_NAME.test(desc)) { anonymous = true; continue }
    const facts = parseLifeFacts(desc)
    const dy = toYear(c.death_year)
    if (facts.length) {
      for (const f of facts) {
        if (f.death != null && dy != null) f.death = Math.max(f.death, dy)
        people.push({ ...f, name: desc, from: 'creators[].description' })
      }
    } else if (dy != null || toYear(c.birth_year) != null) {
      people.push({ name: desc, from: 'creators[].birth_year/death_year', ...UNDATED, birth: toYear(c.birth_year), death: dy, deathApprox: dy != null })
    } else if (!PRODUCTION_ROLE.test(c.role || '')) {
      people.push({ name: desc, from: 'creators[].description (no dates)', ...UNDATED })
    }
  }
  return { people, anonymous, qualified, raw: (a.creators || []).map((c) => [c.role, c.qualifier, c.description].filter(Boolean).join(' ')).join('; ') }
}

export const ANONYMOUS_QID = 'Q4233718'

/** A P5102/P1480 qualifier's label as it reads before a name: "attribution" -> "attributed to". */
export const natureWord = (n) =>
  ({ attribution: 'attributed to', presumably: 'presumably', probably: 'probably', possibly: 'possibly' })[String(n).toLowerCase()] || 'attributed to'

/**
 * Wikidata (the Commons lane): persons = [{kind, qid, label, nature, birth,
 * birthApprox, death, deathApprox}]. kind is "creator" (P170) or an attribution
 * ("workshop of", "attributed to"…: P1774, P1773… on the item or on its P170).
 * A creator with no item (unknown value) or Q4233718 is anonymous; one whose
 * statement carries a nature/sourcing qualifier is qualified. Years are already
 * the latest the date's precision allows.
 */
export function peopleFromWikidata(persons = []) {
  const people = []
  let anonymous = !persons.some((p) => p.kind === 'creator')
  let qualified = null
  for (const p of persons) {
    const qual = p.kind !== 'creator' ? p.kind : p.nature ? natureWord(p.nature) : null
    if (qual) qualified ||= `${qual} ${p.label || p.qid || 'unknown'}`
    if (!p.qid || p.qid === ANONYMOUS_QID) { anonymous = true; continue }
    // One person named in several statements ("creator", "possibly") is judged once.
    if (people.some((x) => x.qid === p.qid)) continue
    people.push({
      qid: p.qid,
      ...UNDATED, name: p.label || p.qid, from: `Wikidata ${p.qid} P569/P570`,
      birth: p.birth ?? null, birthApprox: !!p.birthApprox, death: p.death ?? null, deathApprox: !!p.deathApprox,
    })
  }
  const raw = persons.map((p) => `${p.kind === 'creator' ? '' : `${p.kind} `}${p.label || p.qid || 'unknown value'}` +
    ` (${p.birth ?? '?'}–${p.death ?? '?'})${p.nature ? ` [${p.nature}]` : ''}`).join('; ')
  return { people, anonymous, qualified, raw }
}

/**
 * NGA, the Rijksmuseum, the Getty and SMK list their makers as structured credits:
 * [{name, role, qualifier, life, birth, death, birthApprox, deathApprox, deathAfter,
 * anonymous, from}]. `life` is a lifetime in free text ("Italian, 1452 - 1519"),
 * parsed like the other museums' labels; `birth`/`death` are structured years that
 * corroborate it (the later death wins). The adapter passes `qualifier` ("attributed
 * to", "workshop of", "after"…) only when the credit carries one.
 */
export function peopleFromCredits(credits = []) {
  const people = []
  let anonymous = !credits.length
  let qualified = null
  for (const c of credits) {
    if (NOT_AUTHOR_ROLE.test(c.role || '') || NOT_AUTHOR_ROLE.test(c.qualifier || '')) continue
    if (c.qualifier) qualified ||= `${c.qualifier} ${c.name || ''}`.trim()
    if (c.anonymous || ANON_NAME.test(c.name || '')) { anonymous = true; continue }
    // A maker the record doesn't name isn't anonymous: just undated.
    if (!c.name) { people.push({ ...UNDATED, name: `unnamed ${c.role || 'maker'}`, from: `${c.from} (no name)` }); continue }
    const facts = parseLifeFacts(c.life || '')
    const birth = toYear(c.birth)
    const death = toYear(c.death)
    if (facts.length) {
      for (const f of facts) {
        if (f.death != null && death != null) f.death = Math.max(f.death, death)
        people.push({ ...f, name: c.name, from: c.from })
      }
    } else if (birth != null || death != null || toYear(c.deathAfter) != null) {
      people.push({ ...UNDATED, name: c.name, from: c.from, birth, birthApprox: !!c.birthApprox, death, deathApprox: !!c.deathApprox, deathAfter: toYear(c.deathAfter) })
    } else if (!PRODUCTION_ROLE.test(c.role || '')) {
      people.push({ ...UNDATED, name: c.name, from: `${c.from} (no dates)` })
    }
  }
  const raw = credits.map((c) => [c.role && `${c.role}:`, c.qualifier, c.name || 'unknown', c.life ? `(${c.life})` : (c.birth || c.death) ? `(${c.birth ?? '?'}–${c.death ?? '?'})` : null]
    .filter(Boolean).join(' ')).join('; ')
  return { people, anonymous, qualified, raw }
}

/** The year this person is taken to have died by, and why. */
function diedBy(p, objectEnd) {
  if (p.living) return { by: Infinity, why: 'listed as living' }
  if (p.death != null) {
    return { by: p.death + (p.deathApprox ? APPROX_MARGIN : 0), why: `died ${p.deathApprox ? 'c. ' : ''}${p.death}` }
  }
  // No death year: assume a LIFESPAN-year life, born MIN_WORKING_AGE years
  // before the first active year or the work.
  const after = p.deathAfter != null ? `died after ${p.deathAfter}; ` : ''
  const at = (by, why) => ({ by: Math.max(by, p.deathAfter ?? -Infinity), why: `${after}${why} -> taken as dead by ${by}` })
  if (p.birth != null) {
    return at(p.birth + (p.birthApprox ? APPROX_MARGIN : 0) + LIFESPAN, `death year unknown, born ${p.birth}`)
  }
  if (p.floruit != null) {
    return at(p.floruit + (p.floruitApprox ? APPROX_MARGIN : 0) - MIN_WORKING_AGE + LIFESPAN, `death year unknown, active from ${p.floruit}`)
  }
  if (objectEnd != null) return at(objectEnd - MIN_WORKING_AGE + LIFESPAN, `no life dates, object dated ${objectEnd}`)
  return { by: Infinity, why: 'no life dates and no object date' }
}

/**
 * A work can't be dated after its last artist died: such a date is a data error.
 * dates = [{year, latest}] (as written, and the latest its precision allows);
 * people = identified artists. Drops dates after the last death and caps the
 * rest at it. lastDeath is null unless every artist's death year is known.
 */
export function datesBeforeDeath(dates, people) {
  const deaths = people.map((p) => (p.living ? Infinity : p.death ?? null))
  const lastDeath = deaths.length && deaths.every((d) => d != null) ? Math.max(...deaths) : null
  if (lastDeath == null) return { dates, lastDeath, ignored: [] }
  return {
    dates: dates.filter((d) => d.year <= lastDeath).map((d) => ({ ...d, latest: Math.min(d.latest, lastDeath) })),
    lastDeath,
    ignored: dates.filter((d) => d.year > lastDeath),
  }
}

// ---- 3. flat art -----------------------------------------------------------

const PHOTO = /photo|gelatin silver|albumen|daguerreotype|ambrotype|tintype|cyanotype|platinum print|palladium print|salted paper|chromogenic|carbon print|inkjet/i
// "Paintings-Panels" is the Cloisters' class for panel paintings (e.g. the Merode
// Altarpiece triptych), flat like any other painting.
const MET_FLAT = new Set(['Paintings', 'Paintings-Panels', 'Prints', 'Drawings', 'Miniatures'])
// Only consulted when the Met leaves classification empty. No screens: a carved,
// lacquered or Coromandel screen is a 3-D object (painted byōbu are "Paintings").
const MET_FLAT_NAME = /\b(painting|print|drawing|watercolou?r|pastel|hanging scroll|handscroll|album leaf)\b/i
// Wikidata P31 classes the Commons lane takes. A triptych or altarpiece can be
// carved (the Kefermarkt Altarpiece is limewood), so one needs a paint in P186
// unless it's also typed as a painting.
export const COMMONS_PAINTING_TYPES = {
  Q3305213: 'painting', Q1400853: 'portrait painting', Q18761202: 'watercolor painting', Q16593391: 'tableau',
}
export const COMMONS_PANEL_TYPES = { Q79218: 'triptych', Q15711026: 'altarpiece' }
const PAINTS = new Set(['Q296955', 'Q175166', 'Q174219', 'Q204330']) // oil paint, tempera, paint, gouache
const SCULPTURE_TYPES = new Set(['Q860861', 'Q245117', 'Q179700']) // sculpture, relief sculpture, statue
// The Index of American Design is watercolour renderings (1935–42).
const NGA_FLAT = new Set(['Painting', 'Print', 'Drawing', 'Index of American Design'])
// Rijksmuseum types of work, in English or (when it has no English label) Dutch.
const RIJKS_FLAT = /\b(paintings?|schilderij|prints?|prent|drawings?|tekening|schetsboekblad|watercolou?rs?|aquarel|pastels?|gouaches?|grisailles?|miniatures?|miniatuur)\b/i
const RIJKS_NOT_FLAT = /photo|foto|frame|lijst|sculpture|beeld|relief|\bbooks?\b|\bboek(en)?\b|\bmaps?\b|\bkaart(en)?\b/i
// Getty AAT classifications. A miniature still in its manuscript is a page of a book.
export const GETTY_TYPES = {
  'aat:300033618': 'Paintings', 'aat:300033656': 'Panel Paintings', 'aat:300041273': 'Prints', 'aat:300033973': 'Drawings',
  'aat:300076922': 'Pastels', 'aat:300033936': 'Miniatures (Paintings)', 'aat:300264522': 'Illuminations (Paintings)',
  'aat:300265483': 'Manuscripts', 'aat:300028569': 'Manuscripts (Documents)', 'aat:300028051': 'Books', 'aat:300026690': 'Albums (Books)',
  'aat:300046300': 'Photographs', 'aat:300047090': 'Sculpture', 'aat:300047230': 'Reliefs (Sculpture)', 'aat:300263722': 'Stained Glass',
  'aat:300411641': 'Decorative Arts', 'aat:300178228': 'Diptychs',
}
const GETTY_FLAT = new Set(['Paintings', 'Panel Paintings', 'Prints', 'Drawings', 'Pastels', 'Miniatures (Paintings)', 'Illuminations (Paintings)'])
const GETTY_NOT_FLAT = new Set(['Manuscripts', 'Manuscripts (Documents)', 'Books', 'Albums (Books)', 'Photographs', 'Sculpture', 'Reliefs (Sculpture)', 'Stained Glass', 'Decorative Arts', 'Diptychs'])
// SMK object names (English): a category plus, for prints, the technique.
const SMK_FLAT = new Set(['painting', 'drawing', 'print', 'watercolour', 'gouache', 'pastel', 'miniature'])
const SMK_NOT_FLAT = /photo|collage|relief|statue|sculpture|bust|medal|altar|alterpiece|diptych|predella|icon|mural|offset|collotype|computer print|xerogra/i
const names = (t) => String(t).split(' / ').map((x) => x.trim()).filter(Boolean)

export const FLAT_RULES = {
  aic: { field: 'artwork_type_title', ok: (t) => ['Painting', 'Print', 'Drawing and Watercolor', 'Miniature Painting'].includes(t) },
  cma: { field: 'type', ok: (t) => ['Painting', 'Print', 'Drawing'].includes(t) },
  nga: { field: 'classification', ok: (t) => NGA_FLAT.has(t) },
  rijks: { field: 'type of work', ok: (t) => RIJKS_FLAT.test(t) && !RIJKS_NOT_FLAT.test(t) },
  getty: { field: 'classification (AAT)', ok: (t) => names(t).some((x) => GETTY_FLAT.has(x)) && !names(t).some((x) => GETTY_NOT_FLAT.has(x)) },
  smk: { field: 'object_names', ok: (t) => names(t).some((x) => SMK_FLAT.has(x.toLowerCase())) && !SMK_NOT_FLAT.test(t) },
  met: {
    field: 'classification / objectName',
    ok: (t) => {
      const [cls = '', name = ''] = t.split(' / ')
      if (cls) return MET_FLAT.has(cls.split('|')[0]) && !PHOTO.test(cls)
      return MET_FLAT_NAME.test(name)
    },
  },
  commons: {
    field: 'Wikidata P31 (P186)',
    ok: (_, c) => {
      const p31 = c.p31 || []
      if (p31.some((t) => SCULPTURE_TYPES.has(t))) return false
      if (p31.some((t) => COMMONS_PAINTING_TYPES[t])) return true
      return p31.some((t) => COMMONS_PANEL_TYPES[t]) && (c.p186 || []).some((m) => PAINTS.has(m))
    },
  },
}

// ---- 6. Italian public collections (Commons only) --------------------------

// Holder classes and owner/operator classes that mark the Italian public sector,
// which the Cultural Heritage Code covers (State, regions, municipalities).
const IT_PUBLIC_HOLDER_TYPES = {
  Q3867560: 'Italian national museum', Q124830411: 'Museum of the Italian Ministry of Culture',
  Q124830213: 'museum of a public entity', Q121076356: 'Istituto museale ad autonomia speciale', Q17431399: 'national museum',
}
const IT_PUBLIC_OWNER_TYPES = {
  Q1112537: 'ministry of Italy', Q747074: 'comune of Italy', Q16110: 'region of Italy', Q15089: 'province of Italy', Q3726248: 'territorial body',
}
const ITALY = 'Q38'
// State and civic museums by name, for holders Wikidata doesn't type or link to an owner.
const IT_PUBLIC_NAME = /Uffizi|Palatina|Palazzo Pitti|Accademia|Capodimonte|Brera|Borghese|Nazionale|National|Bargello|Sabauda|Musei Reali|Estense|Barberini|Corsini|Castel Sant'Angelo|Ca' d'Oro|Ca' Pesaro|Palazzo Ducale|Doge's Palace|San Marco|Reggia|Villa Giulia|Cenacolo|Galleria Spada|Palazzo Venezia|Palazzo Vecchio|Castello Sforzesco|Capitolin|Polo Museale|Direzione regionale|Civic|Civico|Civica|Civici|Comunale|Regionale|Regional/i

/**
 * h = {qid, label, countries[], types[], runBy: [{qid, types[], label}]}.
 * Returns why it's an Italian public collection, or null.
 */
export function italianPublic(h) {
  if (!(h.countries || []).includes(ITALY)) return null
  const type = (h.types || []).find((t) => IT_PUBLIC_HOLDER_TYPES[t])
  if (type) return `a ${IT_PUBLIC_HOLDER_TYPES[type]}`
  for (const w of h.runBy || []) {
    if (w.qid === ITALY) return 'owned or run by Italy'
    const t = (w.types || []).find((x) => IT_PUBLIC_OWNER_TYPES[x])
    if (t) return `owned or run by ${w.label || w.qid} (${IT_PUBLIC_OWNER_TYPES[t]})`
  }
  if (IT_PUBLIC_NAME.test(h.label || '')) return 'a state or civic museum by name'
  return null
}

// ---- the gate --------------------------------------------------------------

/**
 * c = { source, license_value, type_label, medium, object_end, who: {people,
 *       anonymous, qualified, raw}, width, height }
 * `dates` [{year, latest}] lists every date when a source has several (Commons'
 *   P571), else object_end is the date.
 * Commons also: p31[], p186[] (Wikidata QIDs), holders[] (see italianPublic),
 *   scan {file, why, …} (scans.mjs), and open_museum {museum, object_id,
 *   releases, why} when a museum we source directly holds it.
 * opts.skipSize: run checks 1-3 only (to decide whether a size probe is worth it).
 * opts.skipFile: skip the checks that depend on the Commons file (licence and
 *   size), to decide whether a search for a better scan is worth it.
 */
export function clear(c, { cutoff = cutoffYear(), usCutoff = usCutoffYear(), skipSize = false, skipFile = false } = {}) {
  const fails = []
  const passes = []
  const ev = { cutoff_year: cutoff }
  const commons = c.source === 'commons'

  // 1. licence
  const lic = LICENSE_RULES[c.source]
  const fileChecks = !(skipFile && commons)
  if (lic.check) {
    if (fileChecks) {
      const v = lic.check(c.license_value)
      ev.license_flag = { [lic.field]: v.evidence }
      ;(v.ok ? passes : fails).push(`licence: ${v.why}`)
    }
  } else {
    ev.license_flag = { [lic.field]: c.license_value ?? null }
    if (lic.ok(c.license_value)) passes.push(`licence: ${lic.field} = ${JSON.stringify(c.license_value)}`)
    else fails.push(`licence: ${lic.field} = ${JSON.stringify(c.license_value ?? null)} (need ${lic.want})`)
  }

  // 2. life + 70. A named artist behind a qualifier ("workshop of", "after")
  // is judged on their own dates; a work with no identifiable artist, on its date.
  const { people = [], anonymous = false, qualified = null, raw = '' } = c.who || {}
  const oe = Number.isFinite(c.object_end) ? c.object_end : null
  ev.artist_text = raw || null
  ev.object_end_date = oe
  ev.anonymous = anonymous
  ev.attribution_qualifier = qualified
  const judged = people.length ? people : [{ ...UNDATED, name: anonymous ? 'anonymous hand' : 'unrecorded artist', from: 'no identifiable artist' }]
  ev.people = judged.map((p) => {
    const d = diedBy(p, oe)
    const known = p.death != null && !p.living
    return { name: p.name, from: p.from, death: p.death ?? null, birth: p.birth ?? null, floruit: p.floruit ?? null, died_by: Number.isFinite(d.by) ? d.by : null, ok: d.by <= cutoff, why: d.why, known }
  })
  for (const { known, ...p } of ev.people) {
    if (p.ok) passes.push(`artist ${p.name}: ${p.why} <= ${cutoff}`)
    else if (known) fails.push(`artist ${p.name}: ${p.why} > ${cutoff} — still in copyright (life+${TERM_YEARS})`)
    else fails.push(`artist ${p.name}: ${p.why}${p.died_by ? ` > ${cutoff}` : ''} — can't establish life+${TERM_YEARS} has run`)
  }
  ev.people = ev.people.map(({ known, ...p }) => p)

  // 3. flat art
  const flat = FLAT_RULES[c.source]
  ev.classification = { [flat.field]: c.type_label ?? null, medium: c.medium ?? null }
  if (!flat.ok(c.type_label || '', c)) {
    fails.push(`medium: ${flat.field} "${c.type_label}"${commons ? ` (${c.medium || 'no material'})` : ''} is not a ${commons ? 'painting' : 'painting/print/drawing'}`)
  } else if (PHOTO.test(c.medium || '') || PHOTO.test(c.type_label || '')) fails.push(`medium: photographic ("${c.medium}") — excluded by product choice`)
  else passes.push(`flat art: ${c.type_label}`)

  if (US_DATE_RULE.has(c.source)) {
    // 5. US safety. A work published in the US gets 95 years from publication,
    // so only one from before usCutoff + 1 is safe; life+70 covers unpublished
    // works only. An artist who died by usCutoff can't have made a later one.
    ev.us_cutoff_year = usCutoff
    const { dates, lastDeath, ignored } = datesBeforeDeath(c.dates ?? (oe != null ? [{ year: oe, latest: oe }] : []), people)
    const usEnd = dates.length ? Math.max(...dates.map((d) => d.latest)) : null
    ev.us_date = usEnd
    if (ignored.length) ev.us_dates_ignored = ignored.map((d) => d.year)
    const after = ignored.length ? ` (ignoring ${ignored.map((d) => d.year).join(', ')}, after the artist's death in ${lastDeath})` : ''
    const what = commons ? 'inception date (P571)' : 'date'
    if (lastDeath != null && lastDeath <= usCutoff) passes.push(`US: every artist died by ${usCutoff} (last in ${lastDeath}), so the work is from ${usCutoff} or earlier`)
    else if (usEnd == null) fails.push(`US: no usable ${what}${after} — can't show the work is from ${usCutoff} or earlier`)
    else if (usEnd > usCutoff) fails.push(`US: dated ${usEnd} > ${usCutoff}${after} — may still be in US copyright`)
    else passes.push(`US: dated ${usEnd} <= ${usCutoff}${after}`)
  }

  if (commons) {
    // 6. holder: known, and not an Italian public collection.
    ev.holders = (c.holders || []).map((h) => ({ qid: h.qid, label: h.label ?? null, countries: h.countries || [], italian_public: italianPublic(h) }))
    const italian = ev.holders.filter((h) => h.italian_public)
    if (!ev.holders.length) fails.push('holder: no current collection (P195) on Wikidata — can\'t rule out an Italian public collection')
    for (const h of italian) fails.push(`holder ${h.label || h.qid}: Italian public collection (${h.italian_public})`)
    if (ev.holders.length && !italian.length) passes.push(`holder: ${ev.holders.map((h) => h.label || h.qid).join(', ')} — not an Italian public collection`)

    // 7. A museum's own released image always wins over Commons.
    const m = c.open_museum
    if (m) {
      ev.open_museum = m
      if (m.releases === false) passes.push(`museum: ${m.museum} doesn't release a usable image (${m.why}); using Commons`)
      else if (m.releases === true) fails.push(`museum: ${m.museum} releases its own image (${m.object_id}); use that, not Commons`)
      else fails.push(`museum: held by ${m.museum}, but ${m.why}; can't confirm it withholds its own image`)
    }
  }

  // 4. resolution
  if (!skipSize && fileChecks) {
    const long = Math.max(c.width || 0, c.height || 0)
    ev.image = { width: c.width ?? null, height: c.height ?? null, long_edge: long || null }
    if (c.scan) ev.scan = c.scan
    const why = c.scan?.upgraded ? ` (${c.scan.why})` : ''
    if (!long) fails.push(`image: no image / size unknown${why}`)
    else if (long < MIN_LONG_EDGE) fails.push(`image: long edge ${long}px < ${MIN_LONG_EDGE}px${why}`)
    else passes.push(`image: long edge ${long}px >= ${MIN_LONG_EDGE}px${why}`)
  }

  return { pass: fails.length === 0, reasons: fails.length ? fails : passes, evidence: ev }
}
