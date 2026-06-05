import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User } from '@supabase/supabase-js'
import { Mail, Calendar } from 'lucide-react'

interface AccountInfoProps {
  user: User
}

export function AccountInfo({ user }: AccountInfoProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Account Details</CardTitle>
        <CardDescription>Your account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted">
            <Mail className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium text-foreground">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted">
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Member since</p>
            <p className="font-medium text-foreground">
              {new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">macOS Setup Instructions</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li><a href="/download/mac" className="text-primary underline underline-offset-2">Download, open, and drag to Applications folder</a></li>
            <li>Open the app in Applications folder and sign in with this account</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
