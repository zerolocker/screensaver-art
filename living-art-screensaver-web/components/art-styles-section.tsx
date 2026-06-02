"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

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

const videos = [
  {
    src: "https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/starry_coast_animated.mp4",
    title: "Van Gogh Style",
    subtitle: "Starry Coast — AI Animated",
  },
  {
    src: "https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/romanticism_storm_animated.mp4",
    title: "Romanticism Style",
    subtitle: "Stormy Sea — AI Animated",
  },
  {
    src: "https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/neoclassicism_roman_forum_animated.mp4",
    title: "Neoclassicism Style",
    subtitle: "Roman Forum — AI Animated",
  },
  {
    src: "https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/gallery/surreal_clocks_animated.mp4",
    title: "Surrealism Style",
    subtitle: "Melting Clocks — AI Animated",
  },
]

const AUTOPLAY_INTERVAL = 6000

export function ArtStylesSection() {
  const [current, setCurrent] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goTo = useCallback((index: number) => {
    if (transitioning) return
    setTransitioning(true)
    setTimeout(() => {
      setCurrent(index)
      setTransitioning(false)
    }, 300)
  }, [transitioning])

  const next = useCallback(() => {
    goTo((current + 1) % videos.length)
  }, [current, goTo])

  const prev = useCallback(() => {
    goTo((current - 1 + videos.length) % videos.length)
  }, [current, goTo])

  // Restart the video when the slide changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load()
      videoRef.current.play().catch(() => {})
    }
  }, [current])

  // Autoplay timer — resets whenever user manually navigates
  useEffect(() => {
    timerRef.current = setTimeout(next, AUTOPLAY_INTERVAL)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, next])

  const video = videos[current]

  return (
    <section id="styles" className="py-24 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Video Carousel */}
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/5 group">
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${transitioning ? "opacity-0" : "opacity-100"}`}
            >
              <source src={video.src} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-card/50 to-transparent" />

            {/* Caption */}
            <div className="absolute bottom-4 left-4 right-16">
              <p className="text-sm text-foreground/80 font-medium">{video.title}</p>
              <p className="text-xs text-muted-foreground">{video.subtitle}</p>
            </div>

            {/* Prev / Next */}
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/60 backdrop-blur-sm border border-border/50 text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/80"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/60 backdrop-blur-sm border border-border/50 text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/80"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-4 right-4 flex gap-1.5">
              {videos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === current ? "bg-foreground w-4" : "bg-foreground/40"}`}
                />
              ))}
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
