// node --test curation/real-art/
// Offline fixtures for the Commons lane's gate (licence, US date, Italy, flat
// art) and how it names artists and holders. Shapes follow live Wikidata and
// Commons records (Oct 2026).

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clear, commonsLicence, italianPublic, peopleFromWikidata, usCutoffYear } from './clearance.mjs'
import { releaseOf, shownHolder, wikidataArtistName } from './commons.mjs'

const CUT = 1955 // = cutoffYear(2026)
const US = 1930 // = usCutoffYear(2026)
const judge = (c) => clear(c, { cutoff: CUT, usCutoff: US })
const says = (r, re) => r.reasons.some((x) => re.test(x))

const PD_FILE = {
  file: 'Van Gogh - Starry Night - Google Art Project.jpg', License: 'pd', LicenseShortName: 'Public domain', Copyrighted: 'False',
  categories: ['The Starry Night by van Gogh', 'PD-old-100-expired', 'PD-Art (PD-old-100-expired)', 'CC-PD-Mark', 'Large images'],
}
const MOMA = { qid: 'Q188740', label: 'Museum of Modern Art', countries: ['Q30'], types: ['Q207694'], runBy: [] }
const vanGogh = { kind: 'creator', qid: 'Q5582', label: 'Vincent van Gogh', birth: 1853, death: 1890 }

// wd:Q45585, The Starry Night
const starry = (extra = {}) => ({
  source: 'commons', license_value: PD_FILE, type_label: 'painting', medium: 'oil paint, canvas', object_end: 1889,
  who: peopleFromWikidata([vanGogh]), width: 44567, height: 35291,
  p31: ['Q3305213'], p186: ['Q296955', 'Q12321255'], holders: [MOMA],
  ...extra,
})

test('the US cutoff is 95 years from publication', () => {
  assert.equal(usCutoffYear(2026), 1930)
  assert.equal(usCutoffYear(2030), 1934)
})

test('The Starry Night passes every check', () => {
  const r = judge(starry())
  assert.equal(r.pass, true, r.reasons.join('\n'))
  assert.ok(says(r, /^US: every artist died by 1930 \(last in 1890\)/))
  assert.ok(says(r, /^holder: Museum of Modern Art — not an Italian public collection/))
  assert.deepEqual(r.evidence.license_flag['Commons file licence'].categories, ['PD-old-100-expired', 'PD-Art (PD-old-100-expired)', 'CC-PD-Mark'])
})

test('licence: only a file Commons marks public domain, with no rights claim', () => {
  const lic = (v) => judge(starry({ license_value: { ...PD_FILE, ...v } }))
  // wd:Q500554, At Eternity's Gate: a self-published CC BY-SA photo.
  const ccby = lic({ License: 'cc-by-sa-4.0', LicenseShortName: 'CC BY-SA 4.0', Copyrighted: 'True', categories: ['Self-published work'] })
  assert.equal(ccby.pass, false)
  assert.ok(says(ccby, /^licence: /))
  assert.equal(lic({ License: 'cc-by-2.0', LicenseShortName: 'CC BY 2.0', Copyrighted: null }).pass, false)
  // The Städel's "PDM-owner": no machine-readable licence and marked copyrighted.
  assert.equal(lic({ License: null, LicenseShortName: 'PDM-owner', Copyrighted: 'True', categories: ['PDMark-owner'] }).pass, false)
  // PD-Art plus a photographer's CC BY-SA ("Licensed-PD-Art").
  const dual = lic({ categories: ['PD-Art (PD-old-100)', 'CC-BY-SA-4.0'] })
  assert.equal(dual.pass, false)
  assert.ok(says(dual, /CC-BY-SA-4\.0/))
  assert.equal(lic({ License: null, LicenseShortName: null, Copyrighted: null, categories: ['PD-Art (PD-old-100)'] }).pass, true)
  assert.equal(lic({ License: 'cc0', LicenseShortName: 'CC0', categories: [] }).pass, true)
  // Commons marks CC0 files Copyrighted (wd:Q1752990's file, uploaded by the Met).
  assert.equal(lic({ License: 'cc0', LicenseShortName: 'CC0', Copyrighted: 'True', categories: ['CC-Zero'] }).pass, true)
  assert.equal(lic({ License: null, LicenseShortName: null, Copyrighted: null, categories: [] }).pass, false)
  assert.equal(lic({ License: 'unknown', LicenseShortName: 'Unknown', categories: [] }).pass, false)
  assert.equal(judge(starry({ license_value: null })).pass, false)
  assert.equal(commonsLicence({ file: 'x.jpg', License: 'gfdl', LicenseShortName: 'GFDL' }).ok, false)
})

