import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Auth-gated, transactional, or app-facing routes — crawlable noise.
      disallow: ['/account', '/auth/', '/api/', '/checkout/', '/updates/'],
    },
    sitemap: 'https://living-art-screensaver.com/sitemap.xml',
  }
}
