export interface Product {
  id: string
  name: string
  description: string
  features: string[]
}

// Registry of purchasable products. NOTE: the *charged price* is NOT here — it
// lives in Stripe as a catalog Price (referenced via the STRIPE_PRICE_ID env
// var, different ID per test/live). The *displayed price* is in
// `@screensaver-art/constants`' `PRICING`. Keep this file to display metadata
// only so there is no third copy of the price to drift out of sync.
export const PRODUCTS: Product[] = [
  {
    id: 'living-art-monthly',
    name: 'Living Art Screensaver',
    description: 'Transform your Mac into a living art gallery',
    // Single source of truth for the pricing-page feature checklist.
    features: [
      'Unlock all artworks',
      'New pieces added every night',
      'Cancel anytime',
    ],
  },
]

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}
