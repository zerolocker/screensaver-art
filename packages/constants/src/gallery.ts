// The gallery item type, tag list, and gating helpers, shared by the website and
// the Electron app.

// A gallery.json entry as served by /api/gallery. Curation-only fields (prompts)
// and website-only images are left out because clients never read them.
export interface ArtItem {
  src: string
  title: string
  type: string
  date?: string
  // One tag from TAG_ORDER, for the filter pills. Missing means "Misc".
  tags?: string[]
  // `true` opens the piece to everyone. New pieces leave it unset (subscriber-only).
  // The free pieces are spread through the catalog so free users keep meeting
  // locked ones.
  free?: boolean

  // ---- Provenance, only on real public-domain paintings --------------------
  // Test with `isRealArtwork`, not the title. REQUIRED_PROVENANCE_FIELDS must be set.
  source?: ArtSource
  artist?: string // "Gustave Caillebotte"
  artist_dates?: string // "1848–1894"
  original_title?: string // "Paris Street; Rainy Day"
  original_date?: string // "1877" — the painting's date, not when it joined the gallery
  museum?: string // "Art Institute of Chicago"
  credit_line?: string // "Charles H. and Mary F. S. Worcester Collection"
  source_url?: string // the museum's object page
  license?: ArtLicense
}

/** Where a piece's still came from. Absent means AI-generated. */
export type ArtSource = 'real_artwork'

/** The only licences a real artwork may carry. */
export type ArtLicense = 'Public Domain' | 'CC0'

export const ART_LICENSES: readonly ArtLicense[] = ['Public Domain', 'CC0']

/** The provenance keys a real-artwork entry carries, in gallery.json order. */
export const PROVENANCE_FIELDS = [
  'source',
  'artist',
  'artist_dates',
  'original_title',
  'original_date',
  'museum',
  'credit_line',
  'source_url',
  'license',
] as const

/** Provenance keys that must be present (non-empty) on every real-artwork entry. */
export const REQUIRED_PROVENANCE_FIELDS = [
  'source',
  'artist',
  'original_title',
  'museum',
  'source_url',
  'license',
] as const

// A real public-domain painting animated with AI, rather than an AI-generated still.
export function isRealArtwork(item: ArtItem): boolean {
  return item.source === 'real_artwork'
}

// The /api/gallery response. Everyone gets the full list; gating is client-side
// (`isItemLocked`).
export interface GalleryApiResponse {
  items: ArtItem[]
  isSubscribed: boolean
}

// The number of `free: true` pieces in gallery.json. A test keeps them equal.
export const FREE_ITEM_COUNT = 50

// Undated items are the oldest; sort them as the launch date (YYYY-MM-DD).
export const UNDATED_FALLBACK = '2026-01-01'

export const MISC_TAG = 'Misc'

export function isItemFree(item: ArtItem): boolean {
  return item.free === true
}

// The gating rule, used by the app's gallery and by cache-sync.
export function isItemLocked(item: ArtItem, isSubscribed: boolean): boolean {
  return !isSubscribed && !isItemFree(item)
}

export function tagsOf(item: ArtItem): string[] {
  return item.tags && item.tags.length > 0 ? item.tags : [MISC_TAG]
}

// Case-insensitive match on title and tags. A blank query matches everything.
export function matchesQuery(item: ArtItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (item.title.toLowerCase().includes(q)) return true
  return tagsOf(item).some((t) => t.toLowerCase().includes(q))
}

// The closed tag list in pill order: world cultures, then the Western timeline.
// Mirrors "Gallery tags" in curation/PROMPT_GUIDANCE.md.
export const TAG_ORDER = [
  'Prehistoric',
  'Egyptian',
  'Ancient Near East',
  'Greek & Roman',
  'Arts of the Americas',
  'Arts of Africa & Oceania',
  'Japanese',
  'Chinese & Korean',
  'South & Southeast Asian',
  'Islamic',
  'Medieval & Byzantine',
  'Renaissance & Baroque',
  '19th Century',
  'Modern',
  'Contemporary',
]

// Sort tags by TAG_ORDER; unknown tags go last, in their original order.
export function orderTags(tags: string[]): string[] {
  const rank = (t: string): number => {
    const i = TAG_ORDER.indexOf(t)
    return i === -1 ? TAG_ORDER.length : i
  }
  return tags
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
    .map((x) => x.t)
}
