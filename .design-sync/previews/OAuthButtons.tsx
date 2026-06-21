import { OAuthButtons } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 360 }}>
      <OAuthButtons onSelect={() => {}} />
    </div>
  )
}
