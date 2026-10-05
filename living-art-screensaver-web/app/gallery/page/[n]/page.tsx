import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GalleryIndex } from '@/components/gallery/gallery-index'
import { ALL_PIECES, GALLERY_PAGE_COUNT } from '@/lib/gallery-catalog'
import { SITE_URL } from '@/lib/seo'

/**
 * `/gallery/page/2…N`. Page 1 is `/gallery`. Pages outside the range 404
 * (`dynamicParams = false`).
 */
export const dynamicParams = false

export function generateStaticParams() {
  return Array.from({ length: GALLERY_PAGE_COUNT - 1 }, (_, i) => ({ n: String(i + 2) }))
}

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const { n } = await params
  return {
    title: `Gallery — page ${n} of ${GALLERY_PAGE_COUNT}`,
    description: `Page ${n} of the Living Art Screensaver collection — ${ALL_PIECES.length} AI-animated artworks for your Mac's idle screen.`,
    alternates: { canonical: `${SITE_URL}/gallery/page/${n}` },
  }
}

export default async function GalleryPaginatedPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params
  const page = Number(n)
  if (!Number.isInteger(page) || page < 2 || page > GALLERY_PAGE_COUNT) notFound()
  return <GalleryIndex page={page} />
}
