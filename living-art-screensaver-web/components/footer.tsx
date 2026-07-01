import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-transparent px-[30px] pt-[60px] pb-[40px]">
      <div className="mx-auto grid max-w-[1340px] grid-cols-1 gap-[40px] md:grid-cols-[2fr_1fr_1fr]">
        {/* Brand */}
        <div>
          <div className="mb-[16px] flex items-center gap-[11px]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#9EE8A2]">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#08130c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </span>
            <span className="text-[16px] font-semibold text-[#f3f4f2]">Living Art Screensaver</span>
          </div>
          <p className="m-0 max-w-[320px] text-[14.5px] leading-[1.6] text-[#9a9c96]">
            Turn your idle display into a living art gallery.
          </p>
        </div>

        <div>
          <h4 className="m-0 mb-[16px] font-mono text-[13px] uppercase tracking-[1.5px] text-[#73756e]">Product</h4>
          <div className="flex flex-col gap-[11px]">
            <Link href="#gallery" className="text-[14.5px] text-[#9a9c96] no-underline transition-colors hover:text-[#f3f4f2]">Gallery</Link>
            <Link href="#styles" className="text-[14.5px] text-[#9a9c96] no-underline transition-colors hover:text-[#f3f4f2]">Art Styles</Link>
            <Link href="#pricing" className="text-[14.5px] text-[#9a9c96] no-underline transition-colors hover:text-[#f3f4f2]">Pricing</Link>
          </div>
        </div>

        <div>
          <h4 className="m-0 mb-[16px] font-mono text-[13px] uppercase tracking-[1.5px] text-[#73756e]">Legal</h4>
          <div className="flex flex-col gap-[11px]">
            <Link href="/privacy" className="text-[14.5px] text-[#9a9c96] no-underline transition-colors hover:text-[#f3f4f2]">Privacy Policy</Link>
            <Link href="/terms" className="text-[14.5px] text-[#9a9c96] no-underline transition-colors hover:text-[#f3f4f2]">Terms of Service</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-[36px] flex max-w-[1340px] flex-wrap justify-between gap-4 border-t border-white/[0.06] pt-[24px]">
        <span className="text-[13px] text-[#6a6c66]">© {new Date().getFullYear()} Living Art Screensaver. All rights reserved.</span>
        <span className="text-[13px] text-[#6a6c66]">Made by an art lover, for art lovers.</span>
      </div>
    </footer>
  )
}
