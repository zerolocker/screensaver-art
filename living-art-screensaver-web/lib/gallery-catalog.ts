/**
 * The data behind `/gallery`, `/art/<slug>` and `/era/<tag>`: a sorted view of
 * `gallery.json`, imported at build time. These pages are landing pages for
 * social posts (mainly Pinterest), not an SEO play. Each nightly push to
 * `master` redeploys the site, so new pieces get pages automatically.
 */

import {
  FREE_ITEM_COUNT,
  isItemFree,
  isRealArtwork,
  tagsOf,
  orderTags,
  type ArtItem,
} from '@screensaver-art/constants'
import rawGallery from '../../gallery.json'
import { poster as gradientPoster } from './gallery-showcase'
import { ERA_COPY, type EraCopy } from './era-copy'

/**
 * Whether search engines may index `/art/*` (controls the robots tag and the
 * sitemap). Off because hundreds of generated pages risk a Google penalty on
 * the whole domain, and Pinterest doesn't need them indexed. `/gallery` and
 * `/era/*` are always indexable.
 */
export const INDEX_ART_PAGES = false

/** Raw `gallery.json` entry — a superset of the client-facing `ArtItem`. */
export interface RawItem extends ArtItem {
  /**
   * Website-only images on R2 (not in `ArtItem`; the app never reads them):
   *   img     2K WebP        archival still; the site never needs more than 720p
   *   og_img  1280x720 JPEG  social cards (JPEG: crawlers and satori handle WebP badly)
   *   thumb   640w WebP      the /gallery grid
   */
  img?: string
  og_img?: string
  thumb?: string
  image_prompt?: string
  video_prompt?: string
  looping?: boolean
}

/** Provenance of a real public-domain artwork. Missing optional fields are ''. */
export interface Artwork {
  artist: string
  /** "1848–1894", or '' */
  artistDates: string
  originalTitle: string
  /** The work's own date ("1877", "c. 1660"), or '' — not when it joined the gallery. */
  originalDate: string
  museum: string
  /** The museum's credit line ("Charles H. and Mary F. S. Worcester Collection"), or '' */
  creditLine: string
  /** The museum's object page. */
  sourceUrl: string
  /** "Public Domain" | "CC0" */
  license: string
}

