import { Button, OAuthButtons, type OAuthProvider } from '@screensaver-art/ui'

interface PasswordlessOptionsProps {
  /** Error from a failed OAuth attempt, shown inline. */
  error: string | null
  onStart: (provider: OAuthProvider) => void
  /** Open the email one-time-code flow. */
  onEmailCode: () => void
  /** Label for the email-code button. */
  emailCodeLabel?: string
}

/**
 * The passwordless sign-in block: social buttons (Apple / Google / Microsoft)
 * plus an "email me a code" option. All of these create the account on first
 * use, so this single block serves as both sign-in and sign-up.
 */
export function PasswordlessOptions({
  error,
  onStart,
  onEmailCode,
  emailCodeLabel = 'Continue with email',
}: PasswordlessOptionsProps) {
  return (
    <div className="space-y-3">
      <OAuthButtons onSelect={onStart} />
      <Button type="button" variant="outline" className="w-full" onClick={onEmailCode}>
        {emailCodeLabel}
      </Button>
      {error && (
        <div className="flex items-start gap-2 p-3 text-sm rounded-lg bg-red-500/[0.06] border border-red-500/20">
          <span className="text-red-400 shrink-0">✕</span>
          <span className="text-neutral-300">{error}</span>
        </div>
      )}
    </div>
  )
}
