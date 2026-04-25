import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpsellBanner } from './UpsellBanner'

describe('<UpsellBanner />', () => {
  it('renders the new copy (no $0.99 mention)', () => {
    render(<UpsellBanner onSubscribe={() => {}} />)
    expect(screen.getByText("You're watching the free preview")).toBeInTheDocument()
    // Body should match the deliberate copy change
    expect(screen.getByText(/Subscribe to unlock the full gallery/)).toBeInTheDocument()
    // Make sure we didn't accidentally reintroduce the old price-mention copy
    expect(screen.queryByText(/\$0\.99/)).toBeNull()
  })

  it('shows the artwork count when totalCount is provided', () => {
    render(<UpsellBanner totalCount={123} onSubscribe={() => {}} />)
    expect(screen.getByText(/all 123 living artworks/i)).toBeInTheDocument()
  })

  it('omits the count gracefully when totalCount is missing', () => {
    render(<UpsellBanner onSubscribe={() => {}} />)
    expect(screen.queryByText(/living artworks/i)).toBeNull()
  })

  it('fires onSubscribe when the button is clicked', () => {
    const onSubscribe = vi.fn()
    render(<UpsellBanner onSubscribe={onSubscribe} />)
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    expect(onSubscribe).toHaveBeenCalledTimes(1)
  })
})
