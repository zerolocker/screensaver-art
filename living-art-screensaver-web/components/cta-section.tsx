"use client"

import posthog from "posthog-js"
import { Download } from "lucide-react"
import { Monitor } from "@/components/marketing/monitor"

export function CTASection() {
  return (
    <section id="get" className="relative px-[30px] pt-[120px] pb-[124px] text-center">
      <div className="relative z-[2] mx-auto max-w-[760px]">
        <h2
          className="m-0 mb-[18px] font-serif font-extrabold leading-[1.04] tracking-[-0.015em] text-[#f3f4f2]"
          style={{ fontSize: "clamp(34px,5vw,68px)" }}
        >
          Your Mac is about to get a&nbsp;lot more beautiful.
        </h2>
        <p className="m-0 mb-[30px] text-[19px] leading-[1.5] text-[#c3c5bf]">
          Download Living Art and let the gallery open the next time you step away.
        </p>
        <div className="flex flex-wrap justify-center gap-[14px]">
          <a
            href="/download/mac"
            onClick={() => posthog.capture("download_clicked", { location: "cta" })}
            className="inline-flex items-center gap-[9px] rounded-full bg-[#9EE8A2] px-[30px] py-[16px] text-[17px] font-semibold text-[#08130c] no-underline"
            style={{ boxShadow: "0 14px 40px -10px rgba(158,232,162,0.6)" }}
          >
            <Download className="h-[17px] w-[17px]" strokeWidth={2.2} />
            Download for Mac
          </a>
        </div>
        <div className="mt-[20px] font-mono text-[11.5px] tracking-[1.5px] text-[#6a6c66]">
          FREE FOREVER · IN-APP PURCHASE AVAILABLE
        </div>
      </div>
      <div className="relative z-[2] mx-auto mt-[60px] max-w-[760px]">
        <Monitor stand={false} interval={5600} />
      </div>
    </section>
  )
}
