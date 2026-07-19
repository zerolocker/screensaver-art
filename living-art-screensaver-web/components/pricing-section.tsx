"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { Loader2 } from "lucide-react"
import { PRICING } from "@screensaver-art/constants"
import { createClient } from "@/lib/supabase/client"
import { greenGlow } from "@/lib/brand"
import { createCheckoutSession } from "@/app/actions/stripe"
import { getProduct } from "@/lib/products"
import type { User } from "@supabase/supabase-js"

const monthlyFeatures = getProduct("living-art-monthly")?.features ?? []
const lifetimeFeatures = getProduct("living-art-lifetime")?.features ?? []

function FeatureList({ features }: { features: string[] }) {
  return (
    <div className="mb-[30px] flex flex-col gap-[13px]">
      {features.map((feature, index) => (
        <div key={index} className="flex items-center gap-3">
          <span
            className="flex h-[21px] w-[21px] flex-none items-center justify-center rounded-full"
            style={{ background: greenGlow(0.16) }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <span className="text-[15px] text-muted-foreground-strong">{feature}</span>
        </div>
      ))}
    </div>
  )
}

export function PricingSection() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<"living-art-monthly" | "living-art-lifetime" | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  async function handleCheckout(productId: "living-art-monthly" | "living-art-lifetime") {
    posthog.capture("subscribe_clicked", {
      location: "pricing_section",
      is_logged_in: !!user,
      plan: productId === "living-art-lifetime" ? "lifetime" : "monthly",
    })

    if (!user) {
      // Land back on the pricing section after login (there's no /pricing route,
      // only this #pricing anchor on the home page).
      router.push("/auth/login?redirect=/%23pricing")
      return
    }

    setLoading(productId)
    // Back out of Stripe → return here to the pricing section, not a dead /pricing.
    const result = await createCheckoutSession(productId, window.location.origin, "/#pricing")

    if (result.error) {
      alert(result.error)
      setLoading(null)
      return
    }

    if (result.url) {
      router.push(result.url)
    }
  }

  return (
    <section id="pricing" className="relative px-[30px] pt-[92px] pb-[96px]">
      <div className="mx-auto max-w-[1340px]">
        <div className="mx-auto mb-[48px] max-w-[680px] text-center">
          <div className="mb-[14px] font-mono text-[12px] font-medium uppercase tracking-[3px] text-primary">
            Pricing
          </div>
          <h2
            className="m-0 mb-[14px] font-serif font-bold leading-[1.05] tracking-[-0.01em] text-foreground"
            style={{ fontSize: "clamp(30px,4vw,54px)" }}
          >
            Start free. Upgrade when you&apos;re hooked.
          </h2>
          <p className="m-0 text-[17px] leading-[1.55] text-muted-foreground">
            One small payment unlocks the entire ever-growing collection — and a fresh piece every
            night.
          </p>
        </div>

        <div className="mx-auto grid max-w-[1000px] gap-[28px] md:grid-cols-2">
          {/* Monthly subscription — the flexible option. */}
          <div className="rounded-[24px] border border-white/[0.08] bg-secondary px-[38px] py-[40px]">
            <div className="mb-[28px] text-center">
              <span className="mb-[22px] inline-block rounded-full border border-white/[0.14] px-[14px] py-[5px] font-mono text-[11px] font-medium uppercase tracking-[2px] text-muted-foreground">
                Most flexible
              </span>
              <div className="flex items-end justify-center gap-2">
                <span className="mb-[9px] text-[24px] font-semibold text-muted-foreground-subtle line-through">{PRICING.regularPrice}</span>
                <span className="font-serif text-[60px] font-bold leading-none text-foreground">{PRICING.promoPrice}</span>
                <span className="mb-[9px] text-[16px] text-muted-foreground">{PRICING.interval}</span>
              </div>
              <p className="mt-[10px] font-mono text-[13px] tracking-[0.5px] text-muted-foreground-subtle">
                {PRICING.billingNote} · promo through {PRICING.promoThrough}
              </p>
            </div>

            <FeatureList features={monthlyFeatures} />

            <button
              onClick={() => handleCheckout("living-art-monthly")}
              disabled={loading !== null}
              className="flex w-full items-center justify-center rounded-full border border-white/[0.16] py-[14px] text-[16px] font-medium text-foreground disabled:opacity-70"
            >
              {loading === "living-art-monthly" ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading…
                </>
              ) : (
                "Subscribe"
              )}
            </button>
          </div>

          {/* Lifetime — one payment, featured. */}
          <div
            className="rounded-[24px] p-px"
            style={{ background: `linear-gradient(180deg,${greenGlow(0.55)},${greenGlow(0.12)})` }}
          >
            <div className="h-full rounded-[23px] bg-secondary px-[38px] py-[40px]">
              <div className="mb-[28px] text-center">
                <span className="mb-[22px] inline-block rounded-full bg-primary px-[14px] py-[5px] font-mono text-[11px] font-semibold uppercase tracking-[2px] text-primary-foreground">
                  Best value
                </span>
                <div className="flex items-end justify-center gap-2">
                  <span className="font-serif text-[60px] font-bold leading-none text-foreground">{PRICING.lifetimePrice}</span>
                  <span className="mb-[9px] text-[16px] text-muted-foreground">once</span>
                </div>
                <p className="mt-[10px] font-mono text-[13px] tracking-[0.5px] text-muted-foreground-subtle">
                  {PRICING.lifetimeLabel} · no subscription
                </p>
              </div>

              <FeatureList features={lifetimeFeatures} />

              <button
                onClick={() => handleCheckout("living-art-lifetime")}
                disabled={loading !== null}
                className="flex w-full items-center justify-center rounded-full bg-primary py-[14px] text-[16px] font-semibold text-primary-foreground disabled:opacity-70"
              >
                {loading === "living-art-lifetime" ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Buy once - own it forever"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