export interface CatalogPiece {
  /** URL slug — `/art/<slug>`. Permanent; see `slugForSrc`. */
  slug: string
  /** Display name, e.g. "Woman and Flora" (title minus the style + suffix). */
  name: string
  /** Art movement from the title, e.g. "Art Nouveau". '' on a real artwork. */
  movement: string
  /** The line under the name: the movement, or the artist for a real artwork. */
  subtitle: string
  /** Set only on a real artwork. */
  artwork: Artwork | null
  /** Full title as stored in gallery.json. */
  title: string
  /** MP4 on the R2 custom domain. */
  src: string
  /** Hero still (2K). Null only if a piece somehow lacks derivatives. */
  posterUrl: string | null
  /** 640w grid tile — the right physical size at every breakpoint. */
  thumbUrl: string | null
  /** 1280x720 JPEG for og:image / twitter:image. */
  cardUrl: string | null
  /** Deterministic CSS gradient shown under/instead of the poster. */
  gradient: string
  /** Era tag, from the closed list in @screensaver-art/constants. */
  era: string
  /** `/era/<eraSlug>`. */
  eraSlug: string
  /** ISO date the piece entered the collection. */
  date: string
  /** Free-tier piece (open to everyone) vs. subscriber-only. */
  free: boolean
  /** The clip is authored to loop seamlessly. */
  looping: boolean
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The piece's URL slug, from its R2 key.
 *
 * Must never change: posted pins can't be edited, so a changed slug breaks
 * them forever. R2 keys are never renamed, unlike titles. It depends on this
 * item alone (no "-2" suffixes or positions that shift when other pieces are
 * added); a test asserts uniqueness. Don't prettify it either, since that would
 * change every existing URL.
 */
export function slugForSrc(src: string): string {
  const file = src.split('/').pop() ?? src
  return slugify(file.replace(/\.[a-z0-9]+$/i, ''))
}

/** `/era/<eraSlug>`, from the closed tag list. */
export function slugForEra(era: string): string {
  return slugify(era)
}

// ---------------------------------------------------------------------------
// Title parsing
// ---------------------------------------------------------------------------

/**
 * AI titles are `"<Name> - <Movement> (AI Animated)"`. A title that doesn't
 * match becomes the name, with no movement.
 */
const TITLE_RE = /^(.+?)\s+-\s+(.+?)\s*\(AI Animated\)\s*$/

export function parseTitle(title: string): { name: string; movement: string } {
  const m = TITLE_RE.exec(title)
  if (!m) return { name: title.replace(/\s*\(AI Animated\)\s*$/, '').trim(), movement: '' }
  return { name: m[1].trim(), movement: m[2].trim() }
}

/**
 * A real artwork's title puts the artist in the movement slot:
 * `"Paris Street; Rainy Day - Gustave Caillebotte (AI Animated)"`. Split on the
 * known artist, since the painting's own title may contain " - ".
 */
export function parseArtworkTitle(title: string, artwork: Pick<Artwork, 'artist' | 'originalTitle'>): string {
  const suffix = ` - ${artwork.artist} (AI Animated)`
  if (artwork.artist && title.trim().endsWith(suffix)) return title.trim().slice(0, -suffix.length).trim()
  return artwork.originalTitle || parseTitle(title).name
}

/** Provenance for a real artwork, or null for an AI-generated piece (no `source`). */
function artworkOf(item: RawItem): Artwork | null {
  if (!isRealArtwork(item)) return null
  return {
    artist: item.artist ?? '',
    artistDates: item.artist_dates ?? '',
    originalTitle: item.original_title ?? '',
    originalDate: item.original_date ?? '',
    museum: item.museum ?? '',
    creditLine: item.credit_line ?? '',
    sourceUrl: item.source_url ?? '',
    license: item.license ?? '',
  }
}

// ---------------------------------------------------------------------------
// Posters
// ---------------------------------------------------------------------------

/** The stills shown before and behind the clip. The gradient covers any gap. */
function postersFor(item: RawItem) {
  return {
    // og_img, not img: the clips are 720p, so a bigger still only costs bytes
    // and shows a resolution drop when the video starts.
    posterUrl: item.og_img ?? item.img ?? null,
    thumbUrl: item.thumb ?? item.og_img ?? null,
    cardUrl: item.og_img ?? item.img ?? null,
  }
}

// ---------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------

/** One gallery.json entry → its landing-page view. Exported for tests. */
export function toPiece(item: RawItem): CatalogPiece {
  const artwork = artworkOf(item)
  const { name, movement } = artwork
    ? { name: parseArtworkTitle(item.title, artwork), movement: '' }
    : parseTitle(item.title)
  const era = tagsOf(item)[0]
  return {
    slug: slugForSrc(item.src),
    name,
    movement,
    subtitle: artwork ? artwork.artist : movement,
    artwork,
    title: item.title,
    src: item.src,
    ...postersFor(item),
    gradient: gradientPoster({ name: item.title }),
    era,
    eraSlug: slugForEra(era),
    date: item.date ?? '',
    free: isItemFree(item),
    looping: item.looping === true,
  }
}

/** Newest first — a browse surface should open on the freshest art. */
export const ALL_PIECES: CatalogPiece[] = (rawGallery as RawItem[])
  .map(toPiece)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)))

const BY_SLUG = new Map(ALL_PIECES.map((p) => [p.slug, p]))

export function pieceBySlug(slug: string): CatalogPiece | undefined {
  return BY_SLUG.get(slug)
}

export interface EraSummary extends EraCopy {
  era: string
  slug: string
  count: number
  pieces: CatalogPiece[]
  /** A piece with a real still, for the era card's thumbnail. */
  cover: CatalogPiece
}

/** The 15 eras, in the canonical museum-wing order from the constants package. */
export const ALL_ERAS: EraSummary[] = orderTags([...new Set(ALL_PIECES.map((p) => p.era))]).map((era) => {
  const pieces = ALL_PIECES.filter((p) => p.era === era)
  return {
    era,
    slug: slugForEra(era),
    count: pieces.length,
    pieces,
    cover: pieces.find((p) => p.posterUrl) ?? pieces[0],
    ...eraCopy(era),
  }
})

