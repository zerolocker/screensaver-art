// node --test curation/real-art/
// Offline fixtures for the copyright gate — the legal logic, pinned.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clear, cutoffYear, parseLifeFacts, peopleFromAic, peopleFromCma, peopleFromMet, toYear } from './clearance.mjs'
import { aicArtistName, cmaArtistName, formatDates, metArtistName } from './sources.mjs'

const CUT = 1955 // = cutoffYear(2026)
const life = (s) => parseLifeFacts(s).map(({ birth, death, deathAfter, floruit }) => ({ birth, death, deathAfter, floruit }))

test('cutoff is life+70 from the current year', () => {
  assert.equal(cutoffYear(2026), 1955)
  assert.equal(cutoffYear(2030), 1959)
})

test('parses the date shapes the three museums use', () => {
  assert.deepEqual(life('Gustave Caillebotte (French, 1848–1894)'), [{ birth: 1848, death: 1894, deathAfter: null, floruit: null }])
  assert.deepEqual(life('Katsushika Hokusai 葛飾 北斎 \nJapanese, 1760-1849')[0].death, 1849)
  assert.deepEqual(life('Jacob van Ruisdael (Dutch, 1628/29-1682)')[0].birth, 1629)
  assert.deepEqual(life('Martino di Bartolomeo (Italian, 1389-1434/5)')[0].death, 1435)
  assert.deepEqual(life('Martín de Soria (Spanish, active 1449–87)')[0].floruit, 1449)
  assert.deepEqual(life('Bernat Martorell (Spanish, active from 1427–died 1452)')[0].death, 1452)
  assert.deepEqual(life('Joshua Johnson (American, c. 1763–after 1825)')[0].deathAfter, 1825)
  assert.deepEqual(life('Vasily Kandinsky\nBorn Moscow (formerly Russian Empire, now Russia), 1866; died Neuilly-sur-Seine, France, 1944')[0].death, 1944)
  assert.deepEqual(life('Maurice Prendergast (American, born Newfoundland [now Canada], 1858–1924)')[0].death, 1924)
  assert.deepEqual(life('Pablo Picasso\nSpanish, active France, 1881-1973')[0], { birth: 1881, death: 1973, deathAfter: null, floruit: null })
  assert.deepEqual(life('Japan, Edo period (1615–1868)'), []) // an era, not a lifetime
  // A floruit span is a working life: its end is not a death, its start not a birth.
  assert.deepEqual(life('Netherlandish, Seligenstadt, active by 1465–died 1494 Bruges'), [{ birth: null, death: 1494, deathAfter: null, floruit: 1465 }])
  assert.deepEqual(life('Netherlandish, active by 1444–died 1475/76 Bruges')[0].death, 1476)
  assert.deepEqual(life('Chinese, active ca. 742–756'), [{ birth: null, death: null, deathAfter: null, floruit: 742 }])
})

test('artist_dates reads like the museum label', () => {
  const fmt = (s) => parseLifeFacts(s).map(formatDates)
  assert.deepEqual(fmt('Gustave Caillebotte (French, 1848–1894)'), ['1848–1894'])
  assert.deepEqual(fmt('Netherlandish, Breda (?) ca. 1525–1569 Brussels'), ['c. 1525–1569'])
  assert.deepEqual(fmt('Jacob van Ruisdael (Dutch, 1628/29-1682)'), ['1628/29–1682'])
  assert.deepEqual(fmt('Netherlandish, active by 1444–died 1475/76 Bruges'), ['active by 1444, died 1475/76'])
  assert.deepEqual(fmt('Chinese, active ca. 742–756'), ['active c. 742–756'])
  assert.deepEqual(fmt('Joshua Johnson (American, c. 1763–after 1825)'), ['c. 1763–after 1825'])
})

const aic = (display, extra = {}) => ({
  source: 'aic', license_value: true, type_label: 'Painting', medium: 'Oil on canvas',
  object_end: 1886, width: 9310, height: 6237,
  who: peopleFromAic({ artist_display: display, artist_ids: [1] }, new Map()),
  ...extra,
})
const failsOn = (r, re) => r.reasons.some((x) => re.test(x))
// Live AIC records (Oct 2026). Undated agents carry birth = death = 4713.
const BOSCH_AGENT = { id: 119568, title: 'Workshop of Hieronymus Bosch', agent_type_title: 'Individual', birth_date: 4713, death_date: 4713 }
const aicWith = (art, agents, extra = {}) => ({
  ...aic('', extra),
  who: peopleFromAic({ artist_ids: agents.map((g) => g.id), ...art }, new Map(agents.map((g) => [g.id, g]))),
})

