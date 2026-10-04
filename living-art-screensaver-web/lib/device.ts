'use client'

import { useEffect, useState } from 'react'

type UAData = { mobile?: boolean }

/**
 * True for phones and tablets, which get "email me the link" instead of a
 * download. Based on the device, not the window width, so a narrow Mac window
 * still downloads.
 */
export function detectMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  // iPads report a "Macintosh" UA; detect the touchscreen. (Not 'ontouchend',
  // which desktop Chrome reports too.)
  const iPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
  const uaMobile = (navigator as Navigator & { userAgentData?: UAData }).userAgentData?.mobile
  if (uaMobile) return true
  return iPadOS || /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(ua)
}

/** True only for a Mac, not an iPad. */
export function detectIsMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isMacUA = /Macintosh|Mac OS X/.test(ua)
  const iPadOS = isMacUA && (navigator.maxTouchPoints ?? 0) > 1
  return isMacUA && !iPadOS
}

/** `undefined` until mounted, to avoid a hydration mismatch; treat it as desktop. */
export function useIsMobileDevice(): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    setIsMobile(detectMobileDevice())
  }, [])
  return isMobile
}
