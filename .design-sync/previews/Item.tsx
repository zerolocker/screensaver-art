import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  Button,
} from 'living-art-ui'

export function List() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 480 }}>
      <ItemGroup>
        <Item>
          <ItemMedia>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--primary)' }} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Paleolithic Cave Painting</ItemTitle>
            <ItemDescription>Free · added to your gallery</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="sm">Remove</Button>
          </ItemActions>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemMedia>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--muted)' }} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Nasrid Alhambra Ornament</ItemTitle>
            <ItemDescription>Subscriber-only</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm">Unlock</Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  )
}
