'use client'

import { useEffect, useState } from 'react'

type UAData = { mobile?: boolean }

/**
 * True for phones and tablets (iOS, iPadOS, Android) — the devices that can't
 * run the macOS app, so their "Download" CTA should email a link instead.
 *
 * Deliberately device-based, not viewport-width-based: a Mac in a narrow window
 * must still download directly, and an iPad (which reports a desktop
 * "Macintosh" UA since iPadOS 13) must still be treated as mobile.
 */
export function detectMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  // iPadOS 13+ masquerades as desktop Safari ("Macintosh"); tell it apart by its
  // real touchscreen. (maxTouchPoints, not 'ontouchend' — desktop Chrome reports
  // ontouchend even with no touchscreen, which would misflag a Mac as mobile.)
  const iPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
  const uaMobile = (navigator as Navigator & { userAgentData?: UAData }).userAgentData?.mobile
  if (uaMobile) return true
  return iPadOS || /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(ua)
}

/** True only for a macOS *desktop* (excludes iPadOS-pretending-to-be-Mac). */
export function detectIsMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isMacUA = /Macintosh|Mac OS X/.test(ua)
  const iPadOS = isMacUA && (navigator.maxTouchPoints ?? 0) > 1
  return isMacUA && !iPadOS
}

/**
 * Device-based mobile check for components. Returns `undefined` until mounted so
 * SSR/first client render stay identical (no hydration mismatch); callers should
 * treat `undefined` as "assume desktop" until it resolves.
 */
export function useIsMobileDevice(): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    setIsMobile(detectMobileDevice())
  }, [])
  return isMobile
}
