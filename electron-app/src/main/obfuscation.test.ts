import { describe, it, expect } from 'vitest'
import { obfuscate, filenameForUrl, MAGIC, KEY } from './obfuscation'

// The obfuscation logic is mirrored byte-for-byte in screensaver/Constants.swift
// + screensaver/CachedGallery.swift. If any of these tests start failing,
// audit both sides — they MUST stay in sync or the screensaver can't decrypt.

describe('obfuscate', () => {
  it('prepends the LARTV001 magic header', () => {
    const out = obfuscate(Buffer.from('hello'))
    expect(out.subarray(0, MAGIC.length).toString('utf8')).toBe('LARTV001')
  })

  it('XORs the body with the cycling 32-byte key', () => {
    const plain = Buffer.alloc(KEY.length, 0)
    const out = obfuscate(plain)
    // 0 ^ key[i] === key[i], so the body is just the key itself
    expect(out.subarray(MAGIC.length)).toEqual(Buffer.from(KEY))
  })

  it('cycles the key for plaintexts longer than 32 bytes', () => {
    const plain = Buffer.alloc(KEY.length * 3, 0xff)
    const out = obfuscate(plain)
    const body = out.subarray(MAGIC.length)
    for (let i = 0; i < body.length; i++) {
      expect(body[i]).toBe(0xff ^ KEY[i % KEY.length])
    }
  })

  it('round-trips: XOR with the same key recovers the plaintext', () => {
    const plain = Buffer.from('Hello, screensaver! ' + '🎨'.repeat(10), 'utf8')
    const obf = obfuscate(plain)
    const body = obf.subarray(MAGIC.length)
    const recovered = Buffer.alloc(body.length)
    for (let i = 0; i < body.length; i++) {
      recovered[i] = body[i] ^ KEY[i % KEY.length]
    }
    expect(recovered).toEqual(plain)
  })

  it('handles empty input', () => {
    const out = obfuscate(Buffer.alloc(0))
    expect(out.length).toBe(MAGIC.length)
    expect(out).toEqual(MAGIC)
  })

  it('produces output of length magic + plaintext', () => {
    const plain = Buffer.alloc(12345)
    const out = obfuscate(plain)
    expect(out.length).toBe(MAGIC.length + plain.length)
  })
})

describe('filenameForUrl', () => {
  it('is deterministic — same URL → same filename', () => {
    const url = 'https://example.com/foo.mp4'
    expect(filenameForUrl(url)).toBe(filenameForUrl(url))
  })

  it('produces 16 hex chars + .bin', () => {
    const name = filenameForUrl('https://example.com/x.mp4')
    expect(name).toMatch(/^[0-9a-f]{16}\.bin$/)
  })

  it('matches the Swift djb2-127 implementation for a known input', () => {
    // This exact value was produced by the Swift code in screensaver/CachedGallery.swift
    // running over the same input string. Locking it in keeps the two sides honest.
    expect(filenameForUrl('https://example.com/foo.mp4')).toBe('fe20cbeaf403f1e3.bin')
  })

  it('differs for differing URLs', () => {
    const a = filenameForUrl('https://example.com/a.mp4')
    const b = filenameForUrl('https://example.com/b.mp4')
    expect(a).not.toBe(b)
  })

  it('handles unicode', () => {
    const name = filenameForUrl('https://example.com/🎨.mp4')
    expect(name).toMatch(/^[0-9a-f]{16}\.bin$/)
  })
})

describe('MAGIC + KEY constants', () => {
  it('MAGIC is exactly 8 bytes', () => {
    expect(MAGIC.length).toBe(8)
  })

  it('MAGIC bytes spell "LARTV001"', () => {
    expect(MAGIC.toString('utf8')).toBe('LARTV001')
  })

  it('KEY is exactly 32 bytes', () => {
    expect(KEY.length).toBe(32)
  })
})
