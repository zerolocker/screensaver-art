import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
}

interface CheckoutCompletePageProps {
  searchParams: Promise<{ status?: string }>
}

// Public landing for app-initiated Stripe checkouts (success or cancel). The
// browser that ran checkout has no website session, so this page deliberately
// needs no auth. The subscription is recorded by the Stripe webhook; the app
// re-checks status when its window regains focus, so the user just returns to
// the app.
export default async function CheckoutCompletePage({ searchParams }: CheckoutCompletePageProps) {
  const { status } = await searchParams
  const canceled = status === 'canceled'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        {canceled ? (
          <>
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl font-bold text-foreground">Checkout canceled</h1>
              <p className="text-muted-foreground">
                No charge was made. You can close this tab and head back to the Living Art
                Screensaver app whenever you&apos;d like to subscribe.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl font-bold text-foreground">You&apos;re subscribed!</h1>
              <p className="text-muted-foreground">
                Thanks for supporting Living Art. Return to the app — your full gallery unlocks
                automatically, with new pieces added every day.
              </p>
            </div>
          </>
        )}

        <div className="pt-2 flex gap-3 justify-center">
          <Button asChild variant="outline">
            <Link href="/account">Manage account</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
