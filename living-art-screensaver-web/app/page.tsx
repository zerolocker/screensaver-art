import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { CollectionSection } from "@/components/collection-section"
import { ArtStylesSection } from "@/components/art-styles-section"
import { PricingSection } from "@/components/pricing-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="relative w-full overflow-hidden bg-[#0a0a0b] text-[#f3f4f2]">
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
