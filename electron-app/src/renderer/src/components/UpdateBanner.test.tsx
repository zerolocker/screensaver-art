import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpdateBanner } from './UpdateBanner'

describe('<UpdateBanner />', () => {
  it('names the version that is ready', () => {
    render(<UpdateBanner version="1.2.3" onRelaunch={() => {}} relaunching={false} />)
    expect(screen.getByText(/version 1\.2\.3 is ready to install/i)).toBeInTheDocument()
  })

  it('falls back to generic copy when the version is unknown', () => {
    render(<UpdateBanner onRelaunch={() => {}} relaunching={false} />)
    expect(screen.getByText(/a new version is ready to install/i)).toBeInTheDocument()
  })

  it('fires onRelaunch when the button is clicked', () => {
    const onRelaunch = vi.fn()
    render(<UpdateBanner version="1.2.3" onRelaunch={onRelaunch} relaunching={false} />)
    fireEvent.click(screen.getByRole('button', { name: /relaunch to update/i }))
    expect(onRelaunch).toHaveBeenCalledTimes(1)
  })

  it('shows a disabled "Relaunching…" state while in flight', () => {
    render(<UpdateBanner version="1.2.3" onRelaunch={() => {}} relaunching={true} />)
    const button = screen.getByRole('button', { name: /relaunching/i })
    expect(button).toBeDisabled()
  })
})
