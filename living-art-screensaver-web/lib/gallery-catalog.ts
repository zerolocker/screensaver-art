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

import { FREE_ITEM_COUNT, isItemFree, tagsOf, orderTags, type ArtItem } from '@screensaver-art/constants'
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
interface RawItem extends ArtItem {
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

export interface CatalogPiece {
  /** URL slug — `/art/<slug>`. Permanent; see `slugForSrc`. */
  slug: string
  /** Display name, e.g. "Woman and Flora" (title minus the style + suffix). */
  name: string
  /** Art-movement label from the title, e.g. "Art Nouveau". 203 distinct values. */
  movement: string
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
 * Every gallery title is authored as `"<Name> - <Movement> (AI Animated)"` (all
 * 262 match today, and a test asserts the split keeps working). Splitting it
 * gives the display name and the movement label without a second data field.
 * Anything that doesn't match falls back to the whole title as the name and no
 * movement, so a stray format can never break a page.
 */
const TITLE_RE = /^(.+?)\s+-\s+(.+?)\s*\(AI Animated\)\s*$/

export function parseTitle(title: string): { name: string; movement: string } {
  const m = TITLE_RE.exec(title)
  if (!m) return { name: title.replace(/\s*\(AI Animated\)\s*$/, '').trim(), movement: '' }
  return { name: m[1].trim(), movement: m[2].trim() }
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

function toPiece(item: RawItem): CatalogPiece {
  const { name, movement } = parseTitle(item.title)
  const era = tagsOf(item)[0]
  return {
    slug: slugForSrc(item.src),
    name,
    movement,
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
 * Internal links out of a piece page: the rest of its era first (that's the
 * strongest relation and the surface we want crawled/clicked), topped up with
 * pieces that share the exact movement label. Deterministic, so the rendered
 * HTML is stable between builds.
 */
export function relatedPieces(piece: CatalogPiece, limit = 8): CatalogPiece[] {
  const sameMovement = piece.movement
    ? ALL_PIECES.filter((p) => p.slug !== piece.slug && p.movement === piece.movement)
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
 * Written from structured fields only — name, movement, era, date, free flag —
 * with five sentence shapes selected deterministically per slug, plus the
 * hand-written era paragraph. Deliberately NOT derived from the `image_prompt` /
 * `video_prompt` fields: those are machine instructions ("static camera", "no
 * morphing", "keeps its exact painted shape"), 61 pieces don't have them at all,
 * and dumping them would make 262 pages that read like a config file.
 *
 * Every sentence is true, and the first one always says the art is AI-generated
 * — these are homages in the style of a movement, never the original works, and
 * the pages must never imply otherwise. That goes for the motion too: only a
 * piece authored as a seamless loop (`looping: true`) is ever called a loop.
 * Most pieces are made to play through once, and the screensaver moves on to the
 * next piece rather than repeating one.
 *
 * This is honest and readable, but it is not art criticism. Richer per-piece
 * prose would need per-piece data, and that data does not go into
 * `gallery.json` (founder, 2026-09-13).
 */
export function pieceParagraphs(piece: CatalogPiece): string[] {
  const { name, movement, era, looping } = piece
  const style = movement || era
  const openers = [
    `${name} is an AI-generated homage to ${style}, ${looping ? 'animated into a seamless loop' : 'brought to life with animation'}. It hangs in the ${era} wing of the Living Art collection.`,
    `An AI-made piece in the manner of ${style}. ${name} began as a generated still and was then animated, so the scene keeps moving while your Mac sits idle. It belongs to the collection's ${era} wing.`,
    `${name} borrows the palette and composition of ${style}. It is AI-generated art rather than a reproduction of any existing work, ${looping ? 'animated to loop without an obvious seam' : 'animated so the scene moves'}. Filed under ${era}.`,
    `Filed in the ${era} wing, ${name} is an AI homage to ${style} — a generated image, animated into a scene that plays whenever your screen is idle.`,
    `${name} takes its visual language from ${style}, one of the traditions in the collection's ${era} wing. Like every piece here it is AI-generated — not a photograph of an original artwork — and it has been ${looping ? 'animated into a seamless loop' : 'animated'} for an idle display.`,
  ]

  const added = formatMonth(piece.date)
  const closing = piece.free
    ? `${added ? `Added to the collection in ${added}. ` : ''}It's one of the ${FREE_ITEM_COUNT} pieces in the free tier, so it plays on your Mac as soon as you install the app — no account upgrade needed.`
    : `${added ? `Added to the collection in ${added}. ` : ''}It's part of the full collection, which opens up with a subscription or the one-time lifetime purchase. The free tier starts you off with ${FREE_ITEM_COUNT} other pieces.`

  return [openers[variantIndex(piece.slug, openers.length)], eraCopy(era).blurb, closing]
}

/** ~150-character meta description / social summary for a piece. */
export function pieceSummary(piece: CatalogPiece): string {
  const style = piece.movement || piece.era
  const motion = piece.looping ? 'looping seamlessly on' : 'playing on'
  return `${piece.name} — an AI-animated homage to ${style}, ${motion} your Mac's idle screen. Part of the Living Art Screensaver collection. Free to download.`
}
