import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from 'living-art-ui'

// value="gallery" opens the Gallery menu so its items render in-card.
export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 320 }}>
      <Menubar value="gallery">
        <MenubarMenu value="gallery">
          <MenubarTrigger>Gallery</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              Sync now <MenubarShortcut>⌘S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem>Select all</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Clear cache</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu value="account">
          <MenubarTrigger>Account</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu value="help">
          <MenubarTrigger>Help</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    </div>
  )
}
