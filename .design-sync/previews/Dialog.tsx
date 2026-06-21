import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
} from 'living-art-ui'

// Open by default so the dialog surface renders inside the card (cardMode:single
// + a tall viewport are set in design-sync.config.json overrides).
export function Confirm() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 400 }}>
      <Dialog defaultOpen>
        <DialogTrigger asChild>
          <Button variant="outline">Cancel subscription</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your subscription?</DialogTitle>
            <DialogDescription>
              You&apos;ll keep access to the full gallery until the end of your billing period. After
              that you&apos;ll drop back to the fifty free pieces.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Keep subscription</Button>
            </DialogClose>
            <Button variant="destructive">Cancel plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
