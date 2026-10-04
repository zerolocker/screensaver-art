import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PieceStage } from '@/components/gallery/piece-stage'
import { PieceGrid } from '@/components/gallery/piece-grid'
import {
  AiDisclosure,
  ArtworkCredit,
  Breadcrumbs,
  DownloadBand,
  GalleryPageShell,
} from '@/components/gallery/gallery-chrome'
import {
  ALL_PIECES,
  INDEX_ART_PAGES,
  eraBySlug,
  formatMonth,
  pieceBySlug,
  pieceParagraphs,
  pieceSummary,
  relatedPieces,
} from '@/lib/gallery-catalog'
import { SITE_OG_IMAGE, SITE_URL } from '@/lib/seo'
import { greenGlow } from '@/lib/brand'

/**
 * `/art/<slug>` — one page per piece. **This is the tier the whole feature is
 * for**: a Pinterest pin (or a YouTube description, or any social clip) points
 * here, the visitor lands on the exact art they clicked, sees it moving at full
 * width, and gets one obvious Mac download.
 *
 * The slug is permanent by construction — see `slugForSrc` in
 * lib/gallery-catalog.ts for why that is a hard requirement and how it's held.
 */

export const dynamicParams = false

export function generateStaticParams() {
  return ALL_PIECES.map((piece) => ({ slug: piece.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const piece = pieceBySlug(slug)
  if (!piece) return {}

  const url = `${SITE_URL}/art/${piece.slug}`
  // Absolute, because the poster may live on R2 rather than this origin.
  const image = piece.cardUrl
    ? piece.cardUrl.startsWith('http')
      ? piece.cardUrl
      : `${SITE_URL}${piece.cardUrl}`
    : null

  return {
    title: piece.subtitle ? `${piece.name} — ${piece.subtitle}, animated` : `${piece.name}, animated`,
    description: pieceSummary(piece),
    alternates: { canonical: url },
    // See INDEX_ART_PAGES in lib/gallery-catalog.ts. `follow` stays on either
    // way, so the links out to /gallery and /era/<tag> still count even while
    // these pages are held back from the index. This is a search-engine
    // directive only — it does not stop anyone linking to, sharing or pinning
    // the page, which is the traffic these pages were actually built for.
    robots: INDEX_ART_PAGES ? undefined : { index: false, follow: true },
    openGraph: {
      type: 'website',
      url,
      title: `${piece.name}${piece.subtitle ? ` — ${piece.subtitle}` : ''}`,
      description: pieceSummary(piece),
      // `images` MUST be set explicitly: overriding `openGraph` at all drops the
      // root opengraph-image Next would otherwise attach (see SITE_OG_IMAGE).
      // The 77 pieces with no still fall back to the site-wide branded card —
      // not ideal, a piece-specific card unfurls far better, but posters can't
      // be generated here (media is never committed to this repo, CLAUDE.md →
      // Repo rules) and a branded card beats no card at all.
      // Dimensions matter: the old raw 5504x3072 still exceeded X's 4096px cap
      // and was silently rejected. og_img is generated at exactly 1280x720.
      images: image
        ? [{ url: image, width: 1280, height: 720, alt: `${piece.name} — ${piece.subtitle || piece.era}` }]
        : [{ url: SITE_OG_IMAGE, width: 1200, height: 630 }],
      videos: [{ url: piece.src, type: 'video/mp4' }],
    },
  }
}

export default async function ArtPiecePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const piece = pieceBySlug(slug)
  if (!piece) notFound()

  const era = eraBySlug(piece.eraSlug)
  const paragraphs = pieceParagraphs(piece)
  const related = relatedPieces(piece)
  const added = formatMonth(piece.date)
  const artwork = piece.artwork

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: piece.name,
    description: pieceSummary(piece),
    contentUrl: piece.src,
    ...(piece.posterUrl ? { thumbnailUrl: [piece.posterUrl] } : {}),
    uploadDate: piece.date || undefined,
    isFamilyFriendly: true,
    genre: piece.movement || piece.era,
    // The clip is ours; for a real artwork, the art it animates is not — say
    // whose it is, where it lives, and that it's public domain.
    creator: { '@type': 'Organization', name: 'Living Art Screensaver' },
    ...(artwork
      ? {
          isBasedOn: {
            '@type': 'VisualArtwork',
            name: artwork.originalTitle,
            creator: { '@type': 'Person', name: artwork.artist },
            ...(artwork.originalDate ? { dateCreated: artwork.originalDate } : {}),
            url: artwork.sourceUrl,
            license: LICENSE_URLS[artwork.license] ?? artwork.license,
            creditText: [artwork.museum, artwork.creditLine].filter(Boolean).join(', '),
          },
        }
      : {}),
  }

  return (
    <GalleryPageShell>
      <script
        type="application/ld+json"
        // Escape "<" so no value can break out of the script block (Next.js
        // JSON-LD guide — JSON.stringify alone doesn't sanitize).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <article className="mx-auto max-w-[1040px] px-[22px] pb-[20px] pt-[42px] sm:px-[30px]">
        <Breadcrumbs
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Gallery', href: '/gallery' },
            ...(era ? [{ label: era.era, href: `/era/${era.slug}` }] : []),
            { label: piece.name },
          ]}
        />

        <PieceStage piece={piece} />

        <header className="mt-[30px] flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1
              className="m-0 font-serif font-bold leading-[1.08] tracking-[-0.015em] text-foreground"
              style={{ fontSize: 'clamp(28px,4.6vw,50px)' }}
            >
              {piece.name}
            </h1>
            <p className="m-0 mt-[8px] text-[17px] text-muted-foreground">
              {piece.subtitle && <span className="text-muted-foreground-strong">{piece.subtitle}</span>}
              {artwork?.originalDate && <span className="text-muted-foreground-strong">, {artwork.originalDate}</span>}
              {piece.subtitle && era && <span className="text-muted-foreground-subtle"> · </span>}
              {era && (
                <Link href={`/era/${era.slug}`} className="text-primary no-underline hover:underline">
                  {era.era}
                </Link>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-[8px]">
            {artwork && <Chip label="Real artwork" />}
            <Chip label="AI-animated" />
            {artwork && <Chip label={artwork.license === 'CC0' ? 'CC0' : 'Public domain'} />}
            {piece.looping && <Chip label="Seamless loop" />}
            {added && <Chip label={`Added ${added}`} />}
            {/* Only free pieces get a badge. Locked pieces get no badge rather
                than a "subscriber only" scold — but nothing anywhere implies
                they're free either; the prose below says which is which. */}
            {piece.free && <Chip label="In the free tier" accent />}
          </div>
        </header>

        <div className="mt-[26px] grid gap-[34px] lg:grid-cols-[1.35fr_1fr]">
          <div>
            {paragraphs.map((text, i) => (
              <p key={i} className="m-0 mb-[16px] text-[16.5px] leading-[1.65] text-muted-foreground-strong">
                {text}
              </p>
            ))}
            {artwork && <ArtworkCredit artwork={artwork} className="mt-[22px]" />}
            <AiDisclosure piece={piece} className="mt-[22px] border-t border-white/[0.07] pt-[18px]" />
          </div>

          {era && (
            <aside className="rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-[22px]">
              <div className="mb-[10px] font-mono text-[11px] uppercase tracking-[2px] text-primary">
                More from this wing
              </div>
              <div className="font-serif text-[24px] font-semibold leading-[1.15] text-foreground">{era.headline}</div>
              <p className="m-0 mt-[10px] text-[14.5px] leading-[1.6] text-muted-foreground">{era.tagline}</p>
              <Link
                href={`/era/${era.slug}`}
                className="mt-[16px] inline-flex items-center gap-2 rounded-full border border-white/12 px-[16px] py-[9px] text-[14px] font-medium text-foreground no-underline transition-colors hover:border-primary/60"
              >
                Browse all {era.count} {era.era} pieces →
              </Link>
            </aside>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section className="mx-auto max-w-[1340px] px-[22px] pb-[10px] pt-[46px] sm:px-[30px]">
          <h2 className="m-0 mb-[16px] font-serif text-[24px] font-semibold text-foreground">More like this</h2>
          <PieceGrid pieces={related} eagerCount={0} />
        </section>
      )}

      <DownloadBand
        campaign="art_piece"
        content={piece.slug}
        headline={`Put ${piece.name} on your Mac.`}
        sub={`It plays whenever your Mac goes idle — along with the rest of the ${ALL_PIECES.length}-piece collection, and a new artwork every night.`}
      />
    </GalleryPageShell>
  )
}

/** schema.org wants a licence URL. */
const LICENSE_URLS: Record<string, string> = {
  'Public Domain': 'https://creativecommons.org/publicdomain/mark/1.0/',
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
}

function Chip({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-[13px] py-[6px] text-[12.5px]"
      style={
        accent
          ? { background: greenGlow(0.12), border: `1px solid ${greenGlow(0.4)}`, color: 'var(--primary)' }
          : {
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'var(--muted-foreground)',
            }
      }
    >
      {label}
    </span>
  )
}
