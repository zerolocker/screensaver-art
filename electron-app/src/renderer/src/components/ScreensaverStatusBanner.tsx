import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MonitorCheck, AlertTriangle, Play, Loader2, ExternalLink, Info } from 'lucide-react'
import { Button } from '@screensaver-art/ui'
import type { ScreensaverTiming } from '../../../preload'

// "System Settings ↗" opens the Lock Screen pane (display-off delay). The start
// delay is in a sheet with no stable URL, so the info popover explains the way.
export const LOCK_SCREEN_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.Lock-Screen-Settings.extension'

// Popover size, for placing it below the icon (or above, near the bottom edge).
const INFO_W = 300
const INFO_H = 156

export type TimingKind = 'healthy' | 'conflict' | 'never-start' | 'never-off' | 'unknown'

export interface TimingStatus {
  kind: TimingKind
  // 'warn' = the user probably won't see the screensaver; 'ok' = they will.
  tone: 'ok' | 'warn'
  // Rounded start delay in minutes for display (null = unknown; 0 = never).
  startMin: number | null
  displayOffMin: number | null
}

// If the display turns off at or before the screensaver starts, the user never
// sees it. Compared in seconds to avoid rounding errors.
export function screensaverTimingStatus(t: ScreensaverTiming | null): TimingStatus {
  const startSec = t?.screensaverStartSec ?? null
  const displayOffMin = t?.displayOffMin ?? null
  const startMin = startSec === null ? null : Math.round(startSec / 60)

  if (startSec === null) return { kind: 'unknown', tone: 'ok', startMin, displayOffMin }
  if (startSec === 0) return { kind: 'never-start', tone: 'warn', startMin, displayOffMin }
  if (displayOffMin === 0) return { kind: 'never-off', tone: 'ok', startMin, displayOffMin }
  if (displayOffMin !== null && displayOffMin * 60 <= startSec)
    return { kind: 'conflict', tone: 'warn', startMin, displayOffMin }
  return { kind: 'healthy', tone: 'ok', startMin, displayOffMin }
}

// A short title, then the timings. The component appends the settings link.
function describe(s: TimingStatus): { title: string; text: string } {
  switch (s.kind) {
    case 'conflict':
      return {
        title: 'You may never see your screensaver',
        text: `The display turns off after ${s.displayOffMin} min, but the screensaver only starts after ${s.startMin} — so the screen goes dark first.`,
      }
    case 'never-start':
      return {
        title: 'Your screensaver won’t start on its own',
        text: 'It’s currently set to never start when idle.',
      }
    case 'never-off':
      return {
        title: 'Living Art is your screensaver',
        text: `Starts after ${s.startMin} min idle. Your display never turns off, so you’ll always catch it.`,
      }
    case 'healthy':
      return {
        title: 'Living Art is your screensaver',
        text:
          s.displayOffMin !== null
            ? `Starts after ${s.startMin} min idle, while the display turns off after ${s.displayOffMin}.`
            : `Starts after ${s.startMin} min idle.`,
      }
    case 'unknown':
    default:
      return { title: 'Living Art is your screensaver', text: 'Your screensaver is set.' }
  }
}

interface ScreensaverStatusBannerProps {
  timing: ScreensaverTiming | null
  onPreview: () => void
  // A "Preview now" launch is in progress.
  previewing: boolean
  // Opens System Settings ▸ Lock Screen.
  onOpenSettings: () => void
}

// Shown once Living Art is the active screensaver: when it will appear (or a
// warning that the display sleeps first), a settings link, help, and
// "Preview now". Amber when the user likely won't see it, green when they will.
export function ScreensaverStatusBanner({
  timing,
  onPreview,
  previewing,
  onOpenSettings,
}: ScreensaverStatusBannerProps) {
  const status = screensaverTimingStatus(timing)
  const warn = status.tone === 'warn'
  const ring = warn ? 'border-amber-500/40' : 'border-emerald-500/40'
  const wash = warn ? 'from-amber-500/15 via-amber-500/5' : 'from-emerald-500/15 via-emerald-500/5'
  const chip = warn ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'
  const Icon = warn ? AlertTriangle : MonitorCheck
  const { title, text } = describe(status)

  // Shows on hover with no delay; portaled to <body> so nothing clips it.
  const [infoPos, setInfoPos] = useState<{ top: number; left: number } | null>(null)
  const showInfo = (e: React.SyntheticEvent<HTMLElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const flipAbove = r.bottom + 8 + INFO_H > window.innerHeight
    const left = Math.max(8, Math.min(r.right - INFO_W, window.innerWidth - 8 - INFO_W))
    setInfoPos({ top: flipAbove ? r.top - 8 - INFO_H : r.bottom + 8, left })
  }
  const hideInfo = (): void => setInfoPos(null)

  return (
    <div
      className={`rounded-xl border ${ring} bg-gradient-to-br ${wash} to-transparent p-5 mb-6 flex items-center gap-4`}
    >
      <div className={`p-2 rounded-full ${chip} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">
          {text} Can change in{' '}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Opens System Settings ▸ Lock Screen"
            className="underline underline-offset-2 hover:text-foreground inline-flex items-center gap-0.5 align-baseline cursor-pointer"
          >
            System Settings
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </button>{' '}
          <button
            type="button"
            aria-label="How to change these, and a note about the login screen"
            onMouseEnter={showInfo}
            onMouseLeave={hideInfo}
            onFocus={showInfo}
            onBlur={hideInfo}
            className="inline-flex align-[-2px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </p>
      </div>
      <Button onClick={onPreview} disabled={previewing} className="shrink-0">
        {previewing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting&hellip;
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" /> Preview now
          </>
        )}
      </Button>

      {infoPos &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: 'fixed', top: infoPos.top, left: infoPos.left, width: INFO_W }}
            className="z-50 pointer-events-none rounded-lg border border-border bg-popover text-popover-foreground shadow-xl px-3 py-2.5"
          >
            <InfoContent />
          </div>,
          document.body,
        )}
    </div>
  )
}

// How to change each delay, and the login-screen caveat.
function InfoContent(): ReactNode {
  return (
    <>
      <p className="text-xs font-medium text-popover-foreground">Change the timing in System Settings</p>
      <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
        <li>
          Open <span className="text-popover-foreground">Lock Screen</span> &rsaquo;
          &ldquo;Turn display off when inactive&rdquo;
        </li>
        <li>
          Open <span className="text-popover-foreground">Wallpaper</span> &rsaquo;
          &ldquo;Screen Saver&hellip;&rdquo; &rsaquo; &ldquo;Start Screen Saver&hellip;&rdquo;
        </li>
      </ul>
      <p className="mt-2 pt-2 border-t border-border text-[11px] leading-relaxed text-muted-foreground">
        Screensaver won&rsquo;t appear on the login screen &mdash; that&rsquo;s a separate screen that
        apps can&rsquo;t change.
      </p>
    </>
  )
}
