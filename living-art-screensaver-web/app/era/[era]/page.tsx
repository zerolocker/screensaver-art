import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PieceGrid } from '@/components/gallery/piece-grid'
import {
  AiDisclosure,
  Breadcrumbs,
  DownloadBand,
  EraPills,
  GalleryPageShell,
} from '@/components/gallery/gallery-chrome'
import { ALL_ERAS, ALL_PIECES, eraBySlug } from '@/lib/gallery-catalog'
import { SITE_OG_IMAGE, SITE_URL } from '@/lib/seo'

/**
 * `/era/<tag>` — the 15 museum "wings" from the closed tag vocabulary in
 * `@screensaver-art/constants`.
 *
 * These are the indexable tier: 15 pages, each with hand-written copy
 * (lib/era-copy.ts) and ~17 pieces, i.e. a real browse surface rather than
 * generated filler. They're also the main internal-linking layer — every piece
 * page points at its wing, and every wing points at every other.
 *
 * Note `/style/<movement>` is deliberately NOT built: the catalog carries 203
 * distinct movement labels, 158 of them attached to a single piece, so a page
 * per raw label would be thin by construction. It needs curated grouping first
 * (docs/growth-and-marketing-strategy.md §4.3).
 */

// Rendered on first visit and cached, like `/art/<slug>` (see there).
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ era: string }> }): Promise<Metadata> {
  const { era: slug } = await params
  const era = eraBySlug(slug)
  if (!era) return {}
  const url = `${SITE_URL}/era/${era.slug}`
  return {
    title: `${era.era} art, animated — ${era.count} pieces`,
    description: `${era.count} AI-animated artworks in the ${era.era} tradition — ${era.tagline.toLowerCase()}. Watch them play, then put the collection on your Mac's idle screen.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${era.era} — ${era.headline}`,
      description: era.blurb,
      url,
      // Explicit — overriding `openGraph` drops the inherited site card (see
      // SITE_OG_IMAGE). Prefer a real piece from the wing; fall back to the
      // branded card when the wing's cover has no still on R2.
      images: era.cover.posterUrl?.startsWith('http')
        ? [{ url: era.cover.posterUrl, alt: `${era.cover.name} — ${era.cover.movement}` }]
        : [{ url: SITE_OG_IMAGE, width: 1200, height: 630 }],
    },
  }
}

export default async function EraPage({ params }: { params: Promise<{ era: string }> }) {
  const { era: slug } = await params
  const era = eraBySlug(slug)
  if (!era) notFound()

  const others = ALL_ERAS.filter((e) => e.slug !== era.slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${era.era} — ${era.headline}`,
    description: era.blurb,
    url: `${SITE_URL}/era/${era.slug}`,
    isPartOf: { '@type': 'WebSite', name: 'Living Art Screensaver', url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: era.count,
      itemListElement: era.pieces.slice(0, 30).map((piece, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/art/${piece.slug}`,
        name: piece.name,
      })),
    },
  }

  return (
    <GalleryPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <section className="mx-auto max-w-[1340px] px-[22px] pb-[34px] pt-[46px] sm:px-[30px]">
        <Breadcrumbs
          trail={[{ label: 'Home', href: '/' }, { label: 'Gallery', href: '/gallery' }, { label: era.era }]}
        />

        <div className="mb-[14px] font-mono text-[12px] font-medium uppercase tracking-[3px] text-primary">
          {era.era} · {era.count} pieces
        </div>
        <h1
          className="m-0 mb-[16px] max-w-[860px] font-serif font-bold leading-[1.06] tracking-[-0.015em] text-foreground"
          style={{ fontSize: 'clamp(32px,5vw,58px)' }}
        >
          {era.headline}
        </h1>
        <p className="m-0 mb-[20px] max-w-[680px] text-[17px] leading-[1.6] text-muted-foreground">{era.blurb}</p>
        <AiDisclosure className="mb-[26px] max-w-[680px]" />
        <EraPills activeSlug={era.slug} />
      </section>

      <section className="mx-auto max-w-[1340px] px-[22px] sm:px-[30px]">
        <PieceGrid pieces={era.pieces} eagerCount={5} />
      </section>

      <section className="mx-auto max-w-[1340px] px-[22px] pt-[52px] sm:px-[30px]">
        <h2 className="m-0 mb-[14px] font-serif text-[24px] font-semibold text-foreground">Other wings</h2>
        <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-3">
          {others.map((other) => (
            <Link
              key={other.slug}
              href={`/era/${other.slug}`}
              className="rounded-[14px] border border-white/[0.07] bg-white/[0.02] p-[16px] no-underline transition-colors hover:border-primary/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-serif text-[19px] font-semibold text-foreground">{other.era}</span>
                <span className="font-mono text-[11px] text-muted-foreground-subtle">{other.count}</span>
              </div>
              <span className="mt-[4px] block text-[14px] leading-[1.5] text-muted-foreground">{other.tagline}</span>
            </Link>
          ))}
        </div>
      </section>

      <DownloadBand
        campaign="era_page"
        content={era.slug}
        headline={`${era.era} art, on your idle Mac.`}
        sub={`All ${era.count} pieces from this wing — plus the other ${ALL_PIECES.length - era.count} in the collection — play whenever your Mac rests.`}
      />
    </GalleryPageShell>
  )
}
