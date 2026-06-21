import { AspectRatio } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, width: 360 }}>
      <AspectRatio ratio={16 / 9} className="rounded-lg overflow-hidden">
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, var(--primary), var(--background))',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 12,
            color: 'var(--primary-foreground)',
            fontWeight: 600,
          }}
        >
          16 : 9 — video poster
        </div>
      </AspectRatio>
    </div>
  )
}
