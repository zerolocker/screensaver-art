import { SubscriptionCard } from 'living-art-ui'

const frame: React.CSSProperties = { background: 'var(--background)', padding: 28, maxWidth: 460 }
const noop = async () => ({})

export function Active() {
  return (
    <div style={frame}>
      <SubscriptionCard
        subscription={{
          status: 'active',
          current_period_start: '2026-04-01T00:00:00Z',
          current_period_end: '2026-07-01T00:00:00Z',
        }}
        onSubscribe={noop}
        onManage={noop}
      />
    </div>
  )
}

export function NotSubscribed() {
  return (
    <div style={frame}>
      <SubscriptionCard subscription={null} onSubscribe={noop} onManage={noop} />
    </div>
  )
}
