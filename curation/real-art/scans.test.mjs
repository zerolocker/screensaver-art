// node --test curation/real-art/
// Offline fixtures for the Commons scan picker: which files count as a faithful
// scan of the whole painting, and which one wins. Names and metadata follow
// live Commons files (Oct 2026).

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aspectMatch, knownSource, pickScan, referenceAspects, screen, titleProblem, vet } from './scans.mjs'

const PD = { License: 'pd', LicenseShortName: 'Public domain', Copyrighted: 'False', categories: ['PD-Art (PD-old-100-expired)', 'Artworks digital representation of 2D work'] }
const Q = 'Q1' // the painting
const file = (name, width, height, extra = {}) => ({ file: name, width, height, mime: 'image/jpeg', represents: [Q], ...PD, ...extra })
const check = (info) => vet(info, Q)
const pick = (o) => pickScan({ qid: Q, ...o })

test('shape: within 3% of P18 or of the recorded size', () => {
  const refs = referenceAspects({ width: 1962, height: 2500 }, { widths: [0.7], heights: [1] })
  assert.deepEqual(refs.map((r) => r.of), ['P18', 'recorded size'])
  assert.equal(aspectMatch(5256, 6742, refs).of, 'P18') // 0.780 vs 0.785
  assert.equal(aspectMatch(710, 1000, refs).of, 'recorded size') // 0.710 vs 0.700
  assert.equal(aspectMatch(1000, 1000, refs), null)
  assert.equal(aspectMatch(1000, 1300, [{ of: 'P18', aspect: 0.8 }]), null) // 0.769: 4% off
  assert.equal(aspectMatch(1000, 1270, [{ of: 'P18', aspect: 0.8 }]).of, 'P18') // 0.787: 1.6% off
  assert.equal(aspectMatch(1000, 1000, []), null)
})

test('file names that say it is not a whole-painting scan', () => {
  const bad = [
    ['Van Gogh - Starry Night - Google Art Project-x0-y0.jpg', /tile/],
    ['VanGogh-starry night edit.jpg', /"edit"/],
    ['Mona Lisa, by Leonardo da Vinci, from C2RMF retouched (3x4 headcrop).jpg', /"retouched"/],
    ['MonaLisa bearbeitet mit Lysa.jpg', /"bearbeitet"/],
    ['Anunciación (detalle), Pedro Berruguete.jpg', /"detalle"/],
    ['San Francisco de Asís, fragmento de la pintura.jpg', /"fragmento"/],
    ['"Starry Night" in its frame.jpg', /"frame"/],
    ['Night Watch X-ray.jpg', /"X-ray"/],
    ['Mona Lisa Digitally Restored.jpg', /"Digitally"|"Restored"/],
    ['Girl with a Pearl Earring upscaled 8K.jpg', /"upscaled"|"8K"/],
    ['IMG_4821.JPG', /camera/],
    ['Starry Night (black and white).jpg', /"black and white"/],
  ]
  for (const [name, why] of bad) assert.match(String(titleProblem(name, 'The Starry Night')), why, name)
  for (const name of [
    'Van Gogh - Starry Night - Google Art Project.jpg',
    'The Night Watch - HD.jpg',
    'Caspar David Friedrich - Wanderer above the Sea of Fog.jpeg',
    'Frameless Gallery.jpg', // not "frame"
    'La Liberté guidant le peuple - Eugène Delacroix - Musée du Louvre Peintures RF 129 - après restauration2024.jpg',
  ]) assert.equal(titleProblem(name, 'x'), null, name)
  // A word in the painting's own title doesn't count.
  assert.equal(titleProblem('Fragment of an Altarpiece - Master of X.jpg', 'Fragment of an Altarpiece'), null)
  assert.match(titleProblem('Fragment of an Altarpiece - Master of X.jpg', 'Altarpiece'), /"Fragment"/)
})

