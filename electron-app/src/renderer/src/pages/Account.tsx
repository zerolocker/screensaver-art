import { useEffect, useState } from 'react'
import { SubscriptionCard, Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '@screensaver-art/ui'
import type { Subscription } from '@screensaver-art/ui'
import { SUBSCRIPTION_VERIFY_ENDPOINT } from '../lib/api'
import { Loader2, Trash2, HardDrive, FolderOpen } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'

interface AccountPageProps {
  session: Session
}

export function AccountPage({ session }: AccountPageProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [cacheStats, setCacheStats] = useState<{ sizeBytes: number; fileCount: number; path: string } | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    fetchSubscription()
    fetchCacheStats()
  }, [])

  async function fetchSubscription() {
    setSubLoading(true)
    try {
      const res = await fetch(SUBSCRIPTION_VERIFY_ENDPOINT, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.subscription) setSubscription(data.subscription)
      }
    } catch {
      // offline — that's fine
    } finally {
      setSubLoading(false)
    }
  }

  async function fetchCacheStats() {
    if (window.electronAPI) {
      const stats = await window.electronAPI.cache.getStats()
      setCacheStats(stats)
    }
  }

  async function handleClearCache() {
    setClearing(true)
    if (window.electronAPI) {
      await window.electronAPI.cache.clear()
      await fetchCacheStats()
    }
    setClearing(false)
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Title bar drag area */}
      <div className="titlebar-drag mb-6">
        <h2 className="text-xl font-semibold text-foreground titlebar-no-drag">Account</h2>
      </div>

      <div className="space-y-6">
        {/* Account info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Account Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-foreground">{session.user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Member since</p>
              <p className="text-foreground">
                {new Date(session.user.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        {subLoading ? (
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <SubscriptionCard
            subscription={subscription}
            onSubscribe={async () => {
              // Open Stripe checkout in browser
              window.electronAPI.shell.openExternal(
                'https://living-art-screensaver.com/account',
              )
              return {}
            }}
            onManage={async () => {
              // Open Stripe portal in browser
              window.electronAPI.shell.openExternal(
                'https://living-art-screensaver.com/account',
              )
              return {}
            }}
          />
        )}

        {/* Cache management */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Video Cache</CardTitle>
            <CardDescription>
              Videos are cached locally for offline playback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cacheStats && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-muted">
                    <HardDrive className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {formatBytes(cacheStats.sizeBytes)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {cacheStats.fileCount} cached video{cacheStats.fileCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  {cacheStats.path}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  if (window.electronAPI && cacheStats) {
                    window.electronAPI.shell.openPath(cacheStats.path)
                  }
                }}
                variant="outline"
                className="flex-1"
                disabled={!cacheStats}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Show in Folder
              </Button>
              <Button
                onClick={handleClearCache}
                variant="outline"
                className="flex-1"
                disabled={clearing}
              >
                {clearing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Cache
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
