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
import { useErrorReport } from '../lib/useErrorReport'
import {
  Loader2,
  Trash2,
  HardDrive,
  FolderOpen,
  Monitor,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Bug,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import type { InstallerStatus } from '../../../preload'
import { UpsellBanner } from '../components/UpsellBanner'
import { useGallerySync } from '../lib/SyncProvider'

interface AccountPageProps {
  session: Session
}

export function AccountPage({ session }: AccountPageProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subLoading, setSubLoading] = useState(true)

  const [installer, setInstaller] = useState<InstallerStatus | null>(null)

  const [installing, setInstalling] = useState(false)
  const [activating, setActivating] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  const [clearing, setClearing] = useState(false)

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

  const { reporting, sendReport } = useErrorReport()

  useEffect(() => {
    fetchSubscription()
    refreshInstaller()
    // Re-check subscription + installer status whenever the window regains focus.
    // This is what makes a just-completed purchase show up "instantly": after
    // the user finishes the browser checkout flow and switches back to the app,
    // the focus event fires and we re-verify — no tab toggle or restart needed.
    // (Cache stats + sync progress are owned by the SyncProvider, which has its
    // own focus listener for the stale re-sync.)
    const onFocus = () => {
      fetchSubscription()
      refreshInstaller()
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

  async function refreshInstaller() {
    setInstaller(await window.electronAPI.installer.status())
  }

  async function handleInstall() {
    setInstalling(true)
    setInstallError(null)
    const result = await window.electronAPI.installer.install()
    if (!result.ok) setInstallError(result.error ?? 'Installation failed')
    await refreshInstaller()
    setInstalling(false)
  }

  // Unregister the .appex from the system (pluginkit -r, via the PaperSaver
  // helper). After this it no longer appears in System Settings → Screen Saver.
  async function handleUninstall() {
    setUninstalling(true)
    setInstallError(null)
    const result = await window.electronAPI.installer.uninstall()
    if (!result.ok) setInstallError(result.error ?? 'Uninstall failed')
    await refreshInstaller()
    setUninstalling(false)
  }

  // One-click "Set as your screensaver" — flips the active screensaver to ours
  // via the PaperSaver helper, no trip through System Settings required.
  async function handleActivate() {
    setActivating(true)
    setInstallError(null)
    const result = await window.electronAPI.installer.activate()
    if (!result.ok) setInstallError(result.error ?? 'Could not set the screensaver')
    await refreshInstaller()
    setActivating(false)
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
      <div className="titlebar-drag mb-6">
        <h2 className="text-xl font-semibold text-foreground titlebar-no-drag">Account & Setup</h2>
      </div>

      {!subLoading && !isActiveSubscription(subscription) && (
        <UpsellBanner
          onSubscribe={() =>
            window.electronAPI.shell.openExternal('https://living-art-screensaver.com/account')
          }
        />
      )}

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

        {/* Screensaver install */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Monitor className="w-4 h-4" /> Screensaver
            </CardTitle>
            <CardDescription>
              {installer?.supported
                ? 'Install the screensaver and set it as your active screensaver. This app keeps its video cache up to date in the background.'
                : `Screensaver install isn't supported on ${installer?.platform ?? 'this platform'} yet — coming soon.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {installer?.supported && (
              <>
                {/* Status row — pill on the left, uninstall pushed to the right */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {installer.active ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <p className="text-foreground">Set as your screensaver</p>
                      </>
                    ) : installer.registered ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <p className="text-foreground">Installed</p>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        <p className="text-foreground">Not installed</p>
                      </>
                    )}
                  </div>

                  {installer.registered && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUninstall}
                      disabled={uninstalling}
                      className="ml-auto shrink-0"
                    >
                      {uninstalling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uninstalling…
                        </>
                      ) : (
                        'Uninstall from System Settings'
                      )}
                    </Button>
                  )}
                </div>

                {/* "Not set" banner — one-click activation, no System Settings trip */}
                {installer.registered && !installer.active && (
                  <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Screen Saver isn’t set to Living Art yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Set it as your active screensaver to see your gallery.
                      </p>
                    </div>
                    <Button onClick={handleActivate} disabled={activating} size="sm">
                      {activating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting…
                        </>
                      ) : (
                        'Set'
                      )}
                    </Button>
                  </div>
                )}

                {!installer.bundledExtensionExists && (
                  <p className="text-xs text-amber-500">
                    The screensaver bundle is missing from this app's resources. Run{' '}
                    <code className="font-mono">scripts/bundle-appex.sh</code> from{' '}
                    <code className="font-mono">electron-app/</code> before launching.
                  </p>
                )}
                {installError && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-xs text-red-500">{installError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        sendReport('install_error', installError, { installError, syncError, installer })
                      }
                      disabled={reporting}
                      className="shrink-0"
                    >
                      {reporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                        </>
                      ) : (
                        <>
                          <Bug className="mr-2 h-4 w-4" /> Send error report
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <div className="flex gap-3">
                  {!installer.registered ? (
                    <Button
                      onClick={handleInstall}
                      disabled={installing || !installer.bundledExtensionExists}
                      className="flex-1"
                    >
                      {installing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Installing…
                        </>
                      ) : (
                        'Install Screensaver'
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => window.electronAPI.installer.openSystemSettings()}
                    >
                      Open System Settings
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
      </div>
    </div>
  )
}
