// node --test curation/real-art/
// Offline fixtures for NGA, the Rijksmuseum, the Getty and SMK: their licence,
// flat-art and US-date rules, and how their records map. Shapes follow live
// records (Oct 2026).

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clear, licenceLabel, peopleFromCredits } from './clearance.mjs'
import { gettyCredits, gettyRecord } from './getty.mjs'
import { csvRows, ngaCredits, ngaRecord } from './nga.mjs'
import { rijksArtistName, rijksCredits, rijksLife, rijksRecord, rijksTitle } from './rijks.mjs'
import { smkArtistName, smkCredits, smkName, smkRecord } from './smk.mjs'

const CUT = 1955 // = cutoffYear(2026)
const US = 1930 // = usCutoffYear(2026)
const judge = (c) => clear(c, { cutoff: CUT, usCutoff: US })
const says = (r, re) => r.reasons.some((x) => re.test(x))
const PDM = 'https://creativecommons.org/publicdomain/mark/1.0/'
const CC0 = 'http://creativecommons.org/publicdomain/zero/1.0/'
const AAT = (n) => `http://vocab.getty.edu/aat/${n}`
const EN = [{ id: AAT(300388277) }]
const NL = [{ id: AAT(300388256) }]

const work = (source, extra = {}) => ({
  source, type_label: { rijks: 'painting', getty: 'Paintings' }[source] || 'Painting', medium: 'oil on canvas', object_end: 1889, width: 4000, height: 3000,
  who: peopleFromCredits([{ name: 'Vincent van Gogh', life: 'Dutch, 1853 - 1890', from: 'test' }]),
  ...extra,
})

test('licence: only each museum\'s own public-domain or CC0 mark', () => {
  assert.equal(judge(work('nga', { license_value: '1' })).pass, true)
  assert.ok(says(judge(work('nga', { license_value: '0' })), /^licence: published_images.openaccess = "0"/))
  assert.equal(judge(work('nga', { license_value: null })).pass, false) // no published image
  assert.equal(judge(work('rijks', { license_value: PDM })).pass, true)
  assert.equal(judge(work('rijks', { license_value: 'https://creativecommons.org/publicdomain/zero/1.0/' })).pass, true)
  assert.equal(judge(work('rijks', { license_value: 'http://rightsstatements.org/vocab/InC/1.0/' })).pass, false)
  assert.equal(judge(work('getty', { license_value: CC0 })).pass, true)
  assert.equal(judge(work('getty', { license_value: 'https://rightsstatements.org/vocab/InC/1.0/' })).pass, false)
  // The object says CC0 but its image doesn't.
  assert.equal(judge(work('getty', { license_value: `object ${CC0}; image https://rightsstatements.org/vocab/UND/1.0/` })).pass, false)
  assert.equal(judge(work('smk', { license_value: { public_domain: true, rights: PDM } })).pass, true)
  assert.equal(judge(work('smk', { license_value: { public_domain: false, rights: 'https://www.smk.dk/section/brug-af-museets-materiale/' } })).pass, false)
  assert.equal(judge(work('smk', { license_value: { public_domain: true, rights: null } })).pass, false)
  assert.equal(licenceLabel('rijks', PDM), 'Public Domain')
  assert.equal(licenceLabel('rijks', 'https://creativecommons.org/publicdomain/zero/1.0/'), 'CC0')
  assert.equal(licenceLabel('smk', { public_domain: true, rights: PDM }), 'Public Domain')
  assert.equal(licenceLabel('nga', '1'), 'CC0')
  assert.equal(licenceLabel('getty', CC0), 'CC0')
  assert.equal(licenceLabel('nga', '0'), null)
})

