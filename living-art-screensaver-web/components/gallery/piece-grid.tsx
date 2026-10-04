import { PieceTile } from '@/components/gallery/piece-tile'
import type { CatalogPiece } from '@/lib/gallery-catalog'

/**
 * The tile grid for the gallery pages: two columns on a phone, up to five on a
 * desktop. The first `eagerCount` tiles load eagerly.
 */
export function PieceGrid({ pieces, eagerCount = 4 }: { pieces: CatalogPiece[]; eagerCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 sm:gap-[14px] lg:grid-cols-4 xl:grid-cols-5">
      {pieces.map((piece, i) => (
        <PieceTile key={piece.slug} piece={piece} priority={i < eagerCount} />
      ))}
    </div>
  )
}
