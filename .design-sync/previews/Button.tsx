import { Button } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'center',
}

export function Variants() {
  return (
    <div style={frame}>
      <Button>Subscribe</Button>
      <Button variant="secondary">Manage</Button>
      <Button variant="outline">Preview now</Button>
      <Button variant="ghost">Skip</Button>
      <Button variant="destructive">Cancel plan</Button>
      <Button variant="link">Learn more</Button>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={frame}>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  )
}

export function States() {
  return (
    <div style={frame}>
      <Button>Enabled</Button>
      <Button disabled>Disabled</Button>
    </div>
  )
}
