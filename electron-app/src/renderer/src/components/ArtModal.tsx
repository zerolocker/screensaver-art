import { useEffect, useRef, useState } from 'react'
import { X, Check, Lock, Loader2, AlertCircle } from 'lucide-react'
import { type ArtItem, isRealArtwork, tagsOf } from '@screensaver-art/constants'
import { ArtVideo } from '@screensaver-art/ui'

interface ArtModalProps {
  item: ArtItem
  selected: boolean
  // Locked: the add button becomes "Unlock", which opens the plan picker.
  locked: boolean
  onToggle: () => void
  onSubscribe: () => void
  onClose: () => void
  // Use native fullscreen while open ("Fullscreen" mode), rather than just the window ("In-app").
  osFullscreen?: boolean
}

function formatDate(date?: string): string | null {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

// A real artwork's credit, e.g. "Original by Gustave Caillebotte, 1877 · Art
// Institute of Chicago · Public domain · Motion by AI". Null for AI pieces.
// "Original" rather than "Painting", since prints and drawings qualify too.
function artworkCredit(item: ArtItem): string | null {
  if (!isRealArtwork(item) || !item.artist) return null
  return [
    `Original by ${[item.artist, item.original_date].filter(Boolean).join(', ')}`,
    item.museum,
    item.license === 'CC0' ? 'CC0' : 'Public domain',
    'Motion by AI',
  ]
    .filter(Boolean)
    .join(' · ')
}

// How far the clip has got: not playing yet, playing, stalled mid-play, or failed.
type ClipState = 'loading' | 'playing' | 'buffering' | 'failed'

// Wait this long before showing the loading cue, so a cached clip doesn't flash it.
const CUE_DELAY_MS = 400

// A full-screen preview of one piece, filling the view like the screensaver
// does. A portrait (9:16) piece is shown whole on the dark wall (ArtVideo).
// A clip is 10–20 MB, so until it plays the piece's still shows with a loading
// cue, and the clip fades in over it. Clicking anywhere but the action button
// or "Try again", Escape, or close dismisses it.
export function ArtModal({
  item,
  selected,
  locked,
  onToggle,
  onSubscribe,
  onClose,
  osFullscreen,
}: ArtModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Keyed by src, so a new piece starts from 'loading'.
  const [clip, setClip] = useState<{ src: string; state: ClipState }>({ src: item.src, state: 'loading' })
  const state: ClipState = clip.src === item.src ? clip.state : 'loading'
  const setState = (next: ClipState): void => setClip({ src: item.src, state: next })
  // Bumped by "Try again" to remount the <video> and fetch the clip afresh.
  const [attempt, setAttempt] = useState(0)

  // How much of the clip has downloaded, for the cue. A clip starts playing at
  // about 100% on a slow link, so this is the wait, not a guess.
  const clipKey = `${item.src}#${attempt}`
  const [progress, setProgress] = useState<{ key: string; pct: number } | null>(null)
  const pct = progress?.key === clipKey ? progress.pct : 0
  const readProgress = (e: React.SyntheticEvent<HTMLVideoElement>): void => {
    const v = e.currentTarget
    if (!Number.isFinite(v.duration) || v.duration <= 0 || v.buffered.length === 0) return
    // Never 100% while still loading.
    const next = Math.min(99, Math.round((v.buffered.end(0) / v.duration) * 100))
    setProgress({ key: clipKey, pct: next })
  }

  // The cue shows only once loading has taken a moment.
  const busy = state === 'loading' || state === 'buffering'
  const [cueDue, setCueDue] = useState(false)
  useEffect(() => {
    setCueDue(false)
    if (!busy) return
    const timer = window.setTimeout(() => setCueDue(true), CUE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [busy, item.src, attempt])

  const retry = (): void => {
    const v = videoRef.current
    if (v) {
      v.removeAttribute('src')
      v.load()
    }
    setState('loading')
    setAttempt((a) => a + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Release the video only on unmount. Keep this separate from the keydown
  // effect: onClose changes on every parent render, and a shared cleanup would
  // strip the <video> src mid-preview, leaving a black frame.
  useEffect(() => {
    return () => {
      const v = videoRef.current
      if (v) {
        v.removeAttribute('src')
        v.load()
      }
    }
  }, [])

  // Fullscreen while open, windowed again on close. Nothing in "In-app" mode.
  useEffect(() => {
    if (!osFullscreen) return
    window.electronAPI?.window?.setFullScreen(true)
    return () => {
      window.electronAPI?.window?.setFullScreen(false)
    }
  }, [osFullscreen])

  const dateStr = formatDate(item.date)
  const meta = [tagsOf(item).join(' · '), dateStr ? `Added ${dateStr}` : null]
    .filter(Boolean)
    .join('  ·  ')
  const credit = artworkCredit(item)

  return (
    <div
      className="fixed inset-0 z-50 bg-black animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      {/* The still, under the clip until it plays. A portrait piece's still
          already shows it whole on the dark wall. */}
      {item.thumb && (
        <img
          src={item.thumb}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <ArtVideo
        key={attempt}
        ref={videoRef}
        src={item.src}
        autoPlay
        loop
        muted
        playsInline
        onPlaying={() => setState('playing')}
        onWaiting={() => {
          if (state === 'playing') setState('buffering')
        }}
        onError={() => setState('failed')}
        onProgress={readProgress}
        style={{
          opacity: state === 'playing' || state === 'buffering' ? 1 : 0,
          transition: 'opacity 400ms ease-out',
        }}
        className="absolute inset-0 w-full h-full object-cover bg-black"
      />

      {/* Loading cue: the still alone could pass for the piece itself. */}
      {busy && cueDue && (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/60 px-4 py-2.5 text-sm text-white/90 tabular-nums shadow-lg backdrop-blur-md animate-[fadeIn_200ms_ease-out]"
        >
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {state === 'buffering'
            ? 'Buffering…'
            : `Loading the animation…${pct > 0 ? ` ${pct}%` : ''}`}
        </div>
      )}
      {state === 'failed' && (
        <div
          role="alert"
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-3 rounded-full border border-white/15 bg-black/60 py-1.5 pl-4 pr-1.5 text-sm text-white/90 shadow-lg backdrop-blur-md"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          Couldn’t load the animation
          <button
            onClick={(e) => {
              e.stopPropagation()
              retry()
            }}
            className="rounded-full bg-white/15 px-3 py-1 text-white transition-colors hover:bg-white/25"
          >
            Try again
          </button>
        </div>
      )}

      {/* Top-right, clear of the traffic lights. */}
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 z-10 rounded-full p-2 text-white/90 bg-black/40 hover:bg-black/60 border border-white/15 backdrop-blur-sm transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Title and action over a gradient, legible on any frame. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-4 p-6 pt-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{item.title}</h3>
          {credit && <p className="text-sm text-white/85 mt-1">{credit}</p>}
          {meta && <p className="text-sm text-white/70 mt-1">{meta}</p>}
        </div>
        {locked && !selected ? (
          <button
            onClick={(e) => {
              // The only element that doesn't dismiss the preview.
              e.stopPropagation()
              onSubscribe()
            }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground transition-colors hover:brightness-105"
          >
            <Lock className="w-4 h-4" /> Unlock
          </button>
        ) : (
          <button
            onClick={(e) => {
              // The only element that toggles instead of dismissing.
              e.stopPropagation()
              onToggle()
            }}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              selected
                ? 'bg-white/10 text-white border border-white/25 backdrop-blur-sm hover:bg-white/20'
                : 'bg-primary text-primary-foreground hover:brightness-105'
            }`}
          >
            {selected ? (
              // Locked but selected (subscription lapsed): only removal is offered.
              locked ? (
                <>
                  <Lock className="w-4 h-4" /> Locked — remove
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> In your screensaver
                </>
              )
            ) : (
              'Add to screensaver'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
