import { Kbd, KbdGroup } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Sync now</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>S</Kbd>
        </KbdGroup>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Command palette</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
    </div>
  )
}
