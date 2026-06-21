import { ScrollArea, Separator } from 'living-art-ui'

const collections = [
  'Paleolithic Cave Painting',
  'Minoan Fresco',
  'Maya Bonampak Mural',
  'Nasrid Alhambra Ornament',
  'Egyptian Tomb Relief',
  'Byzantine Mosaic',
  'Ukiyo-e Woodblock',
  'Aboriginal Dot Painting',
  'Persian Miniature',
  'Art Nouveau Poster',
]

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28 }}>
      <ScrollArea className="rounded-md border" style={{ height: 220, width: 280 }}>
        <div style={{ padding: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Collections</p>
          {collections.map((c) => (
            <div key={c}>
              <div style={{ padding: '8px 0', fontSize: 14 }}>{c}</div>
              <Separator />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
