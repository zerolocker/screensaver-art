import { Calendar } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 24,
  display: 'inline-block',
}

export function Single() {
  const month = new Date(2026, 5, 1) // June 2026
  const selected = new Date(2026, 5, 16)
  return (
    <div style={frame}>
      <Calendar mode="single" selected={selected} defaultMonth={month} className="rounded-md border" />
    </div>
  )
}