const MONDRIAN = { kind: 'creator', qid: 'Q151803', label: 'Piet Mondrian', birth: 1872, death: 1944 }
const MUNCH = { kind: 'creator', qid: 'Q41406', label: 'Edvard Munch', birth: 1863, death: 1944 }

test('US safety: a work dated after 1930 fails when its artist died after 1930', () => {
  // wd:Q2915406, Broadway Boogie Woogie: Mondrian died 1944, painted 1942-43.
  const mondrian = starry({ object_end: 1943, dates: [{ year: 1942, latest: 1943 }], who: peopleFromWikidata([MONDRIAN]) })
  const r = judge(mondrian)
  assert.equal(r.pass, false)
  assert.deepEqual(r.reasons, ['US: dated 1943 > 1930 — may still be in US copyright'])
  assert.equal(judge({ ...mondrian, dates: [{ year: 1930, latest: 1930 }] }).pass, true)
  // An approximate date counts as written.
  assert.equal(judge({ ...mondrian, dates: [{ year: 1930, latest: 1930, circa: true }] }).pass, true)
  const undated = judge({ ...mondrian, object_end: null, dates: [] })
  assert.equal(undated.pass, false)
  assert.ok(says(undated, /^US: no usable inception date/))
})

test('US safety: an artist who died by 1930 passes it whatever the date says', () => {
  // Bruegel's Massacre of the Innocents has no inception on Wikidata.
  const bruegel = starry({ object_end: null, dates: [], who: peopleFromWikidata([{ kind: 'creator', qid: 'Q43270', label: 'Pieter Bruegel the Elder', birth: 1525, death: 1569 }]) })
  const r = judge(bruegel)
  assert.equal(r.pass, true, r.reasons.join('\n'))
  assert.ok(says(r, /^US: every artist died by 1930 \(last in 1569\)/))
  // Every artist needs a known death year by 1930.
  const both = (p2) => judge(starry({ object_end: null, dates: [], who: peopleFromWikidata([vanGogh, p2]) }))
  assert.ok(says(both(MONDRIAN), /^US: no usable inception date/))
  assert.ok(says(both({ kind: 'creator', qid: 'Q2', label: 'Undated Painter', birth: 1700 }), /^US: no usable inception date/))
})

