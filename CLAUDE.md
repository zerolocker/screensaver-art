# Screensaver Art — Project Reference

## What this project is
A monorepo containing:
- **macOS screensaver** (`screensaver/`) — native Swift app sold via subscription
- **Marketing + account website** (`living-art-screensaver-web/`) — Next.js, deployed to `living-art-screensaver.com` via Vercel
- **Gallery playlist** (`gallery.json`) — single source of truth for all art items
- **Web preview** (`index.html`) — standalone HTML+CSS+JS, no build step

## Key paths
| Path | Purpose |
|---|---|
| `index.html` | Standalone web preview (HTML+CSS+JS, no build step) |
| `gallery.json` | Playlist — all art items with `src`, `title`, `type`, `collection`, `date`, prompts |
| `R2 Bucket` | `https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/` — MP4 assets |
| `screensaver/ScreensaverArtView.swift` | Entire native screensaver in one file |
| `screensaver/Info.plist` | Bundle metadata (CFBundleIdentifier, NSPrincipalClass) |
| `screensaver/build.sh` | Build + install script |
| `living-art-screensaver-web/` | Next.js website (marketing, auth, billing, gallery API) |
| `living-art-screensaver-web/app/api/gallery/route.ts` | **The gating endpoint** — serves gallery to the macOS app |
| `living-art-screensaver-web/app/api/subscription/verify/route.ts` | Subscription status check |
| `living-art-screensaver-web/app/api/webhooks/stripe/route.ts` | Stripe → Supabase sync |

## Build & install the screensaver
```bash
bash screensaver/build.sh --install
# kills cached processes, compiles, installs to ~/Library/Screen Savers/ScreensaverArt.saver
```

## Website (living-art-screensaver-web)
```bash
cd living-art-screensaver-web
pnpm install   # first time / after pulling
pnpm dev       # localhost:3000
```
- Deployed on **Vercel** (project `v0-living-art-screensaver`, team `gavin-1a51c3e5`)
- Vercel is connected to **this repo** (`zerolocker/screensaver-art`), root directory set to `living-art-screensaver-web/`
- Auto-deploys on push to `master`
- Uses **pnpm** — do not use npm or yarn

## Infrastructure
| Service | What it does |
|---|---|
| **Supabase** | Auth (email/password) + `subscriptions` table |
| **Stripe** | Payments — $0.99/month, single tier |
| **Cloudflare R2** | Hosts MP4 video assets (public, no auth) |
| **Vercel** | Hosts the Next.js website |
| **GitHub Pages** | Hosts `gallery.json` at `https://tempzero-clawd.github.io/screensaver-art/gallery.json` |

## Add new art pieces
1. Upload MP4 to Cloudflare R2 bucket `screensaver-assets` under the `gallery/` prefix.
2. Add an entry to `gallery.json` — include `src` (full R2 URL), `title`, `type`, `date`, `collection`, `image_prompt`, `video_prompt`.
3. Push to GitHub — the screensaver picks it up on next launch (no rebuild needed).

---

## Subscription & Gating Architecture

### The product model
- Users subscribe at `living-art-screensaver.com` ($0.99/month via Stripe)
- **Subscribed**: see all gallery items
- **Not subscribed / not logged in**: see first 2 items only + upsell overlay after one loop

### Why Option B (server-side gating) not Option A (client-side)
We chose to gate the gallery server-side via `/api/gallery` rather than just limiting on the client. This prevents the full URL list from being trivially readable. The MP4s themselves are still public on R2 (no signed URLs) — this is an acceptable tradeoff for a $0.99 product. If piracy becomes a real problem, add Cloudflare signed URLs (Option C).

### `/api/gallery` endpoint (the key piece)
```
GET https://living-art-screensaver.com/api/gallery?collection=classic
Authorization: Bearer <supabase_access_token>
```
Response: `{ items: GalleryItem[], isSubscribed: boolean, totalCount: number }`
- Active subscriber → full gallery filtered by collection
- No token / unsubscribed → first 2 items only
- Never returns 401 — always returns something so the screensaver has content

