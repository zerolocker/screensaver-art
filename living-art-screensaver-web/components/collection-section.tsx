"use client"

import { AutoVideo } from "@/components/marketing/gallery-video"
import { carousel, poster } from "@/lib/gallery-showcase"

// Duplicated so the marquee track loops seamlessly (animation shifts by -50%).
const marqueeTiles = carousel.concat(carousel)

export function CollectionSection() {
  return (
    <section id="gallery" className="relative pt-[84px] pb-[92px]">
      <div className="mx-auto flex max-w-[1340px] flex-wrap items-end justify-between gap-[30px] px-[30px] pb-[44px]">
        <div className="max-w-[680px]">
          <div className="mb-[14px] font-mono text-[12px] font-medium uppercase tracking-[3px] text-[#9EE8A2]">
            The collection
          </div>
          <h2
            className="m-0 font-serif font-bold leading-[1.06] tracking-[-0.01em] text-[#f3f4f2]"
            style={{ fontSize: "clamp(30px,3.8vw,52px)" }}
          >
            A different masterpiece
            <br />
            every time your Mac rests.
          </h2>
        </div>
        <p className="m-0 max-w-[360px] text-[16px] leading-[1.55] text-[#9a9c96]">
          An ever-growing collection of animated works, looping in high resolution on any screen you sit in
          front of — with a new piece added every night.
        </p>
      </div>

      {/* Marquee */}
      <div
        className="lart-marquee relative w-full overflow-hidden"
        style={{
          WebkitMaskImage: "linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)",
          maskImage: "linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)",
        }}
      >
        <div className="lart-marquee-track flex w-max gap-[22px] px-[11px]">
          {marqueeTiles.map((t, i) => (
            <div key={`m${i}`} className="w-[336px] flex-none">
              <div
                className="relative w-full rounded-[14px] p-1.5"
                style={{
                  aspectRatio: "16 / 10",
                  background: "linear-gradient(180deg,#40444d,#2e313a 42%,#22252f)",
                  boxShadow:
                    "inset 0 1.5px 0 rgba(255,255,255,0.28), inset 1px 0 0 rgba(255,255,255,0.08), inset -1px 0 0 rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.10), 0 22px 40px -22px rgba(0,0,0,0.9)",
                }}
              >
                <div
                  className="h-full w-full rounded-[9px] p-[3px]"
                  style={{ background: "#080809", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.9)" }}
                >
                  <div
                    className="relative h-full w-full overflow-hidden rounded-[5px]"
                    style={{ background: poster(t) }}
                  >
                    <AutoVideo
                      src={t.src}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,0.5))" }}
                    />
                    <div className="absolute bottom-[10px] left-[11px] flex flex-col gap-px">
                      <span className="text-[13.5px] font-semibold tracking-[0.2px] text-white">{t.name}</span>
                      <span className="font-mono text-[11px] tracking-[0.5px] text-white/60">{t.style}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
