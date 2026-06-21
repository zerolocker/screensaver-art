import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Label,
  Input,
} from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 320, display: 'flex', justifyContent: 'center' }}>
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button variant="outline">Display settings</Button>
        </PopoverTrigger>
        <PopoverContent style={{ width: 280 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ fontWeight: 600 }}>Display</p>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label htmlFor="pop-delay">Idle delay (min)</Label>
              <Input id="pop-delay" defaultValue="5" />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
