import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  tagsOf,
  orderTags,
  matchesQuery,
  isItemFree,
  isItemLocked,
  MISC_TAG,
  FREE_ITEM_COUNT,
  type ArtItem,
} from './gallery'
import { PRICING } from './pricing'

describe('tagsOf', () => {
  it('returns the item tags when present', () => {
    expect(tagsOf({ src: 'a', title: 't', type: 'video', tags: ['Modern'] })).toEqual(['Modern'])
  })

  it('falls back to Misc when tags are missing or empty', () => {
    expect(tagsOf({ src: 'a', title: 't', type: 'video' })).toEqual([MISC_TAG])
    expect(tagsOf({ src: 'a', title: 't', type: 'video', tags: [] })).toEqual([MISC_TAG])
  })
})

describe('orderTags', () => {
  it('sorts known tags by the canonical museum order', () => {
    expect(orderTags(['Modern', 'Egyptian', 'Greek & Roman'])).toEqual([
      'Egyptian',
      'Greek & Roman',
      'Modern',
    ])
  })

  it('pushes unknown tags to the end, keeping their first-seen order', () => {
    expect(orderTags(['Zeta', 'Modern', 'Alpha'])).toEqual(['Modern', 'Zeta', 'Alpha'])
  })
})

describe('matchesQuery', () => {
  const item = (over: Partial<ArtItem> = {}): ArtItem => ({
    src: 's',
    title: 'Starry Night',
    type: 'video',
    tags: ['Modern', '19th Century'],
    ...over,
  })

  it('matches everything on an empty or blank query', () => {
    expect(matchesQuery(item(), '')).toBe(true)
    expect(matchesQuery(item(), '   ')).toBe(true)
  })

  it('matches a title substring, case-insensitively', () => {
    expect(matchesQuery(item(), 'starry')).toBe(true)
    expect(matchesQuery(item(), 'NIGHT')).toBe(true)
  })

  it('matches a tag', () => {
    expect(matchesQuery(item(), 'modern')).toBe(true)
    expect(matchesQuery(item(), '19th')).toBe(true)
  })

  it('falls back to the Misc tag when an item has no tags', () => {
    expect(matchesQuery(item({ tags: [] }), 'misc')).toBe(true)
  })

  it('returns false when neither title nor tags contain the query', () => {
    expect(matchesQuery(item(), 'baroque')).toBe(false)
    expect(matchesQuery(item(), 'night sky')).toBe(false)
  })
})

describe('isItemFree / isItemLocked', () => {
  const free: ArtItem = { src: 'f', title: 'F', type: 'video', free: true }
  const paid: ArtItem = { src: 'p', title: 'P', type: 'video' } // no flag → locked

  it('isItemFree is true only when the flag is exactly true', () => {
    expect(isItemFree(free)).toBe(true)
    expect(isItemFree(paid)).toBe(false)
    expect(isItemFree({ ...paid, free: false })).toBe(false)
  })

  it('subscribers never see a locked piece', () => {
    expect(isItemLocked(free, true)).toBe(false)
    expect(isItemLocked(paid, true)).toBe(false)
  })

  it('non-subscribers only unlock free pieces', () => {
    expect(isItemLocked(free, false)).toBe(false)
    expect(isItemLocked(paid, false)).toBe(true)
  })
})

describe('free-tier invariant', () => {
  it('PRICING.freeItemCount is sourced from FREE_ITEM_COUNT', () => {
    expect(PRICING.freeItemCount).toBe(FREE_ITEM_COUNT)
  })

  it('gallery.json flags exactly FREE_ITEM_COUNT pieces as free', () => {
    // The advertised free count must equal the real number of `free: true`
    // pieces in the playlist, or the marketing copy lies. New pieces default to
    // locked (no flag), so this stays at FREE_ITEM_COUNT as the catalog grows.
    const galleryPath = join(dirname(fileURLToPath(import.meta.url)), '../../../gallery.json')
    const items = JSON.parse(readFileSync(galleryPath, 'utf8')) as ArtItem[]
    expect(items.filter(isItemFree)).toHaveLength(FREE_ITEM_COUNT)
  })
})
