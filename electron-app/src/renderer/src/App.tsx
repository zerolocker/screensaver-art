import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase, getStoredSession } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { startOAuth, completeOAuthFromUrl, type OAuthProvider } from './lib/oauth'
import { resetIdentity } from './lib/analytics'
import { log } from './lib/log'
import { LoginPage } from './pages/Login'
import { OtpPage } from './pages/Otp'
import { GalleryPage } from './pages/Gallery'
import { AccountPage } from './pages/Account'
import { HelpPage } from './pages/Help'
import { Sidebar } from './pages/Sidebar'
import { ScreensaverUnavailable } from './pages/ScreensaverUnavailable'
import { SyncProvider } from './lib/SyncProvider'
import { InstallerProvider, useInstaller } from './lib/InstallerProvider'
import { UpdateProvider } from './lib/UpdateProvider'
import { PlanPickerProvider } from './lib/PlanPickerProvider'

// How long startup waits for a token refresh before using the stored session.
const INITIAL_SESSION_TIMEOUT_MS = 2000

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const navigate = useNavigate()

  // OAuth returns through a livingart:// deep link forwarded by the main process.
  useEffect(() => {
    return window.electronAPI.auth.onCallback(async (url) => {
      const { error } = await completeOAuthFromUrl(url)
      if (error) setOauthError(error)
    })
  }, [])

  async function handleStartOAuth(provider: OAuthProvider): Promise<void> {
    setOauthError(null)
    const { error } = await startOAuth(provider)
    if (error) setOauthError(error)
  }

  useEffect(() => {
    let cancelled = false

    // Offline, getSession() retries an expired token's refresh for ~25s, so race
    // it against a short timeout and fall back to the stored session. That keeps
    // the user signed in for everything that works offline, e.g. right after
    // wake when the network isn't back yet. supabase-js refreshes later
    // (TOKEN_REFRESHED). A revoked session is cleared, so the fallback is null.
    async function resolveInitialSession(): Promise<void> {
      const validated = await Promise.race([
        supabase.auth.getSession().then(({ data }) => data.session),
        new Promise<undefined>((resolve) =>
          setTimeout(resolve, INITIAL_SESSION_TIMEOUT_MS),
        ),
      ])
      if (cancelled) return

      if (validated) {
        setSession(validated)
      } else {
        // No stored session means signed out.
        const stored = getStoredSession()
        if (stored) {
          log.info('auth', 'using stored session at startup; will refresh when online')
        }
        setSession(stored)
      }
      setLoading(false)
    }

    void resolveInitialSession()

    // Ignore INITIAL_SESSION: it reports null when offline and would undo the fallback above.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      setSession(session)
      setLoading(false)
      // Only navigate on actual sign-in/sign-out, not token refreshes.
      if (event === 'SIGNED_IN') {
        navigate('/gallery')
      } else if (event === 'SIGNED_OUT') {
        // Start a fresh analytics identity for whoever signs in next.
        resetIdentity()
        navigate('/login')
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="titlebar-drag flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-8 titlebar-no-drag">
          <Routes>
            <Route
              path="/login"
              element={
                <LoginPage oauthError={oauthError} onStartOAuth={handleStartOAuth} />
              }
            />
            <Route path="/otp" element={<OtpPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </div>
    )
  }

  return (
    <SyncProvider>
      <InstallerProvider>
        <UpdateProvider>
          <PlanPickerProvider>
            <AuthedShell session={session} />
          </PlanPickerProvider>
        </UpdateProvider>
      </InstallerProvider>
    </SyncProvider>
  )
}

// The signed-in shell. Shows a recovery screen if the embedded screensaver is
// missing (a damaged install).
function AuthedShell({ session }: { session: Session }) {
  const { installer } = useInstaller()

  if (installer && installer.supported && !installer.bundledExtensionExists) {
    return <ScreensaverUnavailable installer={installer} />
  }

  return (
    <div className="flex h-screen">
      <Sidebar session={session} />
      <main className="flex-1 overflow-y-auto">
        {/* Draggable titlebar strip, as tall as the sidebar's top inset (pt-8). */}
        <div className="titlebar-drag h-8 sticky top-0 z-30 bg-background/95 backdrop-blur-sm" />
        <Routes>
          <Route path="/gallery" element={<GalleryPage session={session} />} />
          <Route path="/account" element={<AccountPage session={session} />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/gallery" replace />} />
        </Routes>
      </main>
    </div>
  )
}
