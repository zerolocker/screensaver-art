import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  Button,
} from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 360, display: 'flex', justifyContent: 'center' }}>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Account</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent style={{ width: 220 }}>
          <DropdownMenuLabel>gavin@example.com</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Manage subscription</DropdownMenuItem>
          <DropdownMenuItem>Clear cache</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Auto-sync</DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
