// Gallery and slug helpers shared by make-social-assets.mjs and post-social.mjs.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SITE_ORIGIN = 'https://living-art-screensaver.com'

// ── slugs ───────────────────────────────────────────────────────────────────

/** The folder name for a piece's clips under marketing/out/. Cosmetic. */
export function assetSlug(title) {
  return title
    .toLowerCase()
    .replace(/\(ai animated\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * The website's `/art/<slug>`: an exact copy of `slugForSrc` in
 * living-art-screensaver-web/lib/gallery-catalog.ts. Don't change it; posted
 * links can't be edited. A drift test keeps the two copies in sync.
 */
export function webSlugForSrc(src) {
  const file = src.split('/').pop() ?? src
  return file
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The piece's page, tagged with the channel for analytics. Only pins carry a link. */
export function landingUrl(webSlug, platform) {
  if (!webSlug) return SITE_ORIGIN
  const q = new URLSearchParams({ utm_source: platform, utm_medium: 'social', utm_campaign: 'daily' })
  return `${SITE_ORIGIN}/art/${webSlug}?${q}`
}

// ── gallery ─────────────────────────────────────────────────────────────────

export function loadGallery() {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, 'gallery.json'), 'utf8'))
}

/** Video entries only, in gallery order (newest are appended last). */
export function galleryVideos(gallery = loadGallery()) {
  return gallery.filter((e) => e.src && (e.type === 'video' || /\.mp4($|\?)/i.test(e.src)))
}

/** Provenance of a real artwork (`source: "real_artwork"`), or null for an AI piece. */
export function artworkOf(entry) {
  if (entry?.source !== 'real_artwork') return null
  return {
    artist: entry.artist ?? '',
    artistDates: entry.artist_dates ?? '',
    originalTitle: entry.original_title ?? '',
    originalDate: entry.original_date ?? '',
    museum: entry.museum ?? '',
    creditLine: entry.credit_line ?? '',
    sourceUrl: entry.source_url ?? '',
    license: entry.license ?? '',
  }
}

/**
 * Split `"<Name> - <Movement> (AI Animated)"` into a name and style, falling back
 * to the whole title and first tag. For a real artwork the "style" is the artist,
 * split on the known artist since a painting's title may contain " - ".
 */
export function deriveMeta(entry, styleOverride) {
  const artwork = artworkOf(entry)
  if (artwork) {
    const suffix = ` - ${artwork.artist} (AI Animated)`
    const raw = (entry.title || '').trim()
    const title = artwork.artist && raw.endsWith(suffix)
      ? raw.slice(0, -suffix.length).trim()
      : artwork.originalTitle || raw.replace(/\s*\(AI Animated\)\s*/i, '').trim() || 'Living Art'
    return { title, style: styleOverride || artwork.artist || (entry.tags && entry.tags[0]) || 'classic art' }
  }
  const raw = entry.title || 'Living Art'
  const noSuffix = raw.replace(/\s*\(AI Animated\)\s*/i, '').trim()
  let style = styleOverride
  let title = noSuffix
  const dash = noSuffix.lastIndexOf(' - ')
  if (dash !== -1) {
    title = noSuffix.slice(0, dash).trim()
    if (!style) style = noSuffix.slice(dash + 3).trim()
  }
  if (!style) style = (entry.tags && entry.tags[0]) || 'classic art'
  return { title, style }
}
