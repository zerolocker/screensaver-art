import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { DownloadCTA } from '@/components/marketing/download-cta'
import { greenGlow } from '@/lib/brand'
import { downloadHref } from '@/lib/seo'
import { FREE_ITEM_COUNT } from '@screensaver-art/constants'
import {
  ALL_ERAS,
  ALL_PIECES,
  artworkCredit,
  fromCommons,
  theMuseum,
  type Artwork,
  type CatalogPiece,
} from '@/lib/gallery-catalog'

/**
 * Shared layout for the gallery pages: header, breadcrumb, content, download
 * band, footer. They exist to turn social traffic into Mac downloads.
 */

export function GalleryPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative w-full overflow-hidden bg-background text-foreground">
      <Header homeHref="/" />
      <div className="pt-[68px]">{children}</div>
      <Footer />
    </main>
  )
}

export interface Crumb {
  label: string
  href?: string
}

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-[18px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      {trail.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="flex items-center gap-2">
          {i > 0 && <span className="text-muted-foreground-subtle">/</span>}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-muted-foreground-subtle">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

/**
 * The era pills. They wrap on desktop but scroll sideways on a phone, where
 * wrapping would push the art below several screens of pills.
 */
export function EraPills({ activeSlug }: { activeSlug?: string }) {
  return (
    <div className="lart-no-scrollbar lart-edge-fade -mx-[22px] flex gap-[8px] overflow-x-auto px-[22px] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {ALL_ERAS.map((era) => {
        const active = era.slug === activeSlug
        return (
          <Link
            key={era.slug}
            href={`/era/${era.slug}`}
            className="inline-flex flex-none items-center gap-[7px] whitespace-nowrap rounded-full px-[14px] py-[7px] text-[13.5px] no-underline transition-colors"
            style={
              active
                ? { background: greenGlow(0.1), border: `1px solid ${greenGlow(0.45)}`, color: 'var(--primary)' }
                : {
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--muted-foreground)',
                  }
            }
          >
            {era.era}
            <span className="font-mono text-[11px] text-muted-foreground-subtle">{era.count}</span>
          </Link>
        )
      })}
    </div>
  )
}

/** The download block that ends every gallery page. `campaign`/`content` tag the link. */
export function DownloadBand({
  campaign,
  content,
  headline = 'Want this on your own screen?',
  sub,
}: {
  campaign: string
  content?: string
  headline?: string
  sub?: string
}) {
  return (
    <section className="px-[22px] pb-[96px] pt-[70px] text-center sm:px-[30px]">
      <div className="mx-auto max-w-[680px]">
        <h2
          className="m-0 mb-[14px] font-serif font-extrabold leading-[1.06] tracking-[-0.015em] text-foreground"
          style={{ fontSize: 'clamp(28px,4.4vw,48px)' }}
        >
          {headline}
        </h2>
        <p className="m-0 mb-[26px] text-[17px] leading-[1.55] text-muted-foreground-strong">
          {sub ??
            `Living Art hangs all ${ALL_PIECES.length} pieces on your Mac's idle display, across ${ALL_ERAS.length} wings of art history — with a new one added every night.`}
        </p>
        <DownloadCTA
          location={campaign}
          href={downloadHref(campaign, content)}
          iconClassName="h-[17px] w-[17px]"
          className="inline-flex cursor-pointer items-center gap-[9px] rounded-full bg-primary px-[30px] py-[16px] text-[17px] font-semibold text-primary-foreground no-underline"
          style={{ boxShadow: `0 14px 40px -10px ${greenGlow(0.6)}` }}
        />
        <div className="mt-[12px] text-[13px]">
          <span className="font-semibold text-primary">Free forever</span>{' '}
          <span className="text-muted-foreground-subtle">
            — {FREE_ITEM_COUNT} pieces included, no account needed to start. macOS. In-app purchase available.
          </span>
        </div>
      </div>
    </section>
  )
}

/**
 * What the visitor is looking at, said plainly: an AI piece is an homage, not a
 * reproduction; a real artwork is the artist's own work with AI motion. Pass
 * `piece` on a piece page, or `pieces` (default: everything) on a browse page.
 */
export function AiDisclosure({
  className = '',
  piece,
  pieces = ALL_PIECES,
}: {
  className?: string
  piece?: CatalogPiece
  pieces?: CatalogPiece[]
}) {
  const cls = `m-0 text-[13px] leading-[1.6] text-muted-foreground-subtle ${className}`
  if (piece?.artwork) {
    return (
      <p className={cls}>
        This is a <strong className="font-semibold">real artwork</strong> by {piece.artwork.artist}, not an AI
        imitation. The clip starts from{' '}
        {fromCommons(piece.artwork)
          ? 'a public-domain image of the original from Wikimedia Commons'
          : "the museum's public-domain image of the original"}
        ; the motion was added with AI and is not part of the artist&apos;s work.
      </p>
    )
  }
  if (piece) {
    return (
      <p className={cls}>
        This piece is <strong className="font-semibold">generated by AI</strong> in the style of a historical
        movement, then animated. It is an original homage — not a scan, photograph or reproduction of an existing
        artwork.
      </p>
    )
  }
  if (pieces.some((p) => p.artwork)) {
    return (
      <p className={cls}>
        Pieces labelled with a movement are <strong className="font-semibold">generated by AI</strong> in that
        style, then animated — original homages, not reproductions of existing artworks. Pieces credited to a named
        artist are <strong className="font-semibold">real public-domain artworks</strong> from museum open-access
        collections{pieces.some((p) => p.artwork && fromCommons(p.artwork)) ? ' and Wikimedia Commons' : ''}, with
        only the motion added by AI.
      </p>
    )
  }
  return (
    <p className={cls}>
      Every piece in this collection is <strong className="font-semibold">generated by AI</strong> in the style of a
      historical movement, then animated. They are original homages — not scans, photographs or reproductions of
      existing artworks.
    </p>
  )
}

/** The credit under a real artwork, linking to the museum's page or the Commons file. Shown even for CC0. */
export function ArtworkCredit({ artwork, className = '' }: { artwork: Artwork; className?: string }) {
  return (
    <p className={`m-0 text-[13.5px] leading-[1.6] text-muted-foreground ${className}`}>
      <span className="font-mono text-[11px] uppercase tracking-[2px] text-primary">Credit</span>
      <br />
      {artworkCredit(artwork)}{' '}
      <a
        href={artwork.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary no-underline hover:underline"
      >
        {fromCommons(artwork) ? 'View the image on Wikimedia Commons' : `View the original at ${theMuseum(artwork.museum)}`} ↗
      </a>
    </p>
  )
}
