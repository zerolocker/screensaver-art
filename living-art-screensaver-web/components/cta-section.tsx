"use client"

import { Monitor } from "@/components/marketing/monitor"
import { DownloadCTA } from "@/components/marketing/download-cta"
import { PlatformInterest } from "@/components/marketing/platform-interest"

export function CTASection() {
  return (
    <section id="get" className="relative px-[30px] pt-[120px] pb-[124px] text-center">
      <div className="relative z-[2] mx-auto max-w-[760px]">
        <h2
          className="m-0 mb-[18px] font-serif font-extrabold leading-[1.04] tracking-[-0.015em] text-foreground"
          style={{ fontSize: "clamp(34px,5vw,68px)" }}
        >
          Your Mac is about to get a&nbsp;lot more beautiful.
        </h2>
        <p className="m-0 mb-[30px] text-[19px] leading-[1.5] text-muted-foreground-strong">
          Download Living Art and let the gallery open the next time you step away.
        </p>
        <div className="flex flex-wrap justify-center gap-[14px]">
          <DownloadCTA
            location="cta"
            iconClassName="h-[17px] w-[17px]"
            className="inline-flex cursor-pointer items-center gap-[9px] rounded-full bg-primary px-[30px] py-[16px] text-[17px] font-semibold text-primary-foreground no-underline"
            style={{ boxShadow: "0 14px 40px -10px rgba(158,232,162,0.6)" }}
          />
        </div>
        <div className="mt-[20px] text-[13px]">
          <span className="font-semibold text-primary">Free forever.</span>{" "}
          <span className="text-muted-foreground-subtle">In-app purchase available.</span>
        </div>
        <PlatformInterest
          location="cta"
          className="mt-[10px] inline-block cursor-pointer text-[13px] text-muted-foreground-subtle underline-offset-4 transition-colors hover:text-muted-foreground hover:underline"
        />
      </div>
      <div className="relative z-[2] mx-auto mt-[60px] max-w-[760px]">
        <Monitor stand={false} interval={5600} />
      </div>
    </section>
  )
}
