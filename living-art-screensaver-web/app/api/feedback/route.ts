import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'

// Stores feedback from the app and the website (a message plus an optional
// image, downsized by the client) in the private `user-error-reports` bucket
// under `feedback/<user id>/`. Requires a Bearer token.

const BUCKET = 'user-error-reports'
const MAX_BYTES = 1_000_000 // ~1 MB cap — matches the bucket's per-file limit

// Service role: bypasses RLS.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function sanitizeId(raw: unknown): string {
  const fallback = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  if (typeof raw !== 'string') return fallback
  // Keep filenames safe: allow only id-ish characters.
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80)
  return cleaned || fallback
}

export async function POST(request: NextRequest) {
  const { user } = await verifyNativeAuth(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = await request.text()
  if (!raw || raw.length > MAX_BYTES) {
    return NextResponse.json({ error: 'Feedback missing or too large' }, { status: 413 })
  }

  let feedback: { id?: string; message?: string }
  try {
    feedback = JSON.parse(raw)
    if (typeof feedback !== 'object' || feedback === null) throw new Error('not an object')
  } catch {
    return NextResponse.json({ error: 'Invalid JSON feedback' }, { status: 400 })
  }

  const id = sanitizeId(feedback.id)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `${user.id}/feedback/${stamp}-${id}.json`

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, raw, { contentType: 'application/json', upsert: false })

  if (error) {
    console.error('feedback upload failed:', error.message)
    return NextResponse.json({ error: 'Failed to store feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id, path })
}
