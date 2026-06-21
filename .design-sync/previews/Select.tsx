import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  Label,
} from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'grid',
  gap: 8,
  minHeight: 360,
  maxWidth: 360,
}

// Open by default so the listbox renders in-card (cardMode:single override).
export function Open() {
  return (
    <div style={frame}>
      <Label>Collection</Label>
      <Select defaultValue="paleolithic" defaultOpen>
        <SelectTrigger style={{ width: 260 }}>
          <SelectValue placeholder="Pick a collection" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Collections</SelectLabel>
            <SelectItem value="paleolithic">Paleolithic Cave Painting</SelectItem>
            <SelectItem value="minoan">Minoan Fresco</SelectItem>
            <SelectItem value="maya">Maya Bonampak Mural</SelectItem>
            <SelectItem value="nasrid">Nasrid Alhambra Ornament</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
