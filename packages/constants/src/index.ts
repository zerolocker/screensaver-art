// @screensaver-art/constants — pure-data shared constants, configs, and types.
//
// No React, no Node APIs, no runtime dependencies, so this barrel is safe to
// import from anywhere: the Next.js website (client + server routes + edge),
// the Electron app (main + renderer), and node test environments.

// Gallery data — item shape, API contract, tag vocabulary + helpers, free tier.
export type { ArtItem, GalleryApiResponse } from './gallery'
export {
  FREE_ITEM_COUNT,
  UNDATED_FALLBACK,
  MISC_TAG,
  TAG_ORDER,
  tagsOf,
  orderTags,
  matchesQuery,
  isItemFree,
  isItemLocked,
} from './gallery'

// Pricing — the displayed price/cadence/promo framing (not what Stripe charges),
// the paid-plan vocabulary, and the single full-access rule.
export { PRICING, isSubscriptionActive, normalizeSubscriptionStatus } from './pricing'
export type { PaidPlan, SubscriptionAccess, SubscriptionStatus } from './pricing'
