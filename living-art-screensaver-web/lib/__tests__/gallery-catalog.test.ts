import { describe, expect, it } from 'vitest'
import { TAG_ORDER } from '@screensaver-art/constants'
import {
  ALL_ERAS,
  ALL_PIECES,
  GALLERY_PAGE_COUNT,
  GALLERY_PAGE_SIZE,
  eraBySlug,
  galleryPage,
  parseTitle,
  pieceBySlug,
  pieceParagraphs,
  pieceSummary,
  relatedPieces,
  slugForSrc,
} from '@/lib/gallery-catalog'
import { ERA_COPY } from '@/lib/era-copy'

/**
 * These run against the real gallery.json, so they're the guard rail on the
 * assumptions the landing pages make about curation's output. The slug tests in
 * particular are load-bearing: a duplicate or changed slug 404s pins that are
 * already live and cannot be re-pointed.
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
    // Same key ⇒ same slug regardless of anything else about the item, which is
    // what makes an already-published /art/<slug> URL permanent.
    expect(slugForSrc('https://cdn.example.com/gallery/edo_sumie_animated.mp4')).toBe('edo-sumie-animated')
    expect(slugForSrc('/gallery/Edo_Sumie_Animated.MP4')).toBe('edo-sumie-animated')
    for (const piece of ALL_PIECES) expect(slugForSrc(piece.src)).toBe(piece.slug)
  })

  it('splits every title into a name and a movement', () => {
    for (const piece of ALL_PIECES) {
      expect(piece.name, piece.title).not.toBe('')
      expect(piece.movement, piece.title).not.toBe('')
      expect(piece.name, piece.title).not.toMatch(/AI Animated/)
    }
    expect(parseTitle('Woman and Flora - Art Nouveau (AI Animated)')).toEqual({
      name: 'Woman and Flora',
      movement: 'Art Nouveau',
    })
    // A title that doesn't match still yields a usable name, never a crash.
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
    // The prompts are machine instructions ("static camera", "no morphing") and
    // 61 pieces don't have them at all — the pages must not read like a config
    // file, so nothing derived from them may reach the copy.
    const promptTells = /static camera|no morphing|keeps its exact|masterpiece, high quality|seamless(ly)? loop\b.*prompt/i
    for (const piece of ALL_PIECES.slice(0, 40)) {
      const text = pieceParagraphs(piece).join(' ')
      expect(text).not.toMatch(promptTells)
      expect(text.length).toBeGreaterThan(200)
      // Honesty rule: every piece page states the art is AI-generated.
      expect(text).toMatch(/\bAI[- ](generated|made|animated|homage)/i)
      expect(text).toContain(piece.name)
      expect(text).toContain(piece.era)
    }
  })

  it('gives adjacent pieces different opening sentences', () => {
    // Five deterministic sentence shapes — enough that a grid of related pieces
    // doesn't read as 8 copies of one template.
    const openers = new Set(ALL_PIECES.slice(0, 30).map((p) => pieceParagraphs(p)[0].replace(p.name, '')))
    expect(openers.size).toBeGreaterThan(1)
  })

  it('summarises a piece for social/meta without over-claiming', () => {
    const piece = ALL_PIECES[0]
    const summary = pieceSummary(piece)
    expect(summary).toContain(piece.name)
    expect(summary).toMatch(/AI-animated/)
    expect(summary.length).toBeLessThan(200)
  })

  it('only calls a piece a loop when it is authored to loop', () => {
    // Most pieces are made to play through once; the copy used to call every
    // piece a seamless loop anyway.
    const nonLooping = ALL_PIECES.filter((p) => !p.looping)
    expect(nonLooping.length).toBeGreaterThan(0)
    for (const piece of nonLooping) {
      // Strip the name first: one piece is literally called "Geometric Loop".
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
      // The gradient is the floor: pieces with no poster still render.
      expect(piece.gradient).toMatch(/^radial-gradient/)
      if (piece.posterUrl) expect(piece.posterUrl).toMatch(/^(https:\/\/|\/posters\/)/)
    }
  })
})
