// Cache obfuscation: an 8-byte magic header, then the MP4 XOR'd with a 32-byte
// key, saved as `<hash>.bin` so it won't open in QuickTime. It deters casual
// copying; it isn't encryption, since both binaries contain the key.
//
// The key, header and filename hash MUST match
// screensaver-macos/ScreensaverArtExtension/Constants.swift.

export const MAGIC = Buffer.from('LARTV001', 'utf8') // 8 bytes
export const KEY = Buffer.from([
  0x9c, 0x4d, 0x1f, 0x7a, 0xe3, 0x55, 0xa1, 0x08,
  0x6b, 0xd2, 0x44, 0xc7, 0x18, 0xf9, 0x82, 0x37,
  0x2e, 0xa6, 0x71, 0xbb, 0x09, 0x5d, 0xe4, 0xc1,
  0x76, 0x33, 0x88, 0x4f, 0xaa, 0x12, 0xb9, 0x60,
])

// djb2-127 of the URL, matching Swift's wrapping `&*` / `&+` on 64-bit unsigned.
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

// XOR one chunk of a stream. `offset` is its position in the MP4 (excluding the
// header), so chunked output matches obfuscate(wholeBuffer).
export function obfuscateChunk(chunk: Buffer, offset: number): Buffer {
  const out = Buffer.allocUnsafe(chunk.length)
  for (let i = 0; i < chunk.length; i++) {
    out[i] = chunk[i] ^ KEY[(offset + i) % KEY.length]
  }
  return out
}
