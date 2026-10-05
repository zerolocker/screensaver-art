// Portrait pieces. Gallery clips are 16:9, except paintings Omni animated as
// 9:16. Wherever a portrait clip plays in a wider frame, the player shows it
// whole, centred on this wall, instead of cropping it. gallery.json has no
// aspect field: each player reads the clip's own size. The macOS screensaver
// keeps its own copy of the colour (ScreensaverArtView.swift).

/** The near-black wall the curation hangs real paintings on. */
export const PORTRAIT_WALL = '#0b0b0d'

/** Taller than wide, as displayed. A clip whose size isn't known yet (0×0) is not portrait. */
export function isPortraitVideo(width: number, height: number): boolean {
  return height > width
}