test('Seurat passes; Hopper (d. 1967) and Pollock (d. 1956) do not', () => {
  assert.equal(clear(aic('Georges Seurat (French, 1859–1891)'), { cutoff: CUT }).pass, true)
  const hopper = clear(aic('Edward Hopper (American, 1882–1967)', { license_value: false, object_end: 1942 }), { cutoff: CUT })
  assert.equal(hopper.pass, false)
  assert.ok(failsOn(hopper, /died 1967 > 1955/) && failsOn(hopper, /^licence/))
  assert.equal(clear(aic('Jackson Pollock (American, 1912–1956)', { object_end: 1950 }), { cutoff: CUT }).pass, false)
  assert.equal(clear(aic('Henri Matisse\nFrench, 1869–1954', { object_end: 1923 }), { cutoff: CUT }).pass, true)
})

test('approximate years count as written', () => {
  // A circa death is exact: c. 1950 <= 1955.
  assert.equal(clear(aic('X (French, c. 1880–c. 1950)', { object_end: 1920 }), { cutoff: CUT }).pass, true)
  assert.equal(clear(aic('X (French, c. 1880–c. 1956)', { object_end: 1920 }), { cutoff: CUT }).pass, false)
  // A split year takes the later one: 1955/56 is 1956.
  assert.equal(clear(aic('X (French, 1880–1955/56)', { object_end: 1920 }), { cutoff: CUT }).pass, false)
  assert.equal(clear(aic('X (French, 1880–1954/55)', { object_end: 1920 }), { cutoff: CUT }).pass, true)
  // An approximate birth or floruit is exact too.
  assert.equal(clear(aic('Y (American, born c. 1885)', { object_end: 1925 }), { cutoff: CUT }).pass, true)
  assert.equal(clear(aic('W (American, active c. 1895-1910)', { object_end: 1900 }), { cutoff: CUT }).pass, true)
})

test('an unknown death year assumes a 70-year life', () => {
  const r = (display, object_end) => clear(aic(display, { object_end }), { cutoff: CUT })
  // Born: birth + 70.
  assert.equal(r('Y (American, born 1885)', 1925).pass, true)
  assert.equal(r('Y (American, born 1886)', 1925).pass, false)
  assert.ok(failsOn(r('Y (American, born 1886)', 1925), /death year unknown, born 1886 -> taken as dead by 1956 > 1955/))
  // Active from Y: born Y - 10, so dead by Y + 60.
  assert.equal(r('W (American, active 1895-1910)', 1900).pass, true)
  assert.equal(r('W (American, active 1896-1910)', 1900).pass, false)
  assert.equal(r('Toshusai Sharaku\nJapanese, active 1794-95', 1794).pass, true)
  // "Died after" sets a floor on the assumption.
  assert.equal(r('Joshua Johnson (American, c. 1763–after 1825)', 1805).pass, true)
  assert.equal(r('Z (American, 1880–after 1960)', 1905).pass, false)
  // No life dates at all: born the work's date - 10, so dead by its date + 60.
  const named = (end) => aicWith({ artist_display: 'Jane Doe', artist_title: 'Jane Doe' }, [{ id: 7, title: 'Jane Doe', agent_type_title: 'Individual' }], { object_end: end })
  assert.equal(clear(named(1895), { cutoff: CUT }).pass, true)
  assert.equal(clear(named(1896), { cutoff: CUT }).pass, false)
})

test('a work with no identifiable artist is judged from its date', () => {
  const anon = (end) => ({
    ...aic('', { object_end: end }),
    who: peopleFromAic({ artist_display: 'Artist unknown\nJapanese', artist_ids: [] }, new Map()),
  })
  // Dated 1895: dead by 1955. Dated 1896: 1956.
  assert.equal(clear(anon(1895), { cutoff: CUT }).pass, true)
  assert.equal(clear(anon(1896), { cutoff: CUT }).pass, false)
  assert.ok(failsOn(clear(anon(1896), { cutoff: CUT }), /^artist anonymous hand: no life dates, object dated 1896 -> taken as dead by 1956 > 1955/))
  assert.equal(clear({ ...anon(1850), object_end: null }, { cutoff: CUT }).pass, false)
  // No artist information at all: the same rule, and no date still rejects.
  const none = (end) => ({ ...aic('', { object_end: end }), who: peopleFromAic({ artist_display: '', artist_ids: [] }, new Map()) })
  assert.equal(clear(none(1850), { cutoff: CUT }).pass, true)
  assert.ok(failsOn(clear(none(null), { cutoff: CUT }), /no life dates and no object date/))
})

