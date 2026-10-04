import { describe, it, expect } from 'vitest'
import { slugForSrc, ALL_PIECES } from '../gallery-catalog'
// The marketing poster is plain ESM with no npm deps, so it imports cleanly here.
import { webSlugForSrc } from '../../../marketing/lib/pieces.mjs'
import { landingUrl } from '../../../marketing/lib/pieces.mjs'

/**
 * The poster's slug rule (marketing/lib/pieces.mjs, run by plain node) must match
 * the website's (`slugForSrc`). Posted links can't be edited, so a mismatch
 * would break them all.
 */
describe('social post links match the website routes', () => {
  it('derives the same slug as the website for every gallery piece', () => {
    const mismatches = ALL_PIECES
      .map((p) => ({ src: p.src, web: p.slug, social: webSlugForSrc(p.src) }))
      .filter((r) => r.web !== r.social)
    expect(mismatches).toEqual([])
  })

  it('agrees with the website on the shapes curation actually produces', () => {
    for (const file of ['a_b_animated.mp4', 'Mixed_Case_LOOPING.mp4', 'x&y_animated.mp4', 'dash-name_animated.mp4']) {
      const src = `https://screensaver-assets.living-art-asset.com/gallery/${file}`
      expect(webSlugForSrc(src)).toBe(slugForSrc(src))
    }
  })

  it('points a post at that piece\'s own page, tagged per channel', () => {
    const piece = ALL_PIECES[0]
    const url = new URL(landingUrl(piece.slug, 'pinterest'))
    expect(url.pathname).toBe(`/art/${piece.slug}`)
    expect(url.searchParams.get('utm_source')).toBe('pinterest')
    expect(url.searchParams.get('utm_medium')).toBe('social')
    expect(url.searchParams.get('utm_campaign')).toBe('daily')
  })
})
