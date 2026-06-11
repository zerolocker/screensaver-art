// Client-side image downsampler shared by the Electron renderer and the website
// (both are Chromium, so the canvas + toBlob('image/webp') path works in both).
//
// Feedback submissions embed the image as base64 inside a single JSON object that
// must fit the Supabase bucket's 1 MB per-file cap. base64 inflates bytes by ~33%,
// so we keep the raw webp comfortably under `maxBytes` (default 500 KB → ~680 KB
// base64), leaving headroom for the rest of the JSON. The encode loop *guarantees*
// the result fits the budget before it is ever handed back.

export interface ResizedImage {
  /** `data:image/webp;base64,…` — ready to embed in the feedback JSON. */
  dataUrl: string
  /** Size of the encoded webp in bytes (not the base64 string). */
  bytes: number
  width: number
  height: number
}

export interface ResizeOptions {
  /** Cap on the longer side of the output, in pixels. */
  maxLongSide?: number
  /** Initial webp quality (0–1). Lowered automatically if the result is too big. */
  quality?: number
  /** Hard budget for the encoded webp, in bytes. */
  maxBytes?: number
}

const QUALITY_STEPS = [0.8, 0.6, 0.45, 0.3]
const MIN_LONG_SIDE = 320

function scaledSize(w: number, h: number, maxLongSide: number): { width: number; height: number } {
  const longSide = Math.max(w, h)
  if (longSide <= maxLongSide) return { width: w, height: h }
  const scale = maxLongSide / longSide
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

function encode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get a 2D canvas context to process the image.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed.'))),
      'image/webp',
      quality,
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the processed image.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Downsample + re-encode an image file to webp, guaranteed to fit `maxBytes`.
 * Throws a user-friendly Error if the file isn't a decodable image.
 */
export async function resizeImageToWebp(file: File, opts: ResizeOptions = {}): Promise<ResizedImage> {
  const maxLongSide = opts.maxLongSide ?? 1024
  const startQuality = opts.quality ?? 0.8
  const maxBytes = opts.maxBytes ?? 500_000

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("That file couldn't be read as an image. Please choose a PNG or JPEG.")
  }

  try {
    let { width, height } = scaledSize(bitmap.width, bitmap.height, maxLongSide)
    let best: Blob | null = null

    // Try progressively lower quality, then shrink dimensions, until it fits.
    while (true) {
      for (const q of QUALITY_STEPS.filter((q) => q <= startQuality)) {
        const blob = await encode(bitmap, width, height, q)
        best = blob
        if (blob.size <= maxBytes) {
          return { dataUrl: await blobToDataUrl(blob), bytes: blob.size, width, height }
        }
      }
      const nextLong = Math.round(Math.max(width, height) / 2)
      if (nextLong < MIN_LONG_SIDE) break
      ;({ width, height } = scaledSize(width, height, nextLong))
    }

    // Floor reached — return the smallest we produced (still the best effort).
    if (!best) throw new Error('Could not process the image.')
    return { dataUrl: await blobToDataUrl(best), bytes: best.size, width, height }
  } finally {
    bitmap.close()
  }
}
