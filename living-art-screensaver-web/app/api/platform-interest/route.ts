import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'

/**
 * POST /api/platform-interest  —  records a cross-platform demand vote + email.
 *
 * Living Art is Mac-only, so the site offers a "want it on Windows / iPad / iOS
 * / TV?" probe. The user self-reports the platforms they want (step 1, tracked
 * on the client) and optionally leaves an email (step 2). This route persists
 * the email + platforms so we can (a) email them when a platform ships and
 * (b) *measure real demand* — the vote counts, not a guess, decide what we build.
 *
 * One row per (email, platform) in `waitlist_signups`, via the service role.
 * Idempotent per (email, platform) so re-submits don't pile up. One-time table
 * setup (run once in the Supabase SQL editor):
 *
 *   create table if not exists public.waitlist_signups (
 *     id uuid primary key default gen_random_uuid(),
 *     email text not null,
 *     platform text not null default 'windows',
 *     location text,
 *     created_at timestamptz not null default now(),
 *     unique (email, platform)
 *   );
 *   alter table public.waitlist_signups enable row level security;
 *
 * RLS stays on with NO policy → only the service-role key (this route) can
 * read/write it; the anon/browser client never can.
 *
 * Public + unauthenticated by design (visitors aren't logged in). Abuse is
 * bounded by an email-shape check, a length cap, a platform allow-list, and a
 * honeypot field.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_PLATFORMS = new Set(['windows', 'ipad', 'ios', 'tv', 'android-phone', 'android-tablet'])

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST(request: NextRequest) {
  let body: { email?: unknown; platforms?: unknown; location?: unknown; company?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Honeypot: real users leave this hidden field empty. Pretend success so bots
  // learn nothing, but store nothing.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const platforms = Array.isArray(body.platforms)
    ? [...new Set(body.platforms.filter((p): p is string => typeof p === 'string' && ALLOWED_PLATFORMS.has(p)))]
    : []
  if (platforms.length === 0) {
    return NextResponse.json({ error: 'Pick at least one platform.' }, { status: 400 })
  }

  const location = typeof body.location === 'string' ? body.location.slice(0, 40) : 'unknown'

  const rows = platforms.map((platform) => ({ email, platform, location }))
  const { error } = await supabaseAdmin
    .from('waitlist_signups')
    .upsert(rows, { onConflict: 'email,platform', ignoreDuplicates: true })

  if (error) {
    console.error('[platform-interest] insert failed', error)
    return NextResponse.json({ error: "Couldn't save that. Please try again." }, { status: 500 })
  }

  // Server-side conversion event (ad-blocker-safe). The client already fired the
  // step-1 vote (`platform_interest_selected`); this is the email-provided event.
  getPostHogClient().capture({
    distinctId: email,
    event: 'platform_interest_submitted',
    properties: { platforms, location },
  })
  after(flushPostHog)

  return NextResponse.json({ ok: true })
}
