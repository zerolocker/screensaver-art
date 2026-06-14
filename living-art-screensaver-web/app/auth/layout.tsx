import type { Metadata } from 'next'

// Auth pages are utility flows, not search targets — keep them out of the index.
// `default` is the title for the (client-component) login page, which can't
// export its own metadata; re-declaring `template` here lets descendant pages
// (e.g. the error page) keep the brand suffix — a plain-string title would
// stop the root template from reaching them.
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