test('flat art in each museum\'s own terms', () => {
  const flat = (source, type_label, license_value) => judge(work(source, { type_label, license_value })).pass
  assert.equal(flat('nga', 'Painting', '1'), true)
  assert.equal(flat('nga', 'Index of American Design', '1'), true)
  assert.equal(flat('nga', 'Photograph', '1'), false)
  assert.equal(flat('nga', 'Sculpture', '1'), false)
  assert.equal(flat('nga', 'Volume', '1'), false)
  assert.equal(flat('rijks', 'painting', PDM), true)
  assert.equal(flat('rijks', 'print / historieprent', PDM), true)
  assert.equal(flat('rijks', 'schetsboekblad', PDM), true)
  assert.equal(flat('rijks', 'salt (condiment vessel)', PDM), false)
  assert.equal(flat('rijks', 'photograph', PDM), false)
  assert.equal(flat('rijks', 'frame', PDM), false)
  assert.equal(flat('getty', 'Paintings', CC0), true)
  assert.equal(flat('getty', 'Paintings / Panel Paintings', CC0), true)
  assert.equal(flat('getty', 'Drawings / Rectos', CC0), true)
  assert.equal(flat('getty', 'Miniatures (Paintings)', CC0), true) // a cut-out leaf
  assert.equal(flat('getty', 'Miniatures (Paintings) / Manuscripts', CC0), false) // still in its book
  assert.equal(flat('getty', 'Photographs', CC0), false)
  const smk = (names) => flat('smk', names, { public_domain: true, rights: PDM })
  assert.equal(smk('Painting'), true)
  assert.equal(smk('Lithograph / Print'), true)
  assert.equal(smk('Watercolour / Drawing'), true)
  assert.equal(smk('Relief'), false)
  assert.equal(smk('Statue'), false)
  assert.equal(smk('Collage / Drawing'), false)
})

