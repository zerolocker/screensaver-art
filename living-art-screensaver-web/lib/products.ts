export interface Product {
  id: string
  name: string
  description: string
  priceInCents: number
  interval: 'month' | 'year'
  features: string[]
}

// This is the source of truth for all products.
// All UI to display products should pull from this array.
export const PRODUCTS: Product[] = [
  {
    id: 'living-art-monthly',
    name: 'Living Art Screensaver',
    description: 'Transform your Mac into a living art gallery',
    priceInCents: 99, // $0.99/month
    interval: 'month',
    features: [
      'Unlimited animated artworks',
      'Nightly AI curation',
      'All art styles included',
      'High-resolution displays',
      'New artwork every day',
    ],
  },
]

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}
