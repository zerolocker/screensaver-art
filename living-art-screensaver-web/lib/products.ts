import type { PaidPlan } from '@screensaver-art/constants'

export interface Product {
  id: string
  name: string
  description: string
  /** Which Stripe checkout this product maps to (recurring vs one-time). */
  plan: PaidPlan
  features: string[]
}

// Product names and features only. Prices live in Stripe and in `PRICING`;
// don't add a third copy here.
export const PRODUCTS: Product[] = [
  {
    id: 'living-art-monthly',
    name: 'Living Art Screensaver',
    description: 'Transform your Mac into a living art gallery',
    plan: 'monthly',
    features: [
      'Unlock all artworks',
      'New pieces added every night',
      'Cancel anytime',
    ],
  },
  {
    id: 'living-art-lifetime',
    name: 'Living Art Screensaver — Lifetime',
    description: 'One payment, the whole ever-growing gallery forever',
    plan: 'lifetime',
    features: [
      'Unlock all artworks',
      'New pieces added every night',
      'One-time payment — no renewals, ever',
    ],
  },
]

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}
