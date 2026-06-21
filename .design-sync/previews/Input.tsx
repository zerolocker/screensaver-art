import { Input, Label } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 360,
}

export function Default() {
  return (
    <div style={frame}>
      <div style={{ display: 'grid', gap: 6 }}>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <Label htmlFor="name">Display name</Label>
        <Input id="name" defaultValue="Gavin" />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <Label htmlFor="disabled">Disabled</Label>
        <Input id="disabled" placeholder="Unavailable" disabled />
      </div>
    </div>
  )
}
