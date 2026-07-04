// Page navigation shown below the gallery grid when the filtered set spans more
// than one page. Prev/Next plus a compact windowed list of page numbers, and a
// subtle "showing X–Y of N" line. Purely presentational — the parent owns the
// current page and slicing.

// Windowed page list: always first + last + current±1, with ellipses filling the
// gaps, so the control stays compact no matter how large the catalog grows.
function pageWindow(current: number, total: number): (number | 'gap')[] {
  const keep = new Set<number>([0, total - 1, current - 1, current, current + 1])
  const shown = [...keep].filter((p) => p >= 0 && p < total).sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  let prev = -1
  for (const p of shown) {
    if (prev >= 0 && p - prev > 1) out.push('gap')
    out.push(p)
    prev = p
  }
  return out
}

export function Pagination({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  onChange,
}: {
  page: number
  pageCount: number
  rangeStart: number
  rangeEnd: number
  total: number
  onChange: (page: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 mt-8">
      <div className="flex items-center gap-1">
        <PageButton disabled={page === 0} onClick={() => onChange(page - 1)}>
          Prev
        </PageButton>
        {pageWindow(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1.5 text-sm text-muted-foreground select-none">
              …
            </span>
          ) : (
            <PageButton key={p} active={p === page} onClick={() => onChange(p)}>
              {p + 1}
            </PageButton>
          ),
        )}
        <PageButton disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)}>
          Next
        </PageButton>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        Showing {rangeStart}–{rangeEnd} of {total}
      </p>
    </div>
  )
}

function PageButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      className={`min-w-8 h-8 px-2.5 rounded-md text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
