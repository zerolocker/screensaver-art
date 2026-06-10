import { Button } from '@screensaver-art/ui'
import { OAuthButtons } from './OAuthButtons'
import type { OAuthProvider } from '../lib/oauth'

interface PasswordlessOptionsProps {
  /** Provider whose sign-in is mid-flight (shows a spinner), or null. */
  pending: OAuthProvider | null
  /** Error from a failed OAuth attempt, shown inline. */
  error: string | null
  onStart: (provider: OAuthProvider) => void
  /**
   * Open the email one-time-code flow. Omit on the sign-up page: OTP can't
   * create accounts (shouldCreateUser is off — the Supabase create path is
   * buggy), so the code option is sign-in only and would error for new users.
   */
  onEmailCode?: () => void
  /** Label for the email-code button (differs slightly for sign-in vs sign-up). */
  emailCodeLabel?: string
}

/**
 * The passwordless block shared by the Login and Sign-up pages: OAuth buttons
 * (Apple / Google / Microsoft), plus an optional "email me a code" option. OAuth
 * creates the account on first use, so it serves as both sign-in and sign-up;
 * the email-code option is sign-in only (see onEmailCode).
 */
export function PasswordlessOptions({
  pending,
  error,
  onStart,
  onEmailCode,
  emailCodeLabel = 'Email me a sign-in code',
}: PasswordlessOptionsProps) {
  return (
    <div className="space-y-3">
      <OAuthButtons pending={pending} onStart={onStart} />
      {onEmailCode && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={onEmailCode}
        >
          {emailCodeLabel}
        </Button>
      )}
      {error && (
        <div className="flex items-start gap-2 p-3 text-sm rounded-lg bg-red-500/[0.06] border border-red-500/20">
          <span className="text-red-400 shrink-0">✕</span>
          <span className="text-neutral-300">{error}</span>
        </div>
      )}
    </div>
  )
}