### Auth flow in the macOS app
1. User opens **System Settings → Screen Saver → Options** (the configure sheet)
2. Enters email + password in the native form
3. Swift calls `POST /auth/v1/token?grant_type=password` on Supabase directly
4. Access token + refresh token stored in **macOS Keychain**
5. On each screensaver activation: read Keychain → refresh token silently → call `/api/gallery`
6. Subscription status cached locally (24h TTL); **fail open** on network failure

### Why refresh tokens (not long-lived access tokens)
- **Revocation**: JWTs are stateless — a short-lived access token (1h) bounds the damage window after a subscription cancels or account compromise. Refresh tokens are checked server-side.
- **Token rotation**: Supabase rotates refresh tokens on use. If an attacker steals and uses a refresh token first, the legitimate user's next refresh fails — a detectable signal. Long-lived tokens give no such signal.
- **Blast radius**: Access tokens go to every API endpoint; refresh tokens only go to the auth server. Fewer places to leak from.

### Offline support
- `gallery.json` response cached to `~/Library/Caches/ScreensaverArt/gallery.json` after every successful fetch
- MP4s cached to `~/Library/Caches/ScreensaverArt/videos/` as they play (passive warming)
- First 2 videos pre-cached eagerly on login (always available offline)
- LRU eviction at 2 GB cap
- On network failure: play from cache, use cached subscription status (fail open)

### Collection support (future-proofing)
- Every `gallery.json` entry has a `collection` field (currently all `"classic"`)
- `/api/gallery?collection=<name>` filters server-side
- The macOS app passes the user's selected collection (stored in UserDefaults)
- To add a new collection: add items to `gallery.json` with a new `collection` value — no API changes needed
- To gate collections by subscription tier: add tier logic to the `/api/gallery` route

### Supabase `subscriptions` table schema
```
id                    uuid
user_id               uuid  FK → auth.users
stripe_customer_id    text
stripe_subscription_id text
status                text  ('active' | 'trialing' | 'inactive' | 'cancelled' | 'past_due')
current_period_start  timestamp
current_period_end    timestamp
updated_at            timestamp
```
`isActive` = status is `active` OR `trialing`

### Native Supabase client (for macOS app requests)
The website's default Supabase client uses cookies (for browser sessions). The macOS app sends a Bearer token instead. Use `lib/supabase/native-client.ts` which creates a `@supabase/supabase-js` client with `Authorization: Bearer <token>` in the global headers — **not** the SSR cookie client.

---

## Screensaver internals (Swift)

### Key classes in ScreensaverArtView.swift
| Class | Responsibility |
|---|---|
| `AuthManager` | Supabase REST auth, Keychain token storage, token refresh |
| `SubscriptionCache` | 24h local cache of `isActive` + `totalCount` in UserDefaults |
| `VideoCache` | File-based MP4 cache, LRU eviction, gallery JSON persistence |
| `GalleryFetcher` | Calls `/api/gallery`, falls back to cached JSON offline |
| `ConfigureSheetController` | Native login/logout panel (System Settings → Options) |
| `UpsellOverlay` | Full-screen overlay shown after free content loops; auto-dismisses in 30s |
| `ScreensaverArtView` | Main screensaver view — A/B CALayer crossfade, 8s timer, orchestrates everything |

### Supabase credentials (safe to hardcode — these are public anon keys)
- URL: `https://fcrkikggdvgshuopshgm.supabase.co`
- Anon key: in `ScreensaverArtView.swift` under `API` enum

### Configure sheet
`hasConfigureSheet = true` — accessible via the Options button in System Settings → Screen Saver. Shows login form when logged out, subscription status + logout when logged in.

---

## Repo history
- `living-art-screensaver-web` was originally a separate repo (`zerolocker/living-art-screensaver-web`).
  It was merged into this repo on 2026-03-22 via `git subtree add --prefix=living-art-screensaver-web ... --squash`.
  The old repo is archived and read-only.
