/**
 * The gallery landing-page catalog — one derived, sorted view of `gallery.json`
 * that `/gallery`, `/art/<slug>` and `/era/<tag>` all read from.
 *
 * WHY THESE PAGES EXIST (it frames every decision in this file): they are
 * **landing destinations for social posts, primarily Pinterest** — not an SEO
 * play. A pin needs a unique, relevant page that shows the art moving and offers
 * a Mac download. Search traffic is a free option on top, not the goal. See
 * docs/growth-and-marketing-strategy.md §4.3.
 *
 * `gallery.json` is imported statically, so the pages are generated at build
 * time and served as static HTML — the fastest thing we can hand a visitor
 * arriving from a pin. The nightly curation job pushes `gallery.json` to
 * `master`, and a push to `master` auto-deploys the site (CLAUDE.md → Website),
 * so the route list and the sitemap grow themselves without any extra step.
 * (The Electron app still reads /api/gallery off the GitHub API — that path is
 * deliberately deploy-independent and is not touched here.)
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
 * INDEXING SWITCH — flip this one line to let search engines index the 262
 * per-piece pages.
 *
 * Default `false`, deliberately. ~262 pages whose art *and* prose are generated
 * is close to what Google's scaled-content-abuse systems demote, and a penalty
 * lands on the whole domain — including the brand-name search that actually
 * converts today. Pinterest does not care whether a destination is indexed, so
 * `noindex` costs the channel these pages were built for exactly nothing.
 *
 * `/gallery` and the 15 `/era/<tag>` pages stay indexable: they are a small,
 * curated, hand-written browse surface, not scaled content.
 *
 * Flip to `true` once there is a reason to (e.g. hand-written per-piece prose,
 * or evidence the risk has passed). Everything downstream — the `robots` meta
 * tag on `/art/*` and whether those URLs appear in the sitemap — reads this.
 */
export const INDEX_ART_PAGES = false

/** Raw `gallery.json` entry — a superset of the client-facing `ArtItem`. */
export interface RawItem extends ArtItem {
  /**
   * Website-only image derivatives on R2 — deliberately NOT part of the shared
   * `ArtItem`, because the Electron app and screensaver never read them.
   * All three are present for every piece (backfilled 2026-08-05; the nightly
   * curation run emits them for new pieces).
   *   img     2K WebP        the high-res still. Kept as data for future needs
   *                          (4K clips, print); the site itself never needs more
   *                          than 720p because that is the clips' resolution
   *   og_img  1280x720 JPEG  social cards — JPEG because crawler WebP support
   *                          is inconsistent and satori can't rasterize WebP
   *   thumb   640w WebP      the /gallery grid
   */
  img?: string
  og_img?: string
  thumb?: string
  image_prompt?: string
  video_prompt?: string
  looping?: boolean
}

/**
 * Provenance of a real, public-domain artwork (`source: "real_artwork"` in
 * gallery.json) — who made it, when, and where the original is. Required keys
 * are guaranteed by curation/publish-piece.mjs; optional ones are '' if absent.
 */
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
  /**
   * Art-movement label from the title, e.g. "Art Nouveau". 203 distinct values.
   * '' on a real artwork, whose title names the artist in that slot instead.
   */
  movement: string
  /**
   * The line shown under the name — the movement for an AI piece, the artist
   * for a real artwork. What tiles, the placard and headers display.
   */
  subtitle: string
  /** Set only on a real public-domain artwork; null on AI-generated pieces (the default). */
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
  /** Era tag (the closed 15-value vocabulary in @screensaver-art/constants). */
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
 * The piece slug — derived from the R2 object key, never from the title.
 *
 * STABILITY IS A HARD REQUIREMENT, not a nicety. Every pin, YouTube description
 * and social post points at `/art/<slug>` forever, and **a pin's destination URL
 * cannot be edited after it is posted**. A slug that changed would silently 404
 * every pin ever published — the single worst failure mode this feature has.
 *
 * So:
 *  - It is derived from `src`, the R2 object key. Gallery keys are never
 *    overwritten or renamed (CLAUDE.md → "Add new art pieces"), which makes the
 *    key the piece's permanent identity. Titles, by contrast, *are* edited by
 *    curation, so a title-derived slug would drift.
 *  - It is a pure function of one item and looks at nothing else in the catalog.
 *    That rules out collision suffixes ("-2") and positional ids, either of
 *    which could renumber an existing piece when a *different* piece is added or
 *    removed. Uniqueness is instead asserted by a test over the real data
 *    (lib/__tests__/gallery-catalog.test.ts), which fails the build's test step
 *    if curation ever introduces two keys that slugify the same.
 *  - Cosmetic cleanups (dropping the "-animated" suffix, prettifying) are
 *    deliberately NOT applied: they would change every existing URL the day they
 *    landed, and stripping suffixes can also merge two distinct keys.
 */
