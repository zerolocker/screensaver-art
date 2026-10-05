import type { Metadata } from 'next'
import { GalleryIndex } from '@/components/gallery/gallery-index'
import { ALL_ERAS, ALL_PIECES } from '@/lib/gallery-catalog'
import { SITE_OG_IMAGE, SITE_URL } from '@/lib/seo'

/** `/gallery`: the index of the whole collection. Indexable, unlike `/art/*`. */
export const metadata: Metadata = {
  title: `Gallery — all ${ALL_PIECES.length} animated artworks`,
  description: `Browse all ${ALL_PIECES.length} AI-animated artworks in the Living Art Screensaver, across ${ALL_ERAS.length} wings of art history — from cave painting to cyberpunk. Free Mac download.`,
  alternates: { canonical: `${SITE_URL}/gallery` },
  openGraph: {
    title: `Every artwork in Living Art Screensaver`,
    description: `${ALL_PIECES.length} AI-animated pieces across ${ALL_ERAS.length} wings of art history, playing on your Mac's idle screen.`,
    url: `${SITE_URL}/gallery`,
    // Overriding `openGraph` drops the site card (see SITE_OG_IMAGE).
    images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630 }],
  },
}

export default function GalleryPage() {
  return <GalleryIndex page={1} />
}
