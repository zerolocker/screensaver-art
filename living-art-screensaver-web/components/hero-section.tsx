"use client"

import { Monitor } from "@/components/marketing/monitor"
import { DownloadCTA } from "@/components/marketing/download-cta"
import { PlatformInterest } from "@/components/marketing/platform-interest"
import { useIsMobileDevice } from "@/lib/device"
import { greenGlow } from "@/lib/brand"

export function HeroSection() {
  const isMobile = useIsMobileDevice()

  return (
    <section id="top" className="relative px-[30px] pt-[130px] pb-[92px]">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] items-center gap-[50px]">
        {/* Copy */}
        <div className="flex max-w-[560px] flex-col items-start gap-[21px] text-left">
          <h1
            className="m-0 font-serif font-extrabold leading-[1.02] tracking-[-0.015em] text-foreground"
            style={{ fontSize: "clamp(36px,3.9vw,62px)" }}
          >
            Turn your screensaver into a{" "}
            <span className="font-semibold italic text-primary">living gallery.</span>
          </h1>
          <p className="m-0 max-w-[540px] text-[18.5px] leading-[1.55] text-muted-foreground">
            Centuries of art, animated by AI and hung on your idle Mac. New pieces arrive every night.
          </p>
          <div className="mt-1.5 flex w-full flex-wrap items-center justify-start gap-x-[18px] gap-y-3">
            <DownloadCTA
              location="hero"
              iconClassName="h-4 w-4"
              className="inline-flex cursor-pointer items-center gap-[9px] rounded-full bg-primary px-[27px] py-[15px] text-[16.5px] font-semibold text-primary-foreground no-underline"
              style={{ boxShadow: `0 12px 34px -10px ${greenGlow(0.6)}` }}
            />
            <div className="flex flex-col items-start gap-[6px]">
              <div className="text-[13px]">
                <span className="font-semibold text-primary">Free forever.</span>{" "}
                <span className="text-muted-foreground-subtle">
                  {isMobile ? "macOS only — we'll email you a link." : "In-app purchase available."}
                </span>
              </div>
              <PlatformInterest
                location="hero"
                className="cursor-pointer text-left text-[13px] text-muted-foreground underline decoration-primary/50 underline-offset-4 transition-colors hover:decoration-primary"
              />
            </div>
          </div>
        </div>

        {/* Stage */}
        <div className="relative w-full">
          <Monitor stand priority interval={6000} />
        </div>
      </div>
    </section>
  )
}
