import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScreensaverSetBanner } from './ScreensaverSetBanner'

describe('<ScreensaverSetBanner />', () => {
  it('renders the prompt copy', () => {
    render(<ScreensaverSetBanner onSet={() => {}} setting={false} />)
    // Curly apostrophes render from &rsquo;, so match loosely.
    expect(screen.getByText(/your screensaver isn.t set to this app yet/i)).toBeInTheDocument()
  })

  it('shows the Set button when idle', () => {
    render(<ScreensaverSetBanner onSet={() => {}} setting={false} />)
    expect(screen.getByRole('button', { name: 'Set' })).toBeInTheDocument()
  })

  it('fires onSet when the button is clicked', () => {
    const onSet = vi.fn()
    render(<ScreensaverSetBanner onSet={onSet} setting={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set' }))
    expect(onSet).toHaveBeenCalledTimes(1)
  })

  it('shows a disabled "Setting…" state while activating', () => {
    render(<ScreensaverSetBanner onSet={() => {}} setting={true} />)
    const button = screen.getByRole('button', { name: /setting/i })
    expect(button).toBeDisabled()
  })
})
