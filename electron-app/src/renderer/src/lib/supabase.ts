import { createClient } from '@supabase/supabase-js'

// These are public anon keys — safe to include in client code
const SUPABASE_URL = 'https://fcrkikggdvgshuopshgm.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmtpa2dnZHZnc2h1b3BzaGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTAyNTUsImV4cCI6MjA4OTEyNjI1NX0.ia0iWugP97L0cOX4OTI20vB9C3U1_f4w84Xumjsvc7c'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Electron stores session in localStorage (Chromium provides this)
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const GALLERY_ENDPOINT = 'https://living-art-screensaver.com/api/gallery'
