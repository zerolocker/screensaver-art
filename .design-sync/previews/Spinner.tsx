import { Spinner, Button } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, display: 'flex', gap: 24, alignItems: 'center' }}>
      <Spinner />
      <Spinner className="size-8 text-primary" />
      <Button disabled>
        <Spinner /> Syncing…
      </Button>
    </div>
  )
}
