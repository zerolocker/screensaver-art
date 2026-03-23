"use client"

const artStyles = [
  { name: "Classical", era: "Ancient Greece & Rome" },
  { name: "Medieval", era: "5th - 15th Century" },
  { name: "Renaissance", era: "14th - 17th Century" },
  { name: "Baroque", era: "17th - 18th Century" },
  { name: "Rococo", era: "18th Century" },
  { name: "Neoclassicism", era: "18th - 19th Century" },
  { name: "Romanticism", era: "18th - 19th Century" },
  { name: "Impressionism", era: "19th Century" },
  { name: "Post-Impressionism", era: "Late 19th Century" },
  { name: "Modern Art", era: "Late 19th - Mid 20th Century" },
  { name: "Contemporary", era: "1970s - Present" },
  { name: "Digital Art", era: "21st Century" },
]

export function ArtStylesSection() {
  return (
    <section id="styles" className="py-24 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Video Preview */}
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/5">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            >
              <source
                src="https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/starry_coast_animated.mp4"
                type="video/mp4"
              />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-card/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-sm text-foreground/80 font-medium">Van Gogh Style</p>
              <p className="text-xs text-muted-foreground">Starry Coast — AI Animated</p>
            </div>
          </div>

          {/* Content */}
          <div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-balance">
              Every Art Movement, Animated
            </h2>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
              From the grandeur of Classical antiquity to the bold expressions of Contemporary art. Our AI brings centuries of artistic heritage to life on your screen.
            </p>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {artStyles.map((style, index) => (
                <div 
                  key={index}
                  className="group px-4 py-3 rounded-xl bg-background/50 border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 cursor-default"
                >
                  <p className="font-medium text-foreground text-sm">{style.name}</p>
                  <p className="text-xs text-muted-foreground">{style.era}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
