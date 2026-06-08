import type { ReactNode } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

interface LegalPageProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

/**
 * Shared shell for the Privacy Policy and Terms of Service pages. Keeps both
 * legal pages visually consistent with the marketing site (same header/footer,
 * serif display headings, muted body copy). Child content is plain semantic
 * HTML (h2/h3/p/ul/a/strong) styled via arbitrary variant selectors below, so
 * the pages read like prose without pulling in the Tailwind typography plugin.
 */
export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 lg:pt-36 pb-20">
        <header className="mb-10">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground text-balance">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </header>
        <div
          className="text-muted-foreground leading-relaxed
            [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-12 [&_h2]:mb-4
            [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:mb-4
            [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ul]:mb-4
            [&_li]:marker:text-muted-foreground/50
            [&_strong]:text-foreground [&_strong]:font-semibold"
        >
          {children}
        </div>
      </article>
      <Footer />
    </main>
  )
}
