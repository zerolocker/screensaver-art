import { describe, it, expect } from 'vitest'
import { cn } from './utils'

// `cn()` is the canonical class-name helper — every component in this package
// runs through it. It composes clsx (conditional concatenation) with twMerge
// (tailwind conflict resolution). The behaviors below are the contracts the
// rest of the codebase relies on.

describe('cn', () => {
  it('joins string arguments with spaces', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('drops falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar')
  })

  it('expands an object map of conditionals', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('flattens nested arrays', () => {
    expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz')
  })

  it('resolves tailwind conflicts (later class wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('keeps non-conflicting tailwind classes side-by-side', () => {
    expect(cn('p-4', 'm-2', 'rounded-lg')).toBe('p-4 m-2 rounded-lg')
  })

  it('returns an empty string when given nothing', () => {
    expect(cn()).toBe('')
  })

  it('handles a real-world conditional override pattern', () => {
    const isActive = true
    const out = cn(
      'px-3 py-2 rounded-lg text-sm',
      isActive ? 'bg-primary text-white' : 'bg-transparent text-muted-foreground',
    )
    expect(out).toContain('bg-primary')
    expect(out).toContain('text-white')
    expect(out).not.toContain('bg-transparent')
  })
})
