import type { Metadata } from 'next'

// Auth pages stay out of search. `default` titles the client-side login page;
// `template` keeps the brand suffix on child pages.
export const metadata: Metadata = {
  title: {
    default: 'Sign In',
    template: '%s — Living Art Screensaver',
  },
  description: 'Sign in or create your Living Art Screensaver account.',
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
