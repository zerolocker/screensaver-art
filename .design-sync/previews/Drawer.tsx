import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  Button,
} from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 460 }}>
      <Drawer defaultOpen>
        <DrawerTrigger asChild>
          <Button variant="outline">Open details</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Minoan Fresco</DrawerTitle>
            <DrawerDescription>
              Sea-blue dolphins curl across a sun-warmed palace wall, animated as a gentle drift.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button>Add to gallery</Button>
            <Button variant="outline">Close</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