const ERA_BY_SLUG = new Map(ALL_ERAS.map((e) => [e.slug, e]))

export function eraBySlug(slug: string): EraSummary | undefined {
  return ERA_BY_SLUG.get(slug)
}

function eraCopy(era: string): EraCopy {
  return (
    ERA_COPY[era] ?? {
      headline: era,
      blurb: `Pieces in the ${era} wing of the collection.`,
    }
  )
}

/**
 * Related pieces for a piece page: same movement (or artist) first, then the
 * rest of its era. Deterministic, so builds are stable.
 */
export function relatedPieces(piece: CatalogPiece, limit = 8): CatalogPiece[] {
  const sameMovement = piece.subtitle
    ? ALL_PIECES.filter(
        (p) => p.slug !== piece.slug && p.subtitle === piece.subtitle && !p.artwork === !piece.artwork,
      )
    : []
  const sameEra = ALL_PIECES.filter(
    (p) => p.slug !== piece.slug && p.era === piece.era && !sameMovement.some((m) => m.slug === p.slug),
  )
  return [...sameMovement, ...sameEra].slice(0, limit)
}

// ---------------------------------------------------------------------------
// Pagination (/gallery)
// ---------------------------------------------------------------------------

/** Tiles per /gallery page. Kept small for the phones most visitors use. */
export const GALLERY_PAGE_SIZE = 48

export const GALLERY_PAGE_COUNT = Math.max(1, Math.ceil(ALL_PIECES.length / GALLERY_PAGE_SIZE))

export function galleryPage(n: number): CatalogPiece[] {
  const start = (n - 1) * GALLERY_PAGE_SIZE
  return ALL_PIECES.slice(start, start + GALLERY_PAGE_SIZE)
}

/** `/gallery` for page 1, `/gallery/page/N` after that. */
export function galleryPageHref(n: number): string {
  return n <= 1 ? '/gallery' : `/gallery/page/${n}`
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-02-28" → "February 2026". Parsed by hand so it can't shift by timezone. */
export function formatMonth(date: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(date)
  if (!m) return ''
  return `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim()
}

/** Stable per-slug index into a list — gives copy variety without randomness. */
function variantIndex(slug: string, count: number): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return h % count
}

/**
 * The piece page's prose, built from its fields with a sentence shape picked
 * per slug, plus the era paragraph. Not from the prompts, which read like
 * machine instructions.
 *
 * Every sentence must be true: an AI piece is an AI homage, never an original
 * work; a real artwork credits the artist and museum and says only the motion
 * is AI. Only `looping: true` pieces are called loops.
 */
export function pieceParagraphs(piece: CatalogPiece): string[] {
  const { name, movement, era, looping } = piece
  const style = movement || era
  const openers = piece.artwork
    ? artworkOpeners(piece, piece.artwork)
    : [
        `${name} is an AI-generated homage to ${style}, ${looping ? 'animated into a seamless loop' : 'brought to life with animation'}. It hangs in the ${era} wing of the Living Art collection.`,
        `An AI-made piece in the manner of ${style}. ${name} began as a generated still and was then animated, so the scene keeps moving while your Mac sits idle. It belongs to the collection's ${era} wing.`,
        `${name} borrows the palette and composition of ${style}. It is AI-generated art rather than a reproduction of any existing work, ${looping ? 'animated to loop without an obvious seam' : 'animated so the scene moves'}. Filed under ${era}.`,
        `Filed in the ${era} wing, ${name} is an AI homage to ${style} — a generated image, animated into a scene that plays whenever your screen is idle.`,
        `${name} takes its visual language from ${style}, one of the traditions in the collection's ${era} wing. It is AI-generated — not a photograph of an original artwork — and it has been ${looping ? 'animated into a seamless loop' : 'animated'} for an idle display.`,
      ]

  const added = formatMonth(piece.date)
  const closing = piece.free
    ? `${added ? `Added to the collection in ${added}. ` : ''}It's one of the ${FREE_ITEM_COUNT} pieces in the free tier, so it plays on your Mac as soon as you install the app — no account upgrade needed.`
    : `${added ? `Added to the collection in ${added}. ` : ''}It's part of the full collection, which opens up with a subscription or the one-time lifetime purchase. The free tier starts you off with ${FREE_ITEM_COUNT} other pieces.`

  return [openers[variantIndex(piece.slug, openers.length)], eraCopy(era).blurb, closing]
}

