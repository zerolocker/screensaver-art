import { describe, it, expect } from 'vitest'
import { matchesQuery, type ArtItem } from './gallery-types'

const item = (over: Partial<ArtItem> = {}): ArtItem => ({
  src: 's',
  title: 'Starry Night',
  type: 'video',
  tags: ['Modern', '19th Century'],
  ...over,
})

describe('matchesQuery', () => {
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
