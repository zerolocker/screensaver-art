import { RadioGroup, RadioGroupItem, Label } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  maxWidth: 360,
}

export function Default() {
  return (
    <div style={frame}>
      <RadioGroup defaultValue="quarterly" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RadioGroupItem value="quarterly" id="r1" />
          <Label htmlFor="r1">Quarterly — $2.97 every 3 months</Label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RadioGroupItem value="monthly" id="r2" />
          <Label htmlFor="r2">Monthly — $0.99 / month</Label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RadioGroupItem value="free" id="r3" disabled />
          <Label htmlFor="r3">Free — 50 pieces</Label>
        </div>
      </RadioGroup>
    </div>
  )
}
