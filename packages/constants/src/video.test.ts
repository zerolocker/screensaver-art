import { describe, it, expect } from 'vitest'
import { isPortraitVideo } from './video'

describe('isPortraitVideo', () => {
  it('is true only for clips taller than wide', () => {
    expect(isPortraitVideo(720, 1280)).toBe(true)
    expect(isPortraitVideo(1280, 720)).toBe(false)
    expect(isPortraitVideo(1080, 1080)).toBe(false)
  })

  it('treats a clip whose size is not loaded yet as landscape', () => {
    expect(isPortraitVideo(0, 0)).toBe(false)
  })
})
