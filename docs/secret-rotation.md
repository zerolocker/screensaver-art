# Secret rotation runbook

Some third-party Auth secrets **expire** and must be regenerated before they do,
or social sign-in breaks for everyone. They live in the **Supabase dashboard**
(Authentication → Providers), not in this repo or in any env file — so the repo
can only hold the *schedule* and the *procedure*, which is what this runbook +
the automated reminder are for.

## What needs rotating

| Secret | Where it lives | Cadence (max life) | Last rotated | Next due |
|---|---|---|---|---|
| **Apple** — Sign in with Apple client secret (a JWT) | Supabase → Auth → Providers → **Apple** → "Secret Key (for OAuth)" | **6 months** (Apple's hard cap on the JWT `exp`) | 2026-06-08 | **2026-12-08** |
| **Microsoft (Azure)** — client secret | Supabase → Auth → Providers → **Azure** → "Secret Value" | **24 months** (Azure's max secret lifetime) | 2026-06-08 | **2028-06-08** |

> Apple's *private key* (the `.p8`) does **not** expire — only the short-lived
> JWT *client secret* derived from it does. Rotating Apple = generating a fresh
> JWT from the same `.p8`, not creating a new key.

## How the reminder works (automated)

- The dates above are mirrored in [`.github/secret-rotation.json`](../.github/secret-rotation.json) — **that file is the source of truth** the automation reads.
- [`.github/workflows/secret-rotation-reminder.yml`](../.github/workflows/secret-rotation-reminder.yml) runs **weekly** (Mondays 14:00 UTC) and opens a GitHub issue (label `secret-rotation`) once a secret is within its lead window of the due date (Apple: 21 days out; Azure: 30 days). It updates the existing issue rather than spamming new ones, and flags **OVERDUE** if the date passes.
- Scheduled workflows only run from the **default branch (`master`)**, so this begins firing once merged to `master`. To test before then: Actions → "Secret rotation reminder" → **Run workflow** → `dry_run = true`.

## After you rotate (do this every time)

1. Update the secret in Supabase (steps below).
2. Bump `last_rotated` for that entry in [`.github/secret-rotation.json`](../.github/secret-rotation.json) to today's date, and update the **Last rotated / Next due** cells in the table above.
3. Close the reminder issue. The next cycle's reminder will compute from the new date automatically.

---

## Rotating the Apple client secret

Full provider walkthrough: <https://supabase.com/docs/guides/auth/social-login/auth-apple>

The client secret is a JWT signed with your Sign in with Apple `.p8` key, with an
`exp` no more than 6 months out. You reuse the **same** `.p8`, Key ID, Team ID,
and Services ID (the `client_id`) — only the JWT is regenerated.

1. Gather (one-time, unchanged between rotations): the **Services ID** (client_id), **Team ID**, **Key ID**, and the **`.p8`** private key from the [Apple Developer portal](https://developer.apple.com/account/resources/authkeys/list). If the `.p8` was lost, create a new key under **Certificates, Identifiers & Profiles → Keys** and use its Key ID.
2. Generate a fresh client-secret JWT (`exp` ≤ 6 months) using the script in the Supabase doc above (the "Generating a client secret" section).
3. Supabase Dashboard → **Authentication → Providers → Apple** → paste the new JWT into **"Secret Key (for OAuth)"** → **Save**.
4. Verify: sign in with Apple from the website and the Electron app.
5. Do the [After you rotate](#after-you-rotate-do-this-every-time) steps.

## Rotating the Microsoft (Azure) client secret

Full provider walkthrough: <https://supabase.com/docs/guides/auth/social-login/auth-azure>

1. [Azure Portal](https://portal.azure.com) → **App registrations** → the Living Art app → **Certificates & secrets → Client secrets → New client secret**. Set expiry up to **24 months**; **copy the secret _Value_ immediately** (it's only shown once).
2. Supabase Dashboard → **Authentication → Providers → Azure** → paste it into **"Secret Value"** → **Save**. (The Application/Client ID and `azure` tenant config are unchanged.)
3. Verify: sign in with Microsoft from the website and the Electron app.
4. Delete the **old** secret in Azure (Certificates & secrets) once the new one is confirmed working.
5. Do the [After you rotate](#after-you-rotate-do-this-every-time) steps.
