import { NextRequest, NextResponse, after } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'

/**
 * POST /api/download-link: emails a phone visitor a link to open on their Mac.
 * Supabase's mailer sends it, through `inviteUserByEmail`, or
 * `resetPasswordForEmail` for an existing user. Both templates carry the same
 * plain link to the home page. See docs/download-link-email.md.
 *
 * Unauthenticated by design. Abuse is limited by Supabase's email rate limits,
 * an email check, and a honeypot field.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// resetPasswordForEmail needs no service role.
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

  // Honeypot: real users leave this hidden field empty. Pretend success.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const location = typeof body.location === 'string' ? body.location.slice(0, 40) : 'unknown'

  let newUser = true
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)

  if (inviteError) {
    if (isRateLimited(inviteError)) {
      return NextResponse.json(
        { error: "You've requested this a few times — please wait a minute and try again." },
        { status: 429 },
      )
    }
    if (isAlreadyRegistered(inviteError)) {
      // Existing user: send the same email through the recovery template.
      newUser = false
      const { error: resetError } = await supabaseAnon.auth.resetPasswordForEmail(email)
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

  // Server-side, so ad blockers can't drop it.
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

// Reuse the visitor's PostHog id from its cookie, or mint an anonymous one.
function distinctId(request: NextRequest): string {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const raw = token ? request.cookies.get(`ph_${token}_posthog`)?.value : undefined
  if (raw) {
    try {
      const id = JSON.parse(decodeURIComponent(raw))?.distinct_id
      if (typeof id === 'string' && id) return id
    } catch {
      /* malformed cookie */
    }
  }
  return `anon-download-${randomUUID()}`
}
