// Shape of a gallery item as returned by /api/gallery (the route passes through
// the raw gallery.json entry, so `date` and `tags` ride along when present).
export interface ArtItem {
  src: string
  title: string
  type: string
  date?: string
  // Art-style category that drives the filter pills (one per item, from a closed
  // vocabulary — see curation/PROMPT_GUIDANCE.md "Gallery tags"). Optional: any
  // item without it falls back to a single "Misc" tag.
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