test('a named artist behind a qualifier is judged on their own dates', () => {
  // Attributed to an artist who died in 1899, on a work dated 1905.
  assert.equal(clear(aic('Attributed to Z (Dutch, 1850–1899)', { object_end: 1905 }), { cutoff: CUT }).pass, true)
  assert.equal(clear(aic('Attributed to Z (Dutch, 1890–1960)', { object_end: 1905 }), { cutoff: CUT }).pass, false)
  const met = {
    source: 'met', license_value: true, type_label: 'Paintings / Painting', medium: 'Oil on wood',
    object_end: 1533, width: 3000, height: 4000,
    who: peopleFromMet({ artistDisplayName: 'Lucas Cranach the Elder and Workshop', artistDisplayBio: 'German, Kronach 1472–1553 Weimar', artistEndDate: '1553' }),
  }
  assert.equal(clear(met, { cutoff: CUT }).pass, true)
  assert.equal(clear({ ...met, object_end: 1901 }, { cutoff: CUT }).pass, true)
  // aic:85628: "After Raphael" on a later copy is judged on Raphael (d. 1520).
  const after = clear(aicWith({ artist_display: 'After Raffaello Sanzio, called Raphael\nItalian, 1483-1520', artist_title: 'Workshop of Raphael' }, [{ id: 1, title: 'Workshop of Raphael', agent_type_title: 'Individual' }], { object_end: 1910 }), { cutoff: CUT })
  assert.equal(after.pass, true, after.reasons.join('\n'))
  assert.match(after.evidence.attribution_qualifier, /^After/)
  // "X after Y" names two people: the undated one is judged from the work's date.
  const engraver = (end) => clear(aic('Jane Roe after Raffaello Sanzio, called Raphael\nItalian, 1483-1520', { object_end: end }), { cutoff: CUT })
  assert.equal(engraver(1850).pass, true)
  assert.equal(engraver(1910).pass, false)
  // CMA: "Workshop of" with the master's dates.
  const cma = (end) => clear({
    source: 'cma', license_value: 'CC0', type_label: 'Painting', medium: 'oil', object_end: end, width: 3000, height: 2000,
    who: peopleFromCma({ creators: [{ description: 'Workshop of Hans Memling (Netherlandish, c. 1430–1494)', role: 'artist' }] }),
  }, { cutoff: CUT })
  assert.equal(cma(1500).pass, true)
  assert.equal(cma(1500).evidence.attribution_qualifier, 'Workshop of Hans Memling')
})

test('Met: 9999 means living; sitters, printers and publishers are not authors', () => {
  const base = { source: 'met', license_value: true, type_label: 'Drawings / Drawing', medium: 'Graphite', object_end: 1873, width: 3000, height: 2000 }
  const living = peopleFromMet({ artistDisplayName: 'Shao Fan', artistDisplayBio: 'Chinese, born 1964', artistEndDate: '9999' })
  assert.equal(clear({ ...base, who: living }, { cutoff: CUT }).pass, false)
  const degas = peopleFromMet({
    artistDisplayName: 'Edgar Degas', artistDisplayBio: 'French, Paris 1834–1917 Paris', artistEndDate: '1917',
    constituents: [{ role: 'Artist', name: 'Edgar Degas' }, { role: 'Sitter', name: 'Edouard Manet' }],
  })
  assert.equal(clear({ ...base, who: degas }, { cutoff: CUT }).pass, true)
  const poster = peopleFromMet({
    artistDisplayName: 'Henri de Toulouse-Lautrec', artistDisplayBio: 'French, Albi 1864–1901 Saint-André-du-Bois', artistEndDate: '1901',
    constituents: [{ role: 'Printer', name: 'Affiches Américaines, Charles Lévy' }],
  })
  assert.equal(clear({ ...base, type_label: 'Prints / Print', object_end: 1891, who: poster }, { cutoff: CUT }).pass, true)
  assert.equal(clear({ ...base, type_label: 'Prints / Print', object_end: 1903, who: poster }, { cutoff: CUT }).pass, true)
})

