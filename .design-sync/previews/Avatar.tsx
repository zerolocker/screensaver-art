import { Avatar, AvatarImage, AvatarFallback } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, display: 'flex', gap: 16, alignItems: 'center' }}>
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/80?img=12" alt="Gavin" />
        <AvatarFallback>GK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>LA</AvatarFallback>
      </Avatar>
      <Avatar className="size-12">
        <AvatarFallback>+9</AvatarFallback>
      </Avatar>
    </div>
  )
}
