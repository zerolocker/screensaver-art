import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function AuthErrorPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-bold text-foreground">Authentication Error</h1>
        <p className="text-muted-foreground">
          Something went wrong during authentication. Please try again.
        </p>
      </div>

      <div className="pt-4 flex gap-3 justify-center">
        <Button asChild variant="outline">
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  )
}
