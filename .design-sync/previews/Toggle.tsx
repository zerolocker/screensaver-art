import { Toggle } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'flex',
  gap: 12,
  alignItems: 'center',
}

export function Default() {
  return (
    <div style={frame}>
      <Toggle aria-label="Bold" defaultPressed style={{ fontWeight: 700 }}>B</Toggle>
      <Toggle aria-label="Italic" style={{ fontStyle: 'italic' }}>I</Toggle>
      <Toggle aria-label="Underline" style={{ textDecoration: 'underline' }}>U</Toggle>
      <Toggle aria-label="Disabled" disabled>S</Toggle>
    </div>
  )
}
