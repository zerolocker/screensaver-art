import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'

// Stores Electron-app debug reports in the `user-error-reports` Supabase Storage
// bucket. Reports are uploaded by the desktop app (Bearer-authenticated) for
// later diagnosis — see electron-app/src/main/report.ts.
//
// Uses the service role so writes bypass storage RLS; the bucket stays private
// and is never read by clients. Reports are namespaced per user id.

const BUCKET = 'user-error-reports'
const MAX_BYTES = 1_000_000 // ~1 MB cap; reports are small JSON

// Service role client (server-only) — bypasses RLS for the private bucket.
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
    return NextResponse.json({ error: 'Report missing or too large' }, { status: 413 })
  }

  let report: { id?: string; reason?: string }
  try {
    report = JSON.parse(raw)
    if (typeof report !== 'object' || report === null) throw new Error('not an object')
  } catch {
    return NextResponse.json({ error: 'Invalid JSON report' }, { status: 400 })
  }

  const id = sanitizeId(report.id)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `${user.id}/${stamp}-${id}.json`

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, raw, { contentType: 'application/json', upsert: false })

  if (error) {
    console.error('error-report upload failed:', error.message)
    return NextResponse.json({ error: 'Failed to store report' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id, path })
}
