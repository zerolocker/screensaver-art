import { HoverCard, HoverCardTrigger, HoverCardContent, Button } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 280, display: 'flex', justifyContent: 'center' }}>
      <HoverCard open>
        <HoverCardTrigger asChild>
          <Button variant="link">Paleolithic Cave Painting</Button>
        </HoverCardTrigger>
        <HoverCardContent style={{ width: 300 }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>Paleolithic Cave Painting</p>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
            A looping motion study of ochre bison on cave stone — one of the free pieces in the Living
            Art collection.
          </p>
        </HoverCardContent>
      </HoverCard>
    </div>
  )
}
