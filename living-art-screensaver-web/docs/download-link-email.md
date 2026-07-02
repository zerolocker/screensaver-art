# "Email me the download link" — Supabase setup

Mobile visitors can't install the macOS app on their phone, so their **Download**
CTA opens a dialog that emails them a link to open on their Mac. This is powered
by Supabase's built-in mailer.

## How it works

1. Mobile visitor taps a Download CTA → dialog → enters email.
2. `POST /api/download-link` triggers the send (Supabase is only the mailer):
   - **New email** → `supabase.auth.admin.inviteUserByEmail(email)`
   - **Existing email** (invite 422s) → `supabase.auth.resetPasswordForEmail(email)`
3. Supabase sends the email. **The button links straight to
   `https://living-art-screensaver.com/?src=email-download`** — a plain link, NOT
   `{{ .ConfirmationURL }}`. So the click goes directly to the home page; it never
   passes through Supabase's verify endpoint and carries no auth token.
4. `EmailArrivalTracker` on the home page fires the **`download_email_link_clicked`**
   PostHog event (the click metric) and starts the DMG.

### Analytics funnel (PostHog)
`download_email_modal_opened` → `download_email_submitted` (client) →
`download_link_requested` (server, ad-blocker-safe) →
**`download_email_link_clicked`** (the "how many clicked the email link" count) →
`download_served` (existing server event on the DMG redirect).

## ⚠️ One-time Supabase configuration

Because the email button is a **plain link** (not `{{ .ConfirmationURL }}`),
there's **no redirect-URL allowlist to configure** — the link goes straight to
the site. The only setup is pasting the template.

### Paste the email template
This project is **passwordless** and doesn't use invites, so the **Invite user**
and **Reset Password** templates are free to repurpose. Paste the HTML below into
**both** (Authentication → Email Templates → *Invite user* and *Reset Password*)
so new and returning visitors get the identical email.

> If you ever add real invites or password reset, you'll need to split these
> back out — see `app/api/download-link/route.ts`.

Subject (both): `Your Living Art download link`

```html
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#0b0b0c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0b0c;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#141416;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
            <tr>
              <td style="padding:36px 36px 8px 36px;" align="left">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;"><img src="{{ .SiteURL }}/apple-icon.png" width="40" height="40" alt="Living Art" style="display:block;border-radius:11px;" /></td>
                    <td style="padding-left:12px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;">Living Art Screensaver</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 0 36px;">
                <h1 style="margin:0;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;font-weight:700;">
                  Your download is ready
                </h1>
                <p style="margin:14px 0 0 0;color:#b7b7ba;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;">
                  Thanks for your interest in Living Art. <strong style="color:#ffffff;">Open this email on your Mac</strong> and click below to download the app — centuries of art, animated and hung on your idle display.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 36px 8px 36px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center" bgcolor="#9EE8A2" style="border-radius:999px;">
                      <a href="{{ .SiteURL }}/?src=email-download" target="_blank"
                         style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#0a1f12;text-decoration:none;border-radius:999px;">
                        Download for Mac
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 36px 4px 36px;">
                <p style="margin:0;color:#7c7c80;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.5;text-align:center;">
                  Requires macOS. Free to download.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 36px 36px;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:16px 0 0 0;color:#6a6a6e;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;">
                  If you didn't request this, you can safely ignore this email.<br />
                  <a href="{{ .SiteURL }}" style="color:#9EE8A2;text-decoration:none;">living-art-screensaver.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

### Notes
- The button is a **plain link** to `{{ .SiteURL }}/?src=email-download` (the home
  page). `{{ .SiteURL }}` resolves to your configured Supabase Site URL, so it
  doesn't hardcode the domain. It deliberately does **not** use
  `{{ .ConfirmationURL }}` — see the top of `app/api/download-link/route.ts`.
- The `?src=email-download` param is how the home page counts the click
  (`download_email_link_clicked`) and starts the download.
- The button uses the brand mint `#9EE8A2` on a dark card, matching the site.
- `inviteUserByEmail` creates an auth user for each new email — that's an
  intentional lead-capture side effect (when they later sign in with the same
  email in the app, it's the same account).
- **Deliverability**, not link routing, is the thing to watch: Supabase's built-in
  SMTP is shared and rate-limited, so for production configure a custom SMTP
  provider (Resend/Postmark/SES) with SPF/DKIM/DMARC on your sending domain.
