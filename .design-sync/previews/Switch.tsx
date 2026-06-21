import { Switch, Label } from 'living-art-ui'

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label htmlFor="s1">Auto-sync gallery</Label>
        <Switch id="s1" defaultChecked />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label htmlFor="s2">Show upsell nudges</Label>
        <Switch id="s2" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.6 }}>
        <Label htmlFor="s3">Beta features</Label>
        <Switch id="s3" disabled />
      </div>
    </div>
  )
}