test('licence flag, flat-art and resolution checks', () => {
  const cma = {
    source: 'cma', license_value: 'CC0', type_label: 'Painting', medium: 'oil on canvas', object_end: 1903, width: 3400, height: 2050,
    who: peopleFromCma({ creators: [{ description: 'Winslow Homer (American, 1836–1910)', role: 'artist', death_year: '1910' }] }),
  }
  assert.equal(clear(cma, { cutoff: CUT }).pass, true)
  assert.equal(clear({ ...cma, license_value: 'Copyrighted' }, { cutoff: CUT }).pass, false)
  assert.equal(clear({ ...cma, type_label: 'Sculpture' }, { cutoff: CUT }).pass, false)
  assert.equal(clear({ ...cma, type_label: 'Print', medium: 'photogravure' }, { cutoff: CUT }).pass, false)
  const metFlat = (label) => clear({ ...cma, source: 'met', license_value: true, type_label: label }, { cutoff: CUT }).pass
  assert.equal(metFlat('Paintings / Painting'), true)
  assert.equal(metFlat('Paintings-Panels / Altarpiece'), true)
  assert.equal(metFlat('Prints|Ephemera / Print'), true)
  assert.equal(metFlat(' / Painting'), true) // no classification: objectName decides
  assert.equal(metFlat(' / Folding screen'), false)
  assert.equal(metFlat(' / '), false)
  assert.equal(metFlat('Sculpture / Statue'), false)
  assert.equal(metFlat('Photographs / Photograph'), false)
  assert.equal(metFlat('Textiles-Woven / Tapestry'), false)
  // 1920 px on the long edge: Omni's input size.
  assert.equal(clear({ ...cma, width: 1920, height: 1080 }, { cutoff: CUT }).pass, true)
  assert.equal(clear({ ...cma, width: 1080, height: 1920 }, { cutoff: CUT }).pass, true)
  assert.equal(clear({ ...cma, width: 1919, height: 1500 }, { cutoff: CUT }).pass, false)
  assert.ok(failsOn(clear({ ...cma, width: 1919, height: 1500 }, { cutoff: CUT }), /^image: long edge 1919px < 1920px$/))
  assert.equal(clear({ ...cma, width: null, height: null }, { cutoff: CUT }).pass, false)
})


test('implausible structured years are unknown, not dates', () => {
  assert.equal(toYear(4713, 2026), null) // AIC's no-date sentinel
  assert.equal(toYear(2027, 2026), null)
  assert.equal(toYear(-4713, 2026), null)
  assert.equal(toYear('9999', 2026), null)
  assert.equal(toYear('', 2026), null)
  assert.equal(toYear('1516', 2026), 1516)
  assert.equal(toYear(-480, 2026), -480)
  assert.equal(toYear(2026, 2026), 2026)
})

test('AIC 4713 agent dates no longer reject; the label decides', () => {
  // aic:22857, The Garden of Paradise
  const bosch = aicWith({ artist_display: 'Workshop of Hieronymus Bosch (Netherlandish, c. 1450–1516)', artist_title: BOSCH_AGENT.title }, [BOSCH_AGENT], { object_end: 1525 })
  assert.ok(!bosch.who.people.some((p) => p.from === 'aic agent'))
  const r = clear(bosch, { cutoff: CUT })
  assert.equal(r.pass, true)
  assert.ok(!r.reasons.some((x) => /4713/.test(x)))
  assert.ok(failsOn(r, /died 1516 <= 1955/))
  assert.equal(r.evidence.attribution_qualifier, 'Workshop')
})

