import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator, Label } from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  display: 'grid',
  gap: 12,
  justifyItems: 'start',
}

export function SixDigit() {
  return (
    <div style={frame}>
      <Label>Enter the code we emailed you</Label>
      <InputOTP maxLength={6} value="429" onChange={() => {}}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}
