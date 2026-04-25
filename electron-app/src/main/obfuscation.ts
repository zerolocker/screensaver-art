// Cache-file obfuscation.
//
// We XOR every byte of an MP4 with a fixed 32-byte cycling key and prepend an
// 8-byte magic header. Files land on disk as `<hash>.bin`, so they don't open
// in QuickTime even after rename. This is NOT cryptography — anyone willing to
// disassemble either binary can recover the key. The point is to deter the
// casual "drag the MP4 out of the cache and post it" path for a $0.99 product.
//
// The exact same key + magic + filename hash is duplicated in the Swift
// screensaver (see screensaver/CachedGallery.swift). If you change either,
// change both.

export const MAGIC = Buffer.from('LARTV001', 'utf8') // 8 bytes
export const KEY = Buffer.from([
  0x9c, 0x4d, 0x1f, 0x7a, 0xe3, 0x55, 0xa1, 0x08,
  0x6b, 0xd2, 0x44, 0xc7, 0x18, 0xf9, 0x82, 0x37,
  0x2e, 0xa6, 0x71, 0xbb, 0x09, 0x5d, 0xe4, 0xc1,
  0x76, 0x33, 0x88, 0x4f, 0xaa, 0x12, 0xb9, 0x60,
])

// djb2-127 of the URL string. Mirrors the Swift implementation byte-for-byte.
// The 64-bit unsigned overflow has to match Swift's `&*` / `&+` semantics.
export function filenameForUrl(url: string): string {
  const MASK = (1n << 64n) - 1n
  let hash = 5381n
  const bytes = Buffer.from(url, 'utf8')
  for (const b of bytes) {
    hash = ((hash * 127n) + BigInt(b)) & MASK
  }
  return hash.toString(16).padStart(16, '0') + '.bin'
}

export function obfuscate(plaintext: Buffer): Buffer {
  const out = Buffer.allocUnsafe(MAGIC.length + plaintext.length)
  MAGIC.copy(out, 0)
  for (let i = 0; i < plaintext.length; i++) {
    out[MAGIC.length + i] = plaintext[i] ^ KEY[i % KEY.length]
  }
  return out
}
