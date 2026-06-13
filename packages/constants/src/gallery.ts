// Gallery data — the shape of a gallery item plus the tag vocabulary and
// helpers that drive sorting and the filter pills. Pure data + pure functions,
// shared by the website, the Electron app (main + renderer), and the backend.

// Shape of a gallery item as served by /api/gallery (the route passes through
// the raw gallery.json entry, so `date`, `tags`, and `collection` ride along
// when present). Curation-only fields like image_prompt/video_prompt are
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
  collection?: string
}

// The /api/gallery response contract — produced by the website's route handler
// and consumed by the Electron app's cache-sync. Centralised here so both sides
// share one definition instead of re-declaring the shape.
export interface GalleryApiResponse {
  items: ArtItem[]
  isSubscribed: boolean
  // Total gallery size (so the client can show "X of Y" in the upsell).
  totalCount: number
}

// How many artworks free (un-subscribed) users get — the single source of truth
// for the free tier across every surface:
//   - the backend's /api/gallery slice for non-subscribers
//   - the Electron app's default cache size + default selection on first run
//   - the number we advertise on the marketing site (via PRICING.freeItemCount)
export const FREE_ITEM_COUNT = 100

// Items with no date are the earliest pieces; treat them as the launch date so
// they sort before everything dated. Must read as a YYYY-MM-DD string so plain
// string comparison orders correctly.
export const UNDATED_FALLBACK = '2026-01-01'

export const MISC_TAG = 'Misc'

export function tagsOf(item: ArtItem): string[] {
  return item.tags && item.tags.length > 0 ? item.tags : [MISC_TAG]
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
