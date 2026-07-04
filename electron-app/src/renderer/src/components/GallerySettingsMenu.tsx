import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, Check } from 'lucide-react'

export type SortOrder = 'oldest' | 'newest'
// How a clicked piece previews: 'fullscreen' fills the whole display (native
// macOS fullscreen, with its brief Space animation); 'in-app' fills just the
// app window instantly. Default is 'fullscreen' — the more impressive preview.
export type PreviewMode = 'fullscreen' | 'in-app'

// Gear menu for gallery view options: sort order + how a clicked piece previews.
// Closes on outside click or Escape; stays open while toggling so several
// settings can be changed at once.
export function GallerySettingsMenu({
  sort,
  onSort,
  previewMode,
  onPreviewMode,
}: {
  sort: SortOrder
  onSort: (s: SortOrder) => void
  previewMode: PreviewMode
  onPreviewMode: (m: PreviewMode) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="View options"
        className={`flex items-center gap-1.5 text-sm transition-colors ${
          open ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Options
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-lg p-1.5 z-30 animate-[fadeIn_120ms_ease-out]"
        >
          <MenuLabel>Sort order</MenuLabel>
          <MenuRadio active={sort === 'oldest'} onClick={() => onSort('oldest')}>
            Oldest first
          </MenuRadio>
          <MenuRadio active={sort === 'newest'} onClick={() => onSort('newest')}>
            Newest first
          </MenuRadio>

          <div className="my-1.5 h-px bg-border" />

          <MenuLabel>Preview a piece in</MenuLabel>
          <MenuRadio active={previewMode === 'fullscreen'} onClick={() => onPreviewMode('fullscreen')}>
            Fullscreen
          </MenuRadio>
          <MenuRadio active={previewMode === 'in-app'} onClick={() => onPreviewMode('in-app')}>
            In-app window
          </MenuRadio>
        </div>
      )}
    </div>
  )
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
      {children}
    </div>
  )
}

function MenuRadio({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-secondary transition-colors"
    >
      <span>{children}</span>
      {active && <Check className="w-4 h-4 text-primary" />}
    </button>
  )
}