test('the cheap screen: format, size, P18 and shape', () => {
  const opts = { refs: [{ of: 'P18', aspect: 0.8 }], label: 'X', minArea: 1600 * 2000 }
  assert.equal(screen({ file: 'a.jpg', mime: 'image/jpeg', width: 4000, height: 5000 }, opts), null)
  assert.equal(screen({ file: 'a.tif', mime: 'image/tiff', width: 4000, height: 5000 }, opts), null)
  assert.match(screen({ file: 'a.svg', mime: 'image/svg+xml', width: 4000, height: 5000 }, opts), /not a bitmap/)
  assert.match(screen({ file: 'a.pdf', mime: 'application/pdf', width: 4000, height: 5000 }, opts), /not a bitmap/)
  assert.match(screen({ file: 'a.jpg', mime: 'image/jpeg', width: 1500, height: 1875 }, { ...opts, minArea: 0 }), /under 1920/)
  assert.match(screen({ file: 'a.jpg', mime: 'image/jpeg', width: 1600, height: 2000 }, opts), /no larger than P18/)
  assert.match(screen({ file: 'a.jpg', mime: 'image/jpeg', width: 5000, height: 5000 }, opts), /shape 1\.000 isn't the painting's/)
  assert.match(screen({ file: 'a detail.jpg', mime: 'image/jpeg', width: 4000, height: 5000 }, opts), /"detail"/)
})

test('after the licence lookup: licence, categories and description', () => {
  assert.equal(check(file('Van Gogh - Starry Night - Google Art Project.jpg', 44567, 35291)), null)
  // CC0 files are marked Copyrighted; that's fine.
  assert.equal(check(file('a.jpg', 4000, 5000, { License: 'cc0', LicenseShortName: 'CC0', Copyrighted: 'True', categories: ['CC-Zero'] })), null)
  // A user's photo or edit carries their own licence.
  assert.match(check(file('Mona Lisa Circa 1603.jpg', 7560, 11232, { License: 'cc-by-sa-4.0', LicenseShortName: 'CC BY-SA 4.0', Copyrighted: 'True', categories: ['Copies of Mona Lisa'] })), /not public domain/)
  assert.match(check(file('a.jpg', 4000, 5000, { categories: ['PD-Art (PD-old-100)', 'Copies of Mona Lisa'] })), /Category:Copies of Mona Lisa/)
  assert.match(check(file('a.jpg', 4000, 5000, { categories: ['PD-Art (PD-old-100)', 'Artworks without Wikidata item'] })), /without Wikidata item/)
  assert.match(check(file('a.jpg', 4000, 5000, { categories: ['PD-Art (PD-old-100)', 'Details of paintings by Rembrandt'] })), /Details of/)
  assert.match(check(file('a.jpg', 4000, 5000, { description: 'Detail of the central panel' })), /"Detail of"/)
  assert.match(check(file('a.jpg', 4000, 5000, { description: 'The painting in its original frame' })), /in its original frame/)
  assert.match(check(file('a.jpg', 4000, 5000, { description: 'This photo is a copy of the Wikipedia Commons file' })), /"copy of"/)
  // An ordinary description of the scene passes.
  assert.equal(check(file('a.jpg', 4000, 5000, { description: 'He looks down on a sea of fog, framed by rocks; the details of the mist are fine.' })), null)
})

test('structured data must say the file represents this painting, unless a known source scanned it', () => {
  // Andromache Mourning Hector: the Pushkin Museum's version sits in the Louvre painting's category.
  const pushkin = file('Andromache Mourning Hector by Jacques-Louis David, 1783, Pushkin Museum.JPG', 2020, 2800, { represents: [] })
  assert.match(check(pushkin), /doesn't say it represents Q1, and it isn't from a known scan source/)
  // Munch's Vampire: a file of another version of it.
  assert.match(check(file('Edvard Munch Vampire.jpg', 3000, 2400, { represents: ['Q18891333'] })), /represents Q18891333/)
  // The Ghent Altarpiece's Google Art Project scan has no structured data yet.
  assert.equal(check(file('Ghent Altarpiece Google Art Project.jpg', 9412, 6938, { represents: [] })), null)
  // A museum's upload of a print after the painting: in the category, and caught by it.
  const print = file("Portrait de M. Bertin d'après Ingres, PPG65.jpg", 4504, 5510, { represents: [], categories: ['CC-Zero', 'Images from Paris Musées', 'Prints after Jean Auguste Dominique Ingres'] })
  assert.match(check(print), /Category:Prints after/)
  assert.match(titleProblem(print.file, 'Portrait of Monsieur Bertin'), /"d'après"/)
  // An exhibition photo, a book plate, an engraving.
  assert.match(check(file('a.jpg', 2501, 2966, { categories: ['PD-Art (PD-old-100)', 'Van Gogh, My Dream Exhibition'] })), /Exhibition/)
  assert.match(check(file('a.png', 1658, 2428, { categories: ['PD US expired', 'Woman in Art (book)'] })), /\(book\)/)
  assert.match(check(file('a.jpg', 4320, 3240, { description: "Oeuvre gravée par L. Deghouy d'après un dessin de Barrias" })), /gravée/)
  assert.match(check(file('a.jpg', 3558, 5828, { description: "Il dio Plutone, dettaglio dall'affresco Giove, Nettuno e Plutone" })), /dettaglio dall/)
  // Gallery snapshots by name.
  assert.match(titleProblem('Sint-Janshospitaal-Memling-Diptych DSC0055.jpg', 'Diptych'), /camera/)
  assert.match(titleProblem('Lisboa-Museu Nacional de Arte Antiga-São Jerónimo-20140917.jpg', 'Saint Jerome'), /camera/)
  assert.match(titleProblem('De hemelvaart van Maria - Düsseldorf 15-08-2012 15-26-30.jpg', 'Assumption'), /camera/)
})

