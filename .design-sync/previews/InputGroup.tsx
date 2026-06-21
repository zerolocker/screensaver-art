import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupButton,
  Label,
} from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 380,
}

export function Default() {
  return (
    <div style={frame}>
      <div style={{ display: 'grid', gap: 6 }}>
        <Label>Email</Label>
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>@</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="you@example.com" />
        </InputGroup>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <Label>Promo code</Label>
        <InputGroup>
          <InputGroupInput defaultValue="LIVINGART" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton>Apply</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  )
}
