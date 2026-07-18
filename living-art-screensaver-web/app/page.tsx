import { PRICING } from "@screensaver-art/constants"
import { Header } from "@/components/header"
import { EmailArrivalTracker } from "@/components/marketing/email-arrival-tracker"
import { HeroSection } from "@/components/hero-section"
import { CollectionSection } from "@/components/collection-section"
import { ArtStylesSection } from "@/components/art-styles-section"
import { PricingSection } from "@/components/pricing-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

// Machine-readable "this is a Mac app" signal for search engines. Prices are
// sourced from PRICING so the schema can't drift from the advertised offer.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Living Art Screensaver",
  operatingSystem: "macOS",
  applicationCategory: "DesktopEnhancementApplication",
  description:
    "A Mac screensaver that turns your idle display into a living art gallery of AI-animated artworks, with new pieces added regularly.",
  url: "https://living-art-screensaver.com",
  downloadUrl: "https://living-art-screensaver.com/download/mac",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description: `Free forever with ${PRICING.freeItemCount} artworks.`,
    },
    {
      "@type": "Offer",
      name: "Subscription",
      price: PRICING.promoPrice.replace("$", ""),
      priceCurrency: "USD",
      description: `Full gallery access, ${PRICING.promoPrice}${PRICING.interval} (${PRICING.billingNote.toLowerCase()}).`,
    },
  ],
}

export default function Home() {
  return (
    <main className="relative w-full overflow-hidden bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EmailArrivalTracker />
      <Header />
      <HeroSection />
      <CollectionSection />
      <ArtStylesSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  )
}
