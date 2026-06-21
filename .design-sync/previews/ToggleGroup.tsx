import { ToggleGroup, ToggleGroupItem } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  alignItems: 'flex-start',
}

export function Single() {
  return (
    <div style={frame}>
      <ToggleGroup type="single" defaultValue="grid">
        <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
        <ToggleGroupItem value="list">List</ToggleGroupItem>
        <ToggleGroupItem value="map">Map</ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

export function Multiple() {
  return (
    <div style={frame}>
      <ToggleGroup type="multiple" defaultValue={['bold', 'italic']}>
        <ToggleGroupItem value="bold" style={{ fontWeight: 700 }}>B</ToggleGroupItem>
        <ToggleGroupItem value="italic" style={{ fontStyle: 'italic' }}>I</ToggleGroupItem>
        <ToggleGroupItem value="underline" style={{ textDecoration: 'underline' }}>U</ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
