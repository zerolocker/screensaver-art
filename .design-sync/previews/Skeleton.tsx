import { Skeleton } from 'living-art-ui'

export function CardLoading() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, width: 340 }}>
      <Skeleton style={{ height: 160, borderRadius: 10 }} />
      <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
        <Skeleton style={{ height: 40, width: 40, borderRadius: 9999 }} />
        <div style={{ display: 'grid', gap: 8, flex: 1 }}>
          <Skeleton style={{ height: 14, width: '70%' }} />
          <Skeleton style={{ height: 14, width: '45%' }} />
        </div>
      </div>
    </div>
  )
}
