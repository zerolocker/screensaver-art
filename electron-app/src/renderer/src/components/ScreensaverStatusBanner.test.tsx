import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScreensaverStatusBanner, screensaverTimingStatus } from './ScreensaverStatusBanner'

const noop = () => {}
const baseProps = {
  onPreview: noop,
  previewing: false,
  onOpenSettings: noop,
}

describe('screensaverTimingStatus', () => {
  it('healthy: display turns off after the saver starts', () => {
    const s = screensaverTimingStatus({ screensaverStartSec: 1200, displayOffMin: 30 })
    expect(s).toMatchObject({ kind: 'healthy', tone: 'ok', startMin: 20, displayOffMin: 30 })
  })

  it('conflict: display turns off at or before the saver starts', () => {
    expect(screensaverTimingStatus({ screensaverStartSec: 1800, displayOffMin: 20 }).kind).toBe('conflict')
    // Equal thresholds also count as a conflict (saver never gets a chance).
    expect(screensaverTimingStatus({ screensaverStartSec: 1200, displayOffMin: 20 }).kind).toBe('conflict')
  })

  it('never-start: screensaver set to Never', () => {
    expect(screensaverTimingStatus({ screensaverStartSec: 0, displayOffMin: 30 })).toMatchObject({
      kind: 'never-start',
      tone: 'warn',
    })
  })

  it('never-off: display never sleeps → always visible', () => {
    expect(screensaverTimingStatus({ screensaverStartSec: 1200, displayOffMin: 0 })).toMatchObject({
      kind: 'never-off',
      tone: 'ok',
    })
  })

  it('healthy with unknown display-off still reads ok', () => {
    expect(screensaverTimingStatus({ screensaverStartSec: 1200, displayOffMin: null })).toMatchObject({
      kind: 'healthy',
      tone: 'ok',
    })
  })

  it('unknown when the start delay is unreadable', () => {
    expect(screensaverTimingStatus(null).kind).toBe('unknown')
    expect(screensaverTimingStatus({ screensaverStartSec: null, displayOffMin: 30 }).kind).toBe('unknown')
  })

  it('rounds the start delay to whole minutes', () => {
    expect(screensaverTimingStatus({ screensaverStartSec: 1230, displayOffMin: 60 }).startMin).toBe(21)
  })
})

describe('<ScreensaverStatusBanner />', () => {
  it('shows the title + live timings in the healthy state', () => {
    render(<ScreensaverStatusBanner {...baseProps} timing={{ screensaverStartSec: 1200, displayOffMin: 30 }} />)
    expect(screen.getByText(/living art is your screensaver/i)).toBeInTheDocument()
    expect(screen.getByText(/starts after 20 min idle/i)).toBeInTheDocument()
    // "min" is intentionally dropped from the second number to avoid wrapping.
    expect(screen.getByText(/display turns off after 30\b/i)).toBeInTheDocument()
    expect(screen.queryByText(/never see/i)).not.toBeInTheDocument()
  })

  it('warns (in the title) when the display sleeps before the saver starts', () => {
    render(<ScreensaverStatusBanner {...baseProps} timing={{ screensaverStartSec: 1800, displayOffMin: 20 }} />)
    expect(screen.getByText(/you may never see your screensaver/i)).toBeInTheDocument()
    expect(screen.getByText(/the screen goes dark first/i)).toBeInTheDocument()
  })

  it('opens System Settings (Lock Screen) from the inline link', () => {
    const onOpenSettings = vi.fn()
    render(
      <ScreensaverStatusBanner
        {...baseProps}
        timing={{ screensaverStartSec: 1200, displayOffMin: 30 }}
        onOpenSettings={onOpenSettings}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /system settings/i }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('reveals the navigation help + login-screen note from the info icon on hover', () => {
    render(<ScreensaverStatusBanner {...baseProps} timing={{ screensaverStartSec: 1200, displayOffMin: 30 }} />)
    // Hidden until hover — keeps the banner uncluttered.
    expect(screen.queryByText(/won.t appear on the login screen/i)).not.toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByRole('button', { name: /login screen/i }))
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent(/change the timing in system settings/i)
    expect(tip).toHaveTextContent(/start screen saver/i)
    expect(tip).toHaveTextContent(/screensaver won.t appear on the login screen/i)
  })

  it('fires onPreview from "Preview now"', () => {
    const onPreview = vi.fn()
    render(
      <ScreensaverStatusBanner
        {...baseProps}
        timing={{ screensaverStartSec: 1200, displayOffMin: 30 }}
        onPreview={onPreview}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /preview now/i }))
    expect(onPreview).toHaveBeenCalledTimes(1)
  })

  it('disables the preview button while a launch is in flight', () => {
    render(
      <ScreensaverStatusBanner
        {...baseProps}
        timing={{ screensaverStartSec: 1200, displayOffMin: 30 }}
        previewing={true}
      />,
    )
    expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled()
  })
})
