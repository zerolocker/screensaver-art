import { Progress } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, display: 'grid', gap: 22, maxWidth: 360 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>Syncing gallery</span><span>62%</span>
        </div>
        <Progress value={62} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>Downloading</span><span>100%</span>
        </div>
        <Progress value={100} />
      </div>
    </div>
  )
}
