'use client'

import { Button } from './button'
import { OAUTH_PROVIDERS, OAUTH_PROVIDER_LABELS, type OAuthProvider } from '../oauth'

export interface OAuthButtonsProps {
  /** Start sign-in with the chosen provider. */
  onSelect: (provider: OAuthProvider) => void
}

// No spinner / disabled state: sign-in continues in the system browser (or its
// own window), so the buttons stay live. Disabling them on click only ever
// stranded the user on a spinner when they came back without finishing.
export function OAuthButtons({ onSelect }: OAuthButtonsProps) {
  return (
    <div className="space-y-2">
      {OAUTH_PROVIDERS.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={() => onSelect(provider)}
        >
          <ProviderIcon provider={provider} />
          Continue with {OAUTH_PROVIDER_LABELS[provider]}
        </Button>
      ))}
    </div>
  )
}

function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  switch (provider) {
    case 'apple':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M16.365 1.43c0 1.14-.42 2.22-1.18 3.02-.79.84-2.06 1.49-3.18 1.41-.13-1.1.42-2.27 1.13-3.02.79-.85 2.16-1.47 3.23-1.41zM20.7 17.2c-.55 1.27-.82 1.84-1.53 2.97-.99 1.57-2.39 3.53-4.12 3.54-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.01-3.06-1.78-4.05-3.35C-.18 16.7-.92 11.2 1.2 8.27 2.42 6.5 4.4 5.4 6.27 5.4c1.9 0 3.1 1.04 4.67 1.04 1.52 0 2.45-1.04 4.65-1.04 1.66 0 3.42.9 4.68 2.46-4.11 2.25-3.44 8.11.43 9.34z" />
        </svg>
      )
    case 'google':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="#4285F4" d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.19a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2.01 3.45-4.97 3.45-8.38z" />
          <path fill="#34A853" d="M12 24c3.12 0 5.73-1.03 7.64-2.8l-3.72-2.89c-1.03.69-2.35 1.1-3.92 1.1-3.01 0-5.56-2.03-6.47-4.77H1.69v2.98A11.99 11.99 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.53 14.64a7.2 7.2 0 0 1 0-4.6V7.06H1.69a12 12 0 0 0 0 10.56l3.84-2.98z" />
          <path fill="#EA4335" d="M12 4.77c1.7 0 3.22.58 4.42 1.72l3.3-3.3C17.73 1.18 15.12 0 12 0A11.99 11.99 0 0 0 1.69 7.06l3.84 2.98C6.44 7.3 8.99 4.77 12 4.77z" />
        </svg>
      )
    case 'azure':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
          <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
          <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
          <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
        </svg>
      )
  }
}
