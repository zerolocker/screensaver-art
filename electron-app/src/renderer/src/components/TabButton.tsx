// One tab in the gallery's sticky filter bar (All / Free / Paid / Selected).
// Purely presentational — the active underline is drawn with an absolute span.
export function TabButton({
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
      onClick={onClick}
      className={`relative py-2 text-sm transition-colors ${
        active ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-t" />}
    </button>
  )
}
