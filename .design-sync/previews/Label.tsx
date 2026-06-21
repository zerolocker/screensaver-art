import { Label, Input, Checkbox } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 360,
}

export function WithControls() {
  return (
    <div style={frame}>
      <div style={{ display: 'grid', gap: 6 }}>
        <Label htmlFor="api-key">API key</Label>
        <Input id="api-key" placeholder="sk-…" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Checkbox id="remember" defaultChecked />
        <Label htmlFor="remember">Keep me signed in</Label>
      </div>
    </div>
  )
}
