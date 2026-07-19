import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpsellBanner } from './UpsellBanner'

describe('<UpsellBanner />', () => {
  it('renders the benefit-led copy with both offers', () => {
    render(<UpsellBanner onUnlock={() => {}} />)
    expect(screen.getByText('Unlock the full gallery')).toBeInTheDocument()
    expect(screen.getByText(/new pieces added every day/i)).toBeInTheDocument()
    // Both paid offers are named so the CTA click isn't a surprise.
    expect(screen.getByText(/\$0\.99\/month/)).toBeInTheDocument()
    expect(screen.getByText(/one payment of \$15\.99/i)).toBeInTheDocument()
  })

  it('quantifies the wall when lockedCount is known', () => {
    render(<UpsellBanner onUnlock={() => {}} lockedCount={123} />)
    expect(screen.getByText('Unlock 123 more artworks')).toBeInTheDocument()
  })

  it('shows the unlock button', () => {
    render(<UpsellBanner onUnlock={() => {}} />)
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument()
  })

  it('fires onUnlock when the button is clicked', () => {
    const onUnlock = vi.fn()
    render(<UpsellBanner onUnlock={onUnlock} />)
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })
})
