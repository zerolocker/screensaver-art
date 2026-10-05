# Rotating sign-in secrets

Two sign-in secrets expire. If one does, that sign-in option breaks for everyone. Both live in the Supabase dashboard (Authentication → Providers), not in this repo.

| Secret | Supabase field | Max life | Last rotated | Next due |
|---|---|---|---|---|
| Apple client secret (a JWT) | Apple → "Secret Key (for OAuth)" | 6 months | 2026-06-08 | **2026-12-08** |
| Microsoft (Azure) client secret | Azure → "Secret Value" | 24 months | 2026-06-08 | **2028-06-08** |

A weekly GitHub Action ([`secret-rotation-reminder.yml`](../.github/workflows/secret-rotation-reminder.yml)) opens an issue labeled `secret-rotation` when a due date is close (Apple: 21 days, Azure: 30 days). It reads the dates from [`.github/secret-rotation.json`](../.github/secret-rotation.json). To test it, run the workflow manually with `dry_run = true`.

## After every rotation

1. Set `last_rotated` for that secret in `.github/secret-rotation.json` to today.
2. Update the table above.
3. Close the reminder issue.

## Apple

Supabase guide: <https://supabase.com/docs/guides/auth/social-login/auth-apple>

Only the JWT expires. The `.p8` key, Key ID, Team ID and Services ID stay the same.

1. Get the Services ID, Team ID, Key ID and `.p8` file from the [Apple Developer portal](https://developer.apple.com/account/resources/authkeys/list). If the `.p8` is lost, create a new key and use its Key ID.
2. Generate a new JWT that expires within 6 months, using the script in the Supabase guide.
3. Paste it into Supabase → Authentication → Providers → Apple → "Secret Key (for OAuth)" and save.
4. Test Apple sign-in on the website and in the app.

## Microsoft (Azure)

Supabase guide: <https://supabase.com/docs/guides/auth/social-login/auth-azure>

1. In the [Azure Portal](https://portal.azure.com), open App registrations → the Living Art app → Certificates & secrets → New client secret. Set the expiry to 24 months and copy the **Value** right away; it is shown only once.
2. Paste it into Supabase → Authentication → Providers → Azure → "Secret Value" and save.
3. Test Microsoft sign-in on the website and in the app.
4. Delete the old secret in Azure.
