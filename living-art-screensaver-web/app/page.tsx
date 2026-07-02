import { Header } from "@/components/header"
import { EmailArrivalTracker } from "@/components/marketing/email-arrival-tracker"
import { HeroSection } from "@/components/hero-section"
import { CollectionSection } from "@/components/collection-section"
import { ArtStylesSection } from "@/components/art-styles-section"
import { PricingSection } from "@/components/pricing-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="relative w-full overflow-hidden bg-background text-foreground">
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