test('US safety ignores dates after the artist died', () => {
  // Munch's Dance of Life: 1899-1900, plus a bogus "2000".
  const dance = starry({ object_end: 2000, dates: [{ year: 1899, latest: 1900 }, { year: 2000, latest: 2000 }], who: peopleFromWikidata([MUNCH]) })
  const r = judge(dance)
  assert.ok(says(r, /^US: dated 1900 <= 1930 \(ignoring 2000, after the artist's death in 1944\)/), r.reasons.join('\n'))
  assert.deepEqual(r.evidence.us_dates_ignored, [2000])
  // Only a bogus date: unknown, so an artist who died after 1930 still fails.
  const onlyBogus = judge({ ...dance, dates: [{ year: 2000, latest: 2000 }] })
  assert.ok(says(onlyBogus, /^US: no usable inception date \(P571\) \(ignoring 2000/))
  // A date range running past the death is capped at it.
  assert.ok(says(judge({ ...dance, dates: [{ year: 1925, latest: 1999 }] }), /^US: dated 1944 > 1930/))
  // Munch's Self-Portrait. Between the Clock and the Bed (1940-43): still out.
  assert.equal(judge({ ...dance, dates: [{ year: 1940, latest: 1943 }] }).pass, false)
})

test('life+70 applies as for the museums', () => {
  // Picasso (d. 1973) fails on life+70 as well as the US date.
  const picasso = judge(starry({ object_end: 1937, who: peopleFromWikidata([{ kind: 'creator', qid: 'Q5593', label: 'Pablo Picasso', birth: 1881, death: 1973 }]) }))
  assert.ok(says(picasso, /died 1973 > 1955 — still in copyright/) && says(picasso, /^US: dated 1937/))
  // A circa death year counts as written.
  assert.equal(judge(starry({ who: peopleFromWikidata([{ ...vanGogh, death: 1950, deathApprox: true }]), object_end: 1920 })).pass, true)
  // Unknown value as creator (anonymous): judged from the work's date, + 60.
  const anon = (end) => judge(starry({ object_end: end, who: peopleFromWikidata([{ kind: 'creator', qid: null, label: null }]) }))
  assert.equal(anon(1895).pass, true)
  assert.equal(anon(1896).pass, false)
  assert.equal(judge(starry({ object_end: 1850, who: peopleFromWikidata([]) })).pass, true) // no P170 at all: anonymous
  // "Workshop of" (P1774 on an unknown-value P170) is judged on Rembrandt's dates.
  const workshop = (end) => judge(starry({
    object_end: end,
    who: peopleFromWikidata([{ kind: 'creator', qid: null }, { kind: 'workshop of', qid: 'Q5598', label: 'Rembrandt', birth: 1606, death: 1669 }]),
  }))
  assert.equal(workshop(1650).pass, true)
  assert.equal(workshop(1650).evidence.attribution_qualifier, 'workshop of Rembrandt')
  const attributed = judge(starry({ object_end: 1925, who: peopleFromWikidata([{ ...vanGogh, nature: 'attribution' }]) }))
  assert.equal(attributed.pass, true)
  // Landscape with the Fall of Icarus: Bruegel as creator and as "possibly" is one person.
  assert.equal(peopleFromWikidata([vanGogh, { ...vanGogh, kind: 'possibly' }]).people.length, 1)
  // A creator with no dates is judged from the work's date.
  assert.equal(judge(starry({ object_end: 1500, who: peopleFromWikidata([{ kind: 'creator', qid: 'Q1', label: 'Master of X' }]) })).pass, true)
  assert.equal(judge(starry({ object_end: 1900, who: peopleFromWikidata([{ kind: 'creator', qid: 'Q1', label: 'Master of X' }]) })).pass, false)
})

test('Italian public collections are out, whatever the licence', () => {
  const MINISTRY = { qid: 'Q1347047', types: ['Q1112537'], label: 'Ministry of Culture' }
  const uffizi = { qid: 'Q51252', label: 'Uffizi Gallery', countries: ['Q38'], types: ['Q207694'], runBy: [MINISTRY] }
  const r = judge(starry({ holders: [uffizi] }))
  assert.equal(r.pass, false)
  assert.deepEqual(r.reasons, ['holder Uffizi Gallery: Italian public collection (owned or run by Ministry of Culture (ministry of Italy))'])
  // A Ministry museum by class, a civic one by class, one owned by Italy, one by its comune.
  assert.match(italianPublic({ label: 'Pinacoteca di Brera', countries: ['Q38'], types: ['Q124830411'] }), /Ministry of Culture/)
  assert.match(italianPublic({ label: 'Capitoline Museums', countries: ['Q38'], types: ['Q124830213'] }), /public entity/)
  assert.equal(italianPublic({ label: 'Galleria Borghese', countries: ['Q38'], runBy: [{ qid: 'Q38', types: ['Q6256'] }] }), 'owned or run by Italy')
  assert.match(italianPublic({ label: 'Palazzo Bianco', countries: ['Q38'], runBy: [{ qid: 'Q1449', types: ['Q747074'], label: 'Genoa' }] }), /comune of Italy/)
  // Untyped and unowned on Wikidata: the name decides.
  assert.match(italianPublic({ label: 'Galleria Palatina', countries: ['Q38'], types: ['Q207694'] }), /by name/)
  assert.match(italianPublic({ label: 'Museo Civico di Sansepolcro', countries: ['Q38'] }), /by name/)
  // Private and church holders in Italy, and "National" museums elsewhere, pass.
  assert.equal(italianPublic({ label: 'Galleria Doria Pamphilj', countries: ['Q38'], types: ['Q2087181'] }), null)
  assert.equal(italianPublic({ label: 'National Gallery', countries: ['Q145'], types: ['Q207694'] }), null)
  // One Italian public holder among several still fails.
  assert.equal(judge(starry({ holders: [MOMA, uffizi] })).pass, false)
  // No holder: can't rule Italy out.
  assert.ok(says(judge(starry({ holders: [] })), /^holder: no current collection/))
})

test('flat art: paintings, and triptychs or altarpieces only when painted', () => {
  assert.equal(judge(starry({ p31: ['Q79218', 'Q3305213'] })).pass, true) // The Garden of Earthly Delights
  assert.equal(judge(starry({ p31: ['Q15711026'], p186: ['Q175166', 'Q106857709'] })).pass, true) // tempera on panel
  // wd:Q1737783, the Kefermarkt Altarpiece: a carved limewood triptych.
  const kefermarkt = judge(starry({ p31: ['Q79218'], p186: ['Q1123657'], type_label: 'triptych', medium: 'limewood' }))
  assert.equal(kefermarkt.pass, false)
  assert.ok(says(kefermarkt, /^medium: Wikidata P31 \(P186\) "triptych" \(limewood\) is not a painting/))
  assert.equal(judge(starry({ p31: ['Q3305213', 'Q245117'] })).pass, false) // a painted relief
  assert.equal(judge(starry({ p31: ['Q93184'] })).pass, false) // a drawing: not this lane
})

test('a museum that holds the work and releases a usable image wins; one that withholds it lets Commons in', () => {
  const MET = 'The Metropolitan Museum of Art'
  // wd:Q432253, Garden at Sainte-Adresse: met:437133 has isPublicDomain false and no image.
  const withheld = judge(starry({ open_museum: { museum: MET, object_id: 'met:437133', releases: false, why: 'isPublicDomain = false' } }))
  assert.equal(withheld.pass, true)
  assert.ok(says(withheld, /^museum: The Metropolitan Museum of Art doesn't release a usable image \(isPublicDomain = false\); using Commons$/))
  assert.equal(withheld.evidence.open_museum.object_id, 'met:437133')
  // wd:Q1752990, The Death of Socrates: the Met releases it under CC0.
  const released = judge(starry({ open_museum: { museum: MET, object_id: 'met:436105', releases: true, why: 'isPublicDomain = true, 4000 px' } }))
  assert.deepEqual(released.reasons, ['museum: The Metropolitan Museum of Art releases its own image (met:436105); use that, not Commons'])
  // Can't tell: the museum's record is missing, or couldn't be fetched.
  const unknown = judge(starry({ open_museum: { museum: MET, object_id: null, releases: null, why: "Wikidata doesn't link to its record" } }))
  assert.equal(unknown.pass, false)
  assert.ok(says(unknown, /can't confirm it withholds its own image/))
})

test('what counts as a museum releasing a usable image', async () => {
  const rec = (source, license_value, extra = {}) => ({
    museum: 'M', object_id: `${source}:1`, image_url: 'https://img', width: 3000, height: 2000,
    _gate: { source, license_value }, ...extra,
  })
  const noProbe = () => { throw new Error('should not probe') }
  assert.deepEqual(await releaseOf('met', rec('met', false, { image_url: null }), noProbe),
    { museum: 'M', object_id: 'met:1', releases: false, why: 'isPublicDomain = false' })
  assert.equal((await releaseOf('met', rec('met', true, { image_url: null }), noProbe)).why, 'its record has no image')
  // AIC's American Gothic (aic:6565) is flagged not public domain, whatever its image.
  assert.equal((await releaseOf('aic', rec('aic', false), noProbe)).releases, false)
  assert.equal((await releaseOf('aic', rec('aic', true, { width: 1686, height: 1200 }), noProbe)).why, 'its image is 1686 px, under 1920')
  assert.equal((await releaseOf('aic', rec('aic', true, { width: 1920, height: 1200 }), noProbe)).releases, true)
  assert.equal((await releaseOf('cma', rec('cma', 'CC0'), noProbe)).releases, true)
  // The Met reports no size: read it from the image.
  const met = rec('met', true, { width: null, height: null })
  assert.equal((await releaseOf('met', met, async () => ({ width: 4000, height: 2663 }))).releases, true)
  assert.equal((await releaseOf('met', met, async () => ({ width: 1500, height: 1000 }))).releases, false)
  assert.equal((await releaseOf('met', met, async () => null)).releases, null)
})

test('size: the Commons file must reach 1920 px', () => {
  assert.equal(judge(starry({ width: 1375, height: 2000 })).pass, true) // The Blue Boy
  assert.equal(judge(starry({ width: 1920, height: 1500 })).pass, true)
  assert.equal(judge(starry({ width: 1919, height: 1500 })).pass, false)
  assert.equal(judge(starry({ width: 800, height: 443 })).pass, false)
  assert.equal(judge(starry({ width: null, height: null })).pass, false)
})

test('artist names read like a museum label', () => {
  assert.equal(wikidataArtistName([vanGogh]), 'Vincent van Gogh')
  assert.equal(wikidataArtistName([{ kind: 'creator', qid: null }, { kind: 'workshop of', qid: 'Q5598', label: 'Rembrandt' }]), 'Workshop of Rembrandt')
  assert.equal(wikidataArtistName([{ ...vanGogh, nature: 'attribution' }]), 'Attributed to Vincent van Gogh')
  // wd:Q734834, the Ghent Altarpiece
  assert.equal(wikidataArtistName([
    { kind: 'creator', qid: 'Q102272', label: 'Jan van Eyck' },
    { kind: 'creator', qid: 'Q456326', label: 'Hubert van Eyck', nature: 'presumably' },
  ]), 'Jan van Eyck and presumably Hubert van Eyck')
  // The same person as creator and as an attribution: say the attribution once.
  assert.equal(wikidataArtistName([{ ...vanGogh }, { ...vanGogh, kind: 'attributed to' }]), 'Attributed to Vincent van Gogh')
  assert.equal(wikidataArtistName([{ kind: 'creator', qid: 'Q4233718', label: 'anonymous' }]), 'Unknown artist')
  assert.equal(wikidataArtistName([]), 'Unknown artist')
})

test('the holder shown is the museum, not a department or a lender', () => {
  const holder = (h) => ({ links: 0, typeLabels: [], parents: [], countries: [], types: [], runBy: [], ...h })
  // wd:Q29530: the Louvre's Department of Paintings names the Louvre.
  const louvre = shownHolder({ locations: [], holders: [holder({ qid: 'Q3044768', label: 'Department of Paintings of the Louvre', typeLabels: ['curatorial department of the Louvre', 'art collection'], parents: [{ qid: 'Q19675', label: 'Louvre Museum' }] })] })
  assert.equal(louvre.label, 'Louvre Museum')
  // wd:Q219831: the Night Watch hangs (P276) in the Rijksmuseum, on loan from the Amsterdam Museum.
  const nightWatch = shownHolder({
    locations: ['Q190804'],
    holders: [holder({ qid: 'Q1820897', label: 'Amsterdam Museum', links: 60 }), holder({ qid: 'Q190804', label: 'Rijksmuseum', links: 50 })],
  })
  assert.equal(nightWatch.label, 'Rijksmuseum')
  // A sub-collection held alongside its parent drops out.
  const nga = shownHolder({
    locations: [],
    holders: [holder({ qid: 'Q46596638', label: 'Andrew W. Mellon collection', links: 900, typeLabels: ['art collection'], parents: [{ qid: 'Q214867', label: 'National Gallery of Art' }] }), holder({ qid: 'Q214867', label: 'National Gallery of Art', links: 80 })],
  })
  assert.equal(nga.label, 'National Gallery of Art')
  assert.equal(shownHolder({ locations: [], holders: [] }), null)
})
