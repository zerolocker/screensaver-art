# "Email me the download link"

Phone visitors can't install the Mac app, so their Download button opens a form that emails them a link to open on their Mac. Supabase's built-in mailer sends it.

1. The visitor enters an email. `POST /api/download-link` calls `inviteUserByEmail`, or `resetPasswordForEmail` if the email already has an account (the invite returns 422).
2. The email's button is a plain link to `{{ .SiteURL }}/?src=email-download`, not `{{ .ConfirmationURL }}`. The click goes straight to the home page, with no auth token and no redirect allow-list to configure.
3. On the home page, `EmailArrivalTracker` fires `download_email_link_clicked` and starts the download.

Each new email becomes a Supabase user. That's intended: if they sign in to the app later with that email, it's the same account.

PostHog funnel: `download_email_modal_opened` → `download_email_submitted` → `download_link_requested` (server) → `download_email_link_clicked` → `download_served`.

## Supabase setup (once)

The project is passwordless and sends no invites or password resets, so both of those templates are reused. In Supabase → Authentication → Email Templates, paste the HTML below into both **Invite user** and **Reset Password**, with the subject `Your Living Art download link`. If real invites or password resets are ever needed, split them back out (see `app/api/download-link/route.ts`).

```html
<div style="margin:0;padding:0;background-color:#0b0b0c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0b0c;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#141416;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
          <tr>
            <td style="padding:36px 36px 8px 36px;" align="left">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;">Living Art Screensaver</td>
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
            <td style="padding:20px 36px 36px 36px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:16px 0 0 0;color:#6a6a6e;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;">
                If you didn't request this, you can safely ignore this email.<br />
                <a href="https://living-art-screensaver.com" style="color:#9EE8A2;text-decoration:none;">living-art-screensaver.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

For production, set up a custom SMTP provider (Resend, Postmark or SES) with SPF, DKIM and DMARC. Supabase's built-in mailer is shared and rate-limited.
