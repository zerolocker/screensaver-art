import { describe, it, expect } from 'vitest'
import { tagsOf, orderTags, MISC_TAG, FREE_ITEM_COUNT } from './gallery'
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

describe('free-tier invariant', () => {
  it('PRICING.freeItemCount is sourced from FREE_ITEM_COUNT', () => {
    expect(PRICING.freeItemCount).toBe(FREE_ITEM_COUNT)
  })
})
