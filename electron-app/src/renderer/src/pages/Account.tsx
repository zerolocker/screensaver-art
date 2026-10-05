import { useEffect, useState } from 'react'
import {
  SubscriptionCard,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
} from '@screensaver-art/ui'
import type { Subscription } from '@screensaver-art/ui'
import { isSubscriptionActive } from '@screensaver-art/constants'
import { SUBSCRIPTION_VERIFY_ENDPOINT } from '../lib/api'
import { startCheckout } from '../lib/checkout'
import { log } from '../lib/log'
import { getAccessToken } from '../lib/supabase'
import { Loader2, Trash2, HardDrive, FolderOpen, RefreshCw } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { AppBanners } from '../components/AppBanners'
import { useGallerySync } from '../lib/SyncProvider'

interface AccountPageProps {
  session: Session
}

export function AccountPage({ session }: AccountPageProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subLoading, setSubLoading] = useState(true)

  const [clearing, setClearing] = useState(false)

  // Sync state lives in SyncProvider; this page shows it and a manual button.
  const {
    syncing,
    progress,
    cacheStats,
    lastSyncedAt,
    error: syncError,
    lastTrigger,
    syncNow,
    refreshStats,
  } = useGallerySync()

  useEffect(() => {
    fetchSubscription()
    // Re-check on focus, so a purchase made in the browser shows up when the
    // user switches back.
    const onFocus = () => {
      fetchSubscription()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  async function fetchSubscription() {
    setSubLoading(true)
    try {
      const accessToken = await getAccessToken()
      const res = await fetch(SUBSCRIPTION_VERIFY_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        // Mirror the server's answer, including null.
        setSubscription(data.subscription ?? null)
      } else {
        // Log it: a 401 here makes a real subscription look like the free tier.
        log.warn('account', 'subscription verify failed', { status: res.status })
      }
    } catch (err) {
      // Offline: keep the last answer.
      log.warn('account', 'subscription verify threw', {
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSubLoading(false)
    }
  }

  async function handleSync() {
    await syncNow({ trigger: 'manual' })
  }

  async function handleClearCache() {
    setClearing(true)
    await window.electronAPI.cache.clear()
    await refreshStats()
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
    // No top padding, to line up with the sidebar title.
    <div className="px-6 pb-6">
      <AppBanners showUpsell={!subLoading && !isSubscriptionActive(subscription)} />

      <div className="space-y-6">
        {/* Account info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Account</CardTitle>
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
            onCheckout={async (plan) => {
              // Straight to Stripe. The card's buttons are per plan, so no picker.
              await startCheckout('account_card', plan)
              return {}
            }}
            onManage={async () => {
              window.electronAPI.shell.openExternal('https://living-art-screensaver.com/account')
              return {}
            }}
            openExternal={(url) => void window.electronAPI.shell.openExternal(url)}
          />
        )}

        {/* Gallery sync */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Video Cache</CardTitle>
            <CardDescription>
              Videos are downloaded, obfuscated, and stored locally for the screensaver to play
              offline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cacheStats && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <HardDrive className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{formatBytes(cacheStats.sizeBytes)}</p>
                  <p className="text-sm text-muted-foreground">
                    {cacheStats.fileCount} cached video{cacheStats.fileCount !== 1 ? 's' : ''}
                    {lastSyncedAt && (
                      <> · synced {new Date(lastSyncedAt).toLocaleTimeString()}</>
                    )}
                  </p>
                </div>
              </div>
            )}

            {progress && progress.phase !== 'done' && (
              <p className="text-xs text-muted-foreground">
                {progress.phase === 'fetching-gallery' && 'Fetching gallery…'}
                {progress.phase === 'downloading' &&
                  `Downloading ${progress.index}/${progress.total}: ${progress.title}`}
                {progress.phase === 'cached' &&
                  `Already cached ${progress.index}/${progress.total}: ${progress.title}`}
                {progress.phase === 'error' && (
                  <span className="text-red-500">
                    Error on {progress.title}: {progress.error}
                  </span>
                )}
              </p>
            )}
            {/* Only for a manual sync; auto-sync errors show quietly in the sidebar. */}
            {syncError && lastTrigger === 'manual' && (
              <p className="text-xs text-red-500">{syncError}</p>
            )}

            <div className="flex gap-3">
              <Button onClick={handleSync} disabled={syncing} className="flex-1">
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" /> Sync Now
                  </>
                )}
              </Button>
              <Button
                onClick={() => cacheStats && window.electronAPI.shell.openPath(cacheStats.path)}
                variant="outline"
                disabled={!cacheStats}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Show Folder
              </Button>
              <Button onClick={handleClearCache} variant="outline" disabled={clearing}>
                {clearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
