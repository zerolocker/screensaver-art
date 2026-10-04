// node --test curation/real-art/
// Offline fixtures for the copyright gate — the legal logic, pinned.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clear, cutoffYear, parseLifeFacts, peopleFromAic, peopleFromCma, peopleFromMet } from './clearance.mjs'
import { formatDates } from './sources.mjs'

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

test('Seurat passes; Hopper (d. 1967) and Pollock (d. 1956) do not', () => {
  assert.equal(clear(aic('Georges Seurat (French, 1859–1891)'), { cutoff: CUT }).pass, true)
  const hopper = clear(aic('Edward Hopper (American, 1882–1967)', { license_value: false, object_end: 1942 }), { cutoff: CUT })
  assert.equal(hopper.pass, false)
  assert.ok(failsOn(hopper, /died 1967 > 1955/) && failsOn(hopper, /^licence/))
  assert.equal(clear(aic('Jackson Pollock (American, 1912–1956)', { object_end: 1950 }), { cutoff: CUT }).pass, false)
  assert.equal(clear(aic('Henri Matisse\nFrench, 1869–1954', { object_end: 1923 }), { cutoff: CUT }).pass, true)
})

test('approximate and unknown deaths are bounded conservatively', () => {
  assert.equal(clear(aic('X (French, c. 1880–c. 1950)', { object_end: 1920 }), { cutoff: CUT }).pass, false) // c. 1950 could be 1960
  assert.equal(clear(aic('Joshua Johnson (American, c. 1763–after 1825)', { object_end: 1805 }), { cutoff: CUT }).pass, true)
  assert.equal(clear(aic('Y (American, born 1890)', { object_end: 1925 }), { cutoff: CUT }).pass, false)
  assert.equal(clear(aic('Toshusai Sharaku\nJapanese, active 1794-95', { object_end: 1794 }), { cutoff: CUT }).pass, true)
  // active from 1850 -> dead by 1850 - 10 + 110 = 1950; "c." adds 10 -> 1960 > 1955
  assert.equal(clear(aic('W (American, active 1850-1880)', { object_end: 1870 }), { cutoff: CUT }).pass, true)
  assert.equal(clear(aic('W (American, active c. 1850-1880)', { object_end: 1870 }), { cutoff: CUT }).pass, false)
})

test('anonymous works need an object date before 1900', () => {
  const anon = (end) => ({
    ...aic('', { object_end: end }),
    who: peopleFromAic({ artist_display: 'Artist unknown\nJapanese', artist_ids: [] }, new Map()),
  })
  assert.equal(clear(anon(1850), { cutoff: CUT }).pass, true)
  assert.equal(clear(anon(1905), { cutoff: CUT }).pass, false)
  assert.equal(clear({ ...anon(1850), object_end: null }, { cutoff: CUT }).pass, false)
})

test('attributed / workshop / after also need the anonymous rule', () => {
  const att = clear(aic('Attributed to Z (Dutch, 1850–1899)', { object_end: 1905 }), { cutoff: CUT })
  assert.equal(att.pass, false)
  assert.ok(failsOn(att, /attribution/))
  const met = {
    source: 'met', license_value: true, type_label: 'Paintings / Painting', medium: 'Oil on wood',
    object_end: 1533, width: 3000, height: 4000,
    who: peopleFromMet({ artistDisplayName: 'Lucas Cranach the Elder and Workshop', artistDisplayBio: 'German, Kronach 1472–1553 Weimar', artistEndDate: '1553' }),
  }
  assert.equal(clear(met, { cutoff: CUT }).pass, true)
  assert.equal(clear({ ...met, object_end: 1901 }, { cutoff: CUT }).pass, false)
})

test('Met: 9999 means living; sitters are not authors; undated printers need < 1900', () => {
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
  assert.equal(clear({ ...base, type_label: 'Prints / Print', object_end: 1903, who: poster }, { cutoff: CUT }).pass, false)
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
  assert.equal(clear({ ...cma, width: 1999, height: 1500 }, { cutoff: CUT }).pass, false)
  assert.equal(clear({ ...cma, width: null, height: null }, { cutoff: CUT }).pass, false)
})
