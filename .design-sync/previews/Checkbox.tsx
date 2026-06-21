import { Checkbox, Label } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

function Row({ id, children, ...props }: { id: string; children: React.ReactNode } & React.ComponentProps<typeof Checkbox>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Checkbox id={id} {...props} />
      <Label htmlFor={id}>{children}</Label>
    </div>
  )
}

export function Default() {
  return (
    <div style={frame}>
      <Row id="c1" defaultChecked>Sync new pieces automatically</Row>
      <Row id="c2">Email me when the gallery updates</Row>
      <Row id="c3" defaultChecked disabled>Required (locked)</Row>
      <Row id="c4" disabled>Unavailable</Row>
    </div>
  )
}
