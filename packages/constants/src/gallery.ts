// Gallery data — the shape of a gallery item plus the tag vocabulary and
// helpers that drive sorting and the filter pills. Pure data + pure functions,
// shared by the website, the Electron app (main + renderer), and the backend.

// Shape of a gallery item as served by /api/gallery (the route passes through
// the raw gallery.json entry, so `date`, `tags` and any provenance fields ride
// along when present). Curation-only fields like image_prompt/video_prompt are
// intentionally omitted — clients never read them.
export interface ArtItem {
  src: string
  title: string
  type: string
  date?: string
  // Art-style category that drives the filter pills (one per item, from a closed
  // vocabulary — see curation/PROMPT_GUIDANCE.md "Gallery tags"). Optional: any
  // item without it falls back to a single "Misc" tag.
  tags?: string[]
  // Free-tier flag. `true` → unlocked for everyone (counts toward the advertised
  // free tier); absent/false → subscriber-only ("locked" for non-subscribers).
  // Source of truth is gallery.json. New pieces default to locked (no flag) so
  // freshly-added art is a subscriber perk, and the free items are *interleaved*
  // through the catalog (not the first N) — so a free user keeps bumping into
  // locked pieces while browsing, which is the core upsell surface. See
  // `isItemLocked` for the gating rule.
  free?: boolean

  // ---- Provenance — only on animated REAL paintings ------------------------
  // Most pieces are AI-generated stills in the style of a movement; those carry
  // none of the fields below. A real, public-domain painting (sourced per
  // curation/REAL_PAINTINGS_CURATION.md and animated with AI) carries all of
  // them, with `source: 'real_artwork'`. A missing `source` means AI-generated —
  // test with `isRealArtwork`, never by sniffing the title. Required on a real
  // artwork (curation/publish-piece.mjs --provenance enforces it): source,
  // artist, original_title, museum, source_url, license. The rest are optional.
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

/** Where a piece's still came from. Absent = AI-generated (every piece before real art). */
export type ArtSource = 'real_artwork'

/** The only licences a real artwork may carry — anything weaker is rejected at curation. */
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

// A real, human-made painting (public domain) animated with AI — as opposed to
// an AI-generated still. Pieces without a `source` are AI-generated.
export function isRealArtwork(item: ArtItem): boolean {
  return item.source === 'real_artwork'
}

// The /api/gallery response contract — produced by the website's route handler
// and consumed by the Electron app's cache-sync. Centralised here so both sides
// share one definition instead of re-declaring the shape. The route returns the
// FULL list to everyone (a free user can browse + preview everything); gating is
// per-item and client-side — see `isItemLocked` / each item's `free` flag.
export interface GalleryApiResponse {
  items: ArtItem[]
  isSubscribed: boolean
}

// How many artworks free (un-subscribed) users get — the headline of the free
// tier we advertise across the marketing site + app (via PRICING.freeItemCount).
// This is the *count of items flagged `free: true` in gallery.json*; the
// `free-tier invariant` test keeps the advertised number from drifting from the
// actual data. (Free-ness is per-item now — see `ArtItem.free` — not a positional
// threshold, so free pieces can be interleaved among locked ones.)
export const FREE_ITEM_COUNT = 50

// Items with no date are the earliest pieces; treat them as the launch date so
// they sort before everything dated. Must read as a YYYY-MM-DD string so plain
// string comparison orders correctly.
export const UNDATED_FALLBACK = '2026-01-01'

export const MISC_TAG = 'Misc'

// Whether a piece is free-tier (open to everyone). Absent/false → subscriber-only.
export function isItemFree(item: ArtItem): boolean {
  return item.free === true
}

// The single gating rule, shared by the Electron Gallery (lock badges + which
// pieces are selectable) and cache-sync (which pieces are downloaded/kept): a
// piece is "locked" only when the viewer isn't subscribed AND it isn't a free
// piece. Subscribers unlock everything; free pieces are open to all.
export function isItemLocked(item: ArtItem, isSubscribed: boolean): boolean {
  return !isSubscribed && !isItemFree(item)
}

export function tagsOf(item: ArtItem): string[] {
  return item.tags && item.tags.length > 0 ? item.tags : [MISC_TAG]
}

// Free-text match over an item's title + tags (case-insensitive). An empty/blank
// query matches everything, so the search box is a pure narrowing filter.
export function matchesQuery(item: ArtItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (item.title.toLowerCase().includes(q)) return true
  return tagsOf(item).some((t) => t.toLowerCase().includes(q))
}

// Canonical pill order (the closed tag vocabulary — museum "wings": world cultures
// first, then the Western timeline). Any tag outside this list — e.g. the Misc
// fallback — sorts to the end, keeping its first-seen order. See
// curation/PROMPT_GUIDANCE.md "Gallery tags".
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

// Sort distinct tags (given in first-seen order) by the canonical order above,
// leaving unknown tags in their original relative position at the end.
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
