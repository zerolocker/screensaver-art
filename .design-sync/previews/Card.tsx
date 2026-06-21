import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from 'living-art-ui'

const frame: React.CSSProperties = { background: 'var(--background)', padding: 28, maxWidth: 460 }

export function ArtPiece() {
  return (
    <div style={frame}>
      <Card>
        <CardHeader>
          <CardTitle>Paleolithic Cave Painting</CardTitle>
          <CardDescription>
            A flickering ochre bison drifts across the stone, rendered as a slow, looping motion study.
          </CardDescription>
          <CardAction>
            <Badge variant="secondary">New</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
            Part of the Living Art collection — one of fifty free pieces, with the full gallery and
            fresh art every day unlocked by a subscription.
          </p>
        </CardContent>
        <CardFooter style={{ gap: 12 }}>
          <Button>Add to gallery</Button>
          <Button variant="ghost">Preview</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
