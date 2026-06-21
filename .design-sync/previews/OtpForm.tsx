import { OtpForm } from 'living-art-ui'

const ok = async () => ({})

export function EmailStep() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 400 }}>
      <OtpForm onRequestCode={ok} onVerify={ok} />
    </div>
  )
}
