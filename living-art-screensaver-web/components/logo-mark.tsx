import { logoSwirlPath } from "@/lib/logo-path"

/**
 * The logo mark, drawn in `currentColor` (see branding/README.md). Inside a tile
 * badge, set `size` to the badge's size: the viewBox includes the margin.
 */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path d={logoSwirlPath} fill="currentColor" />
    </svg>
  )
}
