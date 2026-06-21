import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  Button,
} from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 460 }}>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--muted)' }} />
          </EmptyMedia>
          <EmptyTitle>Your gallery is empty</EmptyTitle>
          <EmptyDescription>
            Add pieces from the collection and they&apos;ll sync to your screensaver automatically.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>Browse the gallery</Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
