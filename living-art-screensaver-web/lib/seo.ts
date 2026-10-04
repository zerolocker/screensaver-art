/** The site's meta description, also used in the homepage JSON-LD. */
export const SITE_DESCRIPTION =
  'A Mac screensaver that turns your idle display into a living art gallery, showcasing AI-animated artworks across every style, with new pieces added regularly. Free Download.'

/** Canonical origin. */
export const SITE_URL = 'https://living-art-screensaver.com'

/**
 * The site's social card. Next merges metadata shallowly, so a page that sets
 * `openGraph` loses the default image and must pass `images` itself; this is
 * the fallback.
 */
export const SITE_OG_IMAGE = `${SITE_URL}/opengraph-image`

/**
 * A download link tagged with the page that sent it. /download/mac runs no
 * analytics script, so these UTM params can't overwrite the visitor's original
 * campaign.
 */
export function downloadHref(source: string, content?: string): string {
  const params = new URLSearchParams({ utm_source: 'site', utm_medium: 'internal', utm_campaign: source })
  if (content) params.set('utm_content', content)
  return `/download/mac?${params.toString()}`
}
