"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { Download, Loader2 } from "lucide-react"
import { PRICING } from "@screensaver-art/constants"
import { createClient } from "@/lib/supabase/client"
import { createCheckoutSession } from "@/app/actions/stripe"
import { getProduct } from "@/lib/products"
import type { User } from "@supabase/supabase-js"

const features = getProduct("living-art-monthly")?.features ?? []

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
    posthog.capture("subscribe_clicked", { location: "pricing_section", is_logged_in: !!user })

    if (!user) {
      // Land back on the pricing section after login (there's no /pricing route,
      // only this #pricing anchor on the home page).
      router.push("/auth/login?redirect=/%23pricing")
      return
    }

    setLoading(true)
    // Back out of Stripe → return here to the pricing section, not a dead /pricing.
    const result = await createCheckoutSession("living-art-monthly", window.location.origin, "/#pricing")

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
    <section id="pricing" className="relative px-[30px] pt-[92px] pb-[96px]">
      <div className="mx-auto max-w-[1340px]">
        <div className="mx-auto mb-[48px] max-w-[680px] text-center">
          <div className="mb-[14px] font-mono text-[12px] font-medium uppercase tracking-[3px] text-[#9EE8A2]">
            Pricing
          </div>
          <h2
            className="m-0 mb-[14px] font-serif font-bold leading-[1.05] tracking-[-0.01em] text-foreground"
            style={{ fontSize: "clamp(30px,4vw,54px)" }}
          >
            Start free. Upgrade when you&apos;re hooked.
          </h2>
          <p className="m-0 text-[17px] leading-[1.55] text-muted-foreground">
            Download and watch your gallery come alive. Free forever. One small subscription unlocks the entire
            ever-growing collection — and a fresh piece every night.
          </p>
        </div>

        <div className="mx-auto max-w-[480px]">
          <div
            className="rounded-[24px] p-px"
            style={{ background: "linear-gradient(180deg,rgba(158,232,162,0.4),rgba(158,232,162,0))" }}
          >
            <div className="rounded-[23px] bg-secondary px-[38px] py-[40px]">
              <div className="mb-[28px] text-center">
                <div className="flex items-end justify-center gap-2">
                  <span className="mb-[9px] text-[24px] font-semibold text-muted-foreground-subtle line-through">{PRICING.regularPrice}</span>
                  <span className="font-serif text-[60px] font-bold leading-none text-foreground">{PRICING.promoPrice}</span>
                  <span className="mb-[9px] text-[16px] text-muted-foreground">{PRICING.interval}</span>
                </div>
                <p className="mt-[10px] font-mono text-[13px] tracking-[0.5px] text-muted-foreground-subtle">
                  {PRICING.billingNote} · promo through {PRICING.promoThrough}
                </p>
              </div>

              <div className="mb-[30px] flex flex-col gap-[13px]">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span
                      className="flex h-[21px] w-[21px] flex-none items-center justify-center rounded-full"
                      style={{ background: "rgba(158,232,162,0.16)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9EE8A2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    <span className="text-[15px] text-muted-foreground-strong">{feature}</span>
                  </div>
                ))}
              </div>

              <a
                href="/download/mac"
                onClick={() => posthog.capture("download_clicked", { location: "pricing_section" })}
                className="mb-[11px] flex w-full items-center justify-center gap-[9px] rounded-full bg-[#9EE8A2] py-[15px] text-[16.5px] font-semibold text-primary-foreground no-underline"
                style={{ boxShadow: "0 12px 30px -10px rgba(158,232,162,0.5)" }}
              >
                <Download className="h-4 w-4" strokeWidth={2.2} />
                Download for Mac
              </a>
              <button
                onClick={handleWebSubscribe}
                disabled={loading}
                className="flex w-full items-center justify-center rounded-full border border-white/[0.16] py-[14px] text-[16px] font-medium text-foreground disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Subscribe on the web"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
