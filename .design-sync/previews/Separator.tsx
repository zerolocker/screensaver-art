import { Separator } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 380 }}>
      <div>
        <p style={{ fontWeight: 600 }}>Living Art Screensaver</p>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Curated motion art for your Mac.</p>
      </div>
      <Separator style={{ margin: '16px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
        <span>Gallery</span>
        <Separator orientation="vertical" style={{ height: 16 }} />
        <span>Account</span>
        <Separator orientation="vertical" style={{ height: 16 }} />
        <span>Help</span>
      </div>
    </div>
  )
}
