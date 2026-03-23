"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check, Download, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { createCheckoutSession } from "@/app/actions/stripe"
import type { User } from "@supabase/supabase-js"

const features = [
  "Unlimited animated artworks",
  "Nightly AI curation",
  "All art styles included",
  "High-resolution display",
  "Seamless macOS integration",
  "Regular new additions",
  "Cancel anytime",
]

export function PricingSection() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  async function handleWebSubscribe() {
    if (!user) {
      router.push('/auth/login?redirect=/pricing')
      return
    }

    setLoading(true)
    const result = await createCheckoutSession('living-art-monthly', window.location.origin)

    if (result.error) {
      alert(result.error)
      setLoading(false)
      return
    }

    if (result.url) {
      router.push(result.url)
    }
  }

  return (
    <section id="pricing" className="py-24 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-balance">
            Simple, Affordable Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Transform your Mac into a living art gallery for less than a cup of coffee per month.
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          <div className="relative rounded-3xl bg-linear-to-b from-primary/20 to-transparent p-px">
            <div className="rounded-3xl bg-card p-8 lg:p-12">
              <div className="text-center mb-8">
                <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                  Full Access
                </span>
                <div className="flex items-end justify-center gap-1">
                  <span className="text-5xl lg:text-6xl font-bold text-foreground">$0.99</span>
                  <span className="text-muted-foreground mb-2">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Billed monthly
                </p>
              </div>

              <ul className="space-y-4 mb-8">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full py-6 text-lg font-medium gap-2"
                  asChild
                >
                  <a href="/download">
                    <Download className="w-5 h-5" />
                    Download for Mac
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full rounded-full py-6 text-lg border-foreground/20"
                  onClick={handleWebSubscribe}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Subscribe on Web'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
