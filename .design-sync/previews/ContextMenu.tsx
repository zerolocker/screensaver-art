import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuCheckboxItem,
  ContextMenuShortcut,
} from 'living-art-ui'

// ContextMenu opens on right-click (no controllable `open` prop), so the static
// card shows the trigger surface; the menu structure is composed for reference.
export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28 }}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            style={{
              border: '1px dashed var(--border)',
              borderRadius: 8,
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--muted-foreground)',
              fontSize: 14,
            }}
          >
            Right-click a gallery piece for actions
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>
            Add to gallery <ContextMenuShortcut>⌘A</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>Preview now</ContextMenuItem>
          <ContextMenuCheckboxItem checked>Loop seamlessly</ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuItem>Remove</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
