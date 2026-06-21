import { Textarea, Label } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'grid',
  gap: 6,
  maxWidth: 420,
}

export function Default() {
  return (
    <div style={frame}>
      <Label htmlFor="feedback">Your feedback</Label>
      <Textarea
        id="feedback"
        rows={4}
        defaultValue="The Paleolithic cave painting loop is mesmerizing — would love more from that era."
      />
    </div>
  )
}

export function Placeholder() {
  return (
    <div style={frame}>
      <Label htmlFor="notes">Notes</Label>
      <Textarea id="notes" rows={4} placeholder="Tell us what you think of the gallery…" />
    </div>
  )
}
