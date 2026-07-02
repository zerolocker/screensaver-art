import { NextRequest, NextResponse, after } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'

/**
 * POST /api/download-link  —  emails a macOS download link to a visitor.
 *
 * Mobile visitors can't install the Mac app on their phone, so instead of a
 * dead "Download" button we capture their email here and send a link they can
 * open on their Mac. The email is sent through Supabase's built-in mailer (the
 * only mailer this project has) via `inviteUserByEmail`; the link's `redirectTo`
 * lands on `/download/start`, which tracks the click and starts the DMG.
 *
 * Existing emails can't be re-invited (inviteUserByEmail 422s), so we fall back
 * to `resetPasswordForEmail`, which delivers the same link to an existing user.
 * Both the "Invite user" and "Reset Password" auth templates are otherwise
 * unused in this passwordless project and are repurposed with identical
 * download-link copy — see docs/download-link-email.md.
 *
 * Public + unauthenticated by design (visitors aren't logged in). Abuse is
 * bounded by Supabase's per-address + per-project email rate limits, an email
 * shape check, and a honeypot field.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// Anon client for resetPasswordForEmail (the existing-user fallback) — mirrors
// how the browser would call it, and needs no service role.
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST(request: NextRequest) {
  let body: { email?: unknown; location?: unknown; company?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Honeypot: real users leave this hidden field empty. Pretend success so bots
  // learn nothing, but send nothing.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const location = typeof body.location === 'string' ? body.location.slice(0, 40) : 'unknown'
  const redirectTo = `${resolveOrigin(request)}/download/start`

  // ── Send the link ──────────────────────────────────────────────────────────
  let newUser = true
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  })

  if (inviteError) {
    if (isRateLimited(inviteError)) {
      return NextResponse.json(
        { error: "You've requested this a few times — please wait a minute and try again." },
        { status: 429 },
      )
    }
    if (isAlreadyRegistered(inviteError)) {
      // Existing user: deliver the same link via the recovery mailer instead.
      newUser = false
      const { error: resetError } = await supabaseAnon.auth.resetPasswordForEmail(email, {
        redirectTo,
      })
      if (resetError) {
        if (isRateLimited(resetError)) {
          return NextResponse.json(
            { error: "You've requested this a few times — please wait a minute and try again." },
            { status: 429 },
          )
        }
        console.error('[download-link] reset fallback failed:', resetError.message)
        return NextResponse.json({ error: "Couldn't send the email. Please try again." }, { status: 502 })
      }
    } else {
      console.error('[download-link] invite failed:', inviteError.message)
      return NextResponse.json({ error: "Couldn't send the email. Please try again." }, { status: 502 })
    }
  }

  // Ad-blocker-safe funnel event (the client also fires `download_email_submitted`).
  getPostHogClient().capture({
    distinctId: distinctId(request),
    event: 'download_link_requested',
    properties: { location, new_user: newUser },
  })
  after(flushPostHog)

  return NextResponse.json({ ok: true })
}

function isAlreadyRegistered(err: { code?: string; status?: number; message?: string }): boolean {
  return (
    err.code === 'email_exists' ||
    err.code === 'user_already_exists' ||
    /already.*registered|already.*exists/i.test(err.message ?? '')
  )
}

function isRateLimited(err: { code?: string; status?: number; message?: string }): boolean {
  return err.status === 429 || err.code === 'over_email_send_rate_limit' || /rate limit/i.test(err.message ?? '')
}

// Reuse the visitor's posthog distinct_id (set by posthog-js) so the request
// stitches onto the same person; mint an anonymous id when there's no cookie.
function distinctId(request: NextRequest): string {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const raw = token ? request.cookies.get(`ph_${token}_posthog`)?.value : undefined
  if (raw) {
    try {
      const id = JSON.parse(decodeURIComponent(raw))?.distinct_id
      if (typeof id === 'string' && id) return id
    } catch {
      /* malformed cookie — fall through */
    }
  }
  return `anon-download-${randomUUID()}`
}

// Behind Vercel's proxy the public host is in x-forwarded-host (mirrors /api/checkout).
function resolveOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${forwardedHost}`
  }
  return new URL(request.url).origin
}
