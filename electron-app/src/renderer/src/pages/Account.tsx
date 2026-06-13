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
import { SUBSCRIPTION_VERIFY_ENDPOINT } from '../lib/api'
import { log } from '../lib/log'
import { getAccessToken } from '../lib/supabase'
import { Loader2, Trash2, HardDrive, FolderOpen, RefreshCw } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { AppBanners } from '../components/AppBanners'
import { useGallerySync } from '../lib/SyncProvider'
import { useUpdate } from '../lib/UpdateProvider'

interface AccountPageProps {
  session: Session
}

export function AccountPage({ session }: AccountPageProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subLoading, setSubLoading] = useState(true)

  const [clearing, setClearing] = useState(false)

  // App version + auto-update. The update state itself (and the "Relaunch"
  // prompt) is owned by UpdateProvider / AppBanners; this card just shows the
  // version and a manual "Check for updates" escape hatch.
  const { state: update, check: checkForUpdates } = useUpdate()
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [checkedOnce, setCheckedOnce] = useState(false)

  useEffect(() => {
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  async function handleCheckForUpdates() {
    setCheckedOnce(true)
    await checkForUpdates()
  }

  // Gallery sync is owned by the app-wide SyncProvider (auto-sync on open +
  // sidebar status). The Account page just surfaces the detail + a manual button.
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
    // Re-check the subscription whenever the window regains focus. This is what
    // makes a just-completed purchase show up "instantly": after the user
    // finishes the browser checkout flow and switches back to the app, the focus
    // event fires and we re-verify — no tab toggle or restart needed. (Installer
    // status has its own focus refresh in the InstallerProvider; cache stats +
    // sync progress are owned by the SyncProvider.)
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
        // Always mirror the server's answer (including null) so a refetch
        // reflects the *current* state — a brand-new purchase flips us to
        // subscribed, a cancellation flips us back.
        setSubscription(data.subscription ?? null)
      } else {
        // Don't fail silently. A 401 here (e.g. a stale token) is exactly why a
        // real subscription can look "stuck" on the free tier — log it so it
        // shows up in the diagnostics report instead of vanishing.
        log.warn('account', 'subscription verify failed', { status: res.status })
      }
    } catch (err) {
      // Offline — keep showing whatever we last had, but record it.
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

  function isActiveSubscription(sub: Subscription | null): boolean {
    return sub?.status === 'active' || sub?.status === 'trialing'
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
      <AppBanners showUpsell={!subLoading && !isActiveSubscription(subscription)} />

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
            onSubscribe={async () => {
              window.electronAPI.shell.openExternal('https://living-art-screensaver.com/account')
              return {}
            }}
            onManage={async () => {
              window.electronAPI.shell.openExternal('https://living-art-screensaver.com/account')
              return {}
            }}
          />
        )}

        {/* The screensaver is registered automatically on launch (see
            InstallerProvider), and the one-click "Set" prompt lives in the
            top-of-app banner — so there's no Screensaver card to manage here. */}

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
            {/* Only surface the error inline for an explicit manual sync; an
                auto-sync failure (e.g. offline at launch) is shown quietly in
                the sidebar instead of as a red error here. */}
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

        {/* About / updates — new versions download in the background and surface
            the "Relaunch to update" banner above; this is a manual check. */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">About</CardTitle>
            <CardDescription>
              {appVersion ? `Living Art Screensaver v${appVersion}` : 'Living Art Screensaver'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleCheckForUpdates}
                variant="outline"
                disabled={update.status === 'checking' || update.status === 'downloading'}
              >
                {update.status === 'checking' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" /> Check for updates
                  </>
                )}
              </Button>
            </div>
            {update.status === 'downloading' && (
              <p className="text-sm text-muted-foreground">
                Downloading update{typeof update.percent === 'number' ? ` — ${update.percent}%` : '…'}
              </p>
            )}
            {update.status === 'ready' && (
              <p className="text-sm text-muted-foreground">
                An update is ready — use the banner above to relaunch.
              </p>
            )}
            {update.status === 'error' && (
              <p className="text-sm text-red-500">
                Couldn&rsquo;t check for updates{update.error ? `: ${update.error}` : '.'}
              </p>
            )}
            {update.status === 'idle' && checkedOnce && (
              <p className="text-sm text-muted-foreground">You&rsquo;re on the latest version.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
