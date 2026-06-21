import { Collapsible, CollapsibleTrigger, CollapsibleContent, Button } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 420 }}>
      <Collapsible defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>Advanced settings</span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">Toggle</Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent style={{ display: 'grid', gap: 8, paddingTop: 12, color: 'var(--muted-foreground)', fontSize: 14 }}>
          <div>Idle delay before the screensaver starts</div>
          <div>Display-off delay</div>
          <div>Crossfade duration</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
