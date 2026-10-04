// Shared constants and types. No React, Node APIs or dependencies, so it can be
// imported anywhere.

// Gallery
export type { ArtItem, ArtSource, ArtLicense, GalleryApiResponse } from './gallery'
export {
  ART_LICENSES,
  PROVENANCE_FIELDS,
  REQUIRED_PROVENANCE_FIELDS,
  isRealArtwork,
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

// Pricing and access
export { PRICING, isSubscriptionActive } from './pricing'
export type { PaidPlan, SubscriptionAccess } from './pricing'
