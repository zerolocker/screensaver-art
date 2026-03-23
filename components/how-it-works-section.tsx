"use client"

import { Wand2, ImageIcon, Play } from "lucide-react"

const steps = [
  {
    icon: Wand2,
    step: "01",
    title: "AI Curates",
    description: "Every night, our AI curator selects art styles and commissions new pieces for your gallery.",
  },
  {
    icon: ImageIcon,
    step: "02",
    title: "Art Generates",
    description: "High-resolution artworks are created using cutting-edge generative AI technology.",
  },
  {
    icon: Play,
    step: "03",
    title: "Motion Brings Life",
    description: "Static artworks are transformed into mesmerizing animated scenes that move and breathe.",
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-balance">
            Your Gallery Grows Every Night
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            While you sleep, your AI curator is hard at work expanding your art collection.
          </p>
        </div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent -translate-y-1/2" />
          
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <div 
                key={index}
                className="relative text-center"
              >
                <div className="relative z-10 w-20 h-20 rounded-2xl bg-card border border-border mx-auto mb-6 flex items-center justify-center">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                  {step.step}
                </span>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
