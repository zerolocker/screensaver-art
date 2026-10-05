'use client'

import { forwardRef, useCallback, useEffect, useRef, useState, type VideoHTMLAttributes } from 'react'
import { PORTRAIT_WALL, isPortraitVideo } from '@screensaver-art/constants'

const HAVE_METADATA = 1
const HAVE_CURRENT_DATA = 2

/**
 * A `<video>` for a gallery piece. A portrait (9:16) clip hangs whole, centred
 * on the dark wall, instead of being cropped by the frame's `object-fit: cover`.
 * A landscape clip gets nothing extra and plays exactly like a plain `<video>`.
 *
 * gallery.json has no aspect field, so the clip's own metadata decides. A
 * portrait clip stays hidden until its first frame decodes, so whatever sits
 * underneath (the piece's still) shows meanwhile, never a cropped poster or a
 * bare wall. The frame keeps its size either way: no layout shift.
 */
export const ArtVideo = forwardRef<HTMLVideoElement, VideoHTMLAttributes<HTMLVideoElement>>(function ArtVideo(
  { src, style, onLoadedMetadata, onLoadedData, ...rest },
  ref,
) {
  const el = useRef<HTMLVideoElement | null>(null)
  const [fit, setFit] = useState({ src, portrait: false, framed: false })

  const read = useCallback(() => {
    const v = el.current
    if (!v) return
    const portrait = v.readyState >= HAVE_METADATA && isPortraitVideo(v.videoWidth, v.videoHeight)
    const framed = v.readyState >= HAVE_CURRENT_DATA
    setFit((f) => (f.src === src && f.portrait === portrait && f.framed === framed ? f : { src, portrait, framed }))
  }, [src])

  // An eager clip on a warm cache can load before hydration attaches the
  // handlers below, so also read the element whenever it gets a new src.
  useEffect(read, [read])

  const setRef = useCallback(
    (node: HTMLVideoElement | null) => {
      el.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  // A new src counts as landscape until its own metadata says otherwise.
  const portrait = fit.src === src && fit.portrait
  return (
    <video
      {...rest}
      ref={setRef}
      src={src}
      style={
        portrait
          ? {
              ...style,
              objectFit: 'contain',
              backgroundColor: PORTRAIT_WALL,
              visibility: fit.framed ? style?.visibility : 'hidden',
            }
          : style
      }
      onLoadedMetadata={(e) => {
        read()
        onLoadedMetadata?.(e)
      }}
      onLoadedData={(e) => {
        read()
        onLoadedData?.(e)
      }}
    />
  )
})
