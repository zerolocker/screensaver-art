import { Badge } from 'living-art-ui'

export function Variants() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge>Subscriber</Badge>
      <Badge variant="secondary">Free</Badge>
      <Badge variant="outline">New</Badge>
      <Badge variant="destructive">Locked</Badge>
    </div>
  )
}