/** " (1848–1894)" or '' — the artist's life dates, ready to follow their name. */
function lifeDates(artwork: Artwork): string {
  return artwork.artistDates ? ` (${artwork.artistDates})` : ''
}

/** "in 1877" / "c. 1660" (already reads as a time) / '' when unknown. */
function when(artwork: Artwork): string {
  const d = artwork.originalDate
  if (!d) return ''
  return /^\d/.test(d) ? `in ${d}` : d
}

/** "the Art Institute of Chicago" — without doubling an institution's own "The". */
export function theMuseum(museum: string): string {
  return /^the\s/i.test(museum) ? museum.replace(/^The\s/, 'the ') : `the ${museum}`
}

/** "in the public domain", noting a CC0 release. */
function publicDomain(artwork: Artwork): string {
  return artwork.license === 'CC0' ? 'in the public domain (CC0)' : 'in the public domain'
}

/** Openers for a real artwork: credit the artist, date and museum; only the motion is AI. */
function artworkOpeners(piece: CatalogPiece, artwork: Artwork): string[] {
  const { name, era, looping } = piece
  const by = `${artwork.artist}${lifeDates(artwork)}`
  const made = when(artwork) ? `, made ${when(artwork)}` : ''
  const museum = theMuseum(artwork.museum)
  const loop = looping ? ', as a seamless loop' : ''
  return [
    `${name} is a real artwork by ${by}${made}. The original is in the collection of ${museum}, and its image is ${publicDomain(artwork)}. The motion was added with AI${loop}, so the scene moves while your Mac sits idle. It hangs in the ${era} wing of the Living Art collection.`,
    `${by} made ${name}${when(artwork) ? ` ${when(artwork)}` : ''}, and the original belongs to ${museum}. This clip starts from the museum's image of that real work, which is ${publicDomain(artwork)}; the motion was added with AI${loop}. Filed under ${era}.`,
    `Filed in the ${era} wing, ${name} is a genuine work by ${by}${made}, from the collection of ${museum}. Its image is ${publicDomain(artwork)}, and the motion was added with AI ${looping ? 'as a seamless loop ' : ''}for an idle display.`,
  ]
}

/**
 * The visible credit under a real artwork:
 * "Gustave Caillebotte (1848–1894), Paris Street; Rainy Day, 1877. Art Institute
 * of Chicago, Charles H. and Mary F. S. Worcester Collection. Public domain."
 */
export function artworkCredit(artwork: Artwork): string {
  const work = [artwork.originalTitle, artwork.originalDate].filter(Boolean).join(', ')
  const museum = [artwork.museum, artwork.creditLine].filter(Boolean).join(', ')
  return `${artwork.artist}${lifeDates(artwork)}, ${work}. ${museum}. ${artwork.license === 'CC0' ? 'CC0 (public domain)' : 'Public domain'}.`
}

/** ~150-character meta description / social summary for a piece. */
export function pieceSummary(piece: CatalogPiece): string {
  if (piece.artwork) {
    const { artist, originalDate, museum } = piece.artwork
    const motion = piece.looping ? 'animated with AI into a seamless loop for' : 'animated with AI for'
    return `${piece.name}${originalDate ? ` (${originalDate})` : ''} by ${artist}, from ${theMuseum(museum)} — the real public-domain work, ${motion} your Mac's idle screen.`
  }
  const style = piece.movement || piece.era
  const motion = piece.looping ? 'looping seamlessly on' : 'playing on'
  return `${piece.name} — an AI-animated homage to ${style}, ${motion} your Mac's idle screen. Part of the Living Art Screensaver collection. Free to download.`
}
