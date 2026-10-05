import Link from 'next/link'
import { PieceGrid } from '@/components/gallery/piece-grid'
import {
  AiDisclosure,
  Breadcrumbs,
  DownloadBand,
  EraPills,
  GalleryPageShell,
} from '@/components/gallery/gallery-chrome'
import {
  ALL_ERAS,
  ALL_PIECES,
  GALLERY_PAGE_COUNT,
  GALLERY_PAGE_SIZE,
  galleryPage,
  galleryPageHref,
} from '@/lib/gallery-catalog'

/** Shared by `/gallery` and `/gallery/page/N`; page 1 also gets the intro. */
export function GalleryIndex({ page }: { page: number }) {
  const pieces = galleryPage(page)
  const isFirst = page === 1

  return (
    <GalleryPageShell>
      <section className="mx-auto max-w-[1340px] px-[22px] pb-[40px] pt-[46px] sm:px-[30px]">
        <Breadcrumbs
          trail={[
            { label: 'Home', href: '/' },
            ...(isFirst ? [{ label: 'Gallery' }] : [{ label: 'Gallery', href: '/gallery' }, { label: `Page ${page}` }]),
          ]}
        />

        <div className="mb-[14px] font-mono text-[12px] font-medium uppercase tracking-[3px] text-primary">
          The full collection
        </div>
        <h1
          className="m-0 mb-[16px] max-w-[860px] font-serif font-bold leading-[1.06] tracking-[-0.015em] text-foreground"
          style={{ fontSize: 'clamp(32px,5vw,60px)' }}
        >
          {ALL_PIECES.length} animated artworks,
          <br className="hidden sm:block" /> {ALL_ERAS.length} wings of art history.
        </h1>
        <p className="m-0 mb-[18px] max-w-[640px] text-[17px] leading-[1.55] text-muted-foreground">
          Open any piece to watch it play full width — then put the whole collection on your Mac&apos;s idle screen.
        </p>
        <AiDisclosure className="mb-[24px] max-w-[640px]" />

        <EraPills />
      </section>

      <section className="mx-auto max-w-[1340px] px-[22px] pb-[16px] sm:px-[30px]">
        <div className="mb-[16px] flex items-baseline justify-between gap-4">
          <h2 className="m-0 font-serif text-[22px] font-semibold text-foreground">
            {isFirst ? 'Newest first' : `Page ${page}`}
          </h2>
          <span className="font-mono text-[12px] text-muted-foreground-subtle">
            {(page - 1) * GALLERY_PAGE_SIZE + 1}–{(page - 1) * GALLERY_PAGE_SIZE + pieces.length} of{' '}
            {ALL_PIECES.length}
          </span>
        </div>
        <PieceGrid pieces={pieces} eagerCount={isFirst ? 5 : 0} />
        <Pagination page={page} />
      </section>

      <DownloadBand campaign="gallery_index" content={`page-${page}`} />
    </GalleryPageShell>
  )
}

function Pagination({ page }: { page: number }) {
  if (GALLERY_PAGE_COUNT <= 1) return null
  const pages = Array.from({ length: GALLERY_PAGE_COUNT }, (_, i) => i + 1)
  return (
    <nav aria-label="Gallery pages" className="mt-[30px] flex flex-wrap items-center justify-center gap-[8px]">
      {page > 1 && (
        <Link href={galleryPageHref(page - 1)} rel="prev" className={navLinkClass}>
          ← Previous
        </Link>
      )}
      {pages.map((n) => (
        <Link
          key={n}
          href={galleryPageHref(n)}
          aria-current={n === page ? 'page' : undefined}
          className={
            n === page
              ? 'inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-full bg-primary px-[13px] text-[14px] font-semibold text-primary-foreground no-underline'
              : navLinkClass
          }
        >
          {n}
        </Link>
      ))}
      {page < GALLERY_PAGE_COUNT && (
        <Link href={galleryPageHref(page + 1)} rel="next" className={navLinkClass}>
          Next →
        </Link>
      )}
    </nav>
  )
}

const navLinkClass =
  'inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-[13px] text-[14px] text-muted-foreground no-underline transition-colors hover:border-white/20 hover:text-foreground'
