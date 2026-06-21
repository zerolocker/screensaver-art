import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  Button,
  Label,
  Input,
} from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 460 }}>
      <Sheet defaultOpen>
        <SheetTrigger asChild>
          <Button variant="outline">Edit account</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Account</SheetTitle>
            <SheetDescription>Update your profile. Changes save when you click done.</SheetDescription>
          </SheetHeader>
          <div style={{ display: 'grid', gap: 14, padding: '0 16px' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label htmlFor="sheet-name">Display name</Label>
              <Input id="sheet-name" defaultValue="Gavin" />
            </div>
          </div>
          <SheetFooter>
            <Button>Save changes</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
