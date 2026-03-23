import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { ArtStylesSection } from "@/components/art-styles-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { PricingSection } from "@/components/pricing-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <ArtStylesSection />
      <HowItWorksSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  )
}
