import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { startOAuth, completeOAuthFromUrl, type OAuthProvider } from './lib/oauth'
import { LoginPage } from './pages/Login'
import { SignUpPage } from './pages/SignUp'
import { OtpPage } from './pages/Otp'
import { GalleryPage } from './pages/Gallery'
import { AccountPage } from './pages/Account'
import { HelpPage } from './pages/Help'
import { Sidebar } from './pages/Sidebar'

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
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      // Only navigate on actual sign-in/sign-out, not token refreshes
      if (event === 'SIGNED_IN') {
        navigate('/gallery')
      } else if (event === 'SIGNED_OUT') {
        navigate('/login')
      }
    })

    return () => subscription.unsubscribe()
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
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/otp" element={<OtpPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </div>
    )
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