test('a sentinel date falls through to the conservative rules, never a pass of its own', () => {
  // No dates on the label either: the agent is an undated person, bounded by the object date.
  const undated = (end) => aicWith({ artist_display: 'Jane Doe', artist_title: 'Jane Doe' }, [{ ...BOSCH_AGENT, title: 'Jane Doe' }], { object_end: end })
  assert.equal(clear(undated(1700), { cutoff: CUT }).pass, true)
  assert.equal(clear(undated(1950), { cutoff: CUT }).pass, false)
  assert.equal(clear(undated(null), { cutoff: CUT }).pass, false)
  // A far-negative sentinel would otherwise clear life+70 by itself.
  const cma = (year) => ({
    source: 'cma', license_value: 'CC0', type_label: 'Painting', medium: 'oil', object_end: 1950, width: 3000, height: 2000,
    who: peopleFromCma({ creators: [{ description: 'Jane Doe', role: 'artist', birth_year: year, death_year: year }] }),
  })
  assert.equal(clear(cma('-4713'), { cutoff: CUT }).pass, false)
  assert.ok(failsOn(clear(cma('-4713'), { cutoff: CUT }), /no life dates, object dated 1950/))
  assert.equal(clear(cma('4713'), { cutoff: CUT }).pass, false)
  assert.equal(clear({ ...cma('1890'), object_end: 1880 }, { cutoff: CUT }).pass, true)
  // Met: 9999 still means living; an implausible end date is unknown.
  const met = (end, object_end) => ({
    source: 'met', license_value: true, type_label: 'Paintings / Painting', medium: 'Oil', object_end, width: 3000, height: 2000,
    who: peopleFromMet({ artistDisplayName: 'Jane Doe', artistDisplayBio: '', artistEndDate: end }),
  })
  assert.ok(failsOn(clear(met('9999', 1700), { cutoff: CUT }), /listed as living/))
  assert.equal(clear(met('4713', 1950), { cutoff: CUT }).pass, false)
  assert.equal(clear(met('4713', 1700), { cutoff: CUT }).pass, true)
})

test('artist names say the attribution qualifier once', () => {
  const name = (artist_display, artist_title) => {
    const a = { artist_display, artist_title, artist_ids: [1] }
    return aicArtistName(a, peopleFromAic(a, new Map()))
  }
  // aic:16246, aic:16958, aic:22857
  assert.equal(name('Workshop of Apollonio di Giovanni (Italian, 1415/17–1465)\nMarco del Buono Giamberti (Italian, 1403–1489)', 'Workshop of Apollonio di Giovanni'), 'Workshop of Apollonio di Giovanni')
  assert.equal(name('Circle of Agnolo Bronzino (Italian, 1503–1572)', 'Circle of Agnolo Bronzino'), 'Circle of Agnolo Bronzino')
  assert.equal(name('Workshop of Hieronymus Bosch (Netherlandish, c. 1450–1516)', 'Workshop of Hieronymus Bosch'), 'Workshop of Hieronymus Bosch')
  // The label's qualifier wins over the agent's (aic:85628, aic:42450, aic:114916)...
  assert.equal(name('After Raffaello Sanzio, called Raphael\nItalian, 1483-1520', 'Workshop of Raphael'), 'After Raphael')
  assert.equal(name('after Raffaello Sanzio, called Raphael, and his workshop\nItalian, 1483-1520', 'Workshop of Raphael'), 'After Raphael')
  assert.equal(name('Circle of Domenico Campagnola\nItalian, c. 1500-1564', 'Workshop of Domenico Campagnola'), 'Circle of Domenico Campagnola')
  // ...and is kept whole when it is a chain (aic:95779).
  assert.equal(name('After Workshop of Raffaello Sanzio, called Raphael\nItalian, 1483-1520', 'Workshop of Raphael'), 'After workshop of Raphael')
  // Agent-only and inverted qualifiers (aic:59971, aic:105764, aic:81969).
  assert.equal(name('Paolo Veneziano (Italian, active 1333–1358)', 'Workshop of Paolo Veneziano'), 'Workshop of Paolo Veneziano')
  assert.equal(name('Northern Italian (Milan)\nWorkshop of Bonfacio Bembo (active 1447-1478, died before 1482)', 'Bonifacio Bembo, workshop of'), 'Workshop of Bonifacio Bembo')
  assert.equal(name('Workshop of Vicencio Carducho\nItalian, 1570-1638', 'Workshop of  Vicencio Carducho'), 'Workshop of Vicencio Carducho')
  assert.equal(name('Workshop of X (Dutch, 1600–1650)', null), 'Workshop of X')
  assert.equal(name('Georges Seurat (French, 1859–1891)', 'Georges Seurat'), 'Georges Seurat')
  assert.equal(name('El Greco (Doménikos Theotokópoulos; Greek, active in Spain, 1541–1614)\nWorkshop of El Greco (Doménikos Theotokópoulos; Greek, active in Spain, 1541–1614)', 'El Greco (Doménikos Theotokópoulos) and workshop'), 'El Greco (Doménikos Theotokópoulos) and workshop')

  const met = (o) => metArtistName(o, peopleFromMet(o))
  assert.equal(met({ artistPrefix: '', artistDisplayName: 'Workshop of Fra Filippo Lippi', artistDisplayBio: 'Italian, Florence ca. 1406–1469 Spoleto' }), 'Workshop of Fra Filippo Lippi')
  assert.equal(met({ artistPrefix: 'Workshop of', artistDisplayName: 'Lucas Cranach the Elder', artistDisplayBio: 'German, Kronach 1472–1553 Weimar' }), 'Workshop of Lucas Cranach the Elder')
  assert.equal(met({ artistPrefix: 'Workshop of', artistDisplayName: 'Workshop of Lucas Cranach the Elder', artistDisplayBio: 'German, Kronach 1472–1553 Weimar' }), 'Workshop of Lucas Cranach the Elder')
  assert.equal(met({ artistPrefix: 'possibly', artistDisplayName: 'workshop of Giovanni Maria Vasaro', artistDisplayBio: '' }), 'possibly workshop of Giovanni Maria Vasaro')

  const cma = (creators) => cmaArtistName({ creators }, peopleFromCma({ creators }))
  assert.equal(cma([{ qualifier: 'workshop of', description: 'Hans Memling (Netherlandish, 1494)', role: 'artist' }]), 'Workshop of Hans Memling')
  assert.equal(cma([{ qualifier: 'workshop of', description: 'Workshop of Hans Memling (Netherlandish, 1494)', role: 'artist' }]), 'Workshop of Hans Memling')
  assert.equal(cma([{ description: 'Jacob Matham (Dutch, 1571–1631)', role: 'artist' }, { qualifier: 'after', description: 'Hendrick Goltzius (Dutch, 1558–1617)', role: 'artist' }]), 'Jacob Matham after Hendrick Goltzius')
})

