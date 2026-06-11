import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountHeader } from '@/components/account/account-header'
import { SubscriptionCard } from '@/components/account/subscription-card'
import { AccountInfo } from '@/components/account/account-info'
import { FeedbackCard } from '@/components/account/feedback-card'
import { syncSubscriptionFromSession } from '@/app/actions/stripe'

interface AccountPageProps {
  searchParams: Promise<{ success?: string; session_id?: string }>
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const params = await searchParams
  if (params.success === 'true' && params.session_id) {
    await syncSubscriptionFromSession(params.session_id)
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <AccountHeader user={user} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Your Account</h1>
            <p className="text-muted-foreground mt-2">Manage your subscription and account settings</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <SubscriptionCard subscription={subscription} />
            <AccountInfo user={user} />
          </div>

          <FeedbackCard />
        </div>
      </main>
    </div>
  )
}
