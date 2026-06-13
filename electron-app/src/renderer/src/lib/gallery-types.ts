// Shape of a gallery item as returned by /api/gallery (the route passes through
// the raw gallery.json entry, so `date` and `tags` ride along when present).
export interface ArtItem {
  src: string
  title: string
  type: string
  date?: string
  // Art-style categories. Added to gallery.json in a separate PR; until then this
  // is absent and the UI treats such items as a single "Misc" tag.
  tags?: string[]
  collection?: string
}

// Items with no date are the earliest pieces; treat them as the launch date so
// they sort before everything dated. Must read as a YYYY-MM-DD string so plain
// string comparison orders correctly.
export const UNDATED_FALLBACK = '2026-01-01'

// Default number of pieces selected on first run — mirrors FREE_COUNT in
// electron-app/src/main/cache-sync.ts (keep in sync).
export const DEFAULT_SELECTION_COUNT = 100

export const MISC_TAG = 'Misc'

export function tagsOf(item: ArtItem): string[] {
  return item.tags && item.tags.length > 0 ? item.tags : [MISC_TAG]
}
