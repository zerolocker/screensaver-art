import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, display: 'flex', justifyContent: 'center' }}>
      <Command className="rounded-lg border" style={{ width: 340 }}>
        <CommandInput placeholder="Search collections…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Collections">
            <CommandItem>
              Paleolithic Cave Painting <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
            <CommandItem>Minoan Fresco</CommandItem>
            <CommandItem>Maya Bonampak Mural</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem>Sync now</CommandItem>
            <CommandItem>Clear cache</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
