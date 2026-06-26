"use client"

import posthog from "posthog-js"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export function CTASection() {
  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-30"
        >
          <source
            src="https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/starry_coast_animated.mp4"
            type="video/mp4"
          />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-balance">
          Ready to Transform Your Screen?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
          Join thousands of art lovers who have turned their idle displays into dynamic galleries. Start your journey today.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-6 text-lg font-medium gap-2"
            asChild
          >
            <a href="/download/mac" onClick={() => posthog.capture('download_clicked', { location: 'cta' })}>
              <Download className="w-5 h-5" />
              Download for Mac
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
