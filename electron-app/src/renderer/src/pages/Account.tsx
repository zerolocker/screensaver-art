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
import { GALLERY_ENDPOINT, SUBSCRIPTION_VERIFY_ENDPOINT } from '../lib/api'
import {
  Loader2,
  Trash2,
  HardDrive,
  FolderOpen,
  Monitor,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import type { CacheProgress, CacheStats, InstallerStatus } from '../../../preload'
import { UpsellBanner } from '../components/UpsellBanner'

interface AccountPageProps {
  session: Session
}

export function AccountPage({ session }: AccountPageProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subLoading, setSubLoading] = useState(true)

  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [installer, setInstaller] = useState<InstallerStatus | null>(null)

  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [progress, setProgress] = useState<CacheProgress | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    fetchSubscription()
    refreshLocalState()
    const off = window.electronAPI.cache.onProgress((p) => {
      setProgress(p)
      // Refresh the cache stats on each progress event so the file count and
      // total size tick up live as videos arrive — otherwise the user only
      // sees the "Downloading 12/184" text and the headline number stays
      // frozen at whatever it was before sync started.
      if (p.phase === 'cached' || p.phase === 'downloading' || p.phase === 'done') {
        window.electronAPI.cache.getStats().then(setCacheStats).catch(() => {})
      }
    })
    return off
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
      // offline — fine
    } finally {
      setSubLoading(false)
    }
  }

  async function refreshLocalState() {
    const [stats, status] = await Promise.all([
      window.electronAPI.cache.getStats(),
      window.electronAPI.installer.status(),
    ])
    setCacheStats(stats)
    setInstaller(status)
  }

  async function handleInstall() {
    setInstalling(true)
    setInstallError(null)
    const result = await window.electronAPI.installer.install()
    if (!result.ok) setInstallError(result.error ?? 'Installation failed')
    else await window.electronAPI.installer.openSystemSettings()
    await refreshLocalState()
    setInstalling(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    setProgress(null)
    const url = `${GALLERY_ENDPOINT}?collection=classic`
    const result = await window.electronAPI.cache.sync(url, session.access_token)
    if (!result.ok) {
      setSyncError(result.error)
    } else {
      setLastSyncedAt(result.manifest.syncedAt)
    }
    await refreshLocalState()
    setSyncing(false)
  }

  async function handleClearCache() {
    setClearing(true)
    await window.electronAPI.cache.clear()
    await refreshLocalState()
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
                ? 'Install the screensaver on your Mac. This app will keep its video cache up to date in the background.'
                : `Screensaver install isn't supported on ${installer?.platform ?? 'this platform'} yet — coming soon.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {installer?.supported && (
              <>
                <div className="flex items-center gap-3">
                  {installer.installed ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-foreground">Installed</p>
                        <p className="text-xs text-muted-foreground break-all">
                          {installer.installedPath}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <p className="text-foreground">Not installed</p>
                    </>
                  )}
                </div>
                {!installer.bundledSaverExists && (
                  <p className="text-xs text-amber-500">
                    The screensaver bundle is missing from this app's resources. Run{' '}
                    <code className="font-mono">scripts/bundle-saver.sh</code> from{' '}
                    <code className="font-mono">electron-app/</code> before launching.
                  </p>
                )}
                {installError && <p className="text-xs text-red-500">{installError}</p>}
                <div className="flex gap-3">
                  <Button
                    onClick={handleInstall}
                    disabled={installing || !installer.bundledSaverExists}
                    className="flex-1"
                  >
                    {installing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Installing…
                      </>
                    ) : installer.installed ? (
                      'Reinstall'
                    ) : (
                      'Install Screensaver'
                    )}
                  </Button>
                  {installer.installed && (
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
            {syncError && <p className="text-xs text-red-500">{syncError}</p>}

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
