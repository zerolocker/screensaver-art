import type { MetadataRoute } from 'next'
import {
  ALL_ERAS,
  ALL_PIECES,
  GALLERY_PAGE_COUNT,
  INDEX_ART_PAGES,
  galleryPageHref,
} from '@/lib/gallery-catalog'
import { SITE_URL } from '@/lib/seo'

/**
 * Built from gallery.json, so it grows with each nightly deploy. `/art/*` pages
 * are listed only when `INDEX_ART_PAGES` is on.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL

  // The newest piece's date approximates when the browse pages last changed.
  const lastModified = ALL_PIECES[0]?.date ? new Date(ALL_PIECES[0].date) : undefined

  const galleryPages: MetadataRoute.Sitemap = Array.from({ length: GALLERY_PAGE_COUNT }, (_, i) => ({
    url: `${base}${galleryPageHref(i + 1)}`,
    lastModified,
    changeFrequency: 'daily' as const,
    priority: i === 0 ? 0.9 : 0.5,
  }))

  const eraPages: MetadataRoute.Sitemap = ALL_ERAS.map((era) => ({
    url: `${base}/era/${era.slug}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const artPages: MetadataRoute.Sitemap = INDEX_ART_PAGES
    ? ALL_PIECES.map((piece) => ({
        url: `${base}/art/${piece.slug}`,
        lastModified: piece.date ? new Date(piece.date) : undefined,
        changeFrequency: 'yearly' as const,
        priority: 0.4,
      }))
    : []

  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    ...galleryPages,
    ...eraPages,
    ...artPages,
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