test('known sources: Google Art Project, C2RMF and museum uploads', () => {
  assert.equal(knownSource(file('Van Gogh - Starry Night - Google Art Project.jpg', 1, 1)), 'Google Art Project')
  assert.equal(knownSource(file('x.jpg', 1, 1, { categories: ['Gigapixel images from the Google Art Project'] })), 'Google Art Project')
  assert.equal(knownSource(file('x.jpg', 1, 1, { categories: ['High-resolution images from C2RMF'] })), 'C2RMF')
  assert.equal(knownSource(file('x.jpg', 1, 1, { categories: ['Images from the Rijksmuseum'] })), 'museum')
  assert.equal(knownSource(file('x.jpg', 1, 1)), null)
})

test('the largest public-domain scan wins, and says why', () => {
  const p18 = file('Friedrich, Caspar David - Wanderer über dem Nebelmeer.jpg', 1962, 2500)
  const big = file('Caspar David Friedrich - Wanderer above the Sea of Fog.jpeg', 5256, 6742)
  const r = pick({ p18, candidates: [file('b.jpg', 2327, 2980), big] })
  assert.equal(r.info, big)
  assert.equal(r.upgraded, true)
  assert.equal(r.why, 'P18 is 2,500 px; using a 6,742 px scan')
  // A known source says so.
  const gap = file('X - Google Art Project.jpg', 5600, 7200)
  assert.equal(pick({ p18: file('p.jpg', 1250, 1600), candidates: [gap] }).why, 'P18 is 1,600 px; using a 7,200 px Google Art Project scan')
  // Within 10% of the largest area, a known source beats an unknown file.
  assert.equal(pick({ p18, candidates: [file('c.jpg', 5700, 7300), gap] }).info, gap)
  assert.equal(pick({ p18, candidates: [file('c.jpg', 7000, 9000), gap] }).info.file, 'c.jpg')
  // P18 stays when nothing larger passes.
  const cc = file('d.jpg', 5000, 6400, { License: 'cc-by-sa-4.0', LicenseShortName: 'CC BY-SA 4.0', Copyrighted: 'True' })
  const kept = pick({ p18, candidates: [cc] })
  assert.equal(kept.info, p18)
  assert.equal(kept.upgraded, false)
  assert.match(kept.why, /^P18 \(2,500 px\) is the largest public-domain scan/)
  assert.equal(kept.rejected[0].file, 'd.jpg')
  // A P18 that isn't public domain, or no P18 at all.
  const ccP18 = file('e.jpg', 3000, 3840, { License: 'cc-by-sa-4.0', LicenseShortName: 'CC BY-SA 4.0', Copyrighted: 'True' })
  assert.equal(pick({ p18: ccP18, candidates: [big] }).why, "P18 isn't public domain (CC BY-SA 4.0); using a 6,742 px scan")
  assert.equal(pick({ p18: null, candidates: [big] }).why, 'no P18 file; using a 6,742 px scan')
  assert.equal(pick({ p18: ccP18, candidates: [] }).info, ccP18) // still fails the licence check later
  assert.equal(pick({ p18: null, candidates: [] }).info, null)
})
