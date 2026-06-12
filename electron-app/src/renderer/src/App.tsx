import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase, getStoredSession } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { startOAuth, completeOAuthFromUrl, type OAuthProvider } from './lib/oauth'
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

// How long to wait for getSession() to validate/refresh the token at startup
// before falling back to the stored session. Comfortably covers a normal online
// refresh (a few hundred ms) without making an offline launch sit on a spinner.
const INITIAL_SESSION_TIMEOUT_MS = 2000

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const navigate = useNavigate()

  // OAuth round-trips through the system browser and returns via a livingart://
  // deep link. The main process forwards that URL here; we exchange it for a
  // session (which then emits SIGNED_IN and navigates to the gallery).
  useEffect(() => {
    return window.electronAPI.auth.onCallback(async (url) => {
      const { error } = await completeOAuthFromUrl(url)
      if (error) setOauthError(error)
      setOauthPending(null)
    })
  }, [])

  async function handleStartOAuth(provider: OAuthProvider): Promise<void> {
    setOauthError(null)
    setOauthPending(provider)
    const { error } = await startOAuth(provider)
    if (error) {
      setOauthError(error)
      setOauthPending(null)
    }
  }

  useEffect(() => {
    let cancelled = false

    // Decide the initial auth state without letting an offline/slow network hang
    // the UI. getSession() returns a *validated, refreshed* session when it can,
    // but if the stored access token is expired and we're offline it retries the
    // refresh for ~25s before giving up — which would freeze startup on a spinner.
    // So we race it against a short timeout and, if it doesn't win, fall back to
    // the session supabase-js already has in storage.
    //
    // Why the stored fallback matters: it keeps the user signed in for everything
    // that doesn't need the network — browsing the cached gallery, setting the
    // screensaver, viewing the account — instead of bouncing them to login or
    // hanging just because they're offline. Two ways that happens at launch:
    //
    //   • "Offline at cold start": right after launch the network often isn't up
    //     yet (Wi-Fi reconnecting after sleep/wake, the OS still bringing up
    //     networking after login/boot), so the refresh HTTPS call to Supabase
    //     fails even though the stored session is valid.
    //
    //   • "Throttled renderer": this runs in an Electron (Chromium) renderer,
    //     which suspends/throttles timers and network in hidden or just-woken
    //     windows to save power, stalling the refresh request mid-flight.
    //
    // supabase-js auto-refreshes the token and emits TOKEN_REFRESHED (handled
    // below) once connectivity returns, swapping the stale session for a fresh
    // one. This also fixed the older "it asked me to sign in again, but relaunching
    // signed me right back in" bug (a transient refresh failure no longer logs you
    // out). A genuinely revoked session is cleared by supabase-js before
    // getSession() returns, so getStoredSession() yields null → the login screen.
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
        // No fresh session in time. Fall back to the persisted session: present
        // ⇒ stay signed in (offline / slow refresh); absent ⇒ genuinely signed
        // out (getSession returns null fast when nothing is stored).
        const stored = getStoredSession()
        if (stored) {
          log.info('auth', 'using stored session at startup; will refresh when online')
        }
        setSession(stored)
      }
      setLoading(false)
    }

    void resolveInitialSession()

    // Listen for auth changes. We deliberately ignore INITIAL_SESSION here — it
    // reports null on the same transient/offline failure above and would clobber
    // the stored-session fallback; resolveInitialSession owns the initial decision.
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
                <LoginPage
                  oauthPending={oauthPending}
                  oauthError={oauthError}
                  onStartOAuth={handleStartOAuth}
                />
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
          <AuthedShell session={session} />
        </UpdateProvider>
      </InstallerProvider>
    </SyncProvider>
  )
}

// The signed-in app shell. Lives inside InstallerProvider so it can short-circuit
// to a recovery screen when the embedded screensaver component is missing (a
// damaged/incomplete install) — without it the app can't do its one job.
function AuthedShell({ session }: { session: Session }) {
  const { installer } = useInstaller()

  if (installer && installer.supported && !installer.bundledExtensionExists) {
    return <ScreensaverUnavailable installer={installer} />
  }

  return (
    <div className="flex h-screen">
      <Sidebar session={session} />
      <main className="flex-1 overflow-y-auto">
        <div className="titlebar-drag h-10 sticky top-0 z-10" />
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
