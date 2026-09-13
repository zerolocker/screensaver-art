// Shared piece/slug helpers for the marketing scripts.
//
// Two scripts need the same three things — which gallery pieces to work on, what
// to call the rendered clips, and which landing page a post should point at — so
// they live here rather than being copy-pasted:
//   make-social-assets.mjs  renders the clips + writes each piece's meta.json
//   post-social.mjs         reads that meta.json and publishes it
//
// No npm deps (Node built-ins only), same as its callers.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SITE_ORIGIN = 'https://living-art-screensaver.com'

// ── slugs ───────────────────────────────────────────────────────────────────

/**
 * The output-directory name for a piece's rendered clips. Cosmetic — it only
 * ever names a folder under marketing/out/, so it is free to be pretty.
 */
export function assetSlug(title) {
  return title
    .toLowerCase()
    .replace(/\(ai animated\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * The website's `/art/<slug>` slug — a VERBATIM mirror of `slugForSrc` in
 * living-art-screensaver-web/lib/gallery-catalog.ts.
 *
 * Do not "improve" this. A post's destination URL cannot be edited after it is
 * published, so a slug that drifts from the website's would 404 every post ever
 * made — the exact failure the website's rule was designed to prevent. The two
 * copies are pinned together by a drift test over the real gallery
 * (living-art-screensaver-web/lib/__tests__/social-slug-drift.test.ts).
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

/**
 * Where a pin sends people: the piece's own landing page, tagged with the channel
 * so PostHog can attribute the traffic. Only pins carry a link: Instagram, TikTok
 * and YouTube don't make caption links clickable, so those posts say "Link in bio"
 * and the profile's own bio link does the job.
 */
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

/**
 * Best-effort split of the authored title format
 * `"<Name> - <Movement> (AI Animated)"` into a display name and a style label.
 * Falls back to the whole title + the first tag, so a stray format can't break a
 * render (same contract as the website's parseTitle).
 */
export function deriveMeta(entry, styleOverride) {
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
