// node --test curation/real-art/
// Offline fixtures for the wing hint: field shapes follow live AIC, Met, CMA
// and Wikidata records (Oct 2026).

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aicWing, cmaWing, commonsWing, metWing, rankByWing, wingOf } from './wings.mjs'

test('culture or region for non-Western art', () => {
  assert.equal(aicWing({ place_of_origin: 'Japan', department_title: 'Arts of Asia', artist_display: 'Katsushika Hokusai\nJapanese, 1760-1849', date_start: 1830 }), 'Japanese')
  assert.equal(metWing({ culture: 'China', department: 'Asian Art', objectBeginDate: 1100 }), 'Chinese & Korean')
  assert.equal(metWing({ culture: 'Korea', department: 'Asian Art', objectBeginDate: 1750 }), 'Chinese & Korean')
  assert.equal(metWing({ culture: '', country: 'India (Rajasthan, Mewar)', department: 'Asian Art', objectBeginDate: 1700 }), 'South & Southeast Asian')
  assert.equal(metWing({ culture: '', country: 'Iran', department: 'Islamic Art', objectBeginDate: 1520 }), 'Islamic')
  assert.equal(cmaWing({ culture: ['Iran, Safavid period'], department: 'Islamic Art', creation_date_earliest: 1600 }), 'Islamic')
  assert.equal(cmaWing({ culture: ['Egypt, Roman period'], department: 'Egyptian and Ancient Near Eastern Art', creation_date_earliest: 150 }), 'Egyptian')
  assert.equal(cmaWing({ culture: ['Egypt, Mamluk period'], department: 'Islamic Art', creation_date_earliest: 1350 }), 'Islamic')
  assert.equal(cmaWing({ culture: ['Peru, Moche'], department: 'Art of the Americas', creation_date_earliest: 300 }), 'Arts of the Americas')
  assert.equal(metWing({ culture: 'Yoruba peoples', department: 'Arts of Africa, Oceania, and the Americas', objectBeginDate: 1900 }), 'Arts of Africa & Oceania')
  // Wikidata labels: country of origin, the creator's citizenship.
  assert.equal(commonsWing({ origin: ['Japan'], culture: [], citizenship: [], movement: [] }, 1831), 'Japanese')
  assert.equal(commonsWing({ origin: [], culture: [], citizenship: ['Qing dynasty'], movement: [] }, 1750), 'Chinese & Korean')
})

test('era for European and American art, from the movement first', () => {
  assert.equal(aicWing({ place_of_origin: 'France', department_title: 'Painting and Sculpture of Europe', style_titles: ['Impressionism'], date_start: 1877 }), '19th Century')
  assert.equal(metWing({ culture: '', country: '', department: 'European Paintings', artistNationality: 'Dutch', objectBeginDate: 1662 }), 'Renaissance & Baroque')
  assert.equal(cmaWing({ culture: ['France, 20th century'], department: 'Modern European Painting and Sculpture', creation_date_earliest: 1910 }), 'Modern')
  assert.equal(cmaWing({ culture: ['France, 19th century'], department: 'Modern European Painting and Sculpture', creation_date_earliest: 1903 }), '19th Century')
  // The movement beats the date: David's Neoclassicism (1788), Monet's late Impressionism.
  assert.equal(commonsWing({ origin: ['France'], culture: [], citizenship: ['France'], movement: ['Neoclassicism'] }, 1788), '19th Century')
  assert.equal(commonsWing({ origin: [], culture: [], citizenship: ['France'], movement: ['Impressionism'] }, 1915), '19th Century')
  assert.equal(commonsWing({ origin: [], culture: [], citizenship: [], movement: ['Harlem Renaissance'] }, 1925), 'Modern')
  assert.equal(commonsWing({ origin: [], culture: [], citizenship: ['Russian Empire'], movement: ['icon painting'] }, 1425), 'Medieval & Byzantine')
  // By date alone.
  assert.equal(wingOf({ year: 1350 }), 'Medieval & Byzantine')
  assert.equal(wingOf({ year: 1650 }), 'Renaissance & Baroque')
  assert.equal(wingOf({ year: 1850 }), '19th Century')
  assert.equal(wingOf({ year: 1925 }), 'Modern')
  assert.equal(wingOf({}), null)
})

test('a Western field stops the search: an Orientalist is still European', () => {
  // A French painter "active in Egypt": the work's own place comes first.
  assert.equal(aicWing({ place_of_origin: 'France', artist_display: 'Jean-Léon Gérôme\nFrench, active in Egypt, 1824–1904', date_start: 1870 }), '19th Century')
  // "Greek" is Greek & Roman only for antiquity: El Greco is Renaissance.
  assert.equal(metWing({ department: 'European Paintings', artistNationality: 'Greek', objectBeginDate: 1597 }), 'Renaissance & Baroque')
  // "African American" is not Arts of Africa.
  assert.equal(metWing({ department: 'The American Wing', artistNationality: 'African American', objectBeginDate: 1893 }), '19th Century')
  // Dürer's "Holy Roman Empire" isn't Rome.
  assert.equal(commonsWing({ origin: [], culture: [], citizenship: ['Holy Roman Empire'], movement: ['Northern Renaissance'] }, 1500), 'Renaissance & Baroque')
})

test('ranking: famous works take turns by wing; the rest follow by fame', () => {
  const c = (id, wing, langs) => ({ id, wing, fame: { wikipedia_langs: langs } })
  const list = [
    c('mona', 'Renaissance & Baroque', 134), c('pearl', 'Renaissance & Baroque', 71), c('nightwatch', 'Renaissance & Baroque', 56),
    c('starry', '19th Century', 75), c('liberty', '19th Century', 67),
    c('tortoise', 'Islamic', 21), c('horse', 'Chinese & Korean', 15),
    c('scroll', 'Japanese', 0), c('obscure', 'Renaissance & Baroque', 4),
  ]
  const ranked = rankByWing(list, (x) => x.fame.wikipedia_langs)
  assert.deepEqual(ranked.map((x) => x.id), [
    'mona', 'starry', 'tortoise', 'horse', // round 1: each wing's most famous, in fame order
    'pearl', 'liberty', // round 2
    'nightwatch', // round 3
    'obscure', 'scroll', // under 10: by fame, after every famous work
  ])
  assert.equal(list.find((x) => x.id === 'liberty').fame.wing_rank, 2)
  assert.equal(list.find((x) => x.id === 'scroll').fame.wing_rank, 1)
})