test('US safety: the Rijksmuseum and SMK need a date of 1930 or earlier unless every artist died by then; NGA and the Getty waive their own', () => {
  // Mondrian died in 1944: life+70 has run, but a 1940 work may be in US copyright.
  const mondrian = peopleFromCredits([{ name: 'Piet Mondrian', birth: 1872, death: 1944, from: 'test' }])
  const late = (source, license_value) => judge(work(source, { license_value, object_end: 1940, who: mondrian }))
  assert.deepEqual(late('rijks', PDM).reasons, ['US: dated 1940 > 1930 — may still be in US copyright'])
  assert.deepEqual(late('smk', { public_domain: true, rights: PDM }).reasons, ['US: dated 1940 > 1930 — may still be in US copyright'])
  assert.equal(late('nga', '1').pass, true)
  assert.equal(late('getty', CC0).pass, true)
  assert.ok(says(judge(work('smk', { license_value: { public_domain: true, rights: PDM }, object_end: null, who: mondrian })), /^US: no usable date/))
  // An artist who died by 1930 can't have made a later work: an unknown or bogus date passes.
  const vermeer = peopleFromCredits([{ name: 'Johannes Vermeer', birth: 1632, death: 1675, from: 'test' }])
  assert.ok(says(judge(work('smk', { license_value: { public_domain: true, rights: PDM }, object_end: null, who: vermeer })), /^US: every artist died by 1930 \(last in 1675\)/))
  // A date after the artist's death is ignored; Mondrian's 1999 is a data error.
  assert.ok(says(judge(work('rijks', { license_value: PDM, object_end: 1999, dates: [{ year: 1920, latest: 1920 }, { year: 1999, latest: 1999 }], who: mondrian })), /^US: dated 1920 <= 1930 \(ignoring 1999/))
  assert.ok(says(judge(work('rijks', { license_value: PDM, object_end: 1930, who: mondrian })), /^US: dated 1930 <= 1930/))
})

test('CSV: quoted commas, doubled quotes, newlines and CRLF', () => {
  const rows = [...csvRows('a,b,c\r\n1,"x, y","say ""hi"""\n2,"two\nlines",\n')]
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', 'x, y', 'say "hi"'], ['2', 'two\nlines', '']])
})

// nga:50724, Ginevra de' Benci
const GINEVRA = {
  o: {
    objectid: '50724', accessionnum: '1967.6.1.a', title: "Ginevra de' Benci [obverse]", displaydate: 'c. 1474/1478', endyear: '1478',
    medium: 'oil on panel', attribution: 'Leonardo da Vinci', creditline: 'Ailsa Mellon Bruce Fund', classification: 'Painting', wikidataid: 'Q1267893',
  },
  artists: [{ order: 1, role: 'painter', prefix: '', name: 'Leonardo da Vinci', life: 'Florentine, 1452 - 1519', type: 'individual' }],
  image: { iiifurl: 'https://api.nga.gov/iiif/8f29e3c9-a289-4d53-abf0-31a66e9e98fa', width: '23235', height: '23968', openaccess: '1' },
}

test('NGA: a record from the open-data export', () => {
  const r = ngaRecord(GINEVRA)
  assert.equal(r.original_title, "Ginevra de' Benci")
  assert.equal(r.artist, 'Leonardo da Vinci')
  assert.equal(r.artist_dates, '1452–1519')
  assert.equal(r.license, 'CC0')
  assert.equal(r.source_url, 'https://www.nga.gov/collection/art-object-page.50724.html')
  assert.equal(r.image_url, 'https://api.nga.gov/iiif/8f29e3c9-a289-4d53-abf0-31a66e9e98fa/full/full/0/default.jpg')
  assert.deepEqual(r._wd, { id: '50724', inv: '1967.6.1.a', qid: 'Q1267893' })
  assert.equal(judge(r._gate).pass, true)
  const shut = ngaRecord({ ...GINEVRA, image: { ...GINEVRA.image, openaccess: '0' } })
  assert.equal(shut.license, null)
  assert.equal(judge(shut._gate).pass, false)
})

test('NGA: name prefixes that qualify an attribution, and ones that only join names', () => {
  const q = (prefix) => ngaCredits([{ name: 'X', prefix, role: 'artist', life: 'Dutch, 1600 - 1650' }])[0].qualifier
  assert.equal(q(''), null)
  assert.equal(q('and'), null)
  assert.equal(q(','), null)
  assert.equal(q('Attributed to'), 'Attributed to')
  assert.equal(q('and Workshop of'), 'Workshop of')
  assert.equal(q('or'), 'or') // "X or Y": the hand is uncertain
  assert.equal(q('Painted by'), null)
  const who = (artists, extra = {}) => peopleFromCredits(ngaCredits(artists.map((a) => ({ role: 'artist', life: '', type: 'individual', ...a, ...extra }))))
  // A former attribution names no author; an anonymous constituent is anonymous.
  assert.equal(who([{ name: 'Rembrandt van Rijn', prefix: 'formerly', life: 'Dutch, 1606 - 1669' }]).people.length, 0)
  assert.equal(who([{ name: 'Anonymous Artist', prefix: '', type: 'anonymous' }]).anonymous, true)
  // A credit whose constituent is missing is an undated maker, not an anonymous one.
  const missing = who([{ name: null, prefix: '' }])
  assert.deepEqual([missing.anonymous, missing.people.length], [false, 1])
  // A late "Attributed to" work is judged on X's own dates.
  const late = ngaRecord({ ...GINEVRA, o: { ...GINEVRA.o, endyear: '1905', attribution: 'Attributed to X' }, artists: [{ name: 'X', prefix: 'Attributed to', role: 'artist', life: 'American, 1850 - 1910' }] })
  assert.equal(judge(late._gate).pass, true)
  assert.equal(judge(late._gate).evidence.attribution_qualifier, 'Attributed to X')
})

// rijks:SK-A-15 and friends: production parts as the Linked Art API returns them.
const person = (id, name) => ({ id: `https://id.rijksmuseum.nl/${id}`, type: 'Person', notation: [{ '@language': 'en', '@value': name }] })
const part = (statement, extra) => ({
  type: 'Production', technique: [{ notation: [{ '@language': 'en', '@value': 'painter' }] }],
  referred_to_by: [{ content: `painter: ${statement}`, language: EN }], ...extra,
})
const lives = new Map([
  ['https://id.rijksmuseum.nl/2101574', { record: { born: { timespan: { identified_by: [{ content: '1633' }], end_of_the_end: '1633-12-31T23:59:59Z' } }, died: { timespan: { identified_by: [{ content: '1702' }], end_of_the_end: '1702-12-31T23:59:59Z' } } } }],
])

test('Rijksmuseum: who made it, and with what qualifier', () => {
  const credits = (p) => rijksCredits({ produced_by: { part: [p] } }, lives)
  const [direct] = credits(part('Johannes Vermeer', { carried_out_by: [person(2101778, 'Johannes Vermeer')] }))
  assert.equal(direct.qualifier, null)
  // An AttributeAssignment typed "attributed to".
  const [attributed] = credits(part('attributed to Jan de Baen', {
    assigned_by: [{ type: 'AttributeAssignment', assigned: [person(2101574, 'Jan de Baen')], assigned_property: 'carried_out_by', classified_as: [{ id: AAT(300404269) }] }],
  }))
  assert.equal(attributed.qualifier, 'attributed to')
  assert.equal(attributed.death, 1702)
  // "signed by artist": an assignment motivated by a signature credits the artist plainly.
  const [signed] = credits(part('Frans Hals (signed by artist)', {
    assigned_by: [{ type: 'AttributeAssignment', assigned: [person(2102576, 'Frans Hals')], motivated_by: [{ classified_as: [{ id: AAT(300028705) }] }] }],
  }))
  assert.equal(signed.qualifier, null)
  // "school of Rembrandt": a Group formed under his influence.
  const [school] = credits(part('school of Rembrandt van Rijn', {
    assigned_by: [{ type: 'AttributeAssignment', classified_as: [{ id: AAT(300404283) }], assigned: [{ type: 'Group', formed_by: { influenced_by: [person(2103429, 'Rembrandt van Rijn')] } }] }],
  }))
  assert.equal(school.qualifier, 'school of')
  assert.equal(school.name, 'Rembrandt van Rijn')
  const [possibly] = credits(part('Adam van Vianen (I) (possibly)', {
    assigned_by: [{ type: 'AttributeAssignment', classified_as: [{ id: AAT(300435722) }], assigned: [person(2103942, 'Adam van Vianen (I)')] }],
  }))
  assert.equal(possibly.qualifier, 'possibly')
  // "[rejected attribution]" names no author.
  const [rejected] = credits(part('circle of Rembrandt van Rijn [rejected attribution]', { carried_out_by: [person(2103429, 'Rembrandt van Rijn')] }))
  assert.equal(peopleFromCredits([rejected]).people.length, 0)
})

test('Rijksmuseum: life dates, titles and artist lines', () => {
  const ts = (shown, end, begin = end) => ({ timespan: { identified_by: [{ content: shown }], begin_of_the_begin: `${begin}-01-01T00:00:00Z`, end_of_the_end: `${end}-12-31T23:59:59Z` } })
  assert.deepEqual(rijksLife({ born: ts('c. 1450', 1450), died: ts('1516', 1516) }), { birth: 1450, birthApprox: true, death: 1516, deathApprox: false, deathAfter: null })
  assert.equal(rijksLife({ died: ts('after 1675', 1675) }).deathAfter, 1675)
  assert.equal(rijksLife({ died: ts('1675-12 - 1675-12-15', 1675) }).death, 1675)
  assert.equal(rijksArtistName('Frans Hals (signed by artist)'), 'Frans Hals')
  assert.equal(rijksArtistName('Albrecht Dürer (mentioned on object)'), 'Albrecht Dürer')
  assert.equal(rijksArtistName('Gerard ter Borch (II)'), 'Gerard ter Borch (II)')
  assert.equal(rijksArtistName('Adam van Vianen (I) (possibly)'), 'Possibly Adam van Vianen (I)')
  assert.equal(rijksArtistName('attributed to Jan de Baen'), 'Attributed to Jan de Baen')
  const name = (content, language, cls) => ({ type: 'Name', content, language, classified_as: cls.map((id) => ({ id })) })
  // rijks:SK-A-2344: an English preferred title beats a Dutch one and a former title.
  assert.equal(rijksTitle({ identified_by: [
    name('De melkmeid', NL, ['https://id.rijksmuseum.nl/22015528']), name('Het melkmeisje', NL, [AAT(300404670)]), name('The Milkmaid', EN, [AAT(300417207), AAT(300404670)]),
  ] }), 'The Milkmaid')
})

const MILKMAID = {
  id: 'https://id.rijksmuseum.nl/200108369', type: 'HumanMadeObject',
  identified_by: [
    { type: 'Identifier', content: 'SK-A-2344', classified_as: [{ id: AAT(300312355) }] },
    { type: 'Name', content: 'The Milkmaid', language: EN, classified_as: [{ id: AAT(300404670) }] },
  ],
  classified_as: [{ id: 'https://id.rijksmuseum.nl/2208', notation: [{ '@language': 'en', '@value': 'painting' }], classified_as: [{ id: AAT(300435443) }] }],
  produced_by: {
    timespan: { identified_by: [{ content: 'c. 1660', language: EN }], begin_of_the_begin: '1660-01-01T00:00:00Z', end_of_the_end: '1660-12-31T23:59:59Z' },
    referred_to_by: [{ content: 'Johannes Vermeer', language: EN, classified_as: [{ id: AAT(300435416) }] }],
    part: [part('Johannes Vermeer', { carried_out_by: [person(2101778, 'Johannes Vermeer')] })],
  },
  referred_to_by: [{ content: 'Purchased with the support of the Vereniging Rembrandt', language: EN, classified_as: [{ id: AAT(300026687) }] }],
  member_of: [{ id: 'https://id.rijksmuseum.nl/260213' }],
}
const VERMEER = new Map([['https://id.rijksmuseum.nl/2101778', {
  name: 'Johannes Vermeer',
  record: { born: { timespan: { identified_by: [{ content: '1632 - 1632-10-31' }], end_of_the_end: '1632-10-31T23:59:59Z' } }, died: { timespan: { identified_by: [{ content: '1675-12 - 1675-12-15' }], end_of_the_end: '1675-12-15T23:59:59Z' } } },
}]])

test('Rijksmuseum: a record, and a circa date counted as written', () => {
  const image = { url: 'https://iiif.micr.io/QkOGy/full/max/0/default.jpg', width: 4649, height: 5177 }
  const r = rijksRecord({ obj: MILKMAID, rights: PDM, image, persons: VERMEER })
  assert.equal(r.object_id, 'rijks:SK-A-2344')
  assert.equal(r.original_title, 'The Milkmaid')
  assert.equal(r.artist, 'Johannes Vermeer')
  assert.equal(r.artist_dates, '1632–1675')
  assert.equal(r.license, 'Public Domain')
  assert.equal(r.source_url, 'https://www.rijksmuseum.nl/en/collection/SK-A-2344')
  assert.equal(r.fame.highlight, true) // in the museum's Top 100
  assert.equal(r._gate.object_end, 1660)
  assert.equal(judge(r._gate).pass, true)
  const in1925 = rijksRecord({ obj: { ...MILKMAID, produced_by: { ...MILKMAID.produced_by, timespan: { ...MILKMAID.produced_by.timespan, identified_by: [{ content: 'c. 1925', language: EN }], begin_of_the_begin: '1925-01-01T00:00:00Z', end_of_the_end: '1925-12-31T23:59:59Z' } } }, rights: PDM, image, persons: VERMEER })
  assert.equal(in1925._gate.object_end, 1925)
})

test('Getty: producers, prefixes and the record', () => {
  const [plain, prefixed, unknown] = gettyCredits([
    { producer: 'Vincent van Gogh (Dutch, 1853 - 1890)', pname: 'Vincent van Gogh', pdates: 'Dutch, 1853 - 1890' },
    { producer: 'Attributed to the Del Chiaro Painter', prefix: 'Attributed to the', pname: 'Del Chiaro Painter' },
    { producer: 'Unknown maker, French' },
  ])
  assert.deepEqual([plain.name, plain.qualifier, plain.life], ['Vincent van Gogh', null, 'Dutch, 1853 - 1890'])
  assert.equal(prefixed.qualifier, 'Attributed to the')
  assert.equal(unknown.anonymous, true)
  // getty:c88b3df0…, Irises
  const irises = {
    iri: 'https://data.getty.edu/museum/collection/object/c88b3df0-de91-4f5b-a9ef-7b2b9a6d8abb', title: 'Irises', acc: '90.PA.20', date: '1889', end: '1889-12-31T23:59:59.000Z',
    types: [AAT(300133025), AAT(300033618), AAT(300033618)], rights: [CC0], page: 'https://www.getty.edu/art/collection/object/103JNH', medium: 'Oil on canvas',
    producers: new Map([['…/production/6e45', { producer: 'Vincent van Gogh (Dutch, 1853 - 1890)', pname: 'Vincent van Gogh', pdates: 'Dutch, 1853 - 1890' }]]),
  }
  const manifest = { rights: CC0, width: 9021, height: 7122, base: 'https://media.getty.edu/iiif/image/8c255d80-7382-46db-9fa8-892c0d37247e' }
  const r = gettyRecord(irises, manifest)
  assert.equal(r.artist, 'Vincent van Gogh')
  assert.equal(r.classification, 'Paintings')
  assert.equal(r.license, 'CC0')
  assert.deepEqual(r._wd, { id: '103JNH', inv: '90.PA.20', qid: null })
  assert.equal(judge(r._gate).pass, true)
  assert.equal(judge(gettyRecord(irises, { ...manifest, rights: 'https://rightsstatements.org/vocab/InC/1.0/' })._gate).pass, false)
})

test('SMK: names, roles and the record', () => {
  assert.equal(smkName('Hammershøi, Vilhelm'), 'Vilhelm Hammershøi')
  assert.equal(smkName('Haarlem, Cornelis Cornelisz. van'), 'Cornelis Cornelisz. van Haarlem')
  assert.equal(smkName('Guercino'), 'Guercino')
  const credits = (production) => smkCredits(production)
  const pan = credits([ // smk:KKS10460
    { creator: 'Flint, Andreas', creator_date_of_birth: '1767-03-04T00:00:00.000Z', creator_date_of_death: '1824-09-19T00:00:00.000Z' },
    { creator: 'Wiedewelt, Johannes', creator_role: 'after', creator_date_of_birth: '1731-07-01T00:00:00.000Z', creator_date_of_death: '1802-12-17T00:00:00.000Z' },
    { creator: 'Tode, Johann Clemens', creator_role: 'Author', creator_date_of_birth: '1735-12-31T00:00:00.000Z', creator_date_of_death: '1805-12-31T00:00:00.000Z' },
  ])
  assert.equal(smkArtistName(pan), 'Andreas Flint after Johannes Wiedewelt')
  assert.deepEqual(pan.map((c) => c.qualifier), [null, 'after', null])
  assert.equal(smkArtistName(credits([{ creator: 'Rubens, Peter Paul', creator_role: 'copy after' }])), 'Copy after Peter Paul Rubens')
  assert.equal(smkArtistName(credits([{ creator: 'Unknown Danish' }])), 'Unknown artist')
  // An earlier ascription isn't an author; a publisher is a printer/publisher.
  const who = peopleFromCredits(credits([{ creator: 'Unknown Danish' }, { creator: 'Mandelberg, Johan', creator_role: 'earlier ascribed to', creator_date_of_death: '1786-01-08T00:00:00.000Z' }]))
  assert.deepEqual([who.anonymous, who.people.length], [true, 0])
  // smk:KMS3716
  const ring = {
    object_number: 'KMS3716', titles: [{ title: "At the French Windows. The Artist's Wife", language: 'engelsk' }], object_names: [{ name: 'Painting' }],
    production: [{ creator: 'Ring, L.A.', creator_date_of_birth: '1854-08-15T00:00:00.000Z', creator_date_of_death: '1933-09-10T00:00:00.000Z' }],
    production_date: [{ start: '1897-01-01T00:00:00.000Z', end: '1897-12-31T00:00:00.000Z', period: '1897' }], techniques: ['Oil on canvas'],
    public_domain: true, rights: PDM, has_image: true, image_width: 4781, image_height: 6333,
    image_iiif_id: 'https://iip.smk.dk/iiif/jp2/1544bs13w_kms3716.tif.reconstructed.tif.jp2', frontend_url: 'https://open.smk.dk/artwork/image/KMS3716',
  }
  const r = smkRecord(ring)
  assert.equal(r.artist, 'L.A. Ring')
  assert.equal(r.artist_dates, '1854–1933')
  assert.equal(r.license, 'Public Domain')
  assert.equal(r.image_url, 'https://iip.smk.dk/iiif/jp2/1544bs13w_kms3716.tif.reconstructed.tif.jp2/full/full/0/default.jpg')
  assert.equal(judge(r._gate).pass, true)
  // Ring died in 1933, so a 1931 work passes life+70 but not the US date; "ca." counts as written.
  const late = smkRecord({ ...ring, production_date: [{ end: '1931-12-31T00:00:00.000Z', period: '1931' }] })
  assert.deepEqual(judge(late._gate).reasons, ['US: dated 1931 > 1930 — may still be in US copyright'])
  assert.equal(smkRecord({ ...ring, production_date: [{ end: '1925-12-31T00:00:00.000Z', period: 'ca. 1925' }] })._gate.object_end, 1925)
})