export function slugForSrc(src: string): string {
  const file = src.split('/').pop() ?? src
  return slugify(file.replace(/\.[a-z0-9]+$/i, ''))
}

/** `/era/<eraSlug>` — same reasoning: derived from the closed tag vocabulary. */
export function slugForEra(era: string): string {
  return slugify(era)
}

// ---------------------------------------------------------------------------
// Title parsing
// ---------------------------------------------------------------------------

/**
 * Every AI gallery title is authored as `"<Name> - <Movement> (AI Animated)"`
 * (all 262 match today, and a test asserts the split keeps working). Splitting
 * it gives the display name and the movement label without a second data field.
 * Anything that doesn't match falls back to the whole title as the name and no
 * movement, so a stray format can never break a page.
 */
const TITLE_RE = /^(.+?)\s+-\s+(.+?)\s*\(AI Animated\)\s*$/

export function parseTitle(title: string): { name: string; movement: string } {
  const m = TITLE_RE.exec(title)
  if (!m) return { name: title.replace(/\s*\(AI Animated\)\s*$/, '').trim(), movement: '' }
  return { name: m[1].trim(), movement: m[2].trim() }
}

/**
 * A real artwork's title puts the artist where an AI piece puts the movement:
 * `"Paris Street; Rainy Day - Gustave Caillebotte (AI Animated)"`. Split on the
 * *known* artist rather than the first " - " (a painting's own title can contain
 * one), and fall back to `original_title` if the title was hand-edited off-format.
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

/**
 * The stills to paint before (and behind) the clip.
 *
 * Every piece now carries all three derivatives on R2, so this is a plain read
 * rather than the old three-tier fallback (own `img` -> a committed
 * public/posters/ file -> gradient). The committed posters are gone: media is
 * never committed to this repo (CLAUDE.md -> Repo rules), and R2 is where these
 * belong. The gradient remains as the paint-before-load background and as the
 * safety net if a field is ever missing.
 */
function postersFor(item: RawItem) {
  return {
    // The hero poster is og_img (1280x720), NOT img, deliberately: the clips are
    // 720p, so a larger still is wasted bytes *and* shows a visible resolution
    // drop the moment the video takes over. It also matters that `img` is the
    // original 5504x3072 WebP (~3.2 MB) on the 140 pieces that had one before
    // the backfill — that was the page's LCP element on mobile.
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
 * Internal links out of a piece page: pieces that share the exact movement label
 * (or, for a real artwork, the same artist) first, topped up with the rest of
 * its era — the surface we want crawled/clicked. Deterministic, so the rendered
 * HTML is stable between builds.
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

/**
 * Page size for the gallery index. Each tile lazy-loads a clip only once it
 * approaches the viewport (`preload="none"` + a shared IntersectionObserver),
 * so the cost of a page is "the tiles you actually scroll past", not 48 clips.
 * Pagination keeps the DOM and the RSC payload small on the phones that most
 * pin traffic arrives on.
 */
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
 * The per-piece prose.
 *
 * Written from structured fields only — name, movement, era, date, free flag,
 * and for a real artwork its provenance — with a few sentence shapes selected
 * deterministically per slug, plus the hand-written era paragraph. Deliberately
 * NOT derived from the `image_prompt` / `video_prompt` fields: those are machine
 * instructions ("static camera", "no morphing", "keeps its exact painted
 * shape"), 61 pieces don't have them at all, and dumping them would make 262
 * pages that read like a config file.
 *
 * Every sentence is true, and the first one always says what the art is:
 *  - An AI piece (the default: no `source`) is AI-generated homage in the style
 *    of a movement, never an original work, and the page must never imply
 *    otherwise.
 *  - A real artwork (`source: "real_artwork"`) is the opposite case, where
 *    "AI-generated, not a reproduction" would be false. Its opener credits the
 *    artist (with their dates), the work's date and the museum, says the image
 *    is public domain, and says the motion was added with AI.
 * That goes for the motion too: only a piece authored as a seamless loop
 * (`looping: true`) is ever called a loop. Most pieces are made to play through
 * once, and the screensaver moves on to the next piece rather than repeating one.
 *
 * This is honest and readable, but it is not art criticism. Richer per-piece
 * prose would need per-piece data. The only per-piece data `gallery.json` takes
 * is a real artwork's provenance (founder: no other new fields, 2026-09-13;
 * provenance allowed, 2026-10).
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
        // Not "like every piece here": the collection also holds real artworks.
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

/**
 * Openers for a real artwork. Each credits the artist (and their dates), the
 * work's date and the museum, says the image is public domain, and says the
 * motion is AI — never that the art itself is generated.
 */
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
