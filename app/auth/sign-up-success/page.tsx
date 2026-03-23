import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Mail } from 'lucide-react'

export default function SignUpSuccessPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
        <Mail className="w-8 h-8 text-primary" />
      </div>
      
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-bold text-foreground">Check your email</h1>
        <p className="text-muted-foreground">
          We&apos;ve sent you a confirmation link. Please check your email to verify your account.
        </p>
      </div>

      <div className="pt-4">
        <Button asChild variant="outline">
          <Link href="/auth/login">Return to sign in</Link>
        </Button>
      </div>
    </div>
  )
}
