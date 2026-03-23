"use client"

import { Sparkles, Moon, Layers } from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "Dynamic Living Art",
    description: "Every artwork is fully animated and brought to life by AI. Unlike traditional slideshows, this gallery prioritizes movement and immersion.",
  },
  {
    icon: Moon,
    title: "Nightly Curation",
    description: "A background AI agent acts as your personal museum curator, commissioning new works and adding fresh pieces to your gallery every night.",
  },
  {
    icon: Layers,
    title: "Every Art Style",
    description: "From Renaissance masterpieces to Contemporary art, explore animated works across Classical, Baroque, Impressionism, Modern, and beyond.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 lg:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-balance">
            A Window Into Imagined Worlds
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Experience art like never before. Every piece moves, breathes, and evolves.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group relative p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