test('the gate still sees every qualifier the artist field shows', () => {
  const aicQ = (artist_display, artist_title) => peopleFromAic({ artist_display, artist_title, artist_ids: [1] }, new Map()).qualified
  assert.ok(aicQ('Workshop of Hieronymus Bosch (Netherlandish, c. 1450–1516)', 'Workshop of Hieronymus Bosch'))
  assert.ok(aicQ('Paolo Veneziano (Italian, active 1333–1358)', 'Workshop of Paolo Veneziano')) // agent only
  assert.ok(aicQ('Northern Italian (Milan)', 'Bonifacio Bembo, workshop of'))
  assert.equal(aicQ('Georges Seurat (French, 1859–1891)', 'Georges Seurat'), null)
  const veneziano = clear(aic('', {
    object_end: 1350,
    who: peopleFromAic({ artist_display: 'Paolo Veneziano (Italian, active 1333–1358)', artist_title: 'Workshop of Paolo Veneziano', artist_ids: [1] }, new Map()),
  }), { cutoff: CUT })
  assert.equal(veneziano.evidence.attribution_qualifier, 'Workshop')
  // Met: the qualifier in the name alone.
  assert.ok(peopleFromMet({ artistPrefix: '', artistDisplayName: 'Workshop of Fra Filippo Lippi', artistDisplayBio: 'Italian, Florence ca. 1406–1469 Spoleto' }).qualified)
  assert.equal(peopleFromMet({ artistPrefix: 'Workshop of', artistDisplayName: 'Lucas Cranach the Elder' }).qualified, 'Workshop of')
  assert.equal(peopleFromMet({ artistDisplayName: 'Lucas Cranach the Elder and Workshop' }).qualified, 'and workshop')
  // CMA: in the description, with no qualifier field.
  assert.ok(peopleFromCma({ creators: [{ description: 'Attributed to X (Dutch, 1600–1650)', role: 'artist' }] }).qualified)
  assert.equal(peopleFromCma({ creators: [{ qualifier: 'circle of', description: 'Leonardo da Vinci (Italian, 1452–1519)', role: 'artist' }] }).qualified, 'circle of')
})
