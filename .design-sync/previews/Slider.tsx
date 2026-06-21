import { Slider, Label } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
  maxWidth: 360,
}

export function Default() {
  return (
    <div style={frame}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Label>Crossfade duration</Label>
        <Slider defaultValue={[40]} max={100} step={1} />
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        <Label>Brightness range</Label>
        <Slider defaultValue={[20, 80]} max={100} step={1} />
      </div>
    </div>
  )
}
