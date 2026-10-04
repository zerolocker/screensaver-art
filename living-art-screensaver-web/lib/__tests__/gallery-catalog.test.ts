import { describe, expect, it } from 'vitest'
import { TAG_ORDER } from '@screensaver-art/constants'
import {
  ALL_ERAS,
  ALL_PIECES,
  GALLERY_PAGE_COUNT,
  GALLERY_PAGE_SIZE,
  artworkCredit,
  eraBySlug,
  galleryPage,
  parseArtworkTitle,
  parseTitle,
  pieceBySlug,
  pieceParagraphs,
  pieceSummary,
  relatedPieces,
  slugForSrc,
  theMuseum,
  toPiece,
  type RawItem,
} from '@/lib/gallery-catalog'
import { ERA_COPY } from '@/lib/era-copy'

/**
 * Runs against the real gallery.json. The slug tests matter most: a duplicate
 * or changed slug breaks posted pins, which can't be edited.
 */
describe('gallery catalog', () => {
  it('derives a unique slug for every piece', () => {
    const slugs = ALL_PIECES.map((p) => p.slug)
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
    expect(dupes).toEqual([])
    expect(slugs).toHaveLength(ALL_PIECES.length)
  })

  it('produces URL-safe slugs', () => {
    for (const piece of ALL_PIECES) {
      expect(piece.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(encodeURIComponent(piece.slug)).toBe(piece.slug)
    }
  })

  it('derives the slug from the R2 key only — never from the title or catalog position', () => {
    // Same key, same slug, whatever else changes.
    expect(slugForSrc('https://cdn.example.com/gallery/edo_sumie_animated.mp4')).toBe('edo-sumie-animated')
    expect(slugForSrc('/gallery/Edo_Sumie_Animated.MP4')).toBe('edo-sumie-animated')
    for (const piece of ALL_PIECES) expect(slugForSrc(piece.src)).toBe(piece.slug)
  })

  it('splits every title into a name and a movement (or, for a real artwork, its artist)', () => {
    for (const piece of ALL_PIECES) {
      expect(piece.name, piece.title).not.toBe('')
      expect(piece.subtitle, piece.title).not.toBe('')
      if (!piece.artwork) expect(piece.movement, piece.title).not.toBe('')
      expect(piece.name, piece.title).not.toMatch(/AI Animated/)
    }
    expect(parseTitle('Woman and Flora - Art Nouveau (AI Animated)')).toEqual({
      name: 'Woman and Flora',
      movement: 'Art Nouveau',
    })
    // An off-format title still gives a name.
    expect(parseTitle('Untitled')).toEqual({ name: 'Untitled', movement: '' })
  })

  it('looks up every piece by its slug', () => {
    for (const piece of ALL_PIECES) expect(pieceBySlug(piece.slug)).toBe(piece)
    expect(pieceBySlug('not-a-piece')).toBeUndefined()
  })

  it('covers every era tag with hand-written copy', () => {
    for (const tag of TAG_ORDER) {
      expect(ERA_COPY[tag], `missing ERA_COPY for "${tag}"`).toBeTruthy()
      expect(ERA_COPY[tag].blurb.length).toBeGreaterThan(80)
      expect(ERA_COPY[tag].headline).not.toBe('')
      expect(ERA_COPY[tag].tagline).not.toBe('')
    }
    // Every era present in the data is one of the known wings.
    for (const era of ALL_ERAS) expect(TAG_ORDER).toContain(era.era)
  })

  it('partitions every piece into exactly one era wing', () => {
    const total = ALL_ERAS.reduce((sum, era) => sum + era.count, 0)
    expect(total).toBe(ALL_PIECES.length)
    for (const era of ALL_ERAS) {
      expect(era.count).toBeGreaterThan(0)
      expect(eraBySlug(era.slug)).toBe(era)
      for (const piece of era.pieces) expect(piece.eraSlug).toBe(era.slug)
    }
  })

  it('paginates the whole catalog with no gaps or repeats', () => {
    const seen = new Set<string>()
    for (let n = 1; n <= GALLERY_PAGE_COUNT; n++) {
      const page = galleryPage(n)
      expect(page.length).toBeGreaterThan(0)
      expect(page.length).toBeLessThanOrEqual(GALLERY_PAGE_SIZE)
      for (const piece of page) seen.add(piece.slug)
    }
    expect(seen.size).toBe(ALL_PIECES.length)
    expect(galleryPage(GALLERY_PAGE_COUNT + 1)).toEqual([])
  })

  it('sorts newest first', () => {
    for (let i = 1; i < ALL_PIECES.length; i++) {
      expect(ALL_PIECES[i - 1].date >= ALL_PIECES[i].date).toBe(true)
    }
  })

  it('writes prose that never dumps a generation prompt', () => {
    // The prompts read like machine instructions and must not reach the copy.
    const promptTells = /static camera|no morphing|keeps its exact|masterpiece, high quality|seamless(ly)? loop\b.*prompt/i
    for (const piece of ALL_PIECES.slice(0, 40)) {
      const text = pieceParagraphs(piece).join(' ')
      expect(text).not.toMatch(promptTells)
      expect(text.length).toBeGreaterThan(200)
      // Every AI piece says it's AI-generated (real artworks: see below).
      if (piece.artwork) expect(text).not.toMatch(/AI[- ]generated|homage/i)
      else expect(text).toMatch(/\bAI[- ](generated|made|animated|homage)/i)
      expect(text).toContain(piece.name)
      expect(text).toContain(piece.era)
    }
  })

  it('gives adjacent pieces different opening sentences', () => {
    // Enough variety that related pieces don't read as one template.
    const openers = new Set(ALL_PIECES.slice(0, 30).map((p) => pieceParagraphs(p)[0].replace(p.name, '')))
    expect(openers.size).toBeGreaterThan(1)
  })

  it('summarises a piece for social/meta without over-claiming', () => {
    const piece = ALL_PIECES.find((p) => !p.artwork)!
    const summary = pieceSummary(piece)
    expect(summary).toContain(piece.name)
    expect(summary).toMatch(/AI-animated/)
    expect(summary.length).toBeLessThan(200)
  })

  it('only calls a piece a loop when it is authored to loop', () => {
    // Only looping pieces are called loops.
    const nonLooping = ALL_PIECES.filter((p) => !p.looping)
    expect(nonLooping.length).toBeGreaterThan(0)
    for (const piece of nonLooping) {
      // Strip the name: one piece is called "Geometric Loop".
      expect(pieceParagraphs(piece)[0].replace(piece.name, '')).not.toMatch(/\bloop|repeats/i)
      expect(pieceSummary(piece).replace(piece.name, '')).not.toMatch(/\bloop/i)
    }
  })

  it('relates pieces without linking a piece to itself', () => {
    for (const piece of ALL_PIECES.slice(0, 25)) {
      const related = relatedPieces(piece)
      expect(related.length).toBeLessThanOrEqual(8)
      expect(related.map((r) => r.slug)).not.toContain(piece.slug)
      const slugs = related.map((r) => r.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    }
  })

  it('always has something to paint behind a clip', () => {
    for (const piece of ALL_PIECES) {
      // Every piece has a gradient to fall back on.
      expect(piece.gradient).toMatch(/^radial-gradient/)
      if (piece.posterUrl) expect(piece.posterUrl).toMatch(/^(https:\/\/|\/posters\/)/)
    }
  })
})

/**
 * Real artworks, using synthetic entries. Their copy must not claim to be
 * AI-generated, as the AI pieces' copy does.
 */
describe('real artworks', () => {
  const real = (over: Partial<RawItem> = {}): RawItem => ({
    src: 'https://screensaver-assets.living-art-asset.com/gallery/paris_street_rainy_day_animated.mp4',
    title: 'Paris Street; Rainy Day - Gustave Caillebotte (AI Animated)',
    type: 'video',
    date: '2026-10-03',
    tags: ['19th Century'],
    source: 'real_artwork',
    artist: 'Gustave Caillebotte',
    artist_dates: '1848–1894',
    original_title: 'Paris Street; Rainy Day',
    original_date: '1877',
    museum: 'Art Institute of Chicago',
    credit_line: 'Charles H. and Mary F. S. Worcester Collection',
    source_url: 'https://www.artic.edu/artworks/20684',
    license: 'Public Domain',
    video_prompt: 'rain falls',
    looping: false,
    ...over,
  })

  it('parses the painting name and credits the artist, not a movement', () => {
    const piece = toPiece(real())
    expect(piece.name).toBe('Paris Street; Rainy Day')
    expect(piece.subtitle).toBe('Gustave Caillebotte')
    expect(piece.movement).toBe('')
    expect(piece.artwork).toMatchObject({ artist: 'Gustave Caillebotte', museum: 'Art Institute of Chicago' })
    // Still slugged from the R2 key.
    expect(piece.slug).toBe('paris-street-rainy-day-animated')
  })

  it('splits on the known artist, so a " - " inside the painting title survives', () => {
    const artwork = { artist: 'Claude Monet', originalTitle: 'Waterloo Bridge - Sun' }
    expect(parseArtworkTitle('Waterloo Bridge - Sun - Claude Monet (AI Animated)', artwork)).toBe('Waterloo Bridge - Sun')
    // An off-format title falls back to the provenance title.
    expect(parseArtworkTitle('Something else entirely', artwork)).toBe('Waterloo Bridge - Sun')
  })

  it('leaves AI pieces alone: no source means AI-generated', () => {
    const piece = toPiece({ src: 'https://x/gallery/a_animated.mp4', title: 'Woman and Flora - Art Nouveau (AI Animated)', type: 'video', tags: ['19th Century'] })
    expect(piece.artwork).toBeNull()
    expect(piece.subtitle).toBe('Art Nouveau')
    expect(piece.movement).toBe('Art Nouveau')
  })

  it('writes true prose: credits artist, dates, year and museum; public domain; motion by AI', () => {
    // Sweep slugs until every opener has been seen.
    const openers = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const piece = toPiece(real({ src: `https://x/gallery/p${i}_animated.mp4` }))
      const [opener] = pieceParagraphs(piece)
      openers.add(opener)
      expect(opener).toContain('Paris Street; Rainy Day')
      expect(opener).toContain('Gustave Caillebotte (1848–1894)')
      expect(opener).toContain('1877')
      expect(opener).toContain('the Art Institute of Chicago')
      expect(opener).toMatch(/public domain/)
      expect(opener).toMatch(/motion was added with AI/)
      expect(opener).toContain('19th Century')
      // The AI pieces' honesty line would be a lie here.
      const all = pieceParagraphs(piece).join(' ')
      expect(all).not.toMatch(/AI[- ](generated|made)|homage|not a reproduction|generated (still|image)/i)
      expect(all).not.toMatch(/\bloop/i) // looping: false
    }
    expect(openers.size).toBe(3)
  })

  it('copes with missing optional provenance and with CC0', () => {
    const piece = toPiece(real({ artist_dates: undefined, original_date: undefined, credit_line: undefined, license: 'CC0' }))
    for (let i = 0; i < 12; i++) {
      const text = pieceParagraphs({ ...piece, slug: `s${i}` })[0]
      expect(text).not.toMatch(/\(\)|undefined|made ,|  /)
      expect(text).toMatch(/public domain \(CC0\)/)
    }
    expect(artworkCredit(piece.artwork!)).toBe('Gustave Caillebotte, Paris Street; Rainy Day. Art Institute of Chicago. CC0 (public domain).')
  })

  it('summarises and credits the real work', () => {
    const piece = toPiece(real())
    const summary = pieceSummary(piece)
    expect(summary).toContain('Paris Street; Rainy Day (1877) by Gustave Caillebotte')
    expect(summary).toMatch(/public-domain/)
    expect(summary).toMatch(/AI/)
    expect(summary).not.toMatch(/homage|AI-generated/i)
    expect(artworkCredit(piece.artwork!)).toBe(
      'Gustave Caillebotte (1848–1894), Paris Street; Rainy Day, 1877. ' +
        'Art Institute of Chicago, Charles H. and Mary F. S. Worcester Collection. Public domain.',
    )
  })

  it('names a museum without doubling its own "The"', () => {
    expect(theMuseum('Art Institute of Chicago')).toBe('the Art Institute of Chicago')
    expect(theMuseum('The Metropolitan Museum of Art')).toBe('the Metropolitan Museum of Art')
  })
})
